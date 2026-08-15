"""In-process job state machine for the P3 fetch (write) path.

DuckDB permits many read-only processes **XOR** one read-write process on a
catalogue file. Our API reads read-only; P3's `gridflow pipeline elexon ...`
subprocess writes. They mutually exclude at the OS level, so this module is
the single source of truth for "is a write in flight right now" — the
read-path guard in `deps.client_ctx` checks `JOBS.is_running()` before ever
constructing a client.

Invariants:
    - At most one `RUNNING` job per process, enforced by `JobManager`'s lock.
    - Single-worker uvicorn is a **hard requirement**: `JOBS` is
      process-local, so `--workers 2` would permit two concurrent `RUNNING`
      jobs. The dev command must never pass `--workers`.
    - No code path may leave a job stuck `RUNNING`. `try_start` is
      transactional: if thread creation or `Thread.start()` raises, the job
      is rolled back to `FAILED` before the exception is re-raised. Once the
      worker thread is running, its own `try/finally` (P3) is responsible
      for always calling `finish`.
    - State is in-memory only, deliberately: a crashed server starts clean
      rather than inheriting a job it can neither observe nor kill.
    - `is_lock_error` is the single authoritative DuckDB lock classifier for
      the whole app — the read-path guard, the P3 `try_start` preflight, and
      the P3 subprocess retry classifier all call this same function rather
      than re-expressing the match.

P1 implements state and the classifier only: `JobState`, `Job`, `JobManager`
(including a working `try_start`/`finish`/`current`/`is_running`), and
`is_lock_error`. Subprocess launching, the `try_start` preflight probe, and
the `/fetch` / `/jobs/current` endpoints are P3 additions on top of this.
"""

from __future__ import annotations

import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

_LOCK_MARKERS = ("could not set lock", "conflicting lock")


def is_lock_error(text: str) -> bool:
    """Classify whether a DuckDB error message indicates a held file lock.

    The single authoritative lock classifier for the whole app: the
    read-path guard, the P3 `try_start` preflight, and the P3 subprocess
    retry classifier all call this function. Do not re-express this match
    anywhere else.

    Args:
        text: The exception message (or subprocess stderr) to classify.

    Returns:
        True if the text matches a known DuckDB lock-contention message,
        case-insensitively.
    """
    lowered = text.lower()
    return any(marker in lowered for marker in _LOCK_MARKERS)


class JobState(StrEnum):
    """Lifecycle states of a fetch job."""

    IDLE = "idle"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass
class Job:
    """A single fetch job's state.

    Attributes:
        job_id: Opaque job identifier (not named `id` — see the naming
            convention in P1-PLAN.md's "Locked conventions").
        dataset_id: The catalogue dataset this job is fetching.
        state: Current lifecycle state.
        started_at: UTC timestamp the job was created.
        finished_at: UTC timestamp the job reached a terminal state, or
            `None` while still `RUNNING`.
        message: Human-readable outcome detail (error tail, timeout note,
            or `None` on success / while running).
    """

    job_id: str
    dataset_id: str
    state: JobState
    started_at: datetime
    finished_at: datetime | None
    message: str | None


class JobManager:
    """Owns the single current job and its lock-guarded state transitions."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._current: Job | None = None

    def try_start(
        self,
        dataset_id: str,
        target: Callable[[Job], None],
        *,
        preflight: Callable[[], None] | None = None,
    ) -> Job | None:
        """Start a new job if none is currently running.

        The single start entry point: owns the `RUNNING` transition and
        thread creation/startup, so the "no path leaves a job stuck
        RUNNING" invariant lives in one place rather than being reassembled
        by each caller. Start is transactional — thread creation and
        `Thread.start()` happen inside this method's own `try/except`; on
        any exception the job is transitioned to `FAILED` before the
        exception is re-raised. A job left `RUNNING` whose worker never
        began would wedge the app in 503/409 until restart, and the
        worker's own `finally` cannot help, since the worker never ran.

        Args:
            dataset_id: The catalogue dataset the job fetches.
            target: Callable invoked as the daemon thread's body, receiving
                the created `Job`. The caller (P3) is responsible for
                calling `finish` from within `target`'s own `try/finally`.
            preflight: Optional callable invoked **inside the manager lock,
                after the already-running check and before the `Job` is
                created**. A raise here leaves no partially-created job and
                no state to roll back — the lock is simply released as the
                exception propagates. Keyword-only and defaulted so every
                existing caller (including `tests/conftest.py`'s
                `running_job` fixture) is untouched. P3's `fetch.py` injects
                the write-lock probe here; this module stays free of
                `duckdb` and `settings` imports.

        Returns:
            The newly created `Job`, or `None` if a job is already
            `RUNNING` (the caller turns that into a 409).

        Raises:
            Exception: Whatever `preflight` raises, propagated unchanged
                (P3's route turns a `RefreshInProgress` into 409 and lets a
                `CatalogueMissing` fall through to the normal 503 handler).
        """
        with self._lock:
            if self._current is not None and self._current.state is JobState.RUNNING:
                return None
            if preflight is not None:
                preflight()
            job = Job(
                job_id=str(uuid.uuid4()),
                dataset_id=dataset_id,
                state=JobState.RUNNING,
                started_at=datetime.now(UTC),
                finished_at=None,
                message=None,
            )
            self._current = job

        try:
            thread = threading.Thread(target=target, args=(job,), daemon=True)
            thread.start()
        except Exception:
            self.finish(job.job_id, JobState.FAILED, "failed to start job thread")
            raise
        return job

    def finish(self, job_id: str, state: JobState, message: str | None) -> None:
        """Transition the current job to a terminal (or failed-start) state.

        A no-op if `job_id` does not match the current job — guards against
        a stale finish call clobbering a job that has already moved on.

        Args:
            job_id: The job to finish.
            state: The terminal state to record.
            message: Human-readable outcome detail, or `None`.
        """
        with self._lock:
            if self._current is not None and self._current.job_id == job_id:
                # `current()`/`to_job_payload` read the job's attributes
                # locklessly, so whichever attribute we set last is the de
                # facto publication point for a concurrent poller. Set
                # `finished_at`/`message` first and `state` last so a
                # poller can never observe a terminal `state` (e.g.
                # `failed`) paired with a still-`None` `message` — a torn
                # snapshot of an in-progress write.
                self._current.finished_at = datetime.now(UTC)
                self._current.message = message
                self._current.state = state

    def current(self) -> Job | None:
        """Return the current job, if any.

        Returns:
            The current `Job`, or `None` if no job has been started this
            process generation.
        """
        return self._current

    def is_running(self) -> bool:
        """Return whether a job is currently `RUNNING`.

        Returns:
            True if the current job's state is `RUNNING`.
        """
        return self._current is not None and self._current.state is JobState.RUNNING


JOBS = JobManager()


def _iso_z(value: datetime | None) -> str | None:
    """Render a UTC `datetime` as ISO-8601 with a trailing `Z`, or `None`."""
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def to_job_payload(job: Job) -> dict[str, Any]:
    """Serialize a `Job` into the one wire shape both job routes return.

    P3's `POST /fetch` 202 body and `GET /api/jobs/current` both return this
    same payload — a deliberate simplification (P3-PLAN.md "T3") so the
    frontend has exactly one job type, a superset of P1-PLAN's minimal 202
    body (`job_id`, `dataset_id`, `state`).

    Args:
        job: The `Job` to serialize.

    Returns:
        `job_id`, `dataset_id`, `state`, ISO-8601 `Z` `started_at` /
        `finished_at`, and `message`.
    """
    return {
        "job_id": job.job_id,
        "dataset_id": job.dataset_id,
        "state": job.state,
        "started_at": _iso_z(job.started_at),
        "finished_at": _iso_z(job.finished_at),
        "message": job.message,
    }
