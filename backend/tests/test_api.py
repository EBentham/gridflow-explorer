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

from app.main import app
from app.routers import datasets as datasets_router


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
