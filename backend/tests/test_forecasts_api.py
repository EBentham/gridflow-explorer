"""Route tests for `/api/forecasts/*`: status codes, envelopes and acquisition order.

The selection rules themselves are pinned in `test_forecasts.py`. The
`forecast_ctx` fixture installs a stub as `app.routers.forecasts.client_ctx`;
there is no `app.dependency_overrides`, because the client is a plain context
manager, never a FastAPI dependency.
"""

from __future__ import annotations

import pytest
from conftest import empty_forecasts_frame, empty_metrics_frame
from fastapi.testclient import TestClient

from app.forecasts import _encode_variant_key
from app.main import app

V1_ROLLING = _encode_variant_key("day_ahead.lgbm_demand.v1", "v1_rolling_23h30m")


def _client() -> TestClient:
    return TestClient(app)


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/api/forecasts/variants", {}),
        ("/api/forecasts/day", {"date": "2026-08-10"}),
        ("/api/forecasts/metrics", {}),
    ],
)
def test_empty_store_answers_200_and_an_empty_list(forecast_ctx, path, params) -> None:
    ctx = forecast_ctx(empty_forecasts_frame(), empty_metrics_frame())

    response = _client().get(path, params=params)

    assert response.status_code == 200
    assert response.json() == []
    assert ctx.entered


def test_variants_lists_one_entry_per_model_id(forecast_ctx) -> None:
    forecast_ctx()

    response = _client().get("/api/forecasts/variants")

    assert response.status_code == 200
    body = response.json()
    assert {entry["model_id"] for entry in body} == {
        "day_ahead.lgbm_demand.v1",
        "day_ahead.lgbm_demand.v2",
    }
    for entry in body:
        assert "title" in entry
        assert "perfect_prog_caveat" in entry


def test_day_variant_key_returns_the_newest_write_in_utc(forecast_ctx) -> None:
    forecast_ctx()

    response = _client().get(
        "/api/forecasts/day",
        params={"date": "2026-08-10", "variant_key": V1_ROLLING},
    )

    assert response.status_code == 200
    period_1 = [r for r in response.json() if r["settlement_period"] == 1]
    assert len(period_1) == 1
    assert period_1[0]["q_0.5"] == 200.0
    assert period_1[0]["delivery_time"] == "2026-08-09T23:00:00Z"


def test_day_unknown_variant_key_returns_404(forecast_ctx) -> None:
    forecast_ctx()

    response = _client().get(
        "/api/forecasts/day",
        params={"date": "2026-08-10", "variant_key": "not-a-real-model::not-a-real-policy"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_variant"


def test_day_bad_date_returns_422_and_never_enters_client_ctx(forecast_ctx) -> None:
    ctx = forecast_ctx()

    response = _client().get("/api/forecasts/day", params={"date": "nonsense"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_range"
    assert not ctx.entered


def test_day_unknown_variant_key_during_writer_lock_answers_503_not_404(
    running_job: None,
) -> None:
    """Pinning test for the documented exception in `routers/forecasts.py`:
    with no `client_ctx` monkeypatch and `JOBS` genuinely `RUNNING`, an
    unknown `variant_key` cannot be distinguished from a known one before
    the guard — both answer `503 refresh_in_progress`, not `404`. This is
    the accepted, documented consequence of `unknown_variant` requiring a
    store read (unlike `dataset_id`'s static registry lookup).
    """
    response = _client().get(
        "/api/forecasts/day",
        params={"date": "2026-08-10", "variant_key": "not-a-real-model::not-a-real-policy"},
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "refresh_in_progress"


def test_metrics_newest_run_per_variant(forecast_ctx) -> None:
    forecast_ctx()

    response = _client().get("/api/forecasts/metrics", params={"variant_key": V1_ROLLING})

    assert response.status_code == 200
    [record] = response.json()
    assert record["run_id"] == "run-new"
    assert record["perfect_prog_caveat"] is False
