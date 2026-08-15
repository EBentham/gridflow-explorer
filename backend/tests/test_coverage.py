"""Route tests for `GET /api/datasets/{dataset_id}/coverage`.

Mirrors `test_api.py`'s pattern: `app.routers.datasets.client_ctx` is
monkeypatched to `StubClientCtx` for the ordinary cases, and the **real**
`client_ctx` (via the `running_job` fixture) is used for the guard test —
proving the 503 `refresh_in_progress` path applies to this route too.
"""

from __future__ import annotations

import pytest
from conftest import StubClientCtx
from fastapi.testclient import TestClient

from app.main import app
from app.routers import datasets as datasets_router


def _client() -> TestClient:
    return TestClient(app)


def test_coverage_fully_covered_range_has_no_missing_days(
    monkeypatch: pytest.MonkeyPatch, stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(datasets_router, "client_ctx", stub_client_ctx)

    response = _client().get(
        "/api/datasets/generation-mix/coverage",
        params={"start": "2026-08-10", "end": "2026-08-10"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["dataset_id"] == "generation-mix"
    assert body["requested"] == {"start": "2026-08-10", "end": "2026-08-10"}
    assert body["present_dates"] == ["2026-08-10"]
    assert body["missing_dates"] == []
    assert body["missing_day_count"] == 0
    assert body["requested_day_count"] == 1


def test_coverage_range_extending_past_fixture_reports_missing_dates_in_order(
    monkeypatch: pytest.MonkeyPatch, stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(datasets_router, "client_ctx", stub_client_ctx)

    response = _client().get(
        "/api/datasets/generation-mix/coverage",
        params={"start": "2026-08-09", "end": "2026-08-11"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["present_dates"] == ["2026-08-10"]
    assert body["missing_dates"] == ["2026-08-09", "2026-08-11"]
    assert body["missing_day_count"] == 2
    assert body["requested_day_count"] == 3
    assert body["missing_day_count"] == len(body["missing_dates"])
    assert body["requested_day_count"] == len(body["present_dates"]) + len(body["missing_dates"])


def test_coverage_unknown_dataset_returns_404(
    monkeypatch: pytest.MonkeyPatch, stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(datasets_router, "client_ctx", stub_client_ctx)

    response = _client().get("/api/datasets/not-a-real-dataset/coverage")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_dataset"
    assert not stub_client_ctx.entered


def test_coverage_bad_range_returns_422(
    monkeypatch: pytest.MonkeyPatch, stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(datasets_router, "client_ctx", stub_client_ctx)

    response = _client().get(
        "/api/datasets/generation-mix/coverage",
        params={"start": "2026-08-15", "end": "2026-08-01"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_range"
    assert not stub_client_ctx.entered


def test_coverage_returns_503_during_job_with_real_client_ctx(running_job: None) -> None:
    """Pinning test: no `client_ctx` monkeypatch — the real guard applies here too."""
    response = _client().get(
        "/api/datasets/generation-mix/coverage",
        params={"start": "2026-08-01", "end": "2026-08-10"},
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "refresh_in_progress"
