"""Job manager — the central service that ties together the queue, registry,
executor, and worker pool.

It exposes high-level operations used by the API layer:

* ``submit_job``  — create and enqueue a new job
* ``get_job``      — retrieve a job by ID
* ``cancel_job``   — cancel a queued or running job
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from config import Config
from executor import TaskExecutor
from models import Job, JobStatus
from queue import JobQueue
from registry import JobRegistry
from worker import WorkerPool

logger = logging.getLogger("job_queue.manager")


class JobNotFoundError(Exception):
    """Raised when a job ID does not exist in the registry."""

    def __init__(self, job_id: str):
        self.job_id = job_id
        super().__init__(f"Job not found: {job_id}")


class JobCancellationError(Exception):
    """Raised when a job cannot be cancelled (e.g. it is already terminal)."""

    def __init__(self, job_id: str, status: JobStatus):
        self.job_id = job_id
        self.status = status
        super().__init__(
            f"Cannot cancel job {job_id}: current status is '{status.value}' "
            f"(only 'queued' or 'running' jobs can be cancelled)"
        )


class JobManager:
    """High-level facade for job lifecycle management."""

    def __init__(self, config: Optional[Config] = None) -> None:
        self.config = config or Config()
        self.registry = JobRegistry()
        self.job_queue = JobQueue()
        self.executor = TaskExecutor()
        self.worker_pool = WorkerPool(
            job_queue=self.job_queue,
            registry=self.registry,
            executor=self.executor,
            config=self.config,
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def start(self) -> None:
        """Start the worker pool (call once at application startup)."""
        self.worker_pool.start()

    def shutdown(self) -> None:
        """Gracefully shut down the worker pool."""
        self.worker_pool.shutdown()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def submit_job(
        self,
        task_name: str,
        payload: Dict[str, Any],
    ) -> Job:
        """Create a new job, register it, and enqueue it for processing.

        Returns the created :class:`Job`.
        """
        job = Job.create(
            task_name=task_name,
            payload=payload,
            max_retries=self.config.MAX_RETRIES,
        )
        self.registry.add(job)
        self.job_queue.enqueue(job)
        logger.info("Submitted job %s (task=%s)", job.job_id, task_name)
        return job

    def get_job(self, job_id: str) -> Job:
        """Return the job with the given ID.

        Raises:
            JobNotFoundError: if the ID does not exist.
        """
        job = self.registry.get(job_id)
        if job is None:
            raise JobNotFoundError(job_id)
        return job

    def cancel_job(self, job_id: str) -> Job:
        """Cancel a queued or running job.

        Raises:
            JobNotFoundError:   if the ID does not exist.
            JobCancellationError: if the job is in a terminal state
                                (completed, failed, or already cancelled).
        """
        job = self.get_job(job_id)

        # Terminal states cannot be cancelled.
        if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
            raise JobCancellationError(job_id, job.status)

        # If the job is still in the queue (queued), remove it first so no
        # worker picks it up.
        if job.status == JobStatus.QUEUED:
            self.job_queue.remove(job_id)

        # Transition to CANCELLED.  This is valid from both QUEUED and RUNNING.
        job.transition_to(JobStatus.CANCELLED)
        logger.info("Cancelled job %s", job_id)
        return job