"""Data models for the Job Queue system."""

from __future__ import annotations

import enum
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class JobStatus(str, enum.Enum):
    """Enumeration of all possible job lifecycle states."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# Valid state-transition table.
# Only the transitions listed here are allowed; all others are rejected.
# ---------------------------------------------------------------------------
VALID_TRANSITIONS: Dict[JobStatus, List[JobStatus]] = {
    JobStatus.QUEUED: [JobStatus.RUNNING, JobStatus.CANCELLED],
    JobStatus.RUNNING: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED],
    JobStatus.COMPLETED: [],   # terminal state
    JobStatus.FAILED: [],      # terminal state
    JobStatus.CANCELLED: [],   # terminal state
}


class InvalidTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""

    def __init__(self, from_status: JobStatus, to_status: JobStatus):
        self.from_status = from_status
        self.to_status = to_status
        super().__init__(
            f"Invalid state transition: {from_status.value} -> {to_status.value}"
        )


@dataclass
class Job:
    """Represents a single job in the queue.

    Thread-safety:
        All mutations to a ``Job`` instance must be performed while holding the
        job's internal lock (``self._lock``).  Public helper methods
        (``transition_to``, ``set_result``, etc.) already acquire the lock
        internally, so callers do not need to manage locking explicitly for
        single operations.
    """

    job_id: str
    task_name: str
    payload: Dict[str, Any]
    status: JobStatus = JobStatus.QUEUED
    retry_count: int = 0
    max_retries: int = 3
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=lambda: time.time())
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    log: List[Dict[str, Any]] = field(default_factory=list)

    # Internal lock to guard all mutable state on this job.
    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False, compare=False)

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------
    @classmethod
    def create(
        cls,
        task_name: str,
        payload: Dict[str, Any],
        max_retries: int = 3,
    ) -> "Job":
        """Create a new job with a unique ID and initial QUEUED status."""
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        job = cls(
            job_id=job_id,
            task_name=task_name,
            payload=payload,
            max_retries=max_retries,
        )
        job._append_log("Job created and queued")
        return job

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------
    def _append_log(self, message: str, **extra: Any) -> None:
        """Append a timestamped log entry.  Caller must hold ``self._lock``."""
        entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": message,
        }
        entry.update(extra)
        self.log.append(entry)

    # ------------------------------------------------------------------
    # State transitions
    # ------------------------------------------------------------------
    def transition_to(self, new_status: JobStatus) -> None:
        """Atomically transition the job to ``new_status``.

        Raises:
            InvalidTransitionError: if the transition is not allowed.
        """
        with self._lock:
            if new_status not in VALID_TRANSITIONS.get(self.status, []):
                raise InvalidTransitionError(self.status, new_status)

            old_status = self.status
            self.status = new_status

            if new_status == JobStatus.RUNNING:
                self.started_at = time.time()
            elif new_status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
                self.completed_at = time.time()

            self._append_log(
                f"State transition: {old_status.value} -> {new_status.value}"
            )

    # ------------------------------------------------------------------
    # Result / error setters
    # ------------------------------------------------------------------
    def set_result(self, result: Dict[str, Any]) -> None:
        """Set the result payload (called when the job completes successfully)."""
        with self._lock:
            self.result = result
            self._append_log("Result set", result_keys=list(result.keys()))

    def set_error(self, error: str) -> None:
        """Set the error message (called when the job fails)."""
        with self._lock:
            self.error = error
            self._append_log("Error recorded", error=error)

    def increment_retry(self) -> int:
        """Increment the retry counter and return the new value."""
        with self._lock:
            self.retry_count += 1
            self._append_log("Retry incremented", retry_count=self.retry_count)
            return self.retry_count

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------
    def to_dict(self, include_log: bool = False) -> Dict[str, Any]:
        """Return a JSON-serializable representation of the job."""
        with self._lock:
            data: Dict[str, Any] = {
                "job_id": self.job_id,
                "task_name": self.task_name,
                "status": self.status.value,
                "retry_count": self.retry_count,
                "max_retries": self.max_retries,
                "result": self.result,
                "error": self.error,
                "created_at": self.created_at,
                "started_at": self.started_at,
                "completed_at": self.completed_at,
            }
            if include_log:
                data["log"] = list(self.log)
            return data