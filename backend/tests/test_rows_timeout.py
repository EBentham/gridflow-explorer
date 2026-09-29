"""Deadline, interruption, and route limiter lifecycle."""

from __future__ import annotations

import time
from datetime import UTC, datetime

import duckdb
from test_rows_api import _route, _seed, _spec

from app import rows, sources


def test_timeout_returns_503_and_releases_limiter(monkeypatch, sources_db):
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)])
    client, url = _route(monkeypatch, sources_db, _spec())
    original = sources_db.query

    def slow(sql):
        if sql.startswith("SELECT current_setting("):
            time.sleep(0.06)
        return original(sql)

    monkeypatch.setattr(sources_db, "query", slow)
    monkeypatch.setattr(rows, "ROWS_REQUEST_TIMEOUT_SECONDS", 0.02)
    response = client.get(url)
    assert response.status_code == 503
    assert response.json() == {
        "error": {"code": "query_timeout", "message": "Rows query exceeded its time limit."}
    }
    assert sources._ROWS_LIMITER.borrowed_tokens == 0


def test_real_duckdb_interrupt_is_translated_and_connection_recovers(monkeypatch, sources_db):
    monkeypatch.setattr(rows, "ROWS_OPERATION_TIMEOUT_SECONDS", 0.02)
    bounded = rows._DeadlineClient(sources_db, time.monotonic() + 2)
    try:
        bounded.query("SELECT sum(sin(i)) FROM range(10000000000) t(i)")
    except rows.RowsError as exc:
        assert exc.code == rows.RowsErrorCode.QUERY_TIMEOUT
    else:
        raise AssertionError("long query was not interrupted")
    assert sources_db.query("SELECT 42 AS answer")["answer"][0] == 42


def test_unrelated_interrupt_is_not_called_a_timeout(monkeypatch, sources_db):
    def interrupted(_sql):
        raise duckdb.InterruptException("external")

    monkeypatch.setattr(sources_db, "query", interrupted)
    bounded = rows._DeadlineClient(sources_db, time.monotonic() + 2)
    try:
        bounded.query("SELECT 1")
    except duckdb.InterruptException:
        pass
    else:
        raise AssertionError("unrelated interrupt was swallowed")


def test_request_deadline_is_shared_across_operations(monkeypatch, sources_db):
    original = sources_db.query

    def slow(sql):
        time.sleep(0.06)
        return original(sql)

    monkeypatch.setattr(sources_db, "query", slow)
    bounded = rows._DeadlineClient(sources_db, time.monotonic() + 0.1)
    assert bounded.query("SELECT 1 AS n")["n"][0] == 1
    try:
        bounded.query("SELECT 2 AS n")
    except rows.RowsError as exc:
        assert exc.code == rows.RowsErrorCode.QUERY_TIMEOUT
    else:
        raise AssertionError("operation reset the request deadline")
