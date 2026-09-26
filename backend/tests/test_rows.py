"""Synthetic SQL regressions for the generic rows selector."""

from __future__ import annotations

import copy
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from app import rows


@pytest.fixture(autouse=True)
def clear_rows_metadata_cache():
    rows._cache.clear()
    yield
    rows._cache.clear()


def _spec(
    *,
    ordered: bool = True,
    grain: str = "1h",
    grouped: bool = True,
    anchor_column: str = "timestamp_utc",
) -> dict:
    return {
        "id": "sample",
        "kind": "series",
        "base_relation": "silver_test_sample",
        "latest_relation": None,
        "not_held_cause": None,
        "clock": {"column": "timestamp_utc", "grain": grain, "settlement_cols": []},
        "latest_day_rule": {"mode": "max", "column": anchor_column},
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
    available = (
        ", available_at TIMESTAMPTZ" if spec["latest_day_rule"]["column"] == "available_at" else ""
    )
    placeholders = ", ?" if available else ""
    db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, "
        f"unit VARCHAR, value DOUBLE, published_at TIMESTAMPTZ, ingested_at TIMESTAMPTZ{available})"
    )
    db.con.executemany(
        f"INSERT INTO silver_test_sample VALUES (?, ?, ?, ?, ?{placeholders})", records
    )


def _run(monkeypatch, db, spec, *, start="2026-09-22", end="2026-09-22", filters=None, group=None):
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    request = rows.validate("test", "sample", start, end, group, filters)
    return rows.execute(db, request, f"test-{id(db)}")


def test_default_window_uses_clock_column_when_anchor_differs(monkeypatch, sources_db):
    spec = _spec(grain="irregular", grouped=False, anchor_column="available_at")
    first = datetime(2026, 8, 1, 10, tzinfo=UTC)
    second = datetime(2026, 8, 2, 10, tzinfo=UTC)
    published = datetime(2026, 8, 15, tzinfo=UTC)
    _seed(
        sources_db,
        spec,
        [
            (first, "A", 1.0, published, published, published),
            (second, "A", 2.0, published, published, published),
        ],
    )
    result = _run(monkeypatch, sources_db, spec, start=None, end=None)
    assert result["row_count"] == 2
    assert result["window"]["end"] == "2026-08-02"
    assert result["window"]["tz"] == "Europe/London"
    assert [row["ts"] for row in result["rows"]] == [rows._ts_ms(first), rows._ts_ms(second)]
    assert result["coverage"]["latest_local_day"] == "2026-08-02"


def test_empty_window_with_data_outside_emits_note(monkeypatch, sources_db):
    spec = _spec(grain="irregular", grouped=False, anchor_column="available_at")
    stamp = datetime(2026, 8, 1, 10, tzinfo=UTC)
    published = datetime(2026, 8, 15, tzinfo=UTC)
    _seed(
        sources_db,
        spec,
        [
            (stamp, "A", 1.0, published, published, published),
            (stamp + timedelta(days=1), "A", 2.0, published, published, published),
        ],
    )
    result = _run(monkeypatch, sources_db, spec, start="2026-08-10", end="2026-08-11")
    assert result["row_count"] == 0
    assert any(
        "No rows in this window" in note and "2026-08-01" in note and "2026-08-02" in note
        for note in result["notes"]
    )


def test_columns_list_includes_every_declared_value(monkeypatch, sources_db):
    spec = _spec(ordered=False, grain="irregular", grouped=False)
    spec["values"].append({"column": "other_value", "unit": "GBP", "label": "Other value"})
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, value DOUBLE, "
        "other_value DOUBLE)"
    )
    sources_db.con.execute("INSERT INTO silver_test_sample VALUES (?, 1.0, 2.0)", [stamp])
    result = _run(monkeypatch, sources_db, spec)
    assert result["columns"] == [
        {"column": "value", "unit": "MW", "label": "Test value"},
        {"column": "other_value", "unit": "GBP", "label": "Other value"},
    ]


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


def test_empty_order_conflict_outside_window_does_not_poison_request(monkeypatch, sources_db):
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


def test_regular_gap_is_null_not_zero(monkeypatch, sources_db):
    """A missing native hour must not be imputed as a stored zero."""
    first = datetime(2026, 9, 22, tzinfo=UTC)
    third = first.replace(hour=2)
    _seed(sources_db, _spec(), [(first, "U", 0.0, first, first), (third, "U", 3.0, third, third)])
    result = _run(monkeypatch, sources_db, _spec())
    values = [row["value"] for row in result["rows"]]
    assert values.count(0.0) == 1
    assert values.count(3.0) == 1
    assert values[values.index(0.0) + 1] is None


def test_grain_parser_uses_exact_tokens():
    """Annotated cadence descriptions cannot trigger synthetic gap fill."""
    for token, width in rows.GRAINS.items():
        assert rows._grain({"clock": {"grain": token}}) == width
    for token in ("none", "mixed (PT15M)", "60min (sparse)", "request-window"):
        assert rows._grain({"clock": {"grain": token}}) is None


def test_default_group_fallback_covers_all_44_specs():
    """Every committed series selects a declared group or remains dimensionless."""
    for (source, dataset_id), spec in rows.REGISTRY.items():
        if spec["not_held_cause"] or spec["kind"] != "series":
            continue
        request = rows.validate(source, dataset_id, None, None, None, None)
        dims = spec["dims"]
        expected = next((dim["column"] for dim in dims if dim["role"] == "series"), None)
        expected = expected or (dims[0]["column"] if dims else None)
        assert request.group == expected, (source, dataset_id)


def test_declared_projection_includes_unrendered_anchor(monkeypatch, sources_db):
    """A hidden publication anchor difference refuses a same-clock collision."""
    spec = copy.deepcopy(_spec(ordered=False))
    spec["latest_day_rule"]["column"] = "published_at"
    assert "published_at" in rows._projection(spec)
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    later = stamp + timedelta(hours=1)
    _seed(
        sources_db,
        spec,
        [(stamp, "U", 1.0, stamp, stamp), (stamp, "U", 1.0, later, stamp)],
    )
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, spec)
    assert caught.value.code == rows.RowsErrorCode.AMBIGUOUS_SERIES
    assert "published_at" in caught.value.details["varying_columns"]


def test_signed_zero_declared_values_refuse(monkeypatch, sources_db):
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


def test_pn_ranking_does_not_overweight_capture_copies(monkeypatch, sources_db):
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


def test_reference_default_filter_reports_removed_rows(monkeypatch, sources_db):
    """A reference default must report its reduction without a date window."""
    spec = _spec()
    spec.update(kind="reference", clock=None, latest_day_rule={"mode": "none", "column": None})
    spec["dedup"] = None
    spec["default_filter"] = {"column": "unit", "equals": "A"}
    sources_db.con.execute("CREATE TABLE silver_test_sample (unit VARCHAR, value DOUBLE)")
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?)", [("A", 1.0), ("B", 2.0), ("B", 3.0)]
    )
    result = _run(monkeypatch, sources_db, spec, start=None, end=None)
    assert result["row_count"] == 1
    assert result["truncated"] is True
    assert result["truncation"]["reasons"] == [{"type": "default_filter", "omitted_rows": 2}]
    assert result["truncation"]["rows_before_defaults"] == 3
    assert result["truncation"]["rows_after_filters"] == 1


def test_reference_default_filter_without_reduction_stays_untruncated(monkeypatch, sources_db):
    """An optional reference default that removes nothing has no truncation object."""
    spec = _spec()
    spec.update(kind="reference", clock=None, latest_day_rule={"mode": "reference", "column": None})
    spec["dedup"] = None
    spec["default_filter"] = {"column": "unit", "equals": "A"}
    sources_db.con.execute("CREATE TABLE silver_test_sample (unit VARCHAR, value DOUBLE)")
    sources_db.con.execute("INSERT INTO silver_test_sample VALUES ('A', 1)")
    result = _run(monkeypatch, sources_db, spec, start=None, end=None)
    assert result["filters"] == {"unit": "A"}
    assert result["truncated"] is False
    assert result["truncation"] is None


@pytest.mark.parametrize("grain, hour", [("1d", 0), ("24h", 23), ("7d", 0)])
def test_calendar_day_grain_crosses_bst_to_gmt_without_phase_refusal(
    monkeypatch, sources_db, grain, hour
):
    """A London calendar cadence survives a UTC offset change and fills missing dates."""
    london = ZoneInfo("Europe/London")
    spec = _spec(grain=grain)
    start_day = date(2025, 10, 22)
    days = range(15) if grain == "7d" else range(8)
    records = []
    for offset in days:
        if offset == 3 or (grain == "7d" and offset == 7):
            continue
        day = start_day + timedelta(days=offset)
        if grain == "7d" and offset not in (0, 7, 14):
            continue
        stamp = datetime(day.year, day.month, day.day, hour, tzinfo=london)
        records.append((stamp, "U", float(offset), stamp, stamp))
    _seed(sources_db, spec, records)
    end_day = "2025-11-05" if grain == "7d" else "2025-10-29"
    result = _run(monkeypatch, sources_db, spec, start="2025-10-22", end=end_day)
    actual = [row for row in result["rows"] if row["value"] is not None]
    assert len(actual) == len(records)
    assert [row["value"] for row in actual] == [row[2] for row in records]
    if grain != "7d":
        assert any(row["value"] is None for row in result["rows"])
        assert len(result["rows"]) == 8
    else:
        assert [row["value"] for row in result["rows"]] == [0.0, None, 14.0]


@pytest.mark.parametrize("grain", ["1d", "24h"])
def test_utc_midnight_daily_crosses_bst_to_gmt(
    monkeypatch: pytest.MonkeyPatch, sources_db: Any, grain: str
) -> None:
    """A fixed UTC daily phase survives the London offset change and fills its gap."""
    spec = _spec(grain=grain)
    first = datetime(2026, 10, 20, tzinfo=UTC)
    records = [
        (first + timedelta(days=offset), "A", float(offset), first, first)
        for offset in range(10)
        if offset != 5
    ]
    _seed(sources_db, spec, records)
    result = _run(monkeypatch, sources_db, spec, start="2026-10-22", end="2026-10-28")
    assert result["row_count"] == 7
    gaps = [row for row in result["rows"] if row["value"] is None]
    assert len(gaps) == 1
    assert gaps[0]["ts"] == rows._ts_ms(datetime(2026, 10, 25, tzinfo=UTC))
    assert gaps[0][result["group"]] == "A"


def test_calendar_day_grain_crosses_gmt_to_bst_without_phase_refusal(monkeypatch, sources_db):
    """Spring's shorter UTC day retains a London 23:00 daily phase."""
    london = ZoneInfo("Europe/London")
    spec = _spec(grain="1d")
    first = date(2025, 3, 28)
    stamps = [
        datetime.combine(first + timedelta(days=offset), datetime.min.time(), london).replace(
            hour=23
        )
        for offset in (0, 1, 3, 4)
    ]
    _seed(
        sources_db, spec, [(stamp, "U", float(i), stamp, stamp) for i, stamp in enumerate(stamps)]
    )
    result = _run(monkeypatch, sources_db, spec, start="2025-03-28", end="2025-04-01")
    assert result["row_count"] == 5
    assert [row["value"] for row in result["rows"]] == [0.0, 1.0, None, 2.0, 3.0]


def test_unsupported_cadence_names_identity_or_phase_in_message(monkeypatch, sources_db):
    """Mixed phases are a cadence failure even for a two-row response."""
    first = datetime(2026, 9, 22, tzinfo=UTC)
    second = first.replace(hour=1)
    _seed(
        sources_db,
        _spec(grain="1d"),
        [(first, "U", 1.0, first, first), (second, "U", 2.0, second, second)],
    )
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, _spec(grain="1d"))
    assert caught.value.details["reason"] == "unsupported_cadence"
    assert "cadence" in caught.value.message.lower()
    assert "row limit" not in caught.value.message.lower()


def test_interval_value_is_not_treated_as_numeric_bucket(monkeypatch):
    """INTERVAL contains INT but must never be sent to numeric avg()."""
    spec = _spec()
    spec["values"] = [{"column": "duration", "unit": "", "label": "Duration"}]
    request = rows.Request("test", spec, None, None, "unit", (), False)
    meta = rows.Metadata(
        "silver_test_sample",
        {"timestamp_utc": "TIMESTAMPTZ", "duration": "INTERVAL"},
        None,
        None,
        None,
        None,
        0,
    )
    sql = rows._bucket_sql(
        "SELECT * FROM silver_test_sample", request, meta, "timestamp_utc", 3600000
    )
    assert 'avg("duration")' not in sql
    assert 'min("duration")' in sql


def test_missing_metadata_relation_raises_runtime_error(monkeypatch, sources_db):
    """A broken metadata invariant must be checked under optimized Python."""
    spec = _spec()
    monkeypatch.setattr(
        rows, "_metadata", lambda *_: rows.Metadata(None, {}, None, None, None, None, 0)
    )
    request = rows.Request("test", spec, None, None, None, (), False)
    with pytest.raises(RuntimeError, match="relation"):
        rows.execute(sources_db, request, "broken")


def test_ambiguity_hint_uses_stable_conflict_order(sources_db):
    """The earliest conflicting clock and group determine the hint."""
    spec = _spec()
    spec["dims"].append({"column": "region", "role": "filter", "cardinality": 2})
    spec["dedup"] = None
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "region VARCHAR, value DOUBLE)"
    )
    early = datetime(2026, 9, 21, tzinfo=UTC)
    late = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?, ?, 1)",
        [(late, "B", "north"), (late, "B", "south"), (early, "A", "north"), (early, "A", "south")],
    )
    request = rows.Request("test", spec, None, None, "unit", (), False)
    with pytest.raises(rows.RowsError) as caught:
        rows._check_entity(sources_db, request, "SELECT * FROM silver_test_sample", "timestamp_utc")
    assert caught.value.details["hint"] == "group=region&filter=unit:A"
    assert "ORDER BY __native_clock, __native_group LIMIT 1" in sources_db.calls[-1]


def test_gap_expansion_is_per_group(monkeypatch, sources_db):
    """Each group has its own phase, leading gap, and trailing gap."""
    base = datetime(2026, 9, 22, tzinfo=UTC)
    records = [
        (base + timedelta(hours=1), "A", 1.0, base, base),
        (base + timedelta(hours=2), "B", 2.0, base, base),
    ]
    _seed(sources_db, _spec(), records)
    result = _run(monkeypatch, sources_db, _spec())
    assert all(row[result["group"]] in {"A", "B"} for row in result["rows"])
    assert all("group" not in row for row in result["rows"])
    by_group = {
        group: [r for r in result["rows"] if r[result["group"]] == group] for group in ("A", "B")
    }
    assert len(by_group["A"]) == len(by_group["B"]) == 24
    assert [r["value"] for r in by_group["A"][:4]] == [None, None, 1.0, None]
    assert [r["value"] for r in by_group["B"][:4]] == [None, None, None, 2.0]
    assert by_group["A"][-1]["value"] is by_group["B"][-1]["value"] is None


def test_irregular_grain_preserves_stored_steps(monkeypatch, sources_db):
    """Unrecognized cadence must not manufacture observations."""
    spec = _spec(grain="irregular")
    first = datetime(2026, 9, 22, tzinfo=UTC)
    third = first + timedelta(hours=3)
    _seed(sources_db, spec, [(first, "A", 1.0, first, first), (third, "A", 3.0, third, third)])
    result = _run(monkeypatch, sources_db, spec)
    assert [row["value"] for row in result["rows"]] == [1.0, 3.0]
    assert result["grain_ms"] is None
    assert any("not gap-filled" in note for note in result["notes"])


def test_relation_without_settlement_columns_omits_both(monkeypatch, sources_db):
    """Ordinary series never invent a settlement date or period."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, _spec(), [(stamp, "A", 1.0, stamp, stamp)])
    result = _run(monkeypatch, sources_db, _spec())
    assert all(
        "settlement_date" not in row and "settlement_period" not in row for row in result["rows"]
    )


def test_mid_passes_through_settlement_period(monkeypatch, sources_db):
    """Stored settlement labels survive projection without local re-derivation."""
    spec = _spec()
    spec["clock"]["settlement_cols"] = ["settlement_date", "settlement_period"]
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, value DOUBLE, "
        "published_at TIMESTAMPTZ, settlement_date DATE, settlement_period INTEGER)"
    )
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.execute(
        "INSERT INTO silver_test_sample VALUES (?, 'A', 1, ?, DATE '2026-09-21', 49)",
        [stamp, stamp],
    )
    result = _run(monkeypatch, sources_db, spec)
    native = next(row for row in result["rows"] if row["value"] == 1)
    assert native["settlement_date"] == "2026-09-21"
    assert native["settlement_period"] == 49
    assert next(row for row in result["rows"] if row["value"] is None)["settlement_period"] is None


def test_spec_named_latest_relation_is_queried(monkeypatch, sources_db):
    """An available declared latest relation wins over a decoy base."""
    spec = _spec()
    spec["latest_relation"] = "silver_test_latest"
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, spec, [(stamp, "A", 1.0, stamp, stamp)])
    sources_db.con.execute("CREATE TABLE silver_test_latest AS SELECT * FROM silver_test_sample")
    sources_db.con.execute("UPDATE silver_test_latest SET value=9")
    result = _run(monkeypatch, sources_db, spec)
    assert result["relation"] == "silver_test_latest"
    assert next(row["value"] for row in result["rows"] if row["value"] is not None) == 9


def test_declared_base_fallback_when_latest_absent(monkeypatch, sources_db):
    """Only a declared base may replace an absent latest relation."""
    spec = _spec()
    spec["latest_relation"] = "silver_test_latest"
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, spec, [(stamp, "A", 4.0, stamp, stamp)])
    result = _run(monkeypatch, sources_db, spec)
    assert result["relation"] == "silver_test_sample"
    assert next(row["value"] for row in result["rows"] if row["value"] is not None) == 4


def test_dedup_keeps_max_published_at(monkeypatch, sources_db):
    """Publication ordering selects the latest revision within each full key."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    older = stamp - timedelta(hours=1)
    _seed(sources_db, _spec(), [(stamp, "A", 1.0, older, stamp), (stamp, "A", 2.0, stamp, stamp)])
    result = _run(monkeypatch, sources_db, _spec())
    assert [row["value"] for row in result["rows"] if row["value"] is not None] == [2.0]


def test_empty_order_equal_captures_collapse_and_report(monkeypatch, sources_db):
    """Equal declared captures with different ingestion provenance collapse."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(
        sources_db,
        _spec(ordered=False),
        [(stamp, "A", 1.0, stamp, stamp), (stamp, "A", 1.0, stamp, stamp + timedelta(hours=1))],
    )
    result = _run(monkeypatch, sources_db, _spec(ordered=False))
    assert result["truncation"]["reasons"] == [{"type": "exact_duplicate_rows", "removed_rows": 1}]


@pytest.mark.parametrize("reverse", [False, True])
def test_empty_order_differing_values_refuse(monkeypatch, sources_db, reverse):
    """Conflicting equal-clock values refuse in either insertion order."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    data = [(stamp, "A", 1.0, stamp, stamp), (stamp, "A", 2.0, stamp, stamp)]
    _seed(sources_db, _spec(ordered=False), data[::-1] if reverse else data)
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, _spec(ordered=False))
    assert caught.value.code == rows.RowsErrorCode.AMBIGUOUS_SERIES
    assert "value" in caught.value.details["varying_columns"]


def test_stack_mandatory_v2_filter_is_applied(monkeypatch, sources_db):
    """An explicit clear cannot remove a mandatory semantic predicate."""
    spec = _spec()
    spec["row_filter"] = {"column": "unit", "equals": "v2"}
    spec["dedup"] = None
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, spec, [(stamp, "v2", 2.0, stamp, stamp), (stamp, "v1", 1.0, stamp, stamp)])
    result = _run(monkeypatch, sources_db, spec, filters=[""])
    assert {row[result["group"]] for row in result["rows"]} == {"v2"}
    assert "Mandatory semantic filter includes only rows where unit equals v2." in result["notes"]


def test_dedup_precedes_row_filter_filters_and_window(monkeypatch, sources_db):
    """A newer nonmatching revision cannot resurrect an older matching row."""
    spec = _spec()
    spec["dedup"]["keys"] = ["unit"]
    spec["dims"].append({"column": "variant", "role": "filter", "cardinality": 2})
    old = datetime(2026, 9, 21, tzinfo=UTC)
    new = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "variant VARCHAR, value DOUBLE, published_at TIMESTAMPTZ)"
    )
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, 'A', ?, ?, ?)",
        [(old, "v2", 1.0, old), (new, "v1", 2.0, new)],
    )
    spec["row_filter"] = {"column": "variant", "equals": "v2"}
    mandatory = _run(monkeypatch, sources_db, spec, start="2026-09-21", end="2026-09-22")
    assert mandatory["row_count"] == 0
    spec["row_filter"] = None
    optional = _run(
        monkeypatch,
        sources_db,
        spec,
        start="2026-09-21",
        end="2026-09-22",
        filters=["variant:v2"],
    )
    assert optional["row_count"] == 0
    windowed = _run(monkeypatch, sources_db, spec, start="2026-09-21", end="2026-09-21")
    assert windowed["row_count"] == 0


@pytest.mark.parametrize(
    "day, expected_count, lower, upper",
    [
        ("2025-10-26", 50, "2025-10-25T23:00:00Z", "2025-10-27T00:00:00Z"),
        ("2025-03-30", 46, "2025-03-30T00:00:00Z", "2025-03-30T23:00:00Z"),
    ],
)
def test_dst_half_hour_window_bounds(monkeypatch, sources_db, day, expected_count, lower, upper):
    """The grid follows actual elapsed instants across both UK clock changes."""
    spec = _spec(grain="30min")
    first = datetime.fromisoformat(lower.replace("Z", "+00:00"))
    _seed(sources_db, spec, [(first, "A", 1.0, first, first)])
    result = _run(monkeypatch, sources_db, spec, start=day, end=day)
    assert result["window"]["lower_utc"] == lower
    assert result["window"]["upper_utc"] == upper
    assert result["row_count"] == expected_count


def test_bst_to_gmt_day_has_50_half_hours(monkeypatch, sources_db):
    test_dst_half_hour_window_bounds(
        monkeypatch, sources_db, "2025-10-26", 50, "2025-10-25T23:00:00Z", "2025-10-27T00:00:00Z"
    )


def test_spring_day_has_46_half_hours(monkeypatch, sources_db):
    test_dst_half_hour_window_bounds(
        monkeypatch, sources_db, "2025-03-30", 46, "2025-03-30T00:00:00Z", "2025-03-30T23:00:00Z"
    )


def test_london_frame_converts_to_utc_epoch_ms(monkeypatch, sources_db):
    """The repeated 01:30 local hour carries two distinct UTC instants."""
    spec = _spec(grain="30min")
    london = ZoneInfo("Europe/London")
    early = datetime(2025, 10, 26, 1, 30, tzinfo=london, fold=0)
    late = datetime(2025, 10, 26, 1, 30, tzinfo=london, fold=1)
    _seed(sources_db, spec, [(early, "A", 1.0, early, early), (late, "A", 2.0, late, late)])
    result = _run(monkeypatch, sources_db, spec, start="2025-10-26", end="2025-10-26")
    native = [row for row in result["rows"] if row["value"] is not None]
    assert [row["ts"] for row in native] == [rows._ts_ms(early), rows._ts_ms(late)]


def test_naive_utc_clock_in_bst(monkeypatch, sources_db):
    """A UTC-suffixed naive clock denotes UTC even in a London SQL session."""
    spec = _spec(grain="irregular")
    sources_db.con.execute("SET TimeZone='Europe/London'")
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMP, unit VARCHAR, value DOUBLE, "
        "published_at TIMESTAMPTZ)"
    )
    sources_db.con.execute(
        "INSERT INTO silver_test_sample VALUES (TIMESTAMP '2026-08-01 00:30:00', 'A', 1, now())"
    )
    result = _run(monkeypatch, sources_db, spec, start="2026-08-01", end="2026-08-01")
    assert result["rows"][0]["ts"] == rows._ts_ms(datetime(2026, 8, 1, 0, 30, tzinfo=UTC))
    assert result["window"]["lower_utc"] == "2026-07-31T23:00:00Z"


def test_events_use_publication_clock_and_descending_order(monkeypatch, sources_db):
    """Events use the declared publication anchor for selection and ordering."""
    spec = _spec()
    spec.update(
        kind="events", clock=None, latest_day_rule={"mode": "max", "column": "published_at"}
    )
    spec["id"] = "outages_sample"
    spec["dedup"] = None
    first = datetime(2026, 9, 22, 10, tzinfo=UTC)
    later = first + timedelta(hours=1)
    _seed(sources_db, spec, [(first, "A", 1.0, first, first), (first, "A", 2.0, later, later)])
    result = _run(monkeypatch, sources_db, spec)
    assert [row["value"] for row in result["rows"]] == [2.0, 1.0]
    assert [row["ts"] for row in result["rows"]] == [rows._ts_ms(later), rows._ts_ms(first)]
    assert result["coverage"]["day_count"] == 1
    assert any("publication time" in note for note in result["notes"])


def test_event_without_clock_uses_declared_event_anchor(monkeypatch, sources_db):
    """A clockless event descriptor still resolves its publication day."""
    spec = _spec()
    spec.update(
        kind="events", clock=None, latest_day_rule={"mode": "max", "column": "published_at"}
    )
    spec["dedup"] = None
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, spec, [(stamp, "A", 7.0, stamp, stamp)])
    result = _run(monkeypatch, sources_db, spec)
    assert result["rows"][0]["ts"] == rows._ts_ms(stamp)
    assert result["window"]["start"] == "2026-09-22"


def test_reference_has_no_window_and_obeys_dedup(monkeypatch, sources_db):
    """Reference records retain the selected revision and no date window."""
    spec = _spec()
    spec.update(kind="reference", clock=None, latest_day_rule={"mode": "reference", "column": None})
    spec["dedup"]["keys"] = ["unit"]
    first = datetime(2026, 9, 22, tzinfo=UTC)
    later = first + timedelta(hours=1)
    _seed(sources_db, spec, [(first, "A", 1.0, first, first), (first, "A", 2.0, later, later)])
    result = _run(monkeypatch, sources_db, spec, start=None, end=None)
    assert result["window"] is None
    assert result["coverage"]["days_in_window"] is None
    assert [row["value"] for row in result["rows"]] == [2.0]


def test_reference_snapshot_precedes_optional_filter(monkeypatch, sources_db):
    """An optional filter cannot revive a record from an older snapshot."""
    spec = _spec()
    spec.update(kind="reference", clock=None, latest_day_rule={"mode": "reference", "column": None})
    spec["dedup"] = None
    spec["snapshot_column"] = "published_at"
    old = datetime(2026, 9, 21, tzinfo=UTC)
    new = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, spec, [(old, "A", 1.0, old, old), (new, "B", 2.0, new, new)])
    result = _run(monkeypatch, sources_db, spec, start=None, end=None, filters=["unit:A"])
    assert result["rows"] == []


def test_pn_ranking_uses_mean_level_to_and_stable_ties(monkeypatch, sources_db):
    """Top units rank by mean, break ties by ID, and exclude null IDs."""
    sources_db.con.execute("CREATE TABLE levels (bm_unit_id VARCHAR, level_to DOUBLE)")
    sources_db.con.executemany(
        "INSERT INTO levels VALUES (?, ?)",
        [("B", 10.0), ("B", 0.0), ("A", 5.0), ("C", 9.0), (None, 100.0)],
    )
    ids, total, selected, groups, null_rows = rows._top_pn(sources_db, "SELECT * FROM levels")
    assert ids[:3] == ["C", "A", "B"]
    assert (total, selected, groups, null_rows) == (5, 4, 3, 1)


def test_gap_and_bucket_never_invent_settlement_period(monkeypatch, sources_db):
    """Gaps and conflicting buckets carry null settlement labels."""
    spec = _spec()
    spec["clock"]["settlement_cols"] = ["settlement_period"]
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "value DOUBLE, published_at TIMESTAMPTZ, settlement_period INTEGER)"
    )
    first = datetime(2026, 9, 22, tzinfo=UTC)
    second = first + timedelta(hours=1)
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, 'A', ?, ?, ?)",
        [(first, 1.0, first, 1), (second, 3.0, second, 2)],
    )
    result = _run(monkeypatch, sources_db, spec)
    assert next(row for row in result["rows"] if row["value"] is None)["settlement_period"] is None
    request = rows.Request("test", spec, None, None, "unit", (), False)
    meta = rows.Metadata(
        "silver_test_sample",
        {"timestamp_utc": "TIMESTAMPTZ", "value": "DOUBLE"},
        None,
        None,
        None,
        None,
        0,
    )
    bucket = rows._bucket_sql(
        "SELECT * FROM silver_test_sample", request, meta, "timestamp_utc", 7200000
    )
    assert sources_db.query(bucket).to_dicts()[0]["settlement_period"] is None


def test_cold_schema_mismatch_never_queries_dataset(monkeypatch, sources_db):
    """A missing required value fails after schema inspection and caches the failure."""
    spec = _spec()
    sources_db.con.execute("CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ)")
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    request = rows.validate("test", "sample", "2026-09-22", "2026-09-22", None, None)
    for _ in range(2):
        with pytest.raises(rows.RowsError) as caught:
            rows.execute(sources_db, request, f"schema-{id(sources_db)}")
        assert caught.value.details["not_held_cause"] == "missing-in-catalogue"
    assert len(sources_db.calls) == 1
    assert sources_db.table_calls == 1


@pytest.mark.parametrize("clock_type", ["VARCHAR", "TIMESTAMP"])
def test_unsupported_clock_type_is_missing_in_catalogue(monkeypatch, sources_db, clock_type):
    """Unsupported clock encodings are rejected both cold and from cache."""
    spec = _spec()
    if clock_type == "TIMESTAMP":
        spec["clock"]["column"] = "stamp"
        spec["latest_day_rule"]["column"] = "stamp"
        spec["dedup"]["keys"][0] = "stamp"
    name = spec["clock"]["column"]
    sources_db.con.execute(
        f"CREATE TABLE silver_test_sample ({name} {clock_type}, unit VARCHAR, "
        "value DOUBLE, published_at TIMESTAMPTZ)"
    )
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    request = rows.validate("test", "sample", None, None, None, None)
    for _ in range(2):
        with pytest.raises(rows.RowsError) as caught:
            rows.execute(sources_db, request, f"clock-{id(sources_db)}")
        assert caught.value.details["not_held_cause"] == "missing-in-catalogue"
    assert sources_db.table_calls == 1


def test_nonstring_dims_use_canonical_equality(monkeypatch, sources_db):
    """Integer and Boolean filters match the canonical DuckDB string form."""
    spec = _spec()
    spec.update(
        kind="reference",
        clock=None,
        latest_day_rule={"mode": "reference", "column": None},
        dedup=None,
    )
    spec["dims"] = [
        {"column": "number", "role": "filter", "cardinality": 2},
        {"column": "flag", "role": "filter", "cardinality": 2},
    ]
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (number INTEGER, flag BOOLEAN, value DOUBLE)"
    )
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?, ?)", [(7, True, 1.0), (7, False, 2.0)]
    )
    true_rows = _run(
        monkeypatch, sources_db, spec, start=None, end=None, filters=["number:7", "flag:true"]
    )
    false_rows = _run(
        monkeypatch, sources_db, spec, start=None, end=None, filters=["number:7", "flag:false"]
    )
    assert [row["value"] for row in true_rows["rows"]] == [1.0]
    assert [row["value"] for row in false_rows["rows"]] == [2.0]


def test_entity_identity_check_precedes_window(monkeypatch, sources_db):
    """An older producer collision is visible before a clean date window."""
    spec = _spec(ordered=False)
    spec["dedup"] = None
    spec["dims"].append({"column": "region", "role": "filter", "cardinality": 2})
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "region VARCHAR, value DOUBLE)"
    )
    old = datetime(2026, 9, 21, tzinfo=UTC)
    new = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?, ?, ?)",
        [(old, "A", "north", 1.0), (old, "A", "south", 2.0), (new, "A", "north", 3.0)],
    )
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, spec)
    assert caught.value.code == rows.RowsErrorCode.AMBIGUOUS_SERIES
    assert "region" in caught.value.details["varying_dimensions"]


def test_dimensionless_observation_conflict_is_window_scoped(monkeypatch, sources_db):
    """Only conflicting observations in the selected window refuse."""
    spec = _spec(ordered=False, grouped=False)
    old = datetime(2026, 9, 21, tzinfo=UTC)
    new = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(
        sources_db,
        spec,
        [(old, None, 1.0, old, old), (old, None, 2.0, old, old), (new, None, 3.0, new, new)],
    )
    assert _run(monkeypatch, sources_db, spec)["rows"][1]["value"] == 3.0
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, spec, start="2026-09-21", end="2026-09-21")
    assert caught.value.code == rows.RowsErrorCode.AMBIGUOUS_SERIES


def test_stack_unit_collision_refuses_even_with_equal_provenance(monkeypatch, sources_db):
    """Distinct units at one group and clock cannot be collapsed or averaged."""
    spec = _spec(ordered=False)
    spec["dedup"] = None
    spec["dims"] = [
        {"column": "unit", "role": "filter", "cardinality": 2},
        {"column": "region", "role": "series", "cardinality": 1},
    ]
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "region VARCHAR, value DOUBLE)"
    )
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?, 'R', 1)", [(stamp, "A"), (stamp, "B")]
    )
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, spec)
    assert caught.value.code == rows.RowsErrorCode.AMBIGUOUS_SERIES
    assert "unit" in caught.value.details["varying_dimensions"]


def test_exact_duplicate_collapse_is_reported(monkeypatch, sources_db):
    """Complete declared duplicates collapse once and report the count."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, _spec(ordered=False), [(stamp, "A", 1.0, stamp, stamp)] * 2)
    result = _run(monkeypatch, sources_db, _spec(ordered=False))
    assert result["truncation"]["reasons"] == [{"type": "exact_duplicate_rows", "removed_rows": 1}]


def test_undeclared_provenance_does_not_block_capture_collapse(monkeypatch, sources_db):
    """An undeclared ingestion field cannot change the served capture."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(
        sources_db,
        _spec(ordered=False),
        [(stamp, "A", 1.0, stamp, stamp), (stamp, "A", 1.0, stamp, stamp + timedelta(days=1))],
    )
    result = _run(monkeypatch, sources_db, _spec(ordered=False))
    assert [row["value"] for row in result["rows"] if row["value"] is not None] == [1.0]
    assert result["truncation"]["reasons"][0]["removed_rows"] == 1


@pytest.mark.parametrize(
    "field", ["value", "unit", "settlement_period", "anchor_utc", "special", "published_at", "snap"]
)
def test_declared_difference_is_not_a_capture_duplicate(sources_db, field):
    """Every declared projection class can distinguish same-clock captures."""
    spec = _spec(ordered=False, grouped=False)
    spec["dedup"] = None
    if field == "unit":
        spec["dims"] = [{"column": "unit", "role": "filter", "cardinality": 2}]
    elif field == "settlement_period":
        spec["clock"]["settlement_cols"] = [field]
    elif field == "anchor_utc":
        spec["latest_day_rule"]["column"] = field
    elif field == "special":
        spec["dedup"] = {"keys": ["timestamp_utc", field], "order_by": []}
    elif field == "published_at":
        spec["dedup"] = {
            "keys": ["timestamp_utc"],
            "order_by": [{"column": field, "direction": "desc", "nulls": "last"}],
        }
    elif field == "snap":
        spec["snapshot_column"] = field
    sources_db.con.execute(
        "CREATE TABLE captures (timestamp_utc TIMESTAMPTZ, value DOUBLE, unit VARCHAR, "
        "settlement_period INTEGER, anchor_utc TIMESTAMPTZ, special VARCHAR, "
        "published_at TIMESTAMPTZ, snap INTEGER)"
    )
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    base = [stamp, 1.0, "A", 1, stamp, "x", stamp, 1]
    changed = list(base)
    changed[
        [
            "timestamp_utc",
            "value",
            "unit",
            "settlement_period",
            "anchor_utc",
            "special",
            "published_at",
            "snap",
        ].index(field)
    ] = {
        "value": 2.0,
        "unit": "B",
        "settlement_period": 2,
        "anchor_utc": stamp + timedelta(hours=1),
        "special": "y",
        "published_at": stamp + timedelta(hours=1),
        "snap": 2,
    }[field]
    sources_db.con.executemany(
        "INSERT INTO captures VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [base, changed]
    )
    request = rows.Request("test", spec, None, None, None, (), False)
    with pytest.raises(rows.RowsError) as caught:
        rows._native_collision_check(
            sources_db, request, "SELECT * FROM captures", "timestamp_utc", rows._projection(spec)
        )
    assert caught.value.code == rows.RowsErrorCode.AMBIGUOUS_SERIES
    assert field in caught.value.details["varying_columns"]


def test_submillisecond_output_collision_refuses(monkeypatch, sources_db):
    """Distinct native microseconds must not map to the same JSON millisecond key."""
    spec = _spec(ordered=False, grouped=False)
    spec["dedup"] = None
    first = datetime(2026, 9, 22, 0, 0, 0, 100, UTC)
    second = datetime(2026, 9, 22, 0, 0, 0, 200, UTC)
    _seed(sources_db, spec, [(first, None, 1.0, first, first), (second, None, 2.0, second, second)])
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, spec)
    assert caught.value.code == rows.RowsErrorCode.AMBIGUOUS_SERIES


def test_staggered_identities_cannot_share_bucket(monkeypatch, sources_db):
    """Different entities at separate instants may still collide after bucketing."""
    monkeypatch.setattr(rows, "MAX_RESPONSE_ROWS", 5)
    spec = _spec(ordered=False)
    spec["dedup"] = None
    spec["dims"].append({"column": "region", "role": "filter", "cardinality": 2})
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "region VARCHAR, value DOUBLE)"
    )
    first = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, 'A', ?, ?)",
        [(first, "north", 1.0), (first + timedelta(hours=1), "south", 2.0)],
    )
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, spec)
    assert caught.value.details["reason"] == "mixed_identity"


@pytest.mark.parametrize("irregular", [False, True])
def test_generation_units_downsample_to_fit(monkeypatch, sources_db, irregular):
    """A bounded group reports bucket width without inventing an irregular native grain."""
    monkeypatch.setattr(rows, "MAX_RESPONSE_ROWS", 5)
    first = datetime(2026, 9, 22, tzinfo=UTC)
    spec = _spec(grain="irregular" if irregular else "1h")
    records = (
        [(first + timedelta(hours=i), "A", float(i + 1), first, first) for i in range(6)]
        if irregular
        else [(first, "A", 1.0, first, first), (first + timedelta(hours=1), "A", 3.0, first, first)]
    )
    _seed(sources_db, spec, records)
    result = _run(monkeypatch, sources_db, spec)
    assert result["truncation"]["reasons"] == [
        {"type": "downsample", "bucket_ms": result["truncation"]["bucket_ms"]}
    ]
    assert (
        result["grain_ms"] is None
        if irregular
        else result["grain_ms"] == result["truncation"]["bucket_ms"]
    )
    assert result["row_count"] <= 5
    expected_first = 1.5 if irregular else 2.0
    assert (
        next(row["value"] for row in result["rows"] if row["value"] is not None) == expected_first
    )
    assert all(row[result["group"]] == "A" for row in result["rows"])


def test_cap_includes_generated_gap_rows(monkeypatch, sources_db):
    """Sparse native data still counts the full expanded window toward the cap."""
    monkeypatch.setattr(rows, "MAX_RESPONSE_ROWS", 5)
    first = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, _spec(), [(first, "A", 1.0, first, first)])
    result = _run(monkeypatch, sources_db, _spec())
    assert result["row_count"] <= 5
    assert result["grain_ms"] > rows.GRAINS["1h"]
    assert any(reason["type"] == "downsample" for reason in result["truncation"]["reasons"])


def test_cap_boundary_and_overflow_sentinel(monkeypatch, sources_db):
    """The 50,001st reference row is refused rather than sliced away."""
    spec = _spec()
    spec.update(
        kind="reference",
        clock=None,
        latest_day_rule={"mode": "reference", "column": None},
        dedup=None,
    )
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample AS SELECT 'A'::VARCHAR AS unit, "
        "i::DOUBLE AS value FROM range(50000) AS t(i)"
    )
    accepted = _run(monkeypatch, sources_db, spec, start=None, end=None)
    assert accepted["row_count"] == 50000
    sources_db.con.execute("INSERT INTO silver_test_sample VALUES ('A', 50000)")
    with pytest.raises(rows.RowsError) as caught:
        _run(monkeypatch, sources_db, spec, start=None, end=None)
    assert caught.value.details["reason"] == "record_cap"


def test_deep_series_requires_downsampling(monkeypatch, sources_db):
    """A deep covered range reports a coarser grain and deep-range reduction."""
    spec = _spec(grain="1d")
    first = datetime(2025, 1, 1, tzinfo=UTC)
    last = first + timedelta(days=401)
    _seed(sources_db, spec, [(first, "A", 1.0, first, first), (last, "A", 3.0, last, last)])
    result = _run(monkeypatch, sources_db, spec, start="2025-01-01", end=last.date().isoformat())
    assert result["grain_ms"] > rows.GRAINS["1d"]
    assert {reason["type"] for reason in result["truncation"]["reasons"]} >= {
        "downsample",
        "deep_range",
    }


def test_deep_range_is_bounded_by_local_depth(monkeypatch, sources_db):
    """Either endpoint outside held local depth fails before expansion."""
    first = datetime(2025, 1, 1, tzinfo=UTC)
    last = first + timedelta(days=401)
    _seed(sources_db, _spec(), [(first, "A", 1.0, first, first), (last, "A", 2.0, last, last)])
    for start, end in (
        ("2024-12-31", last.date().isoformat()),
        ("2025-01-01", (last.date() + timedelta(days=1)).isoformat()),
    ):
        with pytest.raises(rows.RowsError) as caught:
            _run(monkeypatch, sources_db, _spec(), start=start, end=end)
        assert caught.value.code == rows.RowsErrorCode.BAD_RANGE


def test_all_null_bucket_stays_null(sources_db):
    """AVG over an entirely null numeric bucket remains null."""
    spec = _spec()
    request = rows.Request("test", spec, None, None, "unit", (), False)
    meta = rows.Metadata(
        "sample", {"timestamp_utc": "TIMESTAMPTZ", "value": "DOUBLE"}, None, None, None, None, 0
    )
    sources_db.con.execute(
        "CREATE TABLE sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, value DOUBLE)"
    )
    sources_db.con.execute(
        "INSERT INTO sample VALUES (TIMESTAMPTZ '2026-09-22 00:00:00+00', 'A', NULL)"
    )
    bucket = rows._bucket_sql("SELECT * FROM sample", request, meta, "timestamp_utc", 7200000)
    assert sources_db.query(bucket).to_dicts()[0]["value"] is None


def test_varying_ancillary_fields_become_null_with_note(monkeypatch, sources_db):
    """Varying text/Boolean measurements cannot acquire an invented aggregate."""
    monkeypatch.setattr(rows, "MAX_RESPONSE_ROWS", 5)
    spec = _spec(ordered=False)
    spec["dedup"] = None
    spec["values"].extend(
        [
            {"column": "status", "unit": "", "label": "Status"},
            {"column": "flag", "unit": "", "label": "Flag"},
            {"column": "constant", "unit": "", "label": "Constant"},
        ]
    )
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "value DOUBLE, status VARCHAR, flag BOOLEAN, constant VARCHAR)"
    )
    first = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, 'A', 1, ?, ?, 'same')",
        [(first, "up", True), (first + timedelta(hours=1), "down", False)],
    )
    result = _run(monkeypatch, sources_db, spec)
    bucket = next(row for row in result["rows"] if row["value"] is not None)
    assert bucket["status"] is None
    assert bucket["flag"] is None
    assert bucket["constant"] == "same"
    assert {"type": "ancillary_null", "columns": ["flag", "status"]} in result["truncation"][
        "reasons"
    ]
    assert any("nonnumeric" in note for note in result["notes"])


def test_constant_ancillary_fields_do_not_report_null_reduction(
    monkeypatch: pytest.MonkeyPatch, sources_db: Any
) -> None:
    """A text field retained in every bucket causes no ancillary reduction."""
    monkeypatch.setattr(rows, "MAX_RESPONSE_ROWS", 5)
    spec = _spec(ordered=False)
    spec["dedup"] = None
    spec["values"].append({"column": "status", "unit": "", "label": "Status"})
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "value DOUBLE, status VARCHAR)"
    )
    first = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, 'A', 1, 'up')",
        [(first,), (first + timedelta(hours=1),)],
    )
    result = _run(monkeypatch, sources_db, spec)
    assert result["truncation"]["reasons"] == [
        {"type": "downsample", "bucket_ms": result["truncation"]["bucket_ms"]}
    ]
    assert all(row["status"] == "up" for row in result["rows"] if row["value"] is not None)
    assert not any("nonnumeric" in note for note in result["notes"])


def test_date_clock_preserves_label_without_gas_day_derivation(monkeypatch, sources_db):
    """A DATE stays a label and plots at UTC midnight."""
    spec = _spec(grain="1d", grouped=False)
    spec["clock"]["column"] = "delivery_date"
    spec["latest_day_rule"]["column"] = "delivery_date"
    spec["dedup"] = None
    sources_db.con.execute("CREATE TABLE silver_test_sample (delivery_date DATE, value DOUBLE)")
    sources_db.con.execute("INSERT INTO silver_test_sample VALUES (DATE '2026-08-01', 4)")
    result = _run(monkeypatch, sources_db, spec, start="2026-08-01", end="2026-08-01")
    assert result["rows"][0]["delivery_date"] == "2026-08-01"
    assert result["rows"][0]["ts"] == rows._ts_ms(date(2026, 8, 1))
    assert any("not a gas-day" in note for note in result["notes"])


def test_metadata_cache_reuses_checks_and_expires(monkeypatch, sources_db):
    """TTL and config keys isolate metadata checks while warm reads reuse them."""
    spec = _spec()
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, spec, [(stamp, "A", 1.0, stamp, stamp)])
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    request = rows.validate("test", "sample", None, None, None, None)
    tick = [1000.0]
    monkeypatch.setattr(rows.time, "monotonic", lambda: tick[0])
    key = f"cache-{id(sources_db)}"
    assert rows._metadata(sources_db, request, key).rows == 1
    assert rows._metadata(sources_db, request, key).rows == 1
    assert sources_db.table_calls == 1
    rows._metadata(sources_db, request, key + "-other")
    assert sources_db.table_calls == 2
    tick[0] += rows.TTL_SECONDS + 1
    rows._metadata(sources_db, request, key)
    assert sources_db.table_calls == 3
