"""Synthetic SQL regressions for the generic rows selector."""

from __future__ import annotations

import copy
from datetime import UTC, datetime

import pytest

from app import rows


def _spec(*, ordered: bool = True, grain: str = "1h", grouped: bool = True) -> dict:
    return {
        "id": "sample",
        "kind": "series",
        "base_relation": "silver_test_sample",
        "latest_relation": None,
        "not_held_cause": None,
        "clock": {"column": "timestamp_utc", "grain": grain, "settlement_cols": []},
        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
        "values": [{"column": "value", "unit": "MW", "label": "Test value"}],
        "dims": [{"column": "unit", "role": "series", "cardinality": 2}] if grouped else [],
        "default_filter": None,
        "dedup": {
            "keys": ["timestamp_utc", "unit"] if grouped else ["timestamp_utc"],
            "order_by": [{"column": "published_at", "direction": "desc", "nulls": "last"}]
            if ordered
            else [],
        },
        "row_filter": None,
        "snapshot_column": None,
        "notes": [],
    }


def _seed(db, spec, records):
    db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, "
        "unit VARCHAR, value DOUBLE, published_at TIMESTAMPTZ, ingested_at TIMESTAMPTZ)"
    )
    db.con.executemany("INSERT INTO silver_test_sample VALUES (?, ?, ?, ?, ?)", records)


def _run(monkeypatch, db, spec, *, start="2026-09-22", end="2026-09-22"):
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    request = rows.validate("test", "sample", start, end, None, None)
    return rows.execute(db, request, f"test-{id(db)}")


@pytest.mark.parametrize("reverse", [False, True])
def test_ordered_top_tie_with_different_declared_values_refuses_in_either_input_order(
    monkeypatch, sources_db, reverse
):
    """A tied maximum publication must not silently choose an input row."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    entries = [
        (stamp, "U", 1.0, stamp, stamp),
        (stamp, "U", 2.0, stamp, stamp),
    ]
    _seed(sources_db, _spec(), entries[::-1] if reverse else entries)
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, _spec())
    assert caught.value.code == rows.RowsErrorCode.AMBIGUOUS_SERIES
    assert "value" in caught.value.details["varying_columns"]


def test_ordered_top_tie_with_equal_declared_projection_collapses_and_reports(
    monkeypatch, sources_db
):
    """A tied maximum with different undeclared provenance removes one capture."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(
        sources_db,
        _spec(),
        [(stamp, "U", 0.0, stamp, stamp), (stamp, "U", 0.0, stamp, stamp.replace(hour=1))],
    )
    result = _run(monkeypatch, sources_db, _spec())
    assert next(row for row in result["rows"] if row["value"] == 0.0)["value"] == 0.0
    assert result["truncation"]["reasons"] == [{"type": "exact_duplicate_rows", "removed_rows": 1}]


def test_empty_order_conflict_outside_requested_window_does_not_refuse(monkeypatch, sources_db):
    """An old conflicting partition cannot poison a clean requested day."""
    old = datetime(2026, 9, 21, tzinfo=UTC)
    new = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(
        sources_db,
        _spec(ordered=False),
        [(old, "U", 1.0, old, old), (old, "U", 2.0, old, old), (new, "U", 3.0, new, new)],
    )
    result = _run(monkeypatch, sources_db, _spec(ordered=False))
    assert [row["value"] for row in result["rows"] if row["value"] is not None] == [3.0]
    assert result["truncated"] is False


def test_regular_gap_is_null_and_stored_zero_is_preserved(monkeypatch, sources_db):
    """A missing native hour must not be imputed as a stored zero."""
    first = datetime(2026, 9, 22, tzinfo=UTC)
    third = first.replace(hour=2)
    _seed(sources_db, _spec(), [(first, "U", 0.0, first, first), (third, "U", 3.0, third, third)])
    result = _run(monkeypatch, sources_db, _spec())
    values = [row["value"] for row in result["rows"]]
    assert values.count(0.0) == 1
    assert values.count(3.0) == 1
    assert values[values.index(0.0) + 1] is None


def test_grain_parser_uses_only_exact_declared_tokens():
    """Annotated cadence descriptions cannot trigger synthetic gap fill."""
    for token, width in rows.GRAINS.items():
        assert rows._grain({"clock": {"grain": token}}) == width
    for token in ("none", "mixed (PT15M)", "60min (sparse)", "request-window"):
        assert rows._grain({"clock": {"grain": token}}) is None


def test_default_group_fallback_covers_the_committed_registry():
    """Every committed series selects a declared group or remains dimensionless."""
    for (source, dataset_id), spec in rows.REGISTRY.items():
        if spec["not_held_cause"] or spec["kind"] != "series":
            continue
        request = rows.validate(source, dataset_id, None, None, None, None)
        dims = spec["dims"]
        expected = next((dim["column"] for dim in dims if dim["role"] == "series"), None)
        expected = expected or (dims[0]["column"] if dims else None)
        assert request.group == expected, (source, dataset_id)


def test_declared_projection_includes_unrendered_order_column():
    """A publication anchor cannot disappear from the duplicate comparison."""
    spec = copy.deepcopy(_spec())
    assert "published_at" in rows._projection(spec)


def test_signed_zero_declared_values_refuse_even_when_sql_distinct_equates_them(
    monkeypatch, sources_db
):
    """A byte-level +0.0/-0.0 difference cannot be collapsed as a capture."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(
        sources_db,
        _spec(ordered=False),
        [(stamp, "U", 0.0, stamp, stamp), (stamp, "U", -0.0, stamp, stamp)],
    )
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, _spec(ordered=False))
    assert caught.value.code == rows.RowsErrorCode.AMBIGUOUS_SERIES
    assert caught.value.details["varying_columns"] == ["value"]


def test_pn_ranking_does_not_overweight_excluded_capture_copies(monkeypatch, sources_db):
    """A duplicate in an omitted unit cannot change its mean or duplicate count."""
    spec = _spec(ordered=False)
    spec.update(
        id="pn",
        base_relation="silver_test_pn",
        values=[{"column": "level_to", "unit": "MW", "label": "End level"}],
        dims=[{"column": "bm_unit_id", "role": "filter", "cardinality": 21}],
        dedup=None,
    )
    sources_db.con.execute(
        "CREATE TABLE silver_test_pn (timestamp_utc TIMESTAMPTZ, "
        "bm_unit_id VARCHAR, level_to DOUBLE, ingested_at TIMESTAMPTZ)"
    )
    first = datetime(2026, 9, 22, tzinfo=UTC)
    second = first.replace(hour=1)
    values = [(first, "A", 0.0, first), (second, "A", 100.0, first)]
    values.append((second, "A", 100.0, second))
    values.append((first, "B", 60.0, first))
    values.extend((first, f"F{i:02}", 1000.0, first) for i in range(19))
    sources_db.con.executemany("INSERT INTO silver_test_pn VALUES (?, ?, ?, ?)", values)
    monkeypatch.setattr(rows, "REGISTRY", {("elexon", "pn"): spec})
    result = rows.execute(
        sources_db,
        rows.validate("elexon", "pn", "2026-09-22", "2026-09-22", None, None),
        f"pn-{id(sources_db)}",
    )
    top = next(
        reason for reason in result["truncation"]["reasons"] if reason["type"] == "default_top_n"
    )
    assert "B" in top["selected_ids"]
    assert "A" not in top["selected_ids"]
    assert top["omitted_groups"] == 1
    assert not any(
        reason["type"] == "exact_duplicate_rows" for reason in result["truncation"]["reasons"]
    )
