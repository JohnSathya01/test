const EventEmitter = require('events');

const JobStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// Valid state transitions
const VALID_TRANSITIONS = {
  [JobStatus.QUEUED]: [JobStatus.RUNNING, JobStatus.CANCELLED],
  [JobStatus.RUNNING]: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED],
  [JobStatus.COMPLETED]: [],
  [JobStatus.FAILED]: [JobStatus.QUEUED], // retry: failed -> queued
  [JobStatus.CANCELLED]: [],
};

class Job {
  constructor(id, taskFn, options = {}) {
    this.id = id;
    this.status = JobStatus.QUEUED;
    this.result = null;
    this.error = null;
    this.createdAt = new Date();
    this.startedAt = null;
    this.completedAt = null;
    this.retryCount = 0;
    this.maxRetries = options.maxRetries || 0;
    this.taskFn = taskFn;
    this.logs = [];
  }

  addLog(message) {
    this.logs.push({
      timestamp: new Date(),
      message,
    });
  }

  canTransitionTo(newStatus) {
    const allowed = VALID_TRANSITIONS[this.status] || [];
    return allowed.includes(newStatus);
  }

  transitionTo(newStatus) {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`Invalid state transition from ${this.status} to ${newStatus} for job ${this.id}`);
    }
    this.status = newStatus;
  }
}

class JobQueueManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.jobs = new Map();
    this.queue = [];
    this.workerCount = options.workerCount || 4;
    this.maxRetries = options.maxRetries || 0;
    this.retryBackoffMs = options.retryBackoffMs || 100;
    this.workers = [];
    this.isRunning = false;
    this.jobIdCounter = 0;
    this.processingLock = false;
  }

  /**
   * Submit a job into the queue.
   * @param {Function} taskFn - The task function to execute.
   * @param {Object} options - Job options (maxRetries, etc.)
   * @returns {string} The job ID.
   */
  submitJob(taskFn, options = {}) {
    const id = `job-${++this.jobIdCounter}`;
    const job = new Job(id, taskFn, {
      maxRetries: options.maxRetries !== undefined ? options.maxRetries : this.maxRetries,
    });
    job.addLog(`Job ${id} created and queued.`);
    this.jobs.set(id, job);
    this.queue.push(id);
    this.emit('job:queued', job);
    return id;
  }

  /**
   * Get the status of a job.
   * @param {string} jobId
   * @returns {Object} Job status info.
   */
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Invalid Job ID: ${jobId}`);
    }
    return {
      id: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      retryCount: job.retryCount,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      logs: job.logs,
    };
  }

  /**
   * Cancel a job.
   * @param {string} jobId
   * @returns {Object} Updated job status.
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Invalid Job ID: ${jobId}`);
    }
    if (job.status === JobStatus.COMPLETED) {
      throw new Error(`Cannot cancel completed job: ${jobId}`);
    }
    if (job.status === JobStatus.CANCELLED) {
      throw new Error(`Job already cancelled: ${jobId}`);
    }
    if (job.status === JobStatus.FAILED) {
      throw new Error(`Cannot cancel failed job: ${jobId}`);
    }
    if (!job.canTransitionTo(JobStatus.CANCELLED)) {
      throw new Error(`Cannot cancel job in state ${job.status}: ${jobId}`);
    }
    job.transitionTo(JobStatus.CANCELLED);
    job.completedAt = new Date();
    job.addLog(`Job ${jobId} cancelled.`);
    this.emit('job:cancelled', job);
    return this.getJobStatus(jobId);
  }

  /**
   * Start the worker pool to process jobs asynchronously.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    for (let i = 0; i < this.workerCount; i++) {
      const worker = this._createWorker(i);
      this.workers.push(worker);
    }
  }

  /**
   * Stop the worker pool.
   */
  async stop() {
    this.isRunning = false;
    await Promise.all(this.workers.map(w => w.promise.catch(() => {})));
    this.workers = [];
  }

  _createWorker(workerId) {
    const worker = {
      id: workerId,
      promise: this._workerLoop(worker),
    };
    return worker;
  }

  async _workerLoop(worker) {
    while (this.isRunning) {
      const jobId = this._dequeue();
      if (!jobId) {
        await this._sleep(10);
        continue;
      }
      const job = this.jobs.get(jobId);
      if (!job) continue;
      if (job.status !== JobStatus.QUEUED) continue;
      await this._processJob(job);
    }
  }

  _dequeue() {
    // Thread-safe-ish dequeue using a simple lock pattern
    if (this.processingLock) return null;
    this.processingLock = true;
    try {
      return this.queue.shift() || null;
    } finally {
      this.processingLock = false;
    }
  }

  async _processJob(job) {
    try {
      job.transitionTo(JobStatus.RUNNING);
      job.startedAt = new Date();
      job.addLog(`Job ${job.id} started processing.`);
      this.emit('job:running', job);

      const result = await job.taskFn();
      job.result = result;
      job.transitionTo(JobStatus.COMPLETED);
      job.completedAt = new Date();
      job.addLog(`Job ${job.id} completed successfully.`);
      this.emit('job:completed', job);
    } catch (err) {
      job.error = err.message;
      job.addLog(`Job ${job.id} failed: ${err.message}`);
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.addLog(`Job ${job.id} retrying (attempt ${job.retryCount}/${job.maxRetries}).`);
        // Backoff before retry
        await this._sleep(this.retryBackoffMs);
        job.transitionTo(JobStatus.QUEUED);
        job.addLog(`Job ${job.id} re-queued for retry.`);
        this.queue.push(job.id);
        this.emit('job:retry', job);
      } else {
        job.transitionTo(JobStatus.FAILED);
        job.completedAt = new Date();
        job.addLog(`Job ${job.id} failed permanently. Retry limit exceeded.`);
        this.emit('job:failed', job);
      }
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all jobs (for testing/inspection).
   */
  getAllJobs() {
    return Array.from(this.jobs.values()).map(j => this.getJobStatus(j.id));
  }
}

module.exports = { JobQueueManager, JobStatus, Job, VALID_TRANSITIONS };