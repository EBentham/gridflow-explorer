"""Tests for `app.transforms` — UTC conversion, INT* grouping, key fill."""

from __future__ import annotations

from datetime import date

from conftest import StubClient

from app.catalogue import DATASETS, to_catalogue_entry
from app.transforms import load_generation_mix, load_system_prices

WINDOW_START = date(2026, 8, 10)
WINDOW_END = date(2026, 8, 10)


def _generation_records() -> list[dict[str, object]]:
    return load_generation_mix(StubClient(), WINDOW_START, WINDOW_END)


def test_bst_timestamp_converts_to_correct_utc_hour_with_z_suffix() -> None:
    records = _generation_records()
    timestamps = {r["timestamp"] for r in records}
    # 2026-08-10 00:00 BST (UTC+1) -> 2026-08-09 23:00 UTC.
    assert "2026-08-09T23:00:00Z" in timestamps
    assert "2026-08-10T00:00:00Z" not in timestamps


def test_int_star_codes_collapse_into_single_imports_value() -> None:
    records = _generation_records()
    row = next(r for r in records if r["timestamp"] == "2026-08-09T23:00:00Z")
    assert row["imports"] == 500.0 + 300.0 + 200.0
    assert not any(key.lower().startswith("int") for key in row)


def test_every_declared_series_key_present_on_every_record() -> None:
    records = _generation_records()
    declared_keys = {s.key for s in DATASETS["generation-mix"].series}
    for record in records:
        for key in declared_keys:
            assert key in record, f"missing declared key {key!r} in {record!r}"


def test_fuel_absent_from_fixture_fills_zero_not_missing_or_null() -> None:
    records = _generation_records()
    for record in records:
        assert record["oil"] == 0.0


def test_unrecognised_code_lands_in_other_bucket_nothing_dropped() -> None:
    records = _generation_records()
    row = next(r for r in records if r["timestamp"] == "2026-08-09T23:00:00Z")
    assert row["other"] == 50.0


def test_records_sorted_ascending_by_timestamp() -> None:
    records = _generation_records()
    timestamps = [r["timestamp"] for r in records]
    assert timestamps == sorted(timestamps)
    assert len(timestamps) == 2


def test_system_prices_records_carry_expected_keys_and_z_suffix() -> None:
    records = load_system_prices(StubClient(), WINDOW_START, WINDOW_END)
    assert records
    for record in records:
        assert record["timestamp"].endswith("Z")
        assert "system_sell_price" in record
        assert "system_buy_price" in record
        assert "net_imbalance_volume" in record


def test_system_prices_sorted_ascending_by_timestamp() -> None:
    records = load_system_prices(StubClient(), WINDOW_START, WINDOW_END)
    timestamps = [r["timestamp"] for r in records]
    assert timestamps == sorted(timestamps)


def test_to_catalogue_entry_emits_id_and_omits_internal_fields() -> None:
    entry = to_catalogue_entry(DATASETS["generation-mix"])
    assert entry["id"] == "generation-mix"
    assert "cli_source" not in entry
    assert "cli_dataset" not in entry
    assert "loader" not in entry
    assert "dataset_id" not in entry
