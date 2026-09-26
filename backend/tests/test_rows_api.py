"""HTTP validation and guarded acquisition regressions for rows."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import sources
from app.main import app


def test_unknown_source_and_dataset_rejected_before_acquire(monkeypatch):
    """A 404 identity error must not acquire a catalogue client."""

    def forbidden():
        raise AssertionError("client acquired")

    monkeypatch.setattr(sources, "client_ctx", forbidden)
    response = TestClient(app).get("/api/sources/absent/absent/rows")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_dataset"


def test_bad_filter_and_group_rejected_before_acquire(monkeypatch):
    """Malformed filter grammar and undeclared groups retain 422 during refresh."""

    def forbidden():
        raise AssertionError("client acquired")

    monkeypatch.setattr(sources, "client_ctx", forbidden)
    client = TestClient(app)
    for query, code in (
        ("filter=fuel_type", "bad_filter"),
        ("filter=fuel_type:", "bad_filter"),
        ("filter=fuel_type:WIND&filter=fuel_type:COAL", "bad_filter"),
        ("group=ingested_at", "bad_group"),
    ):
        response = client.get(f"/api/sources/elexon/fuelinst/rows?{query}")
        assert response.status_code == 422
        assert response.json()["error"]["code"] == code


def test_invalid_dates_rejected_before_acquire(monkeypatch):
    """Impossible and reversed dates must not be masked by a catalogue 503."""

    def forbidden():
        raise AssertionError("client acquired")

    monkeypatch.setattr(sources, "client_ctx", forbidden)
    client = TestClient(app)
    for query in (
        "start=2026-02-30",
        "start=2026-9-01",
        "start=2026-09-22&end=2026-09-21",
        "end=9999-12-31",
    ):
        response = client.get(f"/api/sources/elexon/freq/rows?{query}")
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "bad_range"
