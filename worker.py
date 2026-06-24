"""Worker pool for asynchronous job processing.

Each :class:`Worker` runs in its own thread, pulling jobs from the shared
:class:`~queue.JobQueue`, executing them via the :class:`~executor.TaskExecutor`,
and handling retries with exponential backoff.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Optional

from config import Config
from executor import TaskExecutor
from models import Job, JobStatus
from queue import JobQueue
from registry import JobRegistry

logger = logging.getLogger("job_queue.worker")


class Worker(threading.Thread):
    """A single worker thread that processes jobs from the queue."""

    def __init__(
        self,
        worker_id: int,
        job_queue: JobQueue,
        registry: JobRegistry,
        executor: TaskExecutor,
        config: Config,
        stop_event: threading.Event,
    ) -> None:
        super().__init__(daemon=True, name=f"Worker-{worker_id}")
        self.worker_id = worker_id
        self.job_queue = job_queue
        self.registry = registry
        self.executor = executor
        self.config = config
        self._stop_event = stop_event

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------
    def run(self) -> None:
        logger.info("Worker %d started", self.worker_id)
        while not self._stop_event.is_set():
            # Block briefly waiting for a job so we don't busy-spin.
            job = self.job_queue.dequeue(timeout=self.config.WORKER_POLL_INTERVAL)
            if job is None:
                continue

            # The job may have been cancelled while waiting in the queue.
            # Re-check status before processing.
            if job.status != JobStatus.QUEUED:
                logger.info(
                    "Worker %d skipping job %s (status=%s)",
                    self.worker_id, job.job_id, job.status.value,
                )
                continue

            self._process_job(job)

        logger.info("Worker %d stopped", self.worker_id)

    # ------------------------------------------------------------------
    # Job processing with retry + backoff
    # ------------------------------------------------------------------
    def _process_job(self, job: Job) -> None:
        """Process a single job, retrying on failure up to ``max_retries``."""
        attempt = 0
        while True:
            attempt += 1

            # --- Transition queued -> running ---------------------------------
            try:
                job.transition_to(JobStatus.RUNNING)
            except Exception:
                # Job was cancelled before we could start it.
                logger.info(
                    "Worker %d: job %s no longer queued, skipping",
                    self.worker_id, job.job_id,
                )
                return

            # Inject the current attempt number so handlers like
            # ``flaky_task`` can use it.
            if isinstance(job.payload, dict):
                job.payload["_attempt"] = attempt

            # --- Execute ------------------------------------------------------
            try:
                result = self.executor.execute(job)
                job.set_result(result)
                job.transition_to(JobStatus.COMPLETED)
                logger.info(
                    "Worker %d: job %s completed on attempt %d",
                    self.worker_id, job.job_id, attempt,
                )
                return

            except Exception as exc:
                error_msg = f"{type(exc).__name__}: {exc}"
                logger.warning(
                    "Worker %d: job %s failed on attempt %d — %s",
                    self.worker_id, job.job_id, attempt, error_msg,
                )

                # Transition running -> failed so we can retry.
                try:
                    job.transition_to(JobStatus.FAILED)
                except Exception:
                    # If we can't transition to FAILED (e.g. it was cancelled),
                    # we stop processing.
                    logger.info(
                        "Worker %d: job %s was cancelled during execution",
                        self.worker_id, job.job_id,
                    )
                    return

                # --- Retry logic ----------------------------------------------
                if attempt <= job.max_retries:
                    # Increment retry counter and re-queue with backoff.
                    job.increment_retry()
                    backoff = self._compute_backoff(attempt)
                    logger.info(
                        "Worker %d: job %s retrying in %.2fs (attempt %d/%d)",
                        self.worker_id, job.job_id, backoff, attempt, job.max_retries,
                    )
                    # Reset status back to QUEUED for the next attempt.
                    # We bypass the normal transition guard because FAILED is
                    # terminal — but we handle the retry internally.
                    self._reset_to_queued(job)
                    time.sleep(backoff)
                    # Loop continues; job will be transitioned to RUNNING again.
                    continue
                else:
                    # Retry limit exceeded — leave the job in FAILED state.
                    job.set_error(error_msg)
                    logger.error(
                        "Worker %d: job %s permanently failed after %d attempts",
                        self.worker_id, job.job_id, attempt,
                    )
                    return

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _compute_backoff(self, attempt: int) -> float:
        """Compute exponential backoff: base * 2^(attempt-1), capped."""
        backoff = self.config.BASE_RETRY_BACKOFF * (2 ** (attempt - 1))
        return min(backoff, self.config.MAX_RETRY_BACKOFF)

    def _reset_to_queued(self, job: Job) -> None:
        """Reset a FAILED job back to QUEUED for retry.

        This is an internal operation that bypasses the normal transition
        table (FAILED -> QUEUED) because retries are an internal mechanism.
        """
        with job._lock:  # noqa: SLF001 — internal access
            job.status = JobStatus.QUEUED
            job._append_log("Reset to queued for retry")  # noqa: SLF001


class WorkerPool:
    """Manages a pool of worker threads.

    The pool is started once at application startup and shut down gracefully
    on application exit.
    """

    def __init__(
        self,
        job_queue: JobQueue,
        registry: JobRegistry,
        executor: TaskExecutor,
        config: Config,
    ) -> None:
        self.job_queue = job_queue
        self.registry = registry
        self.executor = executor
        self.config = config
        self._stop_event = threading.Event()
        self._workers: list[Worker] = []

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def start(self) -> None:
        """Start all worker threads."""
        for i in range(self.config.WORKER_CONCURRENCY):
            worker = Worker(
                worker_id=i,
                job_queue=self.job_queue,
                registry=self.registry,
                executor=self.executor,
                config=self.config,
                stop_event=self._stop_event,
            )
            self._workers.append(worker)
            worker.start()
        logger.info("Worker pool started with %d workers", len(self._workers))

    def shutdown(self) -> None:
        """Signal all workers to stop and wait for them to finish."""
        self._stop_event.set()
        for worker in self._workers:
            worker.join(timeout=self.config.SHUTDOWN_TIMEOUT)
        logger.info("Worker pool shut down")

    @property
    def worker_count(self) -> int:
        return len(self._workers)