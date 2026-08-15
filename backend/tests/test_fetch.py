"""Tests for the P3 subprocess runner (`app.fetch`) and `JobManager.try_start`'s
`preflight` parameter (`app.jobs`).

`launch` and `_sleep` are monkeypatched everywhere a job is driven, so no
test ever spawns a real `gridflow` CLI or sleeps the real retry schedule —
`run_fetch_job` is called directly (synchronously), never via a thread.

Job state is process-global (`app.jobs.JOBS`), so an autouse fixture resets
it to idle after every test in this module regardless of outcome.
"""

from __future__ import annotations

import subprocess
from datetime import date
from pathlib import Path

import duckdb
import pytest
from conftest import CountingFakeClient

import app.jobs as jobs_module
from app import fetch
from app.catalogue import get_dataset
from app.errors import RefreshInProgress
from app.jobs import JOBS, JobState


class _FakeSettings:
    """Minimal stand-in for `Settings`, carrying only what `fetch.py` reads."""

    def __init__(self, duckdb_path: Path | None) -> None:
        self.duckdb_path = duckdb_path


@pytest.fixture(autouse=True)
def _reset_jobs() -> None:
    """Guarantee `JOBS` is idle after every test in this module."""
    yield
    current = JOBS.current()
    if current is not None and JOBS.is_running():
        JOBS.finish(current.job_id, JobState.IDLE, None)


def _start_job(dataset_id: str = "generation-mix"):
    """Start a job that stays `RUNNING` forever (empty target), mirroring
    `conftest.py`'s `running_job` fixture, so `run_fetch_job` can be driven
    against a real registered `Job` and `JOBS.finish` actually applies.
    """
    job = JOBS.try_start(dataset_id, target=lambda _job: None)
    assert job is not None, "a previous test left JOBS RUNNING"
    return job


# --- run_fetch_job: retry classification, the P1 retry contract -----------


def test_happy_path_success_on_first_attempt(monkeypatch: pytest.MonkeyPatch) -> None:
    job = _start_job()
    calls: list[list[str]] = []
    monkeypatch.setattr(fetch, "launch", lambda cmd, env: (calls.append(cmd), (0, ""))[1])
    sleeps: list[float] = []
    monkeypatch.setattr(fetch, "_sleep", lambda s: sleeps.append(s))

    spec = get_dataset("generation-mix")
    fetch.run_fetch_job(job, spec, date(2026, 8, 1), date(2026, 8, 15))

    assert job.state == JobState.SUCCEEDED
    assert job.message is None
    assert len(calls) == 1
    assert sleeps == []


def test_retry_twice_then_success_pins_launch_count_and_delays(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case 5 (retry): the pinned P1 retry contract — do not let this drift."""
    job = _start_job()
    responses = iter(
        [
            (1, "Could not set lock on file gridflow.duckdb"),
            (1, "conflicting lock detected"),
            (0, ""),
        ]
    )
    calls: list[list[str]] = []

    def fake_launch(cmd: list[str], env: dict[str, str] | None) -> tuple[int, str]:
        calls.append(cmd)
        return next(responses)

    monkeypatch.setattr(fetch, "launch", fake_launch)
    sleeps: list[float] = []
    monkeypatch.setattr(fetch, "_sleep", lambda s: sleeps.append(s))

    spec = get_dataset("generation-mix")
    fetch.run_fetch_job(job, spec, date(2026, 8, 1), date(2026, 8, 15))

    assert job.state == JobState.SUCCEEDED
    assert job.message is None
    assert len(calls) == 3
    assert sleeps == [0.5, 1]


def test_retry_exhaustion_pins_launch_count_and_delays(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 5 (exhaustion): the pinned P1 retry contract — do not let this drift."""
    job = _start_job()
    calls: list[list[str]] = []

    def fake_launch(cmd: list[str], env: dict[str, str] | None) -> tuple[int, str]:
        calls.append(cmd)
        return 1, "Could not set lock on file gridflow.duckdb"

    monkeypatch.setattr(fetch, "launch", fake_launch)
    sleeps: list[float] = []
    monkeypatch.setattr(fetch, "_sleep", lambda s: sleeps.append(s))

    spec = get_dataset("generation-mix")
    fetch.run_fetch_job(job, spec, date(2026, 8, 1), date(2026, 8, 15))

    assert job.state == JobState.FAILED
    assert "catalogue busy" in job.message
    assert len(calls) == 6
    assert sleeps == [0.5, 1, 2, 4, 8]


def test_non_lock_error_fails_immediately_no_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 2: a non-lock-classified non-zero exit fails on the first attempt."""
    job = _start_job()
    calls: list[list[str]] = []
    stderr_text = "Traceback (most recent call last):\n" + "ValueError: dataset schema drift\n"

    def fake_launch(cmd: list[str], env: dict[str, str] | None) -> tuple[int, str]:
        calls.append(cmd)
        return 1, stderr_text

    monkeypatch.setattr(fetch, "launch", fake_launch)
    sleeps: list[float] = []
    monkeypatch.setattr(fetch, "_sleep", lambda s: sleeps.append(s))

    spec = get_dataset("generation-mix")
    fetch.run_fetch_job(job, spec, date(2026, 8, 1), date(2026, 8, 15))

    assert job.state == JobState.FAILED
    assert len(calls) == 1
    assert sleeps == []
    assert "ValueError: dataset schema drift" in job.message


def test_timeout_expired_fails_with_timeout_message_no_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case 9: `subprocess.run` already killed and reaped the child — no manual kill."""
    job = _start_job()

    def fake_launch(cmd: list[str], env: dict[str, str] | None) -> tuple[int, str]:
        raise subprocess.TimeoutExpired(cmd, 900)

    monkeypatch.setattr(fetch, "launch", fake_launch)

    def fail_if_slept(seconds: float) -> None:
        raise AssertionError("must not sleep on a timeout")

    monkeypatch.setattr(fetch, "_sleep", fail_if_slept)

    spec = get_dataset("generation-mix")
    fetch.run_fetch_job(job, spec, date(2026, 8, 1), date(2026, 8, 15))

    assert job.state == JobState.FAILED
    assert job.message == "timed out after 900s"


# --- JobManager.try_start: preflight, transactional start -----------------


def test_thread_creation_failure_rolls_job_back_to_failed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case 1: a raise during thread startup leaves the job FAILED, not RUNNING."""

    class ExplodingThread:
        def __init__(self, *args: object, **kwargs: object) -> None:
            raise RuntimeError("thread creation exploded")

    monkeypatch.setattr(jobs_module.threading, "Thread", ExplodingThread)

    with pytest.raises(RuntimeError):
        JOBS.try_start("generation-mix", target=lambda _job: None)

    job = JOBS.current()
    assert job is not None
    assert job.state == JobState.FAILED


def test_second_try_start_while_running_returns_none() -> None:
    """Case 6: a second concurrent try_start is refused, not queued."""
    job = _start_job()

    second = JOBS.try_start("generation-mix", target=lambda _job: None)

    assert second is None
    JOBS.finish(job.job_id, JobState.IDLE, None)


def test_preflight_raising_propagates_with_no_job_and_no_thread(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case 7/14: preflight raises inside the lock, before Job creation.

    `try_start` must propagate the raise, `JOBS.current()` must be
    identical to what it was before the call (no job created), and no
    thread may have been instantiated — a no-op target could not prove
    this, so we use a recording fake `Thread`.
    """
    before = JOBS.current()
    thread_calls: list[tuple[object, object]] = []

    class RecordingThread:
        def __init__(self, *args: object, **kwargs: object) -> None:
            thread_calls.append((args, kwargs))

        def start(self) -> None:
            raise AssertionError("thread.start() must never be reached")

    monkeypatch.setattr(jobs_module.threading, "Thread", RecordingThread)

    def raising_preflight() -> None:
        raise RefreshInProgress("a writer is live")

    with pytest.raises(RefreshInProgress):
        JOBS.try_start(
            "generation-mix", target=lambda _job: None, preflight=raising_preflight
        )

    assert JOBS.current() is before
    assert thread_calls == []


# --- probe_writer_lock: the preflight probe itself -------------------------


def test_probe_closes_client_on_successful_construction(
    monkeypatch: pytest.MonkeyPatch, counting_fake_client: type[CountingFakeClient]
) -> None:
    counting_fake_client.configure()
    monkeypatch.setattr(fetch, "GridflowClient", counting_fake_client)
    monkeypatch.setattr(
        fetch, "get_settings", lambda: _FakeSettings(Path("C:/gridflow-data/gridflow.duckdb"))
    )

    fetch.probe_writer_lock()

    assert counting_fake_client.count == 1
    assert counting_fake_client.close_calls == 1


def test_probe_leaves_no_handle_open_when_construction_raises(
    monkeypatch: pytest.MonkeyPatch, counting_fake_client: type[CountingFakeClient]
) -> None:
    """Case 11: construction itself raising means no client object ever
    exists to close — `close()` is called exactly zero times, proving the
    probe never leaks the very handle it is testing for. (`close()` cannot
    be called on an object whose `__init__` never returned; the success
    path above pins the complementary "close IS called when construction
    succeeds" half of the same invariant.)
    """
    counting_fake_client.configure(
        raise_exc=duckdb.IOException("Could not set lock on file gridflow.duckdb")
    )
    monkeypatch.setattr(fetch, "GridflowClient", counting_fake_client)
    monkeypatch.setattr(
        fetch, "get_settings", lambda: _FakeSettings(Path("C:/gridflow-data/gridflow.duckdb"))
    )

    with pytest.raises(RefreshInProgress):
        fetch.probe_writer_lock()

    assert counting_fake_client.count == 1
    assert counting_fake_client.close_calls == 0


# --- build_env / build_command: case 13 and the CLI mapping ---------------


def test_build_env_injects_duckdb_path_and_preserves_other_vars(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GRIDFLOW_EXPLORER_TEST_MARKER", "abc123")
    configured_path = Path("C:/gridflow-data/gridflow.duckdb")
    monkeypatch.setattr(fetch, "get_settings", lambda: _FakeSettings(configured_path))

    env = fetch.build_env()

    assert env is not None
    assert env["GRIDFLOW_DUCKDB_PATH"] == str(configured_path)
    assert env["GRIDFLOW_EXPLORER_TEST_MARKER"] == "abc123"


def test_build_env_returns_none_when_duckdb_path_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fetch, "get_settings", lambda: _FakeSettings(None))

    assert fetch.build_env() is None


def test_build_command_matches_documented_shape_for_both_datasets() -> None:
    """`--end` is the day after the inclusive `end` arg — see
    `test_build_command_advances_end_by_one_day_for_zero_width_window` for
    the inclusive-day -> exclusive-midnight contract this encodes.
    """
    generation_mix = get_dataset("generation-mix")
    cmd = fetch.build_command(generation_mix, date(2026, 8, 1), date(2026, 8, 15))
    assert cmd == [
        str(fetch.GRIDFLOW_EXE),
        "pipeline",
        "elexon",
        "fuelhh",
        "--start",
        "2026-08-01",
        "--end",
        "2026-08-16",
    ]

    system_prices = get_dataset("system-prices")
    cmd2 = fetch.build_command(system_prices, date(2026, 8, 1), date(2026, 8, 15))
    assert cmd2 == [
        str(fetch.GRIDFLOW_EXE),
        "pipeline",
        "elexon",
        "system_prices",
        "--start",
        "2026-08-01",
        "--end",
        "2026-08-16",
    ]


def test_build_command_advances_end_by_one_day_for_zero_width_window() -> None:
    """Regression for the end-day fetch gap: explorer `end` is an inclusive
    day, but the CLI's bare-date `--end` resolves to a midnight-UTC instant
    (exclusive upper bound). A same-day request (`start == end`) would
    therefore be a zero-width window and ingest nothing unless `--end` is
    advanced by one day past the requested `end`.
    """
    generation_mix = get_dataset("generation-mix")
    cmd = fetch.build_command(generation_mix, date(2026, 3, 1), date(2026, 3, 1))
    assert cmd == [
        str(fetch.GRIDFLOW_EXE),
        "pipeline",
        "elexon",
        "fuelhh",
        "--start",
        "2026-03-01",
        "--end",
        "2026-03-02",
    ]
