"""Thread-safe in-memory registry of all jobs."""

from __future__ import annotations

import threading
from typing import Dict, Optional

from models import Job, JobStatus


class JobRegistry:
    """Thread-safe in-memory store for all jobs keyed by ``job_id``.

    This registry holds *every* job regardless of its state, allowing clients
    to query status at any point in the lifecycle.
    """

    def __init__(self) -> None:
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.RLock()

    def add(self, job: Job) -> None:
        """Register a new job."""
        with self._lock:
            self._jobs[job.job_id] = job

    def get(self, job_id: str) -> Optional[Job]:
        """Retrieve a job by ID, or ``None`` if not found."""
        with self._lock:
            return self._jobs.get(job_id)

    def remove(self, job_id: str) -> None:
        """Remove a job from the registry."""
        with self._lock:
            self._jobs.pop(job_id, None)

    def all_jobs(self) -> Dict[str, Job]:
        """Return a shallow copy of the internal job map."""
        with self._lock:
            return dict(self._jobs)

    def count_by_status(self, status: JobStatus) -> int:
        """Count jobs currently in the given status."""
        with self._lock:
            return sum(1 for j in self._jobs.values() if j.status == status)