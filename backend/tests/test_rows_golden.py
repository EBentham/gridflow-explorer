"""Golden payloads: whole rows responses pinned byte for byte, key and row order included.

These replace the frozen copy of the pre-speed-up `rows.py` ("baseline D") and
the live A/B runner that the v0.4 rows-performance SPEC required while the
2026-09-29 rewrite was proven equivalent. The rewrite has shipped, and a baseline
that had to be hand-patched alongside every intended change was no longer an
independent oracle. Each golden file below matched baseline D, for both insertion
orders and both thread counts, when it was written. An intended change to the
response edits the golden file in the same commit.

Each case runs through the HTTP route with `columns` absent, cold and then warm
from the metadata cache, for both insertion orders and with one and four threads.
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import rows, sources
from app.main import app

GOLDEN = Path(__file__).parent / "fixtures" / "rows_golden"
# Long past, so the wall clock that caps a window at today never reaches the data.
STAMP = datetime(2026, 9, 22, tzinfo=UTC)
DAY = "?start=2026-09-22&end=2026-09-22"


@pytest.fixture(autouse=True)
def clear_rows_metadata_cache():
    rows._cache.clear()
    yield
    rows._cache.clear()


def _spec(kind: str = "series") -> dict[str, Any]:
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
        "dims": [{"column": "unit", "role": "series"}],
        "default_filter": None,
        "dedup": None,
        "row_filter": None,
        "snapshot_column": None,
        "notes": [],
    }


def _capture(
    *, hour: int = 0, unit: str = "A", value: float = 1.0, published_hour: int = 0
) -> tuple[Any, ...]:
    return (STAMP + timedelta(hours=hour), unit, value, STAMP + timedelta(hours=published_hour))


def _golden(
    monkeypatch: pytest.MonkeyPatch,
    db: Any,
    name: str,
    spec: dict[str, Any],
    captures: list[tuple[Any, ...]],
    query: str,
    *,
    reverse: bool,
    threads: int,
) -> None:
    db.con.execute(f"SET threads={threads}")
    db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "value DOUBLE, published_at TIMESTAMPTZ)"
    )
    db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?, ?, ?)",
        captures[::-1] if reverse else captures,
    )
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})

    @contextmanager
    def acquire():
        yield db

    monkeypatch.setattr(sources, "client_ctx", acquire)
    expected = (GOLDEN / f"{name}.json").read_text(encoding="utf-8")
    client = TestClient(app)
    for _ in ("cold", "warm"):
        response = client.get(f"/api/sources/test/sample/rows{query}")
        assert response.status_code == 200
        assert json.dumps(response.json(), indent=2) + "\n" == expected


ORDERS = pytest.mark.parametrize("reverse", [False, True], ids=["inserted", "reversed"])
THREADS = pytest.mark.parametrize("threads", [1, 4])


@ORDERS
@THREADS
def test_series_golden(monkeypatch, sources_db, reverse, threads):
    """Grouped series: newest capture wins, an exact copy collapses with a note."""
    spec = _spec()
    spec["dedup"] = {
        "keys": ["timestamp_utc", "unit"],
        "order_by": [{"column": "published_at", "direction": "desc", "nulls": "last"}],
    }
    captures = [
        _capture(),
        _capture(),
        _capture(value=9.0, published_hour=-1),
        _capture(unit="B", value=3.0),
        _capture(hour=1, value=2.0),
        _capture(hour=1, unit="B", value=4.0),
    ]
    _golden(
        monkeypatch, sources_db, "series", spec, captures, DAY, reverse=reverse, threads=threads
    )


@ORDERS
@THREADS
@pytest.mark.parametrize("kind", ["events", "reference"])
def test_record_order_golden(monkeypatch, sources_db, kind, reverse, threads):
    """Events and reference rows: the record sort and its tie-breakers."""
    captures = [
        _capture(value=2.0),
        _capture(unit="B", value=2.0),
        _capture(hour=1, unit="B", value=1.0),
        _capture(hour=1, value=5.0),
    ]
    if kind == "reference":
        captures.append(_capture(value=1.0))
    query = DAY if kind == "events" else ""
    _golden(
        monkeypatch,
        sources_db,
        kind,
        _spec(kind),
        captures,
        query,
        reverse=reverse,
        threads=threads,
    )


@ORDERS
@THREADS
def test_bucketed_golden(monkeypatch, sources_db, reverse, threads):
    """A downsampled window: bucket means over values whose sum depends on order."""
    spec = _spec()
    spec["clock"]["grain"] = "1h"
    monkeypatch.setattr(rows, "MAX_RESPONSE_ROWS", 16)
    values = [1e16, 1.0, -1e16]
    captures = [
        _capture(hour=i, unit=unit, value=values[i % 3]) for unit in ("A", "B") for i in range(24)
    ]
    _golden(
        monkeypatch, sources_db, "bucketed", spec, captures, DAY, reverse=reverse, threads=threads
    )
