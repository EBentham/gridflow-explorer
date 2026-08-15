"""Route tests for `/api/datasets*`.

`app.routers.datasets.client_ctx` is monkeypatched to `StubClientCtx` — no
`app.dependency_overrides` anywhere, since the client is a plain
context manager, never a FastAPI dependency.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from conftest import StubClientCtx
from fastapi.testclient import TestClient

from app.jobs import JobManager, JobState
from app.main import app
from app.routers import datasets as datasets_router
from app.routers import jobs as jobs_router


def _client() -> TestClient:
    return TestClient(app)


def test_datasets_lists_both_datasets_with_series_and_id() -> None:
    response = _client().get("/api/datasets")

    assert response.status_code == 200
    body = response.json()
    ids = {entry["id"] for entry in body}
    assert ids == {"generation-mix", "system-prices"}
    for entry in body:
        assert entry["series"], f"{entry['id']} has no series"
        assert entry["default_range_days"] == 7
        assert "cli_source" not in entry
        assert "cli_dataset" not in entry
        assert "loader" not in entry


def test_data_route_default_window_is_seven_days_ending_today(
    monkeypatch: pytest.MonkeyPatch, stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(datasets_router, "client_ctx", stub_client_ctx)

    response = _client().get("/api/datasets/generation-mix/data")

    assert response.status_code == 200
    records = response.json()
    assert records
    expected_keys = {"timestamp", "nuclear", "wind", "imports", "other"}
    assert expected_keys.issubset(records[0].keys())

    assert stub_client_ctx.entered
    assert len(stub_client_ctx.client.calls) == 1
    _, start, end = stub_client_ctx.client.calls[0]
    today = datetime.now(UTC).date()
    assert end == today
    assert start == today - timedelta(days=6)  # 7-day inclusive window


def test_unknown_dataset_returns_404_and_never_enters_client_ctx(
    monkeypatch: pytest.MonkeyPatch, stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(datasets_router, "client_ctx", stub_client_ctx)

    response = _client().get("/api/datasets/not-a-real-dataset/data")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "unknown_dataset",
            "message": response.json()["error"]["message"],
        }
    }
    assert not stub_client_ctx.entered


def test_bad_range_start_after_end_returns_422(
    monkeypatch: pytest.MonkeyPatch, stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(datasets_router, "client_ctx", stub_client_ctx)

    response = _client().get(
        "/api/datasets/generation-mix/data",
        params={"start": "2026-08-15", "end": "2026-08-01"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_range"
    assert not stub_client_ctx.entered


def test_bad_range_unparseable_date_returns_422(
    monkeypatch: pytest.MonkeyPatch, stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(datasets_router, "client_ctx", stub_client_ctx)

    response = _client().get(
        "/api/datasets/generation-mix/data", params={"start": "nonsense"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_range"
    assert not stub_client_ctx.entered


def test_validation_ordering_holds_with_real_client_ctx_and_running_job(
    running_job: None,
) -> None:
    """Pinning test: no `client_ctx` monkeypatch here.

    With `JOBS` genuinely `RUNNING` and the real `client_ctx` in place, an
    unknown dataset must still 404 (not 503) and a bad range must still
    422 (not 503) — validation runs before client acquisition even during
    a live refresh.
    """
    client = _client()

    response = client.get("/api/datasets/not-a-real-dataset/data")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_dataset"

    response = client.get(
        "/api/datasets/generation-mix/data",
        params={"start": "2026-08-15", "end": "2026-08-01"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_range"


# --- POST /api/datasets/{dataset_id}/fetch and GET /api/jobs/current ------
#
# `app.routers.jobs.run_fetch_job` and `probe_writer_lock` are monkeypatched
# in every test below so no subprocess is ever launched. Job-state tests use
# a `fresh_jobs` `JobManager` (monkeypatched over `jobs_router.JOBS`) rather
# than the real process-global `JOBS`, so they are isolated from job state
# left behind by other test modules and do not depend on execution order.


def _noop_run_fetch_job(job: object, spec: object, start: object, end: object) -> None:
    """Replaces `run_fetch_job`: leaves the job `RUNNING`, no thread work done."""


@pytest.fixture
def fresh_jobs(monkeypatch: pytest.MonkeyPatch) -> JobManager:
    """A brand-new `JobManager`, isolated from every other test's job state."""
    manager = JobManager()
    monkeypatch.setattr(jobs_router, "JOBS", manager)
    return manager


def test_post_fetch_accepts_and_returns_running_job(
    monkeypatch: pytest.MonkeyPatch, fresh_jobs: JobManager
) -> None:
    monkeypatch.setattr(jobs_router, "run_fetch_job", _noop_run_fetch_job)
    monkeypatch.setattr(jobs_router, "probe_writer_lock", lambda: None)

    response = _client().post(
        "/api/datasets/generation-mix/fetch",
        params={"start": "2026-08-01", "end": "2026-08-02"},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["state"] == "running"
    assert body["dataset_id"] == "generation-mix"
    assert body["job_id"]


def test_post_fetch_while_running_returns_409_standard_envelope(
    monkeypatch: pytest.MonkeyPatch, fresh_jobs: JobManager
) -> None:
    monkeypatch.setattr(jobs_router, "run_fetch_job", _noop_run_fetch_job)
    monkeypatch.setattr(jobs_router, "probe_writer_lock", lambda: None)
    client = _client()

    first = client.post(
        "/api/datasets/generation-mix/fetch",
        params={"start": "2026-08-01", "end": "2026-08-02"},
    )
    assert first.status_code == 202

    second = client.post(
        "/api/datasets/generation-mix/fetch",
        params={"start": "2026-08-01", "end": "2026-08-02"},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "refresh_in_progress"


def test_post_fetch_unknown_dataset_404_never_reaches_preflight(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """404/422 are answered before `try_start` — same ordering rule as `/data`."""
    preflight_calls: list[None] = []
    monkeypatch.setattr(jobs_router, "probe_writer_lock", lambda: preflight_calls.append(None))

    response = _client().post(
        "/api/datasets/not-a-real-dataset/fetch",
        params={"start": "2026-08-01", "end": "2026-08-02"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_dataset"
    assert preflight_calls == []


def test_post_fetch_bad_range_422_never_reaches_preflight(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    preflight_calls: list[None] = []
    monkeypatch.setattr(jobs_router, "probe_writer_lock", lambda: preflight_calls.append(None))

    response = _client().post(
        "/api/datasets/generation-mix/fetch",
        params={"start": "2026-08-15", "end": "2026-08-01"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_range"
    assert preflight_calls == []


def test_jobs_current_idle_on_fresh_manager(fresh_jobs: JobManager) -> None:
    response = _client().get("/api/jobs/current")

    assert response.status_code == 200
    assert response.json() == {"state": "idle"}


def test_jobs_current_reports_running_job_after_post(
    monkeypatch: pytest.MonkeyPatch, fresh_jobs: JobManager
) -> None:
    monkeypatch.setattr(jobs_router, "run_fetch_job", _noop_run_fetch_job)
    monkeypatch.setattr(jobs_router, "probe_writer_lock", lambda: None)
    client = _client()

    post_response = client.post(
        "/api/datasets/generation-mix/fetch",
        params={"start": "2026-08-01", "end": "2026-08-02"},
    )
    job_id = post_response.json()["job_id"]

    response = client.get("/api/jobs/current")

    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "running"
    assert body["job_id"] == job_id
    assert body["dataset_id"] == "generation-mix"
    assert body["finished_at"] is None


def test_jobs_current_reports_terminal_state_and_message_after_finish(
    monkeypatch: pytest.MonkeyPatch, fresh_jobs: JobManager
) -> None:
    monkeypatch.setattr(jobs_router, "run_fetch_job", _noop_run_fetch_job)
    monkeypatch.setattr(jobs_router, "probe_writer_lock", lambda: None)
    client = _client()

    post_response = client.post(
        "/api/datasets/generation-mix/fetch",
        params={"start": "2026-08-01", "end": "2026-08-02"},
    )
    job_id = post_response.json()["job_id"]

    fresh_jobs.finish(job_id, JobState.FAILED, "catalogue busy")

    response = client.get("/api/jobs/current")

    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "failed"
    assert body["message"] == "catalogue busy"
    assert body["finished_at"] is not None
