"""Thread-safe priority-aware FIFO job queue.

The queue only holds jobs that are in the ``QUEUED`` state and are waiting to
be picked up by a worker.  Once a worker dequeues a job it is removed from this
queue and tracked solely in the :class:`~registry.JobRegistry`.
"""

from __future__ import annotations

import threading
from collections import deque
from typing import Optional

from models import Job


class JobQueue:
    """A thread-safe FIFO queue of jobs awaiting processing."""

    def __init__(self) -> None:
        self._queue: deque[Job] = deque()
        self._lock = threading.Lock()
        self._not_empty = threading.Condition(self._lock)

    # ------------------------------------------------------------------
    # Producer API
    # ------------------------------------------------------------------
    def enqueue(self, job: Job) -> None:
        """Add a job to the back of the queue and notify waiting workers."""
        with self._not_empty:
            self._queue.append(job)
            self._not_empty.notify()

    # ------------------------------------------------------------------
    # Consumer API (workers)
    # ------------------------------------------------------------------
    def dequeue(self, timeout: Optional[float] = None) -> Optional[Job]:
        """Block until a job is available (or ``timeout`` elapses) and return it.

        Returns ``None`` if the timeout expires without a job becoming
        available.
        """
        with self._not_empty:
            if not self._queue:
                self._not_empty.wait(timeout=timeout)
            if self._queue:
                return self._queue.popleft()
            return None

    # ------------------------------------------------------------------
    # Removal (for cancellation of queued jobs)
    # ------------------------------------------------------------------
    def remove(self, job_id: str) -> Optional[Job]:
        """Remove and return the job with ``job_id`` from the queue, if present."""
        with self._not_empty:
            for i, job in enumerate(self._queue):
                if job.job_id == job_id:
                    del self._queue[i]
                    return job
            return None

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------
    def size(self) -> int:
        """Return the current number of jobs in the queue."""
        with self._lock:
            return len(self._queue)

    def is_empty(self) -> bool:
        with self._lock:
            return len(self._queue) == 0