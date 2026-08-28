"""Tests for `app.forecasts` — supersession, UTC conversion, empty states."""

from __future__ import annotations

from datetime import date

import pytest
from conftest import ForecastStubClient

from app.errors import UnknownVariant
from app.forecasts import (
    _decode_variant_key,
    _encode_variant_key,
    day_forecast,
    list_variants,
    variant_metrics,
)

DAY = date(2026, 8, 10)

V1_ROLLING = _encode_variant_key("day_ahead.lgbm_demand.v1", "v1_rolling_23h30m")
V1_DAY_ANCHORED = _encode_variant_key("day_ahead.lgbm_demand.v1", "v1_day_anchored_noon_d1")
V2_ROLLING = _encode_variant_key("day_ahead.lgbm_demand.v2", "v2_rolling_23h30m")


def test_supersession_keeps_only_the_newest_write_for_a_shared_identity(
    forecast_stub_client: ForecastStubClient,
) -> None:
    # Period 1 on 2026-08-10 has two rows sharing one supersession identity:
    # an older write (q_0.5=100.0) and a newer one (q_0.5=200.0). Without
    # the supersession collapse both would appear.
    records = day_forecast(forecast_stub_client, DAY, [V1_ROLLING])
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 1
    assert period_1[0]["q_0.5"] == 200.0


def test_bst_delivery_time_converts_to_correct_utc_hour_with_z_suffix(
    forecast_stub_client: ForecastStubClient,
) -> None:
    # 2026-08-10 00:00 BST (UTC+1) -> 2026-08-09 23:00 UTC.
    records = day_forecast(forecast_stub_client, DAY, [V1_ROLLING])
    delivery_times = {r["delivery_time"] for r in records}
    assert "2026-08-09T23:00:00Z" in delivery_times
    assert "2026-08-10T00:00:00Z" not in delivery_times


def test_day_forecast_omitted_variant_key_returns_every_variant(
    forecast_stub_client: ForecastStubClient,
) -> None:
    records = day_forecast(forecast_stub_client, DAY, None)
    model_ids = {r["model_id"] for r in records}
    assert model_ids == {"day_ahead.lgbm_demand.v1", "day_ahead.lgbm_demand.v2"}


def test_day_forecast_unknown_variant_key_raises_unknown_variant(
    forecast_stub_client: ForecastStubClient,
) -> None:
    with pytest.raises(UnknownVariant):
        day_forecast(forecast_stub_client, DAY, ["not-a-real-model::not-a-real-policy"])


def test_day_forecast_crossed_pair_of_two_real_components_raises_unknown_variant(
    forecast_stub_client: ForecastStubClient,
) -> None:
    """Regression for Sol's finding: v1's model_id and v2's vintage_policy_id
    each exist in the store, but never together. Independently validating
    the two dimensions (the pre-fix design) would pass this through as
    "known" and silently return `200 []`; validating the encoded pair must
    reject it as `404 unknown_variant`.
    """
    crossed = _encode_variant_key("day_ahead.lgbm_demand.v1", "v2_rolling_23h30m")
    with pytest.raises(UnknownVariant):
        day_forecast(forecast_stub_client, DAY, [crossed])


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


def test_day_forecast_unknown_variant_key_against_empty_store_still_404s(
    empty_forecast_stub_client: ForecastStubClient,
) -> None:
    with pytest.raises(UnknownVariant):
        day_forecast(empty_forecast_stub_client, DAY, [V1_ROLLING])


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
    records = variant_metrics(forecast_stub_client, [V1_ROLLING])
    assert len(records) == 1
    assert records[0]["run_id"] == "run-new"
    assert records[0]["metric_name"] == "pinball_loss_overall"


def test_variant_metrics_omitted_variant_key_returns_every_variant(
    forecast_stub_client: ForecastStubClient,
) -> None:
    records = variant_metrics(forecast_stub_client, None)
    model_ids = {r["model_id"] for r in records}
    assert model_ids == {"day_ahead.lgbm_demand.v1", "day_ahead.lgbm_demand.v2"}


def test_variant_metrics_empty_store_returns_empty_list(
    empty_forecast_stub_client: ForecastStubClient,
) -> None:
    assert variant_metrics(empty_forecast_stub_client, None) == []


def test_variant_metrics_unknown_variant_key_returns_empty_list_not_error(
    forecast_stub_client: ForecastStubClient,
) -> None:
    # /metrics has no documented 404 behaviour (unlike /day) — an unmatched
    # variant_key simply yields no rows.
    assert variant_metrics(forecast_stub_client, ["not-a-real-model::not-a-real-policy"]) == []


def test_variant_metrics_crossed_pair_of_two_real_components_yields_no_rows(
    forecast_stub_client: ForecastStubClient,
) -> None:
    crossed = _encode_variant_key("day_ahead.lgbm_demand.v1", "v2_rolling_23h30m")
    assert variant_metrics(forecast_stub_client, [crossed]) == []


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


def test_day_forecast_variant_key_filter_narrows_to_one_policy(
    two_policy_forecast_stub_client: ForecastStubClient,
) -> None:
    key = _encode_variant_key("day_ahead.lgbm_demand.v1", "v1_rolling_23h30m")
    records = day_forecast(two_policy_forecast_stub_client, date(2026, 8, 10), [key])
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 1
    assert period_1[0]["vintage_policy_id"] == "v1_rolling_23h30m"


def test_day_forecast_unknown_variant_key_among_two_policies_raises_unknown_variant(
    two_policy_forecast_stub_client: ForecastStubClient,
) -> None:
    with pytest.raises(UnknownVariant):
        day_forecast(
            two_policy_forecast_stub_client,
            date(2026, 8, 10),
            ["day_ahead.lgbm_demand.v1::not-a-real-policy"],
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


# --- Pinning test: supersession's run_id DESC tie-break ---------------------
#
# `forecast_stub_client`'s supersession-colliding rows have *different*
# `written_at` values, so `written_at DESC` alone always picks the winner
# and the secondary `run_id DESC` tie-break (used only when `written_at`
# ties) is never exercised by any other test in this file — removing it
# from `_supersede`'s sort key would not fail the suite. This fixture gives
# two candidates the *same* `written_at` and different `run_id`s so the
# tie-break itself is pinned.


def test_supersession_run_id_desc_tie_break_when_written_at_ties(
    tie_break_forecast_stub_client: ForecastStubClient,
) -> None:
    key = _encode_variant_key("day_ahead.lgbm_demand.v1", "v1_rolling_23h30m")
    records = day_forecast(tie_break_forecast_stub_client, DAY, [key])
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 1
    # run "run-z" sorts after "run-a" under `run_id DESC` and must win the tie.
    assert period_1[0]["q_0.5"] == 999.0


# --- Pinning tests: Sol diff review, second confirmatory pass --------------
#
# The wire encoding must be collision-safe: model_id/vintage_policy_id come
# from a different repository this app only reads, so a hand-picked
# separator (the previous "::") can appear inside an identifier. These
# tests fail against that old scheme (verified by temporarily reverting
# `_encode_variant_key`/`_decode_variant_key` to `f"{a}::{b}"` /
# `.partition("::")` and confirming both fail) and pass against the current
# JSON-array encoding.


def test_encode_variant_key_distinguishes_pairs_that_would_collide_naively() -> None:
    # Under the old "::"-joined scheme, encode("A::B", "C") and
    # encode("A", "B::C") both produced the literal string "A::B::C" -- two
    # genuinely different pairs sharing one wire key.
    key_a = _encode_variant_key("A::B", "C")
    key_b = _encode_variant_key("A", "B::C")
    assert key_a != key_b


def test_decode_variant_key_round_trips_when_identifiers_contain_the_wire_separator() -> None:
    model_id = "weird::model.id"
    vintage_policy_id = "also::weird_policy"
    key = _encode_variant_key(model_id, vintage_policy_id)
    assert _decode_variant_key(key) == (model_id, vintage_policy_id)


def test_day_forecast_resolves_a_variant_whose_identifiers_contain_the_wire_separator(
    collision_forecast_stub_client: ForecastStubClient,
) -> None:
    model_id = "weird::model.id"
    vintage_policy_id = "also::weird_policy"
    key = _encode_variant_key(model_id, vintage_policy_id)

    records = day_forecast(collision_forecast_stub_client, DAY, [key])

    assert len(records) == 1
    assert records[0]["model_id"] == model_id
    assert records[0]["vintage_policy_id"] == vintage_policy_id
