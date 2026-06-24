"""Task executor registry.

The executor maps ``task_name`` strings to callable handlers.  This makes the
system extensible: new task types can be registered without modifying the
worker or queue code.

A default set of sample tasks is provided for demonstration and testing.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Dict

from models import Job


# Type alias for a task handler callable.
TaskHandler = Callable[[Dict[str, Any]], Dict[str, Any]]


class TaskExecutor:
    """Registry of task handlers keyed by ``task_name``."""

    def __init__(self) -> None:
        self._handlers: Dict[str, TaskHandler] = {}
        self._register_defaults()

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------
    def register(self, task_name: str, handler: TaskHandler) -> None:
        """Register (or override) a handler for the given task name."""
        self._handlers[task_name] = handler

    def get(self, task_name: str) -> TaskHandler:
        """Return the handler for ``task_name``.

        Raises:
            KeyError: if no handler is registered for the task name.
        """
        if task_name not in self._handlers:
            raise KeyError(f"No handler registered for task '{task_name}'")
        return self._handlers[task_name]

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------
    def execute(self, job: Job) -> Dict[str, Any]:
        """Execute the job's task handler and return the result dict."""
        handler = self.get(job.task_name)
        return handler(job.payload)

    # ------------------------------------------------------------------
    # Default handlers
    # ------------------------------------------------------------------
    def _register_defaults(self) -> None:
        """Register a set of built-in sample tasks."""

        def data_processing(payload: Dict[str, Any]) -> Dict[str, Any]:
            input_data = payload.get("input", "")
            # Simulate some processing work.
            time.sleep(0.5)
            return {"output": f"processed_{input_data}"}

        def echo(payload: Dict[str, Any]) -> Dict[str, Any]:
            return {"echo": payload}

        def slow_task(payload: Dict[str, Any]) -> Dict[str, Any]:
            duration = float(payload.get("duration", 2))
            time.sleep(duration)
            return {"slept_for": duration}

        def failing_task(payload: Dict[str, Any]) -> Dict[str, Any]:
            # Always raises — useful for testing retry logic.
            raise RuntimeError("Intentional failure for testing")

        def flaky_task(payload: Dict[str, Any]) -> Dict[str, Any]:
            # Fails on the first N attempts, then succeeds.
            fail_until = int(payload.get("fail_until_attempt", 2))
            attempt = int(payload.get("_attempt", 1))
            if attempt < fail_until:
                raise RuntimeError(f"Flaky failure on attempt {attempt}")
            return {"output": "succeeded_after_retries", "attempt": attempt}

        self.register("data_processing", data_processing)
        self.register("echo", echo)
        self.register("slow_task", slow_task)
        self.register("failing_task", failing_task)
        self.register("flaky_task", flaky_task)