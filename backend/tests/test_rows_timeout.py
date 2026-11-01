"""Deadline, interruption, and route limiter lifecycle."""

from __future__ import annotations

import threading
import time
from datetime import UTC, datetime

import duckdb
from test_rows_api import _route, _seed, _spec

from app import rows, sources
from app.errors import ErrorCode


def test_post_return_timeout_returns_503_and_releases_limiter(monkeypatch, sources_db):
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)])
    client, url = _route(monkeypatch, sources_db, _spec())
    original = sources_db.query
    returned: list[str] = []

    def slow(sql):
        result = original(sql)
        if sql.startswith("SELECT current_setting("):
            time.sleep(0.3)
            returned.append(sql)
        return result

    monkeypatch.setattr(sources_db, "query", slow)
    # The slow query runs and returns after the deadline, between watchdog interrupts.
    monkeypatch.setattr(rows, "ROWS_REQUEST_TIMEOUT_SECONDS", 0.2)
    response = client.get(url)
    assert len(returned) == 1
    assert response.status_code == 503
    assert response.json() == {
        "error": {"code": "query_timeout", "message": "Rows query exceeded its time limit."}
    }
    assert sources._ROWS_LIMITER.borrowed_tokens == 0


def test_real_duckdb_interrupt_is_translated_and_connection_recovers(sources_db):
    bounded = rows._DeadlineClient(sources_db)
    try:
        with bounded.watchdog(time.monotonic() + 0.1):
            bounded.query("SELECT sum(sin(i)) FROM range(10000000000) t(i)")
    except rows.RowsError as exc:
        assert exc.code == ErrorCode.QUERY_TIMEOUT
    else:
        raise AssertionError("long query was not interrupted")
    assert sources_db.query("SELECT 42 AS answer")["answer"][0] == 42


def test_interrupt_retries_after_bind_before_execution(monkeypatch, sources_db):
    def bind_then_execute(sql):
        relation = sources_db.con.sql(sql)
        time.sleep(0.1)
        return relation.pl()

    monkeypatch.setattr(sources_db, "query", bind_then_execute)
    bounded = rows._DeadlineClient(sources_db)
    started = time.monotonic()
    try:
        with bounded.watchdog(time.monotonic() + 0.02):
            bounded.query("SELECT sum(sin(i)) FROM range(400000000) t(i)")
    except rows.RowsError as exc:
        assert exc.code == ErrorCode.QUERY_TIMEOUT
    else:
        raise AssertionError("long query was not interrupted")
    assert time.monotonic() - started < 1


def test_unrelated_interrupt_is_not_called_a_timeout(monkeypatch, sources_db):
    def interrupted(_sql):
        raise duckdb.InterruptException("external")

    monkeypatch.setattr(sources_db, "query", interrupted)
    bounded = rows._DeadlineClient(sources_db)
    try:
        with bounded.watchdog(time.monotonic() + 2):
            bounded.query("SELECT 1")
    except duckdb.InterruptException:
        pass
    else:
        raise AssertionError("unrelated interrupt was swallowed")


def test_request_deadline_is_shared_across_operations(monkeypatch, sources_db):
    original = sources_db.query

    def slow(sql):
        time.sleep(0.3)
        return original(sql)

    monkeypatch.setattr(sources_db, "query", slow)
    bounded = rows._DeadlineClient(sources_db)
    with bounded.watchdog(time.monotonic() + 0.5):
        assert bounded.query("SELECT 1 AS n")["n"][0] == 1
        try:
            bounded.query("SELECT 2 AS n")
        except rows.RowsError as exc:
            assert exc.code == ErrorCode.QUERY_TIMEOUT
        else:
            raise AssertionError("operation reset the request deadline")


def test_one_watchdog_covers_every_query_of_a_request(monkeypatch, sources_db):
    """A request starts one interrupt thread for its queries and one for TEMP cleanup."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)])
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): _spec()})
    started: list[threading.Thread] = []
    original = threading.Thread.start

    def counted(thread: threading.Thread) -> None:
        started.append(thread)
        original(thread)

    monkeypatch.setattr(threading.Thread, "start", counted)
    request = rows.validate("test", "sample", "2026-09-22", "2026-09-22", None, None)
    assert rows.execute(sources_db, request, f"watchdog-{id(sources_db)}")["row_count"] == 24
    assert len(sources_db.calls) > 2
    assert len(started) == 2


def test_timeout_cleans_staged_temp_and_releases_limiter(monkeypatch, sources_db):
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)])
    spec = _spec()
    spec["dedup"] = {
        "keys": ["timestamp_utc", "unit"],
        "order_by": [{"column": "ingested_at", "direction": "desc", "nulls": "last"}],
    }
    client, url = _route(monkeypatch, sources_db, spec)
    original = sources_db.query
    staged_before_timeout = False

    def slow_final_count(sql):
        nonlocal staged_before_timeout
        if " AS final_count" in sql:
            staged_before_timeout = (
                sources_db.con.execute(
                    "SELECT count(*) FROM duckdb_tables() "
                    "WHERE temporary AND starts_with(table_name, '__rows_')"
                ).fetchone()[0]
                > 0
            )
            time.sleep(0.6)
        return original(sql)

    monkeypatch.setattr(sources_db, "query", slow_final_count)
    monkeypatch.setattr(rows, "ROWS_REQUEST_TIMEOUT_SECONDS", 0.5)
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "query_timeout"
    assert staged_before_timeout
    assert (
        sources_db.con.execute(
            "SELECT count(*) FROM duckdb_tables() "
            "WHERE temporary AND starts_with(table_name, '__rows_')"
        ).fetchone()[0]
        == 0
    )
    assert sources._ROWS_LIMITER.borrowed_tokens == 0
