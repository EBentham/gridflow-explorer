"""Tests for `app.forecasts` — supersession, UTC conversion, grouping, variant keys."""

from __future__ import annotations

import itertools
from collections.abc import Callable
from datetime import date

import polars as pl
import pytest
from conftest import (
    ForecastStubClient,
    collision_forecasts_frame,
    empty_forecasts_frame,
    empty_metrics_frame,
    forecast_metrics_rows_frame,
    tie_break_forecasts_frame,
    two_policy_forecasts_frame,
    two_policy_metrics_frame,
)

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
# v1's model_id and v2's vintage_policy_id each exist in the store, but never
# together: validating the two halves independently would let it through.
CROSSED = _encode_variant_key("day_ahead.lgbm_demand.v1", "v2_rolling_23h30m")
# Python's `json.dumps` puts a space after the comma; `JSON.stringify` (what a
# browser sends) does not. Keys are decoded and compared as tuples, so both resolve.
JS_V1_ROLLING = '["day_ahead.lgbm_demand.v1","v1_rolling_23h30m"]'
# Valid JSON that once escaped the decoder as RecursionError / ValueError (a 500).
DEEPLY_NESTED = "[" * 200 + "]" * 200
HUGE_INT = "9" * 5000
# model_id and vintage_policy_id come from a repository this app only reads, so the
# old hand-picked "::" separator can appear inside an identifier.
SEPARATOR_IDS = ("weird::model.id", "also::weird_policy")


def _default() -> ForecastStubClient:
    return ForecastStubClient()


def _empty() -> ForecastStubClient:
    return ForecastStubClient(empty_forecasts_frame(), empty_metrics_frame())


def _two_policy() -> ForecastStubClient:
    """ADR-057 section 3: one model_id with two live vintage_policy_id families."""
    return ForecastStubClient(two_policy_forecasts_frame(), two_policy_metrics_frame())


def test_supersession_keeps_only_the_newest_write_for_a_shared_identity() -> None:
    # Period 1 on 2026-08-10 has two rows sharing one supersession identity:
    # an older write (q_0.5=100.0) and a newer one (q_0.5=200.0).
    records = day_forecast(_default(), DAY, [V1_ROLLING])
    period_1 = [r for r in records if r["settlement_period"] == 1]
    assert len(period_1) == 1
    assert period_1[0]["q_0.5"] == 200.0


def test_bst_delivery_time_converts_to_correct_utc_hour_with_z_suffix() -> None:
    # 2026-08-10 00:00 BST (UTC+1) -> 2026-08-09 23:00 UTC.
    delivery_times = {r["delivery_time"] for r in day_forecast(_default(), DAY, [V1_ROLLING])}
    assert "2026-08-09T23:00:00Z" in delivery_times
    assert "2026-08-10T00:00:00Z" not in delivery_times


def test_omitted_variant_key_returns_every_variant() -> None:
    expected = {"day_ahead.lgbm_demand.v1", "day_ahead.lgbm_demand.v2"}
    assert {r["model_id"] for r in day_forecast(_default(), DAY, None)} == expected
    assert {r["model_id"] for r in variant_metrics(_default(), None)} == expected


def test_empty_store_and_empty_day_answer_empty_lists_not_errors() -> None:
    assert day_forecast(_default(), date(2026, 8, 11), None) == []
    assert day_forecast(_empty(), DAY, None) == []
    assert list_variants(_empty()) == []
    assert variant_metrics(_empty(), None) == []


@pytest.mark.parametrize(
    ("client", "key"),
    [
        (_default, "not-a-real-model::not-a-real-policy"),
        (_default, CROSSED),
        (_default, DEEPLY_NESTED),
        (_default, HUGE_INT),
        (_empty, V1_ROLLING),
        (_two_policy, "day_ahead.lgbm_demand.v1::not-a-real-policy"),
    ],
    ids=["unknown", "crossed-pair", "deeply-nested", "huge-int", "empty-store", "two-policy"],
)
def test_day_forecast_unmatched_variant_key_raises_unknown_variant(
    client: Callable[[], ForecastStubClient], key: str
) -> None:
    with pytest.raises(UnknownVariant):
        day_forecast(client(), DAY, [key])


@pytest.mark.parametrize(
    "key",
    ["not-a-real-model::not-a-real-policy", CROSSED, DEEPLY_NESTED, HUGE_INT],
    ids=["unknown", "crossed-pair", "deeply-nested", "huge-int"],
)
def test_variant_metrics_unmatched_variant_key_yields_no_rows(key: str) -> None:
    # /metrics has no documented 404 (unlike /day): an unmatched key yields no rows.
    assert variant_metrics(_default(), [key]) == []


def test_list_variants_one_entry_per_model_from_its_newest_run() -> None:
    by_id = {v["model_id"]: v for v in list_variants(_default())}
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
    assert v1["perfect_prog_caveat"] is False
    assert by_id["day_ahead.lgbm_demand.v2"]["perfect_prog_caveat"] is True


def test_variant_metrics_newest_run_excludes_older_runs_fold_rows() -> None:
    # v1's newest run is "run-new"; "run-old"'s fold-scope row must not appear.
    [record] = variant_metrics(_default(), [V1_ROLLING])
    assert record["run_id"] == "run-new"
    assert record["metric_name"] == "pinball_loss_overall"
    assert record["perfect_prog_caveat"] is False


# --- ADR-057 section 3's two-policy collision --------------------------------
#
# A Variant grouped by model_id alone would show only one policy and silently
# drop the other's history and rows.


def test_list_variants_two_policy_families_under_one_model_id_yield_two_entries() -> None:
    variants = list_variants(_two_policy())
    assert len(variants) == 2
    assert {v["model_id"] for v in variants} == {"day_ahead.lgbm_demand.v1"}

    by_policy = {v["vintage_policy_id"]: v for v in variants}
    assert set(by_policy) == {"v1_rolling_23h30m", "v1_day_anchored_noon_d1"}
    # The two policies' date spans differ (rolling also covers 2025-01-01).
    rolling = by_policy["v1_rolling_23h30m"]
    day_anchored = by_policy["v1_day_anchored_noon_d1"]
    assert rolling["first_settlement_date"] == "2025-01-01"
    assert rolling["n_days"] == 2
    assert day_anchored["first_settlement_date"] == "2026-08-10"
    assert day_anchored["n_days"] == 1
    # Titles must be distinguishable in a Variant dropdown.
    assert "Rolling" in rolling["title"]
    assert "Day Anchored" in day_anchored["title"]


def test_day_forecast_two_policy_rows_are_separable_and_filterable() -> None:
    period_1 = [r for r in day_forecast(_two_policy(), DAY, None) if r["settlement_period"] == 1]
    by_policy = {r["vintage_policy_id"]: r for r in period_1}
    assert len(period_1) == 2
    # Each policy keeps its own quantiles, not overwritten by the other's.
    assert by_policy["v1_rolling_23h30m"]["q_0.5"] == 310.0
    assert by_policy["v1_day_anchored_noon_d1"]["q_0.5"] == 420.0

    narrowed = day_forecast(_two_policy(), DAY, [V1_ROLLING])
    assert {r["vintage_policy_id"] for r in narrowed if r["settlement_period"] == 1} == {
        "v1_rolling_23h30m"
    }


def test_variant_metrics_two_policy_families_are_grouped_per_pair() -> None:
    records = variant_metrics(_two_policy(), None)
    assert len(records) == 2
    by_policy = {r["vintage_policy_id"]: r for r in records}
    assert by_policy["v1_rolling_23h30m"]["run_id"] == "run-rolling"
    assert by_policy["v1_day_anchored_noon_d1"]["run_id"] == "run-day-anchored"
    # Gates must not be attributed across policies.
    assert by_policy["v1_rolling_23h30m"]["metric_value"] == 11.1
    assert by_policy["v1_day_anchored_noon_d1"]["metric_value"] == 9.5


# --- Tie-breaks ----------------------------------------------------------------


def test_supersession_run_id_desc_tie_break_when_written_at_ties() -> None:
    # The default frame's colliding rows differ in written_at, so only this frame
    # reaches `_supersede`'s secondary `run_id DESC` key.
    client = ForecastStubClient(tie_break_forecasts_frame(), empty_metrics_frame())
    period_1 = [r for r in day_forecast(client, DAY, [V1_ROLLING]) if r["settlement_period"] == 1]
    assert len(period_1) == 1
    # "run-z" sorts after "run-a" under `run_id DESC` and must win the tie.
    assert period_1[0]["q_0.5"] == 999.0


@pytest.mark.parametrize("order", list(itertools.permutations(["aaa", "mmm", "zzz"])))
def test_newest_run_tie_on_written_at_breaks_on_run_id_in_any_input_order(
    order: tuple[str, ...],
) -> None:
    """Runs written at the same instant resolve to the largest run_id, as supersession does."""
    base = forecast_metrics_rows_frame().filter(pl.col("run_id") == "run-new")
    tied = pl.concat(
        [base.with_columns(run_id=pl.lit(r), gates_passed=pl.lit(r == "zzz")) for r in order]
    )
    client = ForecastStubClient(metrics=tied)
    [record] = variant_metrics(client, [V1_ROLLING])
    assert record["run_id"] == "zzz"
    v1 = next(v for v in list_variants(client) if v["model_id"] == "day_ahead.lgbm_demand.v1")
    assert (v1["run_id"], v1["gates_passed"]) == ("zzz", True)


# --- The wire encoding of a variant key: a JSON array, decoded once at the edge ---


def test_encode_variant_key_distinguishes_pairs_that_would_collide_naively() -> None:
    # Under the old "::"-joined scheme both pairs were the string "A::B::C".
    assert _encode_variant_key("A::B", "C") != _encode_variant_key("A", "B::C")


@pytest.mark.parametrize(
    ("key", "expected"),
    [
        (_encode_variant_key(*SEPARATOR_IDS), SEPARATOR_IDS),
        (V1_ROLLING, ("day_ahead.lgbm_demand.v1", "v1_rolling_23h30m")),
        (JS_V1_ROLLING, ("day_ahead.lgbm_demand.v1", "v1_rolling_23h30m")),
        (DEEPLY_NESTED, None),
        (HUGE_INT, None),
    ],
    ids=["separator-in-ids", "python-spelling", "javascript-spelling", "deeply-nested", "huge-int"],
)
def test_decode_variant_key(key: str, expected: tuple[str, str] | None) -> None:
    assert _decode_variant_key(key) == expected


def test_day_forecast_resolves_a_variant_whose_identifiers_contain_the_wire_separator() -> None:
    client = ForecastStubClient(collision_forecasts_frame(), empty_metrics_frame())
    [record] = day_forecast(client, DAY, [_encode_variant_key(*SEPARATOR_IDS)])
    assert (record["model_id"], record["vintage_policy_id"]) == SEPARATOR_IDS


def test_day_forecast_both_json_encoder_spellings_resolve_identically() -> None:
    assert V1_ROLLING != JS_V1_ROLLING  # really two different byte strings
    js_records = day_forecast(_default(), DAY, [JS_V1_ROLLING])
    assert js_records != []
    assert {r["model_id"] for r in js_records} == {"day_ahead.lgbm_demand.v1"}
    assert js_records == day_forecast(_default(), DAY, [V1_ROLLING])
