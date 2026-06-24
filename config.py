"""Configuration settings for the Job Queue system."""

import os


class Config:
    """Application configuration with sensible defaults and environment overrides."""

    # Number of concurrent worker threads processing the job queue.
    WORKER_CONCURRENCY: int = int(os.getenv("JOB_QUEUE_WORKER_CONCURRENCY", "4"))

    # Maximum number of retry attempts for a failed job before it is marked as permanently failed.
    MAX_RETRIES: int = int(os.getenv("JOB_QUEUE_MAX_RETRIES", "3"))

    # Base backoff (in seconds) for retry attempts. Actual backoff = BASE_RETRY_BACKOFF * 2^(attempt-1).
    BASE_RETRY_BACKOFF: float = float(os.getenv("JOB_QUEUE_BASE_RETRY_BACKOFF", "1.0"))

    # Maximum backoff cap (in seconds) to avoid excessively long waits.
    MAX_RETRY_BACKOFF: float = float(os.getenv("JOB_QUEUE_MAX_RETRY_BACKOFF", "30.0"))

    # Interval (in seconds) at which the worker pool polls the queue for new jobs.
    WORKER_POLL_INTERVAL: float = float(os.getenv("JOB_QUEUE_WORKER_POLL_INTERVAL", "0.1"))

    # Timeout (in seconds) for graceful worker shutdown.
    SHUTDOWN_TIMEOUT: float = float(os.getenv("JOB_QUEUE_SHUTDOWN_TIMEOUT", "10.0"))


# Singleton config instance
config = Config()