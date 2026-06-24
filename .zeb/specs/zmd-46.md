## SOLDEF-zmd-46

### <u>Project Details</u>
- **Project ID:** ZMD
- **Project Name:** test

### <u>Story Details</u>
- **Story ID:** ZMD-46
- **Story Name:** Develop Job Queue Management APIs for Asynchronous Job Processing
- **Story Description:**
  As a client application,I want to submit jobs for asynchronous processing, track their execution status, cancel queued/running jobs, and fetch final results,so that long-running tasks can be managed efficiently without blocking client requests.

### <u>Table of Contents</u>
- [Section 1: Functional Requirements](#section-1-functional-requirements)
- [Section 2: Non Functional Requirements](#section-2-non-functional-requirements)
- [Section 3: In Scope and Out Scope](#section-3-in-scope-and-out-scope)
- [Section 4: Solution Diagrams](#section-4-solution-diagrams)

---

### <u>Section 1: Functional Requirements</u>

#### <u>1.1 Overview</u>

The Python/FastAPI implementation is complete and production-quality, satisfying all requirements. The JavaScript/Node.js implementation in src/ has the core JobQueueManager logic (submit, status, cancel, worker pool, retry with exponential backoff, state transitions, EventEmitter lifecycle events) but LACKS the HTTP API layer, task executor registry, configuration module, test suite, and a proper server entry point. This plan completes the JS implementation to achieve feature parity with the Python version. Specifically: (1) Create src/config.js for environment-based configuration (worker concurrency, max retries, backoff settings, port). (2) Create src/executor.js with a TaskExecutor registry mapping task_name strings to handler functions, including built-in tasks (data_processing, echo, slow_task, failing_task, flaky_task) mirroring the Python executor.py. (3) Create src/server.js with Express routes exposing POST /jobs, GET /jobs/:jobId, DELETE /jobs/:jobId, and GET /health, with proper request validation, error handling (404/409/422), and lifespan management. (4) Update src/index.js to serve as the main entry point booting the Express server. (5) Create src/__tests__/jobQueue.test.js with a comprehensive Jest test suite. (6) Update package.json to add express and supertest dependencies. (7) Update README.md to document both implementations.

#### <u>1.2 Requirement Details</u>

##### <u>1.2.1 REQ-01: REQ-01: Create src/config.js — Environment-based configuration module that reads worker concurrency (JOB_QUEUE_WORKER_CONCURRENCY, default 4), max retries (JOB_QUEUE_MAX_RETRIES, default 3), base retry backoff ms (JOB_QUEUE_BASE_RETRY_BACKOFF_MS, default 100), max retry backoff ms (JOB_QUEUE_MAX_RETRY_BACKOFF_MS, default 30000), worker poll interval ms (JOB_QUEUE_WORKER_POLL_INTERVAL_MS, default 10), and server port (PORT, default 3000). Export a Config class or singleton object mirroring the Python config.py pattern.</u>

> **Description:** REQ-01: Create src/config.js — Environment-based configuration module that reads worker concurrency (JOB_QUEUE_WORKER_CONCURRENCY, default 4), max retries (JOB_QUEUE_MAX_RETRIES, default 3), base retry backoff ms (JOB_QUEUE_BASE_RETRY_BACKOFF_MS, default 100), max retry backoff ms (JOB_QUEUE_MAX_RETRY_BACKOFF_MS, default 30000), worker poll interval ms (JOB_QUEUE_WORKER_POLL_INTERVAL_MS, default 10), and server port (PORT, default 3000). Export a Config class or singleton object mirroring the Python config.py pattern. _(ac_17, ac_18, ac_33)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.2 REQ-02: REQ-02: Create src/executor.js — TaskExecutor registry that maps task_name strings to handler functions, mirroring Python executor.py. Include register(taskName, handler) and execute(job) methods. Register built-in tasks: data_processing, echo, slow_task, failing_task, flaky_task. The executor accepts a job object with {taskName, payload} and invokes the registered handler with the payload.</u>

> **Description:** REQ-02: Create src/executor.js — TaskExecutor registry that maps task_name strings to handler functions, mirroring Python executor.py. Include register(taskName, handler) and execute(job) methods. Register built-in tasks: data_processing, echo, slow_task, failing_task, flaky_task. The executor accepts a job object with {taskName, payload} and invokes the registered handler with the payload. _(ac_0, ac_1, ac_3)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.3 REQ-03: REQ-03: Adapt JobQueueManager to work with task_name + payload instead of raw function — Update src/jobQueue.js submitJob method to accept (taskName, payload, options) instead of (taskFn, options). Store taskName and payload on the Job object. Integrate TaskExecutor so workers call executor.execute(job) rather than job.taskFn(). This aligns the JS implementation with the Python manager/executor pattern and enables the HTTP API to submit jobs by task name.</u>

> **Description:** REQ-03: Adapt JobQueueManager to work with task_name + payload instead of raw function — Update src/jobQueue.js submitJob method to accept (taskName, payload, options) instead of (taskFn, options). Store taskName and payload on the Job object. Integrate TaskExecutor so workers call executor.execute(job) rather than job.taskFn(). This aligns the JS implementation with the Python manager/executor pattern and enables the HTTP API to submit jobs by task name. _(ac_0, ac_1, ac_7)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.4 REQ-04: REQ-04: Add exponential backoff retry mechanism to JobQueueManager — Ensure src/jobQueue.js implements configurable exponential backoff: backoff = baseBackoffMs * 2^(attempt-1), capped at maxBackoffMs. The current implementation uses a fixed retryBackoffMs; upgrade it to use exponential backoff from config. Log each retry attempt with backoff duration. When retry limit is exceeded, transition job to FAILED permanently with error message.</u>

> **Description:** REQ-04: Add exponential backoff retry mechanism to JobQueueManager — Ensure src/jobQueue.js implements configurable exponential backoff: backoff = baseBackoffMs * 2^(attempt-1), capped at maxBackoffMs. The current implementation uses a fixed retryBackoffMs; upgrade it to use exponential backoff from config. Log each retry attempt with backoff duration. When retry limit is exceeded, transition job to FAILED permanently with error message. _(ac_3, ac_18, ac_28, ac_33)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.5 REQ-05: REQ-05: Create src/server.js — Express HTTP server with three API endpoints and a health check. POST /jobs: accept {task_name, payload}, validate task_name is required (422 if missing), submit job via manager, return {job_id, status} with 201. GET /jobs/:jobId: fetch job status, return {job_id, status, retry_count, result, error, task_name, max_retries} with 200, or 404 if not found. DELETE /jobs/:jobId: cancel job, return {job_id, status: 'cancelled'} with 200, or 404 if not found, or 409 if terminal state. GET /health: return {status, workers, queue_size, total_jobs}. Export the Express app for testing and a startServer function for production use.</u>

> **Description:** REQ-05: Create src/server.js — Express HTTP server with three API endpoints and a health check. POST /jobs: accept {task_name, payload}, validate task_name is required (422 if missing), submit job via manager, return {job_id, status} with 201. GET /jobs/:jobId: fetch job status, return {job_id, status, retry_count, result, error, task_name, max_retries} with 200, or 404 if not found. DELETE /jobs/:jobId: cancel job, return {job_id, status: 'cancelled'} with 200, or 404 if not found, or 409 if terminal state. GET /health: return {status, workers, queue_size, total_jobs}. Export the Express app for testing and a startServer function for production use. _(ac_4, ac_5, ac_6, ac_7, ac_8, ac_9, ac_25, ac_26, ac_27)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.6 REQ-06: REQ-06: Implement request validation and error handling in Express routes — POST /jobs must validate task_name is non-empty (422 if missing). Payload defaults to empty object. GET /jobs/:jobId must catch invalid ID errors and return 404 with {detail, job_id}. DELETE /jobs/:jobId must catch invalid ID (404), cannot cancel completed (409), already cancelled (409), cannot cancel failed (409). All error responses follow consistent {detail, job_id?} schema matching Python ErrorResponse model.</u>

> **Description:** REQ-06: Implement request validation and error handling in Express routes — POST /jobs must validate task_name is non-empty (422 if missing). Payload defaults to empty object. GET /jobs/:jobId must catch invalid ID errors and return 404 with {detail, job_id}. DELETE /jobs/:jobId must catch invalid ID (404), cannot cancel completed (409), already cancelled (409), cannot cancel failed (409). All error responses follow consistent {detail, job_id?} schema matching Python ErrorResponse model. _(ac_25, ac_26, ac_27, ac_24)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.7 REQ-07: REQ-07: Implement server lifecycle management — On startup, create JobQueueManager with config values, register built-in task executors, call manager.start() to boot worker pool. On shutdown (SIGINT/SIGTERM), call manager.stop() to gracefully drain workers. Wire executor into manager so workers process jobs via task executor registry. Ensure Express app and manager are accessible for testing.</u>

> **Description:** REQ-07: Implement server lifecycle management — On startup, create JobQueueManager with config values, register built-in task executors, call manager.start() to boot worker pool. On shutdown (SIGINT/SIGTERM), call manager.stop() to gracefully drain workers. Wire executor into manager so workers process jobs via task executor registry. Ensure Express app and manager are accessible for testing. _(ac_1, ac_2, ac_16, ac_31)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.8 REQ-08: REQ-08: Update src/index.js — Replace simple re-export with proper server entry point that imports config, creates JobQueueManager with config values, registers TaskExecutor, starts worker pool, creates Express app from server.js, and listens on configured port. Log startup info. Handle graceful shutdown on SIGINT/SIGTERM.</u>

> **Description:** REQ-08: Update src/index.js — Replace simple re-export with proper server entry point that imports config, creates JobQueueManager with config values, registers TaskExecutor, starts worker pool, creates Express app from server.js, and listens on configured port. Log startup info. Handle graceful shutdown on SIGINT/SIGTERM. _(ac_1, ac_16, ac_17)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.9 REQ-09: REQ-09: Create src/__tests__/jobQueue.test.js — Jest test suite covering: (a) Job model state transitions: all valid and invalid transitions. (b) POST /jobs API: successful creation 201, missing task_name 422, empty payload defaults. (c) GET /jobs/:jobId API: correct status, completed exposes result, invalid ID 404. (d) DELETE /jobs/:jobId API: cancel queued 200, invalid ID 404, cancel completed 409, cancel already-cancelled 409. (e) Retry/failure: failing_task ends FAILED with retry_count=maxRetries, flaky_task succeeds after retries. (f) Concurrency: multiple slow_task jobs complete faster than sequential. (g) Health check 200. Use supertest for API integration tests.</u>

> **Description:** REQ-09: Create src/__tests__/jobQueue.test.js — Jest test suite covering: (a) Job model state transitions: all valid and invalid transitions. (b) POST /jobs API: successful creation 201, missing task_name 422, empty payload defaults. (c) GET /jobs/:jobId API: correct status, completed exposes result, invalid ID 404. (d) DELETE /jobs/:jobId API: cancel queued 200, invalid ID 404, cancel completed 409, cancel already-cancelled 409. (e) Retry/failure: failing_task ends FAILED with retry_count=maxRetries, flaky_task succeeds after retries. (f) Concurrency: multiple slow_task jobs complete faster than sequential. (g) Health check 200. Use supertest for API integration tests. _(ac_0, ac_1, ac_2, ac_3, ac_4, ac_5, ac_6, ac_7, ac_8, ac_9, ac_10, ac_11, ac_12, ac_13, ac_14, ac_15, ac_16, ac_17, ac_18, ac_19, ac_20, ac_21, ac_22, ac_23, ac_24, ac_25, ac_26, ac_27, ac_28, ac_29, ac_30, ac_31, ac_32, ac_34)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.10 REQ-10: REQ-10: Update package.json — Add 'express' to dependencies, add 'supertest' to devDependencies, add 'start' script (node src/index.js), ensure Jest test script remains 'jest --verbose'. Add jest configuration for test file patterns (src/__tests__/**/*.test.js).</u>

> **Description:** REQ-10: Update package.json — Add 'express' to dependencies, add 'supertest' to devDependencies, add 'start' script (node src/index.js), ensure Jest test script remains 'jest --verbose'. Add jest configuration for test file patterns (src/__tests__/**/*.test.js). _(ac_7, ac_8, ac_9)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.11 REQ-11: REQ-11: Update README.md — Add section documenting the JavaScript/Node.js implementation alongside existing Python docs. Document JS API endpoints, configuration env vars, npm install/start/test commands, built-in task handlers, and architecture overview for JS files.</u>

> **Description:** REQ-11: Update README.md — Add section documenting the JavaScript/Node.js implementation alongside existing Python docs. Document JS API endpoints, configuration env vars, npm install/start/test commands, built-in task handlers, and architecture overview for JS files. _(ac_0, ac_4, ac_5, ac_6, ac_7, ac_8, ac_9)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.12 REQ-12: REQ-12: Ensure concurrency-safe access in JS implementation — Replace the simple processingLock flag in _dequeue with a proper async-safe mechanism leveraging Node's single-threaded event loop correctly. Ensure job state transitions are guarded so concurrent cancel + process operations don't cause invalid states. Add a test for concurrent cancel-and-process race condition.</u>

> **Description:** REQ-12: Ensure concurrency-safe access in JS implementation — Replace the simple processingLock flag in _dequeue with a proper async-safe mechanism leveraging Node's single-threaded event loop correctly. Ensure job state transitions are guarded so concurrent cancel + process operations don't cause invalid states. Add a test for concurrent cancel-and-process race condition. _(ac_30, ac_31, ac_32)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.13 REQ-13: REQ-13: Add job lifecycle logging to JS implementation — Ensure every job state transition (created/queued, started/running, completed, failed, cancelled, retry) is logged with timestamps via job.addLog(). Verify logs are accessible through GET /jobs/:jobId. Mirror the Python implementation's logging behavior.</u>

> **Description:** REQ-13: Add job lifecycle logging to JS implementation — Ensure every job state transition (created/queued, started/running, completed, failed, cancelled, retry) is logged with timestamps via job.addLog(). Verify logs are accessible through GET /jobs/:jobId. Mirror the Python implementation's logging behavior. _(ac_34)_
> **Acceptance Criteria:** Implementation verified against story requirements.

#### <u>1.3 Project Artifacts</u>

- `src/jobQueue.js` (modify)
- `src/index.js` (modify)
- `package.json` (modify)
- `README.md` (modify)
- `src/config.js` (create)
- `src/executor.js` (create)
- `src/server.js` (create)
- `src/__tests__/jobQueue.test.js` (create)

#### <u>1.4 Dependencies</u>

- No blocking dependencies identified

---

### <u>Section 2: Non Functional Requirements</u>

#### 2.1 Infrastructure and Deployment

##### <u>2.1.1 Overview</u>
> Implementation targets the existing project infrastructure. No new infrastructure provisioning required unless specified in the story.

#### 2.2 Architecture and System Design

##### <u>2.2.1 Security and Compliance</u>
> Follow existing security patterns in the codebase (authentication, authorization, input validation).

##### <u>2.2.2 System Performance</u>
> Adhere to performance requirements specified in the story description.

---

### <u>Section 3: In Scope and Out Scope</u>

#### <u>3.1 In Scope Details</u>

- Allow clients to submit jobs into the queue.
- Jobs should be processed asynchronously by worker threads/processes.
- Multiple workers should be able to process jobs concurrently.
- Failed jobs should support configurable retry attempts.
- Clients should be able to check job status at any time.
- Clients should be able to cancel jobs before completion.
- Completed jobs should expose result payload.
- Create Job
- Get Job Status
- Cancel Job
- queued
- running
- completed
- failed
- cancelled
- Maintain all jobs in memory.
- Process jobs asynchronously using worker pool.
- Support configurable worker concurrency.
- Support configurable retry limit for failed jobs.
- Handle state transitions correctly:
- queued → running
- running → completed
- running → failed
- queued/running → cancelled
- Prevent invalid transitions.
- Invalid Job ID
- Cancelling completed job
- Cancelling already cancelled job
- Retry limit exceeded
- Worker failure during execution
- Concurrent updates on same job
- Ensure thread-safe access to shared in-memory queue.
- Handle race conditions during job updates.
- Implement retry backoff mechanism (optional).
- Maintain logs for job execution lifecycle.

#### <u>3.2 Out Scope Details</u>

- Features not mentioned in the acceptance criteria
- Infrastructure changes beyond what is specified
- Unrelated module modifications

---

### <u>Section 4: Solution Diagrams</u>

#### <u>4.1 UI/UX Design Diagram</u>
**Diagram Location:** _(refer to story attachments if any)_

#### <u>4.2 Architecture Design Diagram</u>
**Diagram Location:** _(to be added if applicable)_

#### <u>4.3 Infrastructure Design Diagram</u>
**Diagram Location:** _(to be added if applicable)_

---

### <u>Files Summary</u>

| Action | File |
|--------|------|
| Modify | `src/jobQueue.js` |
| Modify | `src/index.js` |
| Modify | `package.json` |
| Modify | `README.md` |
| Create | `src/config.js` |
| Create | `src/executor.js` |
| Create | `src/server.js` |
| Create | `src/__tests__/jobQueue.test.js` |

> **Estimated changes:** 12
> **Status:** Draft — Awaiting Approval
