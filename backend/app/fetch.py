"""The P3 subprocess runner: preflight probe, command/env builders, launch
seam and the retrying worker body.

Implements P1-PLAN.md's "Subprocess runner — P3, design fixed here" section
verbatim. Constants (timeout, retry schedule) live in code, not restated in
prose here — see the `# see P1-PLAN.md "Subprocess runner"` markers below.

Two module-level seams exist purely for testing:
    - `launch` — the **only** call site of `subprocess.run`. Tests
      monkeypatch `app.fetch.launch` so no real `gridflow` CLI ever runs.
    - `_sleep` — a thin `time.sleep` wrapper. Tests monkeypatch
      `app.fetch._sleep` so the retry schedule's ~15.5s worst case never
      actually elapses.

`run_fetch_job` is written to be callable synchronously (no thread required)
so tests can drive the retry loop directly.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from datetime import timedelta
from pathlib import Path
from typing import TYPE_CHECKING

import duckdb
from gridflow.serving.client import GridflowClient

from app.errors import CatalogueMissing, RefreshInProgress
from app.jobs import JOBS, JobState, is_lock_error
from app.settings import get_settings

if TYPE_CHECKING:
    from datetime import date

    from app.catalogue import DatasetSpec
    from app.jobs import Job

# `gridflow` is editable-installed into this backend's venv, so its console
# script lands in the same Scripts directory as the running interpreter —
# see P1-PLAN.md "Subprocess runner" > "Executable". Never assume PATH.
GRIDFLOW_EXE = Path(sys.executable).parent / "gridflow.exe"

# Attempt schedule: 1 initial attempt plus up to 5 retries, sleeping these
# delays (seconds) before each successive retry — 6 attempts total, ~15.5s
# worst case. See P1-PLAN.md "Subprocess runner" > "Retry classification".
_RETRY_DELAYS = (0.5, 1, 2, 4, 8)
_MAX_ATTEMPTS = len(_RETRY_DELAYS) + 1

# See P1-PLAN.md "Subprocess runner" > "Timeout".
_SUBPROCESS_TIMEOUT_SECONDS = 900


def probe_writer_lock() -> None:
    """Preflight: raise if a read-write writer currently holds the catalogue.

    Constructs a real `GridflowClient(get_settings().duckdb_path)` and
    closes it in `finally` — reusing the exact path resolution the read path
    uses, which yields lock-classified `duckdb.IOException` ->
    `RefreshInProgress` and `FileNotFoundError` -> `CatalogueMissing` for
    free, with no separate classification logic to keep in sync.

    **Deliberately NOT `client_ctx()`.** `client_ctx` reads job state
    (`JOBS.is_running()`) while `try_start` holds the manager lock. That
    does not deadlock today only because `is_running()` happens to be
    lockless — a fragility that must not become load-bearing (P3-PLAN.md
    "The probe"). This function talks to `GridflowClient` directly instead.

    Raises:
        RefreshInProgress: A lock-classified `duckdb.IOException` was
            raised while constructing the client (a writer holds the file).
        CatalogueMissing: The DuckDB catalogue file does not exist.
        duckdb.Error: Any non-lock-classified duckdb error, propagated
            unchanged — mirrors `client_ctx`'s narrow-catch philosophy.
    """
    client: GridflowClient | None = None
    try:
        client = GridflowClient(get_settings().duckdb_path)
    except FileNotFoundError as exc:
        raise CatalogueMissing(str(exc)) from exc
    except duckdb.IOException as exc:
        if is_lock_error(str(exc)):
            raise RefreshInProgress("A dataset refresh is in progress. Try again shortly.") from exc
        raise
    finally:
        if client is not None:
            client.close()


def build_command(spec: DatasetSpec, start: date, end: date) -> list[str]:
    """Build the `gridflow pipeline` command for one dataset and window.

    Explorer `end` is an inclusive day, but the CLI's bare-date `--end`
    resolves to a midnight-UTC instant (exclusive upper bound), so `end` is
    advanced by one day to convert inclusive-day to exclusive-midnight and
    ensure the final requested day is actually ingested.

    Args:
        spec: The catalogue entry, supplying `cli_source`/`cli_dataset`.
        start: Inclusive fetch window start.
        end: Inclusive fetch window end.

    Returns:
        The argv list, per P1-PLAN.md "Subprocess runner" > "CLI mapping".
    """
    return [
        str(GRIDFLOW_EXE),
        "pipeline",
        spec.cli_source,
        spec.cli_dataset,
        "--start",
        start.isoformat(),
        "--end",
        (end + timedelta(days=1)).isoformat(),
    ]


def build_env() -> dict[str, str] | None:
    """Build the subprocess environment, injecting the catalogue path if set.

    When `get_settings().duckdb_path` is not `None`, the child inherits the
    parent environment plus `GRIDFLOW_DUCKDB_PATH` pointing at that same
    path — closing the silent-divergence class where the API and the fetch
    subprocess resolve different catalogue files (P3-PLAN.md "Subprocess
    environment"). When the setting is `None` (deferring to gridflow's own
    resolution), the environment is inherited unchanged.

    Returns:
        `None` to let `subprocess.run` inherit the parent environment
        as-is, or a dict of the parent environment plus the injected
        `GRIDFLOW_DUCKDB_PATH`.
    """
    duckdb_path = get_settings().duckdb_path
    if duckdb_path is None:
        return None
    return {**os.environ, "GRIDFLOW_DUCKDB_PATH": str(duckdb_path)}


def launch(cmd: list[str], env: dict[str, str] | None) -> tuple[int, str]:
    """Run the fetch subprocess once. The only `subprocess.run` call site.

    **Test monkeypatch seam:** tests replace `app.fetch.launch` and never
    invoke a real `gridflow` CLI.

    Args:
        cmd: The argv list from `build_command`.
        env: The environment from `build_env`, or `None` to inherit.

    Returns:
        `(returncode, stderr)`.

    Raises:
        subprocess.TimeoutExpired: The subprocess exceeded
            `_SUBPROCESS_TIMEOUT_SECONDS`. `subprocess.run` already kills
            and reaps the child before raising this — no manual cleanup is
            needed (P1-PLAN.md "Subprocess runner" > "Timeout").
    """
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=_SUBPROCESS_TIMEOUT_SECONDS,
        env=env,
    )
    return result.returncode, result.stderr


def _sleep(seconds: float) -> None:
    """Thin `time.sleep` wrapper — the seam that keeps tests instant."""
    time.sleep(seconds)


def run_fetch_job(job: Job, spec: DatasetSpec, start: date, end: date) -> None:
    """Run (and retry) the fetch subprocess, recording the job's outcome.

    The thread body: builds the command/env once, then attempts `launch` up
    to `_MAX_ATTEMPTS` times, sleeping the pinned schedule before each retry.
    Every exit path funnels through the single `finally` below, so no path
    leaves the job `RUNNING` — see P1-PLAN.md "Subprocess runner" > "Retry
    classification".

    **Written to be callable synchronously** — tests call this directly with
    no threads involved.

    Args:
        job: The `Job` created by `try_start`, already `RUNNING`.
        spec: The catalogue entry identifying the dataset to fetch.
        start: Inclusive fetch window start.
        end: Inclusive fetch window end.
    """
    state = JobState.FAILED
    message: str | None = "fetch worker crashed"
    try:
        cmd = build_command(spec, start, end)
        env = build_env()

        for attempt in range(_MAX_ATTEMPTS):
            if attempt:
                _sleep(_RETRY_DELAYS[attempt - 1])
            try:
                returncode, stderr = launch(cmd, env)
            except subprocess.TimeoutExpired:
                state, message = JobState.FAILED, "timed out after 900s"
                return
            if returncode == 0:
                state, message = JobState.SUCCEEDED, None
                return
            if not is_lock_error(stderr):
                state, message = JobState.FAILED, stderr[-2000:]
                return
        state, message = JobState.FAILED, "catalogue busy: still locked after 5 retries"
    finally:
        JOBS.finish(job.job_id, state, message)
