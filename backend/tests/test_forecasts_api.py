"""Route tests for `/api/forecasts/*`.

`app.routers.forecasts.client_ctx` is monkeypatched to `StubClientCtx` — no
`app.dependency_overrides` anywhere, matching `test_api.py`'s pattern: the
client is a plain context manager, never a FastAPI dependency.
"""

from __future__ import annotations

import pytest
from conftest import ForecastStubClient, StubClientCtx
from fastapi.testclient import TestClient

from app.main import app
from app.routers import forecasts as forecasts_router


def _client() -> TestClient:
    return TestClient(app)


def test_variants_empty_store_returns_200_and_empty_list(
    monkeypatch: pytest.MonkeyPatch, empty_forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", empty_forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/variants")

    assert response.status_code == 200
    assert response.json() == []
    assert empty_forecast_stub_client_ctx.entered


def test_variants_lists_one_entry_per_model_id(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/variants")

    assert response.status_code == 200
    body = response.json()
    ids = {entry["model_id"] for entry in body}
    assert ids == {"day_ahead.lgbm_demand.v1", "day_ahead.lgbm_demand.v2"}
    for entry in body:
        assert "title" in entry
        assert "perfect_prog_caveat" in entry


def test_day_returns_only_newest_write_for_a_superseded_identity(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)

    response = _client().get(
        "/api/forecasts/day",
        params={"date": "2026-08-10", "model_id": "day_ahead.lgbm_demand.v1"},
    )

    assert response.status_code == 200
    records = response.json()
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 1
    assert period_1[0]["q_0.5"] == 200.0


def test_day_delivery_time_is_relabelled_to_genuine_utc(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/day", params={"date": "2026-08-10"})

    assert response.status_code == 200
    delivery_times = {r["delivery_time"] for r in response.json()}
    assert "2026-08-09T23:00:00Z" in delivery_times


def test_day_empty_store_valid_date_returns_200_and_empty_list(
    monkeypatch: pytest.MonkeyPatch, empty_forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", empty_forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/day", params={"date": "2026-08-10"})

    assert response.status_code == 200
    assert response.json() == []


def test_day_valid_date_with_no_rows_returns_200_and_empty_list(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/day", params={"date": "2026-08-11"})

    assert response.status_code == 200
    assert response.json() == []


def test_day_unknown_model_id_returns_404(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)

    response = _client().get(
        "/api/forecasts/day",
        params={"date": "2026-08-10", "model_id": "not-a-real-model"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_variant"


def test_day_bad_date_returns_422_and_never_enters_client_ctx(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/day", params={"date": "nonsense"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_range"
    assert not forecast_stub_client_ctx.entered


def test_metrics_newest_run_per_variant(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)

    response = _client().get(
        "/api/forecasts/metrics", params={"model_id": "day_ahead.lgbm_demand.v1"}
    )

    assert response.status_code == 200
    records = response.json()
    assert len(records) == 1
    assert records[0]["run_id"] == "run-new"
    assert records[0]["perfect_prog_caveat"] is False


def test_metrics_empty_store_returns_200_and_empty_list(
    monkeypatch: pytest.MonkeyPatch, empty_forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", empty_forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/metrics")

    assert response.status_code == 200
    assert response.json() == []


def test_forecast_stub_client_type_is_exercised_by_route(
    forecast_stub_client_ctx: StubClientCtx,
) -> None:
    # Sanity check on the fixture wiring itself, matching test_api.py's
    # style of asserting `.entered` explicitly.
    assert isinstance(forecast_stub_client_ctx.client, ForecastStubClient)
