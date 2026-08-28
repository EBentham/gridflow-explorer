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
    assert v1["vintage_policy_id"] == "v1_rolling_23h30m"
    assert v1["title"] == "Day Ahead · Lgbm Demand · V1 -- Rolling 23H30M"


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


# --- Pinning tests: ADR-057 section 3's two-policy collision --------------
#
# One model_id, two live vintage_policy_id families (`two_policy_forecast_
# stub_client`). A Variant grouped by model_id alone would show only one
# policy and silently drop the other's history/rows — this is the defect
# a coordinator review caught after the first pass of this file.


def test_list_variants_two_policy_families_under_one_model_id_yield_two_entries(
    two_policy_forecast_stub_client: ForecastStubClient,
) -> None:
    variants = list_variants(two_policy_forecast_stub_client)
    assert len(variants) == 2

    by_policy = {v["vintage_policy_id"]: v for v in variants}
    assert set(by_policy) == {"v1_rolling_23h30m", "v1_day_anchored_noon_d1"}
    for variant in variants:
        assert variant["model_id"] == "day_ahead.lgbm_demand.v1"

    # The two policies' date spans genuinely differ (rolling also covers
    # 2025-01-01, day-anchored does not) — grouping by model_id alone would
    # merge these into one misleading span.
    rolling = by_policy["v1_rolling_23h30m"]
    day_anchored = by_policy["v1_day_anchored_noon_d1"]
    assert rolling["first_settlement_date"] == "2025-01-01"
    assert rolling["n_days"] == 2
    assert day_anchored["first_settlement_date"] == "2026-08-10"
    assert day_anchored["n_days"] == 1

    # Titles must be distinguishable in a Variant dropdown.
    assert rolling["title"] != day_anchored["title"]
    assert "Rolling" in rolling["title"]
    assert "Day Anchored" in day_anchored["title"]


def test_day_forecast_two_policy_rows_are_separable_by_vintage_policy_id(
    two_policy_forecast_stub_client: ForecastStubClient,
) -> None:
    records = day_forecast(two_policy_forecast_stub_client, date(2026, 8, 10), None)
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 2

    by_policy = {r["vintage_policy_id"]: r for r in period_1}
    assert set(by_policy) == {"v1_rolling_23h30m", "v1_day_anchored_noon_d1"}
    # Each policy's own quantile values must be intact, not overwritten by
    # the other's — this is what a model_id-only chart key would silently
    # collapse into one series.
    assert by_policy["v1_rolling_23h30m"]["q_0.5"] == 310.0
    assert by_policy["v1_day_anchored_noon_d1"]["q_0.5"] == 420.0


def test_day_forecast_vintage_policy_id_filter_narrows_to_one_policy(
    two_policy_forecast_stub_client: ForecastStubClient,
) -> None:
    records = day_forecast(
        two_policy_forecast_stub_client,
        date(2026, 8, 10),
        None,
        vintage_policy_ids=["v1_rolling_23h30m"],
    )
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 1
    assert period_1[0]["vintage_policy_id"] == "v1_rolling_23h30m"


def test_day_forecast_unknown_vintage_policy_id_raises_unknown_variant(
    two_policy_forecast_stub_client: ForecastStubClient,
) -> None:
    with pytest.raises(UnknownVariant):
        day_forecast(
            two_policy_forecast_stub_client,
            date(2026, 8, 10),
            None,
            vintage_policy_ids=["not-a-real-policy"],
        )


def test_variant_metrics_two_policy_families_are_grouped_per_pair(
    two_policy_forecast_stub_client: ForecastStubClient,
) -> None:
    records = variant_metrics(two_policy_forecast_stub_client, None)
    assert len(records) == 2

    by_policy = {r["vintage_policy_id"]: r for r in records}
    assert by_policy["v1_rolling_23h30m"]["run_id"] == "run-rolling"
    assert by_policy["v1_day_anchored_noon_d1"]["run_id"] == "run-day-anchored"
    # Gates must not be attributed across policies.
    assert by_policy["v1_rolling_23h30m"]["metric_value"] == 11.1
    assert by_policy["v1_day_anchored_noon_d1"]["metric_value"] == 9.5
