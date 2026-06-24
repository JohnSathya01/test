"""FastAPI application exposing the Job Queue Management APIs."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from config import Config
from manager import JobCancellationError, JobManager, JobNotFoundError
from models import JobStatus

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("job_queue.api")

# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------


class CreateJobRequest(BaseModel):
    task_name: str = Field(..., description="Name of the task to execute")
    payload: Dict[str, Any] = Field(
        default_factory=dict, description="Input payload for the task"
    )


class CreateJobResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    retry_count: int
    result: Dict[str, Any] | None = None
    error: str | None = None
    task_name: str | None = None
    max_retries: int | None = None


class CancelJobResponse(BaseModel):
    job_id: str
    status: str


class ErrorResponse(BaseModel):
    detail: str
    job_id: str | None = None


# ---------------------------------------------------------------------------
# Application + dependency wiring
# ---------------------------------------------------------------------------

config = Config()
manager = JobManager(config=config)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the worker pool on startup and shut it down on exit."""
    manager.start()
    logger.info("Job Queue API started — %d workers, max_retries=%d",
                config.WORKER_CONCURRENCY, config.MAX_RETRIES)
    try:
        yield
    finally:
        manager.shutdown()
        logger.info("Job Queue API stopped")


app = FastAPI(
    title="Job Queue Management API",
    description=(
        "Submit jobs for asynchronous processing, track their execution "
        "status, cancel queued/running jobs, and fetch final results."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.post(
    "/jobs",
    response_model=CreateJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Job",
    tags=["Jobs"],
)
def create_job(request: CreateJobRequest) -> CreateJobResponse:
    """Submit a new job for asynchronous processing."""
    job = manager.submit_job(
        task_name=request.task_name,
        payload=request.payload,
    )
    return CreateJobResponse(job_id=job.job_id, status=job.status.value)


@app.get(
    "/jobs/{job_id}",
    response_model=JobStatusResponse,
    summary="Get Job Status",
    tags=["Jobs"],
    responses={
        404: {"model": ErrorResponse, "description": "Job not found"},
    },
)
def get_job_status(job_id: str) -> JobStatusResponse:
    """Fetch job details, current status, retry count, and result (if completed)."""
    try:
        job = manager.get_job(job_id)
    except JobNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid Job ID: '{job_id}' not found",
        )

    data = job.to_dict()
    return JobStatusResponse(
        job_id=data["job_id"],
        status=data["status"],
        retry_count=data["retry_count"],
        result=data["result"],
        error=data["error"],
        task_name=data["task_name"],
        max_retries=data["max_retries"],
    )


@app.delete(
    "/jobs/{job_id}",
    response_model=CancelJobResponse,
    summary="Cancel Job",
    tags=["Jobs"],
    responses={
        404: {"model": ErrorResponse, "description": "Job not found"},
        409: {"model": ErrorResponse, "description": "Job cannot be cancelled"},
    },
)
def cancel_job(job_id: str) -> CancelJobResponse:
    """Cancel a queued or running job."""
    try:
        job = manager.cancel_job(job_id)
    except JobNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid Job ID: '{job_id}' not found",
        )
    except JobCancellationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return CancelJobResponse(job_id=job.job_id, status=job.status.value)


# ---------------------------------------------------------------------------
# Health check (bonus)
# ---------------------------------------------------------------------------


@app.get("/health", tags=["System"])
def health_check() -> dict:
    """Simple health-check endpoint."""
    return {
        "status": "ok",
        "workers": config.WORKER_CONCURRENCY,
        "queue_size": manager.job_queue.size(),
        "total_jobs": len(manager.registry.all_jobs()),
    }