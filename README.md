# Job Queue Management API

A production-quality, in-memory job queue system built with **FastAPI** that supports asynchronous job processing, worker concurrency, retry handling with exponential backoff, and full job lifecycle state management.

## Features

- **Submit jobs** into an in-memory queue for asynchronous processing
- **Worker pool** with configurable concurrency (multiple workers process jobs concurrently)
- **Retry handling** with configurable retry limits and exponential backoff
- **Job status tracking** at any point in the lifecycle
- **Job cancellation** for queued or running jobs
- **Result retrieval** for completed jobs
- **Thread-safe** access to shared in-memory queue and job state
- **Lifecycle logging** for every job state transition
- **Strict state-transition validation** — invalid transitions are prevented

## Job Lifecycle States

```
queued ──→ running ──→ completed
  │           │
  │           ├──→ failed
  │           │
  └──→ cancelled  ←──┘
```

| Transition | Allowed? |
|---|---|
| `queued → running` | ✅ |
| `running → completed` | ✅ |
| `running → failed` | ✅ |
| `queued → cancelled` | ✅ |
| `running → cancelled` | ✅ |
| Any → terminal | ❌ (terminal states: completed, failed, cancelled) |

## API Endpoints

### 1. Create Job — `POST /jobs`

```bash
curl -X POST http://localhost:8000/jobs \
  -H "Content-Type: application/json" \
  -d '{"task_name": "data_processing", "payload": {"input": "sample_data"}}'
```

**Response (201):**
```json
{"job_id": "job_abc123", "status": "queued"}
```

### 2. Get Job Status — `GET /jobs/{job_id}`

```bash
curl http://localhost:8000/jobs/job_abc123
```

**Response (200):**
```json
{
  "job_id": "job_abc123",
  "status": "completed",
  "retry_count": 1,
  "result": {"output": "processed_sample_data"},
  "error": null,
  "task_name": "data_processing",
  "max_retries": 3
}
```

### 3. Cancel Job — `DELETE /jobs/{job_id}`

```bash
curl -X DELETE http://localhost:8000/jobs/job_abc123
```

**Response (200):**
```json
{"job_id": "job_abc123", "status": "cancelled"}
```

### Health Check — `GET /health`

```bash
curl http://localhost:8000/health
```

## Configuration

All settings are configurable via environment variables:

| Variable | Default | Description |
|---|---|---|
| `JOB_QUEUE_WORKER_CONCURRENCY` | `4` | Number of concurrent worker threads |
| `JOB_QUEUE_MAX_RETRIES` | `3` | Maximum retry attempts for failed jobs |
| `JOB_QUEUE_BASE_RETRY_BACKOFF` | `1.0` | Base backoff in seconds (`base * 2^(attempt-1)`) |
| `JOB_QUEUE_MAX_RETRY_BACKOFF` | `30.0` | Maximum backoff cap in seconds |
| `JOB_QUEUE_WORKER_POLL_INTERVAL` | `0.1` | Queue poll interval in seconds |
| `JOB_QUEUE_SHUTDOWN_TIMEOUT` | `10.0` | Graceful shutdown timeout in seconds |

## Running

### Install dependencies

```bash
pip install -r requirements.txt
```

### Start the server

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Run tests

```bash
pytest -v
```

## Built-in Task Handlers

| Task Name | Description |
|---|---|
| `data_processing` | Simulates data processing (0.5s delay) |
| `echo` | Returns the payload as-is |
| `slow_task` | Sleeps for `payload["duration"]` seconds |
| `failing_task` | Always fails — useful for testing retries |
| `flaky_task` | Fails until `payload["fail_until_attempt"]`, then succeeds |

To register custom task handlers, use `manager.executor.register("my_task", my_handler)`.

## Architecture

```
app.py          — FastAPI application with API endpoints
config.py       — Configuration with environment variable overrides
models.py       — Job model, JobStatus enum, state-transition logic
registry.py     — Thread-safe in-memory job registry
queue.py        — Thread-safe FIFO job queue
executor.py     — Task handler registry with built-in tasks
worker.py       — Worker threads + WorkerPool with retry/backoff
manager.py      — High-level facade tying everything together
test_job_queue.py — Comprehensive test suite
```

### Thread Safety

- **JobQueue** uses a `threading.Condition` for blocking-safe dequeue with notification.
- **JobRegistry** uses a `threading.RLock` to guard the internal job map.
- **Job** uses a per-instance `threading.RLock` to guard all mutable state, preventing race conditions during concurrent updates.
- **WorkerPool** uses a `threading.Event` for coordinated shutdown.