"""HTTP, cache, and shared Windows sharing-violation guard checks."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import date
from threading import Event

import duckdb
import pytest
from conftest import CountingFakeClient
from fastapi.testclient import TestClient

from app import deps, fetch, sources
from app.catalogue import get_dataset
from app.errors import RefreshInProgress
from app.jobs import JobManager, JobState
from app.main import app
from app.routers import jobs as jobs_router

SHARING = "The process cannot access the file because it is being used by another process."


@pytest.fixture(autouse=True)
def _clear_sources_cache(monkeypatch: pytest.MonkeyPatch):
    """Keep process-local snapshots and clocks isolated across tests."""
    monkeypatch.setattr(sources, "_snapshot", None)
    monkeypatch.setattr(sources, "_refreshed_at", 0.0)
    yield


def _empty_client_context():
    """Return one complete schema scan without touching the real catalogue."""

    class Client:
        def __init__(self):
            self.calls = 0
            self.closed = False

        def get_tables(self):
            self.calls += 1
            return []

        def query(self, sql):
            import polars as pl

            self.calls += 1
            return pl.DataFrame(
                schema={"table_name": pl.String, "column_name": pl.String, "data_type": pl.String}
            )

        def close(self):
            self.closed = True

    client = Client()
    entries = []

    @contextmanager
    def ctx():
        entries.append(True)
        try:
            yield client
        finally:
            client.close()

    return ctx, client, entries


def test_http_contract_cache_is_lazy_and_fresh_hit_skips_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Detect startup scans, repeated warm scans, or leaking server-only fields."""
    ctx, client, entries = _empty_client_context()
    monkeypatch.setattr(sources, "client_ctx", ctx)
    assert entries == []
    first = TestClient(app).get("/api/sources")
    second = TestClient(app).get("/api/sources")
    assert first.status_code == second.status_code == 200
    assert len(entries) == 1
    assert client.closed
    assert client.calls == 2
    body = second.json()
    assert body["generated_at"] == first.json()["generated_at"]
    assert len(body["sources"]) == 9
    assert sum(len(f["datasets"]) for s in body["sources"] for f in s["families"]) == 172
    dataset = body["sources"][0]["families"][0]["datasets"][0]
    assert {
        "id",
        "schedule",
        "kind",
        "verdict",
        "held",
        "relation",
        "coverage",
        "latest_day_rule",
    } <= set(dataset)
    assert "dedup" not in dataset
    assert "row_filter" not in dataset
    assert "base_relation" not in dataset
    assert TestClient(app).get("/api/datasets").status_code == 200


def test_warm_refresh_returns_stale_with_original_generated_at(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Detect failed refreshes destroying a usable snapshot or faking freshness."""
    ctx, _, _ = _empty_client_context()
    monkeypatch.setattr(sources, "client_ctx", ctx)
    original = TestClient(app).get("/api/sources").json()
    original_refreshed = sources._refreshed_at
    monkeypatch.setattr(sources, "_refreshed_at", -1000.0)

    @contextmanager
    def blocked():
        raise RefreshInProgress("busy")
        yield

    monkeypatch.setattr(sources, "client_ctx", blocked)
    stale = TestClient(app).get("/api/sources")
    assert stale.status_code == 200
    assert stale.json()["generated_at"] == original["generated_at"]
    assert sources._refreshed_at != original_refreshed
    assert sources._refreshed_at == -1000.0


def test_cold_concurrent_requests_build_once_and_publish_complete_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Detect duplicate cold scans or publication of a partly built manifest."""
    ctx, client, entries = _empty_client_context()
    entered = Event()
    release = Event()

    @contextmanager
    def delayed():
        with ctx() as selected:
            entered.set()
            assert release.wait(3)
            yield selected

    monkeypatch.setattr(sources, "client_ctx", delayed)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(sources.get_sources)
        assert entered.wait(3)
        second = pool.submit(sources.get_sources)
        assert not second.done()
        release.set()
        a, b = first.result(timeout=3), second.result(timeout=3)
    assert len(entries) == 1
    assert client.closed
    assert a["generated_at"] == b["generated_at"]
    assert sum(len(f["datasets"]) for s in a["sources"] for f in s["families"]) == 172


def test_cold_running_job_and_windows_sharing_violation_return_503(
    monkeypatch: pytest.MonkeyPatch,
    counting_fake_client: type[CountingFakeClient],
    running_job: None,
) -> None:
    """Detect client construction during a job and sharing violations escaping as 500."""
    monkeypatch.setattr(deps, "GridflowClient", counting_fake_client)
    response = TestClient(app).get("/api/sources")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "refresh_in_progress"
    assert counting_fake_client.count == 0


def test_windows_sharing_violation_maps_to_read_refresh_and_other_io_propagates(
    monkeypatch: pytest.MonkeyPatch,
    counting_fake_client: type[CountingFakeClient],
) -> None:
    """Detect the observed sharing message being missed or generic I/O being hidden."""
    counting_fake_client.configure(raise_exc=duckdb.IOException(SHARING))
    monkeypatch.setattr(deps, "GridflowClient", counting_fake_client)
    assert TestClient(app).get("/api/sources").status_code == 503
    assert (
        TestClient(app)
        .get("/api/datasets/generation-mix/data?start=2026-09-01&end=2026-09-01")
        .status_code
        == 503
    )
    counting_fake_client.configure(raise_exc=duckdb.IOException("permission denied"))
    with pytest.raises(duckdb.IOException, match="permission denied"), deps.client_ctx():
        pass


def test_fetch_preflight_sharing_violation_returns_409(
    monkeypatch: pytest.MonkeyPatch,
    counting_fake_client: type[CountingFakeClient],
) -> None:
    """Detect M1's write-path preflight status change disappearing."""
    manager = JobManager()
    monkeypatch.setattr(jobs_router, "JOBS", manager)
    counting_fake_client.configure(raise_exc=duckdb.IOException(SHARING))
    monkeypatch.setattr(fetch, "GridflowClient", counting_fake_client)
    response = TestClient(app).post(
        "/api/datasets/generation-mix/fetch?start=2026-09-01&end=2026-09-01"
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "refresh_in_progress"
    assert counting_fake_client.count == 1


def test_fetch_subprocess_sharing_violation_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Detect M1's subprocess retry change, including its first backoff."""
    manager = JobManager()
    monkeypatch.setattr(fetch, "JOBS", manager)
    job = manager.try_start("generation-mix", target=lambda _job: None)
    assert job is not None
    replies = iter([(1, SHARING), (0, "")])
    calls: list[bool] = []
    sleeps: list[float] = []
    monkeypatch.setattr(fetch, "launch", lambda cmd, env: (calls.append(True), next(replies))[1])
    monkeypatch.setattr(fetch, "_sleep", lambda seconds: sleeps.append(seconds))
    fetch.run_fetch_job(job, get_dataset("generation-mix"), date(2026, 9, 1), date(2026, 9, 1))
    assert job.state is JobState.SUCCEEDED
    assert len(calls) == 2
    assert sleeps == [0.5]
