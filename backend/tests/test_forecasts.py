"""Tests for `app.forecasts` — supersession, UTC conversion, empty states."""

from __future__ import annotations

from datetime import date

import pytest
from conftest import ForecastStubClient

from app.errors import UnknownVariant
from app.forecasts import day_forecast, list_variants, variant_metrics

DAY = date(2026, 8, 10)


def test_supersession_keeps_only_the_newest_write_for_a_shared_identity(
    forecast_stub_client: ForecastStubClient,
) -> None:
    # Period 1 on 2026-08-10 has two rows sharing one supersession identity:
    # an older write (q_0.5=100.0) and a newer one (q_0.5=200.0). Without
    # the supersession collapse both would appear.
    records = day_forecast(forecast_stub_client, DAY, ["day_ahead.lgbm_demand.v1"])
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 1
    assert period_1[0]["q_0.5"] == 200.0


def test_bst_delivery_time_converts_to_correct_utc_hour_with_z_suffix(
    forecast_stub_client: ForecastStubClient,
) -> None:
    # 2026-08-10 00:00 BST (UTC+1) -> 2026-08-09 23:00 UTC.
    records = day_forecast(forecast_stub_client, DAY, ["day_ahead.lgbm_demand.v1"])
    delivery_times = {r["delivery_time"] for r in records}
    assert "2026-08-09T23:00:00Z" in delivery_times
    assert "2026-08-10T00:00:00Z" not in delivery_times


def test_day_forecast_omitted_model_id_returns_every_variant(
    forecast_stub_client: ForecastStubClient,
) -> None:
    records = day_forecast(forecast_stub_client, DAY, None)
    model_ids = {r["model_id"] for r in records}
    assert model_ids == {"day_ahead.lgbm_demand.v1", "day_ahead.lgbm_demand.v2"}


def test_day_forecast_unknown_model_id_raises_unknown_variant(
    forecast_stub_client: ForecastStubClient,
) -> None:
    with pytest.raises(UnknownVariant):
        day_forecast(forecast_stub_client, DAY, ["not-a-real-model"])


def test_day_forecast_valid_date_with_no_rows_returns_empty_list_not_error(
    forecast_stub_client: ForecastStubClient,
) -> None:
    records = day_forecast(forecast_stub_client, date(2026, 8, 11), None)
    assert records == []


def test_day_forecast_empty_store_returns_empty_list(
    empty_forecast_stub_client: ForecastStubClient,
) -> None:
    records = day_forecast(empty_forecast_stub_client, DAY, None)
    assert records == []


def test_day_forecast_unknown_model_id_against_empty_store_still_404s(
    empty_forecast_stub_client: ForecastStubClient,
) -> None:
    with pytest.raises(UnknownVariant):
        day_forecast(empty_forecast_stub_client, DAY, ["day_ahead.lgbm_demand.v1"])


def test_list_variants_empty_store_returns_empty_list(
    empty_forecast_stub_client: ForecastStubClient,
) -> None:
    assert list_variants(empty_forecast_stub_client) == []


def test_list_variants_one_entry_per_model_from_its_newest_run(
    forecast_stub_client: ForecastStubClient,
) -> None:
    variants = list_variants(forecast_stub_client)
    by_id = {v["model_id"]: v for v in variants}
    assert set(by_id) == {"day_ahead.lgbm_demand.v1", "day_ahead.lgbm_demand.v2"}

    v1 = by_id["day_ahead.lgbm_demand.v1"]
    # v1's newest write is "run-new" (written_at 02:00), not "run-old" (01:00).
    assert v1["run_id"] == "run-new"
    assert v1["written_at"] == "2026-08-10T01:00:00Z"
    assert v1["first_settlement_date"] == "2026-08-10"
    assert v1["last_settlement_date"] == "2026-08-10"
    assert v1["n_days"] == 1
    assert v1["title"] == "Day Ahead · Lgbm Demand · V1"


def test_list_variants_perfect_prog_caveat_is_visible_per_variant(
    forecast_stub_client: ForecastStubClient,
) -> None:
    variants = list_variants(forecast_stub_client)
    by_id = {v["model_id"]: v for v in variants}
    assert by_id["day_ahead.lgbm_demand.v1"]["perfect_prog_caveat"] is False
    assert by_id["day_ahead.lgbm_demand.v2"]["perfect_prog_caveat"] is True


def test_variant_metrics_newest_run_excludes_older_runs_fold_rows(
    forecast_stub_client: ForecastStubClient,
) -> None:
    # v1's newest run is "run-new"; "run-old"'s fold-scope row must not appear.
    records = variant_metrics(forecast_stub_client, ["day_ahead.lgbm_demand.v1"])
    assert len(records) == 1
    assert records[0]["run_id"] == "run-new"
    assert records[0]["metric_name"] == "pinball_loss_overall"


def test_variant_metrics_omitted_model_id_returns_every_variant(
    forecast_stub_client: ForecastStubClient,
) -> None:
    records = variant_metrics(forecast_stub_client, None)
    model_ids = {r["model_id"] for r in records}
    assert model_ids == {"day_ahead.lgbm_demand.v1", "day_ahead.lgbm_demand.v2"}


def test_variant_metrics_empty_store_returns_empty_list(
    empty_forecast_stub_client: ForecastStubClient,
) -> None:
    assert variant_metrics(empty_forecast_stub_client, None) == []


def test_variant_metrics_unknown_model_id_returns_empty_list_not_error(
    forecast_stub_client: ForecastStubClient,
) -> None:
    # /metrics has no documented 404 behaviour (unlike /day) — an unmatched
    # model_id simply yields no rows.
    assert variant_metrics(forecast_stub_client, ["not-a-real-model"]) == []
