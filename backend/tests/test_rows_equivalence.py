"""Exact synthetic DuckDB comparison of the frozen rows baseline and reuse path."""

from __future__ import annotations

import copy
import json
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import duckdb
import polars as pl
import pytest
import rows_baseline as D  # noqa: N812 - frozen baseline arm
from conftest import SourcesDuckDBClient
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app import rows as N  # noqa: N812 - new implementation arm
from app import sources
from app.main import app

STAMP = datetime(2026, 9, 22, tzinfo=UTC)


class _FixedDatetime(datetime):
    """Pin coverage's wall clock in both independent implementation modules."""

    @classmethod
    def now(cls, tz: Any = None) -> datetime:
        """Return the same UTC instant for each comparison arm."""
        fixed = datetime(2026, 9, 29, tzinfo=UTC)
        return fixed.astimezone(tz) if tz is not None else fixed.replace(tzinfo=None)


def _spec(kind: str = "series") -> dict[str, Any]:
    """Build a registry declaration for the synthetic relation."""
    return {
        "id": "sample",
        "kind": kind,
        "base_relation": "silver_test_sample",
        "latest_relation": None,
        "not_held_cause": None,
        "clock": {"column": "timestamp_utc", "grain": "irregular", "settlement_cols": []}
        if kind == "series"
        else None,
        "latest_day_rule": {"mode": "reference", "column": None}
        if kind == "reference"
        else {"mode": "max", "column": "timestamp_utc"},
        "values": [{"column": "value", "unit": "MW", "label": "Value"}],
        "dims": [{"column": "unit", "role": "series", "cardinality": 2}],
        "default_filter": None,
        "dedup": None,
        "row_filter": None,
        "snapshot_column": None,
        "notes": [],
    }


def _record(
    *,
    hour: int = 0,
    unit: str = "A",
    value: float = 1.0,
    published_hour: int = 0,
    snap: int = 1,
    status: str = "keep",
) -> tuple[Any, ...]:
    """Return one timestamp-aware synthetic capture."""
    return (
        STAMP + timedelta(hours=hour),
        unit,
        value,
        STAMP + timedelta(hours=published_hour),
        snap,
        status,
        unit,
        value,
    )


def _seed(db: SourcesDuckDBClient, records: list[tuple[Any, ...]]) -> None:
    """Create the fixture relation with the same schema for both arms."""
    db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "value DOUBLE, published_at TIMESTAMPTZ, snap INTEGER, status VARCHAR, "
        "bm_unit_id VARCHAR, level_to DOUBLE)"
    )
    if records:
        db.con.executemany(
            "INSERT INTO silver_test_sample VALUES (?, ?, ?, ?, ?, ?, ?, ?)", records
        )


def _outcome(
    module: Any, db: SourcesDuckDBClient, spec: dict[str, Any], args: dict[str, Any]
) -> tuple[int, bytes]:
    """Render each implementation's own validator and error envelope as JSON bytes."""
    request = module.validate(
        args.get("source", "test"),
        spec["id"],
        args.get("start"),
        args.get("end"),
        args.get("group"),
        args.get("filters"),
    )
    try:
        payload = module.execute(db, request, f"equivalence-{id(db)}")
    except module.RowsError as exc:
        status = JSONResponse(status_code=exc.http_status, content=exc.envelope()).status_code
        return status, json.dumps(exc.envelope(), sort_keys=False).encode("utf-8")
    return 200, json.dumps(payload, sort_keys=False).encode("utf-8")


def _compare(
    monkeypatch: pytest.MonkeyPatch,
    db: SourcesDuckDBClient,
    spec: dict[str, Any],
    args: dict[str, Any] | None = None,
    *,
    warm: bool = False,
) -> tuple[int, bytes]:
    """A missing tie breaker or changed selection makes the raw byte assertion fail."""
    args = args or {}
    registry = {(args.get("source", "test"), spec["id"]): spec}
    for module in (D, N):
        monkeypatch.setattr(module, "REGISTRY", registry)
        monkeypatch.setattr(module, "datetime", _FixedDatetime)
        module._cache.clear()
    # D and N start with identical connection settings, including on warm runs.
    db.con.execute("SET temp_directory=''")
    db.con.execute("SET memory_limit='8GiB'")
    first = _outcome(D, db, spec, args)
    second = _outcome(N, db, spec, args)
    assert second == first
    if warm:
        assert _outcome(N, db, spec, args) == _outcome(D, db, spec, args)
    return first


@pytest.mark.parametrize("threads", [1, 4])
@pytest.mark.parametrize("reverse", [False, True])
@pytest.mark.parametrize(
    "case",
    [
        "dedup_ties",
        "snapshot",
        "row_filter",
        "events",
        "reference",
        "pn_top",
        "filtered",
        "grouped",
        "bucket",
        "empty",
        "entity_ambiguity",
        "native_ambiguity",
        "record_cap",
    ],
)
def test_exact_matrix(
    monkeypatch: pytest.MonkeyPatch,
    sources_db: SourcesDuckDBClient,
    case: str,
    reverse: bool,
    threads: int,
) -> None:
    """D/N bytes and status must match across selection shapes, insertion order, and threads."""
    db = sources_db
    db.con.execute(f"SET threads={threads}")
    spec = _spec()
    args: dict[str, Any] = {"start": "2026-09-22", "end": "2026-09-22"}
    records = [_record(), _record(hour=1, value=2.0)]
    if case == "dedup_ties":
        spec["dedup"] = {
            "keys": ["timestamp_utc", "unit"],
            "order_by": [{"column": "published_at", "direction": "desc", "nulls": "last"}],
        }
        records = [_record(), _record(value=1.0), _record(value=9.0, published_hour=-1)]
    elif case == "snapshot":
        spec["snapshot_column"] = "snap"
        records = [_record(snap=1), _record(hour=24, snap=2)]
    elif case == "row_filter":
        spec["row_filter"] = {"column": "status", "equals": "keep"}
        records = [_record(), _record(hour=1, status="drop")]
    elif case == "events":
        spec.update(
            kind="events", clock=None, latest_day_rule={"mode": "max", "column": "timestamp_utc"}
        )
        records = [_record(), _record(hour=0, unit="B", value=2.0)]
    elif case == "reference":
        spec.update(
            kind="reference", clock=None, latest_day_rule={"mode": "reference", "column": None}
        )
        args = {}
    elif case == "pn_top":
        spec.update(
            id="pn",
            values=[{"column": "level_to", "unit": "MW", "label": "End level"}],
            dims=[{"column": "bm_unit_id", "role": "filter", "cardinality": 21}],
        )
        args["source"] = "elexon"
        records = [_record(unit=f"U{i:02}", value=float(max(1, i))) for i in range(21)]
        records += [_record(unit="U00", value=1.0), _record(unit="U20", value=20.0)]
    elif case == "filtered":
        args["filters"] = ["unit:A"]
        records.append(_record(unit="B", value=3.0))
    elif case == "grouped":
        records = [_record(unit="B"), _record(unit="A", value=2.0)]
    elif case == "bucket":
        spec["clock"]["grain"] = "1h"
        monkeypatch.setattr(D, "MAX_RESPONSE_ROWS", 5)
        monkeypatch.setattr(N, "MAX_RESPONSE_ROWS", 5)
        values = [1e16, 1.0, -1e16]
        records = [
            _record(hour=i, unit=unit, value=values[i % 3])
            for unit in ("A", "B")
            for i in range(24)
        ]
    elif case == "empty":
        args = {"start": "2026-09-21", "end": "2026-09-21"}
    elif case == "entity_ambiguity":
        spec["dims"].append({"column": "status", "role": "filter", "cardinality": 2})
        records = [_record(), _record(status="other")]
    elif case == "native_ambiguity":
        records = [_record(), _record(value=2.0)]
    elif case == "record_cap":
        spec.update(
            kind="reference", clock=None, latest_day_rule={"mode": "reference", "column": None}
        )
        args = {}
        records = []
    _seed(db, records[::-1] if reverse else records)
    if case == "record_cap":
        db.con.execute(
            "INSERT INTO silver_test_sample SELECT ?, 'A', i::DOUBLE, ?, 1, 'keep', 'A', i::DOUBLE "
            "FROM range(50001) AS t(i)",
            [STAMP, STAMP],
        )
    try:
        _compare(monkeypatch, db, spec, args, warm=True)
    finally:
        D._cache.clear()
        N._cache.clear()


def test_comparator_detects_changed_order(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """Weakening a record sort tie breaker must fail the D/N byte comparator."""
    spec = _spec("reference")
    spec["latest_day_rule"] = {"mode": "reference", "column": None}
    _seed(sources_db, [_record(unit="A", value=2.0), _record(unit="A", value=1.0)])
    baseline = _compare(monkeypatch, sources_db, spec)
    original = N._record_rows

    def reversed_tie_breaker(
        client: Any,
        sql: str,
        projection: tuple[str, ...],
        clock: str | None,
        kind: str,
        group: str | None = None,
    ) -> pl.DataFrame:
        if kind == "reference":
            columns = ", ".join(N._quote(column) for column in projection)
            return client.query(
                f"SELECT {columns} FROM ({sql}) AS final "
                'ORDER BY "unit" ASC, "value" DESC LIMIT 50001'
            )
        return original(client, sql, projection, clock, kind, group)

    monkeypatch.setattr(N, "_record_rows", reversed_tie_breaker)
    assert _outcome(N, sources_db, spec, {}) != baseline
    D._cache.clear()
    N._cache.clear()


def test_exact_50000_row_boundary(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """The cap accepts exactly 50,000 reference records with identical D/N bytes."""
    spec = _spec("reference")
    spec["latest_day_rule"] = {"mode": "reference", "column": None}
    _seed(sources_db, [])
    sources_db.con.execute(
        "INSERT INTO silver_test_sample SELECT ?, 'A', i::DOUBLE, ?, 1, 'keep', 'A', i::DOUBLE "
        "FROM range(50000) AS t(i)",
        [STAMP, STAMP],
    )
    status, payload = _compare(monkeypatch, sources_db, spec)
    assert status == 200
    assert json.loads(payload)["row_count"] == 50_000
    D._cache.clear()
    N._cache.clear()


def test_resource_ceiling_applied_once(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """Pre-fix code hardcodes the SET and cannot follow a changed ceiling constant."""
    db = sources_db
    spec = _spec()
    spec["row_filter"] = {"column": "status", "equals": "keep"}
    _seed(db, [_record(), _record(hour=1)])
    monkeypatch.setattr(N, "REGISTRY", {("test", "sample"): spec})
    monkeypatch.setattr(N, "_ROWS_MEMORY_CEILING", "7GiB")
    db.con.execute("SET memory_limit='16GiB'")
    result = N.execute(db, N.validate("test", "sample", None, None, None, None), "ceiling")
    assert result["row_count"] == 2
    assert N._memory_bytes(
        db.con.sql("SELECT current_setting('memory_limit')").fetchone()[0]
    ) == N._memory_bytes("7GiB")
    assert len([sql for sql in db.config_calls if sql.startswith("SET temp_directory=")]) == 1
    assert len([sql for sql in db.config_calls if "SET memory_limit='7GiB'" in sql]) == 1
    N._cache.clear()


def test_lower_memory_limit_preserved(sources_db: SourcesDuckDBClient) -> None:
    """Pre-fix unconditional SET raises a lower configured limit to 8 GiB."""
    db = sources_db
    db.con.execute("SET memory_limit='1GiB'")
    N._configure_resources(db)
    actual = db.con.sql("SELECT current_setting('memory_limit')").fetchone()[0]
    assert N._memory_bytes(actual) == N._memory_bytes("1GiB")


def test_setting_mismatch_fails_before_rows_query(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """Pre-fix discarded current_setting result permits rows queries under wrong policy."""
    db = sources_db
    original = db.query

    def mismatched(sql: str) -> pl.DataFrame:
        if sql.startswith("SET temp_directory="):
            return pl.DataFrame({"temp_directory": ["C:/spill"], "memory_limit": ["8.0 GiB"]})
        return original(sql)

    monkeypatch.setattr(db, "query", mismatched)
    with pytest.raises(RuntimeError, match="resource policy"):
        N.execute(db, N.Request("test", _spec(), None, None, None, (), False), "mismatch")
    assert not any("final_count" in sql for sql in db.calls)


def test_setting_failure_propagates(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """A failed resource SET remains a visible engine failure before dataset queries."""
    original = sources_db.query

    def failing_set(sql: str) -> pl.DataFrame:
        if sql.startswith("SET temp_directory="):
            raise duckdb.Error("injected setting failure")
        return original(sql)

    monkeypatch.setattr(sources_db, "query", failing_set)
    with pytest.raises(duckdb.Error, match="setting failure"):
        N.execute(sources_db, N.Request("test", _spec(), None, None, None, (), False), "set-fails")
    assert not any("information_schema.columns" in sql for sql in sources_db.calls)


def test_sources_route_after_policy(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """A rows resource SET must leave the shared manifest query path operational."""
    N._configure_resources(sources_db)
    monkeypatch.setattr(sources, "_snapshot", None)
    monkeypatch.setattr(sources, "_refreshed_at", 0.0)

    @contextmanager
    def acquire() -> Any:
        yield sources_db

    monkeypatch.setattr(sources, "client_ctx", acquire)
    assert TestClient(app).get("/api/sources").status_code == 200


def _temporary_tables(db: SourcesDuckDBClient) -> set[str]:
    """Read DuckDB's TEMP catalog, independent of the fixture query adapter."""
    return set(
        db.con.sql("SELECT table_name FROM duckdb_tables() WHERE temporary = true").pl()[
            "table_name"
        ]
    )


def test_real_stages_exist_during_request_and_are_dropped(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """The real rows staging path must create TEMP tables and clean every one."""
    spec = _spec()
    spec["row_filter"] = {"column": "status", "equals": "keep"}
    _seed(sources_db, [_record()])
    monkeypatch.setattr(N, "REGISTRY", {("test", "sample"): spec})
    original = N._TempOperations.create
    seen: list[set[str]] = []

    def observe(self: N._TempOperations, name: str, sql: str) -> None:
        original(self, name, sql)
        seen.append(_temporary_tables(sources_db))

    monkeypatch.setattr(N._TempOperations, "create", observe)
    N.execute(sources_db, N.validate("test", "sample", None, None, None, None), "temp-lifetime")
    assert seen and any(any(name.startswith("__rows_") for name in tables) for tables in seen)
    assert _temporary_tables(sources_db) == set()
    N._cache.clear()


def test_temp_creation_oom_uses_unmaterialised_selection(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """A TEMP creation OOM must fall back to D's exact unmaterialised bytes."""
    spec = _spec()
    spec["row_filter"] = {"column": "status", "equals": "keep"}
    _seed(sources_db, [_record(), _record(hour=1)])
    monkeypatch.setattr(D, "REGISTRY", {("test", "sample"): spec})
    monkeypatch.setattr(N, "REGISTRY", {("test", "sample"): spec})
    D._cache.clear()
    N._cache.clear()
    expected = _outcome(D, sources_db, spec, {})
    original = N._TempOperations.create
    calls = 0

    def fail_once(self: N._TempOperations, name: str, sql: str) -> None:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise duckdb.OutOfMemoryException("injected TEMP creation OOM")
        original(self, name, sql)

    monkeypatch.setattr(N._TempOperations, "create", fail_once)
    assert _outcome(N, sources_db, spec, {}) == expected
    assert calls > 1
    assert _temporary_tables(sources_db) == set()
    D._cache.clear()
    N._cache.clear()


def test_cleanup_preserves_primary_and_attempts_every_drop(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """Pre-fix close masks the primary error and skips drops after a DROP failure."""
    scope = N._SelectionScope(sources_db)
    scope.stage("SELECT 1 AS n")
    scope.stage("SELECT 2 AS n")
    attempted: list[str] = []
    original = scope.operations.drop

    def failing_drop(name: str) -> None:
        attempted.append(name)
        if name == scope.owned[-1]:
            raise duckdb.Error("injected DROP failure")
        original(name)

    monkeypatch.setattr(scope.operations, "drop", failing_drop)
    with pytest.raises(ValueError, match="primary"):
        try:
            raise ValueError("primary")
        finally:
            scope.close()
    assert attempted == list(reversed(scope.owned))
    assert scope.owned[0] not in _temporary_tables(sources_db)
    sources_db.con.execute(f"DROP TABLE IF EXISTS temp.main.{scope.owned[-1]}")


def test_selection_key_guard_and_memoization(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """Pre-fix selection silently returns a previous relation for a new key."""
    spec = _spec()
    _seed(sources_db, [_record()])
    scope = N._SelectionScope(sources_db)
    original = N._selected_sql
    calls = 0

    def count(relation: str, dataset: dict[str, Any]) -> str:
        nonlocal calls
        calls += 1
        return original(relation, dataset)

    monkeypatch.setattr(N, "_selected_sql", count)
    selected = scope.selection("silver_test_sample", spec)
    assert scope.selection("silver_test_sample", spec) == selected
    assert calls == 1
    with pytest.raises(ValueError, match="different relation or dataset"):
        scope.selection("other_relation", spec)
    changed = copy.deepcopy(spec)
    changed["row_filter"] = {"column": "status", "equals": "keep"}
    with pytest.raises(ValueError, match="different relation or dataset"):
        scope.selection("silver_test_sample", changed)
    scope.close()


def test_collision_pair_is_stable_without_sql_sort(
    monkeypatch: pytest.MonkeyPatch, sources_db: SourcesDuckDBClient
) -> None:
    """Removing SQL ORDER BY leaves Python's reported collision pair unchanged."""
    spec = _spec()
    _seed(sources_db, [_record(value=3.0), _record(value=1.0), _record(value=2.0)])
    monkeypatch.setattr(D, "REGISTRY", {("test", "sample"): spec})
    monkeypatch.setattr(N, "REGISTRY", {("test", "sample"): spec})
    D._cache.clear()
    N._cache.clear()
    actual = _outcome(N, sources_db, spec, {})
    assert not any("JOIN r ON" in sql and "ORDER BY" in sql for sql in sources_db.calls)
    assert actual == _outcome(D, sources_db, spec, {})
    D._cache.clear()
    N._cache.clear()
