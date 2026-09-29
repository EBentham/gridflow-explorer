"""Optional rows projection contract."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from test_rows_api import _route, _seed, _spec

from app import sources
from app.main import app


def test_columns_subset_preserves_order_and_gap_identity(monkeypatch, sources_db):
    first = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(first, "A", 1.0, first), (first + timedelta(hours=2), "A", 3.0, first)])
    client, url = _route(monkeypatch, sources_db, _spec())
    full = client.get(url + "?start=2026-09-22&end=2026-09-22")
    subset = client.get(url + "?start=2026-09-22&end=2026-09-22&columns=value")
    assert full.status_code == subset.status_code == 200
    payload = subset.json()
    assert payload["columns"] == full.json()["columns"]
    assert payload["coverage"] == full.json()["coverage"]
    assert payload["truncation"] == full.json()["truncation"]
    assert all(set(row) <= {"ts", "unit", "value"} for row in payload["rows"])
    assert any(row["value"] is None for row in payload["rows"])
    assert all("unit" in row for row in payload["rows"])


def test_columns_absent_matches_frozen_baseline(monkeypatch, sources_db):
    import rows_baseline

    first = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(first, "A", 1.0, first)])
    spec = _spec()
    client, url = _route(monkeypatch, sources_db, spec)
    monkeypatch.setattr(rows_baseline, "REGISTRY", {("test", "sample"): spec})
    request = rows_baseline.validate("test", "sample", "2026-09-22", "2026-09-22", None, None)
    baseline = rows_baseline.execute(sources_db, request, "baseline-columns")
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 200
    assert json.dumps(response.json(), sort_keys=False) == json.dumps(baseline, sort_keys=False)


def test_bad_columns_rejected_before_catalogue(monkeypatch):
    def forbidden():
        raise AssertionError("client acquired")

    monkeypatch.setattr(sources, "client_ctx", forbidden)
    client = TestClient(app)
    for suffix in (
        "columns=",
        "columns=value,,unit",
        "columns=value,value",
        "columns=value&columns=unit",
        "columns=undeclared",
        "columns=ts",
    ):
        response = client.get(f"/api/sources/elexon/fuelinst/rows?{suffix}")
        assert response.status_code == 422
        assert response.json() == {
            "error": {
                "code": "bad_columns",
                "message": "Columns must be a non-empty, unique subset of the declared projection.",
            }
        }


def test_columns_parameter_order_keeps_declared_row_order(monkeypatch, sources_db):
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)])
    client, url = _route(monkeypatch, sources_db, _spec())
    full = client.get(url).json()
    subset = client.get(url + "?columns=value,timestamp_utc").json()
    expected = [key for key in full["rows"][0] if key in {"value", "timestamp_utc", "unit", "ts"}]
    assert list(subset["rows"][0]) == expected
