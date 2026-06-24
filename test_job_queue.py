"""Comprehensive test suite for the Job Queue Management API.

Run with:  pytest -v
"""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app import app, manager
from models import Job, JobStatus, InvalidTransitionError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

client = TestClient(app)


def _wait_for_status(job_id: str, target: JobStatus, timeout: float = 15.0) -> dict:
    """Poll the API until the job reaches ``target`` status or timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        resp = client.get(f"/jobs/{job_id}")
        assert resp.status_code == 200
        data = resp.json()
        if data["status"] == target.value:
            return data
        time.sleep(0.1)
    raise AssertionError(
        f"Job {job_id} did not reach {target.value} within {timeout}s "
        f"(last status: {data['status']})"
    )


# ---------------------------------------------------------------------------
# Model / state-transition unit tests
# ---------------------------------------------------------------------------


class TestJobStateTransitions:
    """Unit tests for the Job model and state-transition logic."""

    def test_create_job_initial_state_is_queued(self):
        job = Job.create("echo", {"x": 1}, max_retries=3)
        assert job.status == JobStatus.QUEUED
        assert job.retry_count == 0
        assert job.job_id.startswith("job_")

    def test_valid_transition_queued_to_running(self):
        job = Job.create("echo", {})
        job.transition_to(JobStatus.RUNNING)
        assert job.status == JobStatus.RUNNING
        assert job.started_at is not None

    def test_valid_transition_running_to_completed(self):
        job = Job.create("echo", {})
        job.transition_to(JobStatus.RUNNING)
        job.transition_to(JobStatus.COMPLETED)
        assert job.status == JobStatus.COMPLETED
        assert job.completed_at is not None

    def test_valid_transition_running_to_failed(self):
        job = Job.create("echo", {})
        job.transition_to(JobStatus.RUNNING)
        job.transition_to(JobStatus.FAILED)
        assert job.status == JobStatus.FAILED

    def test_valid_transition_queued_to_cancelled(self):
        job = Job.create("echo", {})
        job.transition_to(JobStatus.CANCELLED)
        assert job.status == JobStatus.CANCELLED

    def test_valid_transition_running_to_cancelled(self):
        job = Job.create("echo", {})
        job.transition_to(JobStatus.RUNNING)
        job.transition_to(JobStatus.CANCELLED)
        assert job.status == JobStatus.CANCELLED

    def test_invalid_transition_queued_to_completed(self):
        job = Job.create("echo", {})
        with pytest.raises(InvalidTransitionError):
            job.transition_to(JobStatus.COMPLETED)

    def test_invalid_transition_completed_to_running(self):
        job = Job.create("echo", {})
        job.transition_to(JobStatus.RUNNING)
        job.transition_to(JobStatus.COMPLETED)
        with pytest.raises(InvalidTransitionError):
            job.transition_to(JobStatus.RUNNING)

    def test_invalid_transition_failed_to_running(self):
        job = Job.create("echo", {})
        job.transition_to(JobStatus.RUNNING)
        job.transition_to(JobStatus.FAILED)
        with pytest.raises(InvalidTransitionError):
            job.transition_to(JobStatus.RUNNING)

    def test_invalid_transition_cancelled_to_anything(self):
        job = Job.create("echo", {})
        job.transition_to(JobStatus.CANCELLED)
        for target in [JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.COMPLETED]:
            with pytest.raises(InvalidTransitionError):
                job.transition_to(target)

    def test_job_log_is_populated(self):
        job = Job.create("echo", {})
        job.transition_to(JobStatus.RUNNING)
        job.transition_to(JobStatus.COMPLETED)
        assert len(job.log) >= 3  # created + 2 transitions
        assert any("created" in entry["message"].lower() for entry in job.log)


# ---------------------------------------------------------------------------
# API integration tests
# ---------------------------------------------------------------------------


class TestCreateJobAPI:
    """Tests for POST /jobs."""

    def test_create_job_success(self):
        resp = client.post(
            "/jobs",
            json={"task_name": "data_processing", "payload": {"input": "hello"}},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["job_id"].startswith("job_")
        assert data["status"] == "queued"

    def test_create_job_with_empty_payload(self):
        resp = client.post("/jobs", json={"task_name": "echo"})
        assert resp.status_code == 201
        assert resp.json()["status"] == "queued"

    def test_create_job_missing_task_name(self):
        resp = client.post("/jobs", json={"payload": {}})
        assert resp.status_code == 422  # validation error


class TestGetJobStatusAPI:
    """Tests for GET /jobs/{job_id}."""

    def test_get_status_queued(self):
        # Submit a slow task so it stays queued briefly.
        create = client.post(
            "/jobs", json={"task_name": "slow_task", "payload": {"duration": 3}}
        )
        job_id = create.json()["job_id"]

        resp = client.get(f"/jobs/{job_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == job_id
        assert data["status"] in ("queued", "running")
        assert data["retry_count"] == 0

    def test_get_status_completed_with_result(self):
        create = client.post(
            "/jobs",
            json={"task_name": "data_processing", "payload": {"input": "world"}},
        )
        job_id = create.json()["job_id"]

        data = _wait_for_status(job_id, JobStatus.COMPLETED)
        assert data["result"] == {"output": "processed_world"}
        assert data["retry_count"] == 0

    def test_get_status_invalid_job_id(self):
        resp = client.get("/jobs/job_nonexistent")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


class TestCancelJobAPI:
    """Tests for DELETE /jobs/{job_id}."""

    def test_cancel_queued_job(self):
        # Submit a slow task so it's likely still queued when we cancel.
        create = client.post(
            "/jobs", json={"task_name": "slow_task", "payload": {"duration": 10}}
        )
        job_id = create.json()["job_id"]

        resp = client.delete(f"/jobs/{job_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == job_id
        assert data["status"] == "cancelled"

    def test_cancel_invalid_job_id(self):
        resp = client.delete("/jobs/job_does_not_exist")
        assert resp.status_code == 404

    def test_cancel_already_completed_job(self):
        create = client.post(
            "/jobs",
            json={"task_name": "data_processing", "payload": {"input": "x"}},
        )
        job_id = create.json()["job_id"]
        _wait_for_status(job_id, JobStatus.COMPLETED)

        resp = client.delete(f"/jobs/{job_id}")
        assert resp.status_code == 409
        assert "cancel" in resp.json()["detail"].lower()

    def test_cancel_already_cancelled_job(self):
        create = client.post(
            "/jobs", json={"task_name": "slow_task", "payload": {"duration": 10}}
        )
        job_id = create.json()["job_id"]

        # First cancel succeeds.
        resp1 = client.delete(f"/jobs/{job_id}")
        assert resp1.status_code == 200

        # Second cancel fails (already cancelled).
        resp2 = client.delete(f"/jobs/{job_id}")
        assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# Retry / failure tests
# ---------------------------------------------------------------------------


class TestRetryAndFailure:
    """Tests for retry handling and permanent failure."""

    def test_failed_job_with_retries(self):
        """A task that always fails should end up in FAILED state after retries."""
        create = client.post(
            "/jobs", json={"task_name": "failing_task", "payload": {}}
        )
        job_id = create.json()["job_id"]

        data = _wait_for_status(job_id, JobStatus.FAILED, timeout=30)
        assert data["status"] == "failed"
        assert data["retry_count"] == manager.config.MAX_RETRIES
        assert data["error"] is not None

    def test_flaky_job_succeeds_after_retries(self):
        """A flaky task that fails on early attempts should eventually succeed."""
        create = client.post(
            "/jobs",
            json={
                "task_name": "flaky_task",
                "payload": {"fail_until_attempt": 2},
            },
        )
        job_id = create.json()["job_id"]

        data = _wait_for_status(job_id, JobStatus.COMPLETED, timeout=30)
        assert data["status"] == "completed"
        assert data["retry_count"] >= 1
        assert data["result"]["output"] == "succeeded_after_retries"


# ---------------------------------------------------------------------------
# Concurrency tests
# ---------------------------------------------------------------------------


class TestConcurrency:
    """Tests for concurrent job processing."""

    def test_multiple_jobs_processed_concurrently(self):
        """Submit several slow jobs and verify they complete faster than
        sequential execution would allow."""
        num_jobs = manager.config.WORKER_CONCURRENCY
        duration = 1.0

        job_ids = []
        for _ in range(num_jobs):
            resp = client.post(
                "/jobs",
                json={"task_name": "slow_task", "payload": {"duration": duration}},
            )
            job_ids.append(resp.json()["job_id"])

        start = time.time()
        for jid in job_ids:
            _wait_for_status(jid, JobStatus.COMPLETED, timeout=30)
        elapsed = time.time() - start

        # If jobs were processed sequentially, elapsed would be >= num_jobs * duration.
        # With concurrency, it should be roughly one duration (plus overhead).
        sequential_time = num_jobs * duration
        assert elapsed < sequential_time, (
            f"Jobs took {elapsed:.2f}s, expected less than {sequential_time:.2f}s "
            f"for {num_jobs} concurrent workers"
        )

    def test_concurrent_cancel_and_process(self):
        """Cancelling a job while it might be processing should not crash."""
        create = client.post(
            "/jobs", json={"task_name": "slow_task", "payload": {"duration": 5}}
        )
        job_id = create.json()["job_id"]

        # Cancel immediately — should either cancel it or it's already running.
        resp = client.delete(f"/jobs/{job_id}")
        assert resp.status_code in (200, 409)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


class TestHealthCheck:
    def test_health(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "workers" in data
        assert "queue_size" in data