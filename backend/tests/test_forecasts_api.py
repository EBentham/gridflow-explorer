"""Route tests for `/api/forecasts/*`.

`app.routers.forecasts.client_ctx` is monkeypatched to `StubClientCtx` — no
`app.dependency_overrides` anywhere, matching `test_api.py`'s pattern: the
client is a plain context manager, never a FastAPI dependency.
"""

from __future__ import annotations

import pytest
from conftest import ForecastStubClient, StubClientCtx
from fastapi.testclient import TestClient

from app.forecasts import _encode_variant_key
from app.main import app
from app.routers import forecasts as forecasts_router

V1_ROLLING = _encode_variant_key("day_ahead.lgbm_demand.v1", "v1_rolling_23h30m")
V1_DAY_ANCHORED = _encode_variant_key("day_ahead.lgbm_demand.v1", "v1_day_anchored_noon_d1")


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
        params={"date": "2026-08-10", "variant_key": V1_ROLLING},
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


def test_day_unknown_variant_key_returns_404(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)

    response = _client().get(
        "/api/forecasts/day",
        params={"date": "2026-08-10", "variant_key": "not-a-real-model::not-a-real-policy"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_variant"


def test_day_crossed_pair_of_two_real_components_returns_404_over_the_route(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    """Regression for Sol's finding: v1's model_id crossed with v2's
    vintage_policy_id — each half exists in the store, never together.
    """
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)
    crossed = _encode_variant_key("day_ahead.lgbm_demand.v1", "v2_rolling_23h30m")

    response = _client().get(
        "/api/forecasts/day",
        params={"date": "2026-08-10", "variant_key": crossed},
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


def test_metrics_newest_run_per_variant(
    monkeypatch: pytest.MonkeyPatch, forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/metrics", params={"variant_key": V1_ROLLING})

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


# --- Two-policy collision (ADR-057 section 3), exercised at the route ------


def test_variants_two_policy_families_yield_two_entries_over_the_route(
    monkeypatch: pytest.MonkeyPatch, two_policy_forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", two_policy_forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/variants")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    policy_ids = {entry["vintage_policy_id"] for entry in body}
    assert policy_ids == {"v1_rolling_23h30m", "v1_day_anchored_noon_d1"}
    titles = {entry["title"] for entry in body}
    assert len(titles) == 2, "each policy must get a distinguishable title"


def test_day_two_policy_rows_carry_vintage_policy_id_over_the_route(
    monkeypatch: pytest.MonkeyPatch, two_policy_forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", two_policy_forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/day", params={"date": "2026-08-10"})

    assert response.status_code == 200
    records = response.json()
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 2
    assert {r["vintage_policy_id"] for r in period_1} == {
        "v1_rolling_23h30m",
        "v1_day_anchored_noon_d1",
    }


def test_day_variant_key_query_param_narrows_to_one_policy_over_the_route(
    monkeypatch: pytest.MonkeyPatch, two_policy_forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", two_policy_forecast_stub_client_ctx)

    response = _client().get(
        "/api/forecasts/day",
        params={"date": "2026-08-10", "variant_key": V1_DAY_ANCHORED},
    )

    assert response.status_code == 200
    records = response.json()
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 1
    assert period_1[0]["vintage_policy_id"] == "v1_day_anchored_noon_d1"


def test_day_unknown_variant_key_among_two_policies_returns_404_over_the_route(
    monkeypatch: pytest.MonkeyPatch, two_policy_forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", two_policy_forecast_stub_client_ctx)

    response = _client().get(
        "/api/forecasts/day",
        params={
            "date": "2026-08-10",
            "variant_key": "day_ahead.lgbm_demand.v1::not-a-real-policy",
        },
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_variant"


def test_metrics_two_policy_families_grouped_per_pair_over_the_route(
    monkeypatch: pytest.MonkeyPatch, two_policy_forecast_stub_client_ctx: StubClientCtx
) -> None:
    monkeypatch.setattr(forecasts_router, "client_ctx", two_policy_forecast_stub_client_ctx)

    response = _client().get("/api/forecasts/metrics")

    assert response.status_code == 200
    records = response.json()
    assert len(records) == 2
    by_policy = {r["vintage_policy_id"]: r for r in records}
    assert by_policy["v1_rolling_23h30m"]["metric_value"] == 11.1
    assert by_policy["v1_day_anchored_noon_d1"]["metric_value"] == 9.5
