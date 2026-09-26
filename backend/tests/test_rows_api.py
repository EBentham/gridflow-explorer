"""HTTP validation and guarded acquisition regressions for rows."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import rows, sources
from app.main import app


@pytest.fixture(autouse=True)
def clear_rows_metadata_cache():
    rows._cache.clear()
    yield
    rows._cache.clear()


def _spec(*, kind="series", grain="1h", grouped=True):
    return {
        "id": "sample",
        "kind": kind,
        "base_relation": "silver_test_sample",
        "latest_relation": None,
        "not_held_cause": None,
        "clock": {"column": "timestamp_utc", "grain": grain, "settlement_cols": []}
        if kind == "series"
        else None,
        "latest_day_rule": {"mode": "reference", "column": None}
        if kind == "reference"
        else {"mode": "max", "column": "timestamp_utc"},
        "values": [{"column": "value", "unit": "MW", "label": "Value"}],
        "dims": [{"column": "unit", "role": "series", "cardinality": 2}] if grouped else [],
        "default_filter": None,
        "dedup": None,
        "row_filter": None,
        "snapshot_column": None,
        "notes": [],
    }


def _route(monkeypatch, db, spec, *, source="test"):
    monkeypatch.setattr(rows, "REGISTRY", {(source, spec["id"]): spec})

    @contextmanager
    def acquire():
        yield db

    monkeypatch.setattr(sources, "client_ctx", acquire)
    return TestClient(app), f"/api/sources/{source}/{spec['id']}/rows"


def _seed(db, records):
    db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
        "value DOUBLE, ingested_at TIMESTAMPTZ)"
    )
    db.con.executemany("INSERT INTO silver_test_sample VALUES (?, ?, ?, ?)", records)


def test_unknown_source_and_dataset_before_acquire(monkeypatch):
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


def test_freq_default_ignores_capture_duplicate_outside_window(monkeypatch, sources_db):
    """An old duplicate does not poison the default dimensionless window."""
    spec = _spec(grouped=False, grain="irregular")
    old = datetime(2026, 9, 1, tzinfo=UTC)
    recent = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(old, None, 1.0, old)] * 2 + [(recent, None, 3.0, recent)])
    client, url = _route(monkeypatch, sources_db, spec)
    response = client.get(url)
    assert response.status_code == 200
    assert [row["value"] for row in response.json()["rows"]] == [3.0]
    assert response.json()["truncated"] is False


def test_freq_capture_duplicate_inside_window_is_reported(monkeypatch, sources_db):
    """A provenance-only copy inside the window is an explicit reduction."""
    spec = _spec(grouped=False, grain="irregular")
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, None, 1.0, stamp)] * 2)
    client, url = _route(monkeypatch, sources_db, spec)
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 200
    assert response.json()["row_count"] == 1
    assert response.json()["truncation"]["reasons"] == [
        {"type": "exact_duplicate_rows", "removed_rows": 1}
    ]


def test_windowed_value_conflict_has_explicit_details(monkeypatch, sources_db):
    """Only the affected day returns an ambiguity with its differing field."""
    spec = _spec(grouped=False, grain="irregular")
    old = datetime(2026, 9, 21, tzinfo=UTC)
    new = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(old, None, 1.0, old), (old, None, 2.0, old), (new, None, 3.0, new)])
    client, url = _route(monkeypatch, sources_db, spec)
    bad = client.get(url + "?start=2026-09-21&end=2026-09-21")
    good = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "ambiguous_series"
    assert "value" in bad.json()["error"]["varying_columns"]
    assert good.status_code == 200


def _gold_policy_case(monkeypatch, sources_db):
    spec = _spec(grain="irregular", grouped=False)
    spec["id"] = "gold_forecasts"
    spec["dims"] = [
        {"column": "model_id", "role": "series", "cardinality": 2},
        {"column": "vintage_policy_id", "role": "filter", "cardinality": 2},
    ]
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, model_id VARCHAR, "
        "vintage_policy_id VARCHAR, value DOUBLE)"
    )
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, 'X', ?, ?)",
        [(stamp, "p1", 1.0), (stamp, "p2", 2.0)],
    )
    return _route(monkeypatch, sources_db, spec, source="gold")


def test_gold_forecasts_default_refuses_multiple_policies(monkeypatch, sources_db):
    """Default model grouping names the policy collision and a usable hint."""
    client, url = _gold_policy_case(monkeypatch, sources_db)
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "ambiguous_series"
    assert "vintage_policy_id" in error["varying_dimensions"]
    assert "group=vintage_policy_id&filter=model_id:X" in error["hint"]


def test_gold_forecasts_grouped_policies_serve_native(monkeypatch, sources_db):
    """An explicit model filter and policy group preserve both native values."""
    client, url = _gold_policy_case(monkeypatch, sources_db)
    response = client.get(
        url + "?start=2026-09-22&end=2026-09-22&filter=model_id:X&group=vintage_policy_id"
    )
    assert response.status_code == 200
    payload = response.json()
    assert {(row[payload["group"]], row["value"]) for row in payload["rows"]} == {
        ("p1", 1.0),
        ("p2", 2.0),
    }
    assert payload["truncated"] is False


def test_hourly_gap_rows_use_declared_group_column_over_http(
    monkeypatch: pytest.MonkeyPatch, sources_db: Any
) -> None:
    """HTTP gap rows carry the declared series key and retain each group identity."""
    first = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(
        sources_db,
        [
            (first, "A", 1.0, first),
            (first + timedelta(hours=2), "A", 3.0, first),
            (first, "B", 2.0, first),
        ],
    )
    client, url = _route(monkeypatch, sources_db, _spec())
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 200
    payload = response.json()
    assert all(row[payload["group"]] in {"A", "B"} for row in payload["rows"])
    gap = next(
        row
        for row in payload["rows"]
        if row["ts"] == rows._ts_ms(first + timedelta(hours=1)) and row[payload["group"]] == "A"
    )
    assert gap["value"] is None
    assert all("group" not in row for row in payload["rows"])


def _pn_case(monkeypatch, sources_db):
    spec = _spec(grain="irregular", grouped=False)
    spec.update(
        id="pn",
        dims=[{"column": "bm_unit_id", "role": "series", "cardinality": 21}],
        values=[{"column": "level_to", "unit": "MW", "label": "End level"}],
    )
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, "
        "bm_unit_id VARCHAR, level_to DOUBLE)"
    )
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?, ?)",
        [(stamp, f"U{i:02}", float(i)) for i in range(21)],
    )
    return _route(monkeypatch, sources_db, spec, source="elexon")


def test_pn_above_cap_reports_top20_truncation(monkeypatch, sources_db):
    """The PN default selects at most twenty units and reports omissions."""
    client, url = _pn_case(monkeypatch, sources_db)
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 200
    payload = response.json()
    assert payload["row_count"] == 20
    reason = payload["truncation"]["reasons"][0]
    assert reason["type"] == "default_top_n"
    assert reason["omitted_rows"] == reason["omitted_groups"] == 1


def test_pn_explicit_unit_and_clear_bypass_default(monkeypatch, sources_db):
    """Both explicit unit selection and sole clear bypass the PN top twenty."""
    client, url = _pn_case(monkeypatch, sources_db)
    selected = client.get(url + "?start=2026-09-22&end=2026-09-22&filter=bm_unit_id:U00")
    cleared = client.get(url + "?start=2026-09-22&end=2026-09-22&filter=")
    assert selected.status_code == cleared.status_code == 200
    assert selected.json()["row_count"] == 1
    assert cleared.json()["row_count"] == 21
    assert cleared.json()["truncated"] is False


def _forbid_acquire(monkeypatch):
    def forbidden():
        raise AssertionError("client acquired")

    monkeypatch.setattr(sources, "client_ctx", forbidden)


def test_unknown_relation_rejected_before_acquire(monkeypatch):
    """Malformed relation identifiers fail validation before client creation."""
    spec = _spec()
    spec["base_relation"] = "unregistered; DROP TABLE x"
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    _forbid_acquire(monkeypatch)
    response = TestClient(app).get("/api/sources/test/sample/rows")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_identifier"


def test_unknown_column_rejected_before_acquire(monkeypatch):
    """Invalid declared projection and undeclared filter fields fail early."""
    spec = _spec()
    spec["values"][0]["column"] = ""
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    _forbid_acquire(monkeypatch)
    client = TestClient(app)
    invalid = client.get("/api/sources/test/sample/rows")
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "bad_identifier"
    spec["values"][0]["column"] = "value"
    undeclared = client.get("/api/sources/test/sample/rows?filter=ingested_at:X")
    assert undeclared.status_code == 422
    assert undeclared.json()["error"]["code"] == "bad_filter"


def test_group_outside_dims_rejected_before_acquire(monkeypatch):
    """Existing nondimension columns are not valid group selectors."""
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): _spec()})
    _forbid_acquire(monkeypatch)
    response = TestClient(app).get("/api/sources/test/sample/rows?group=timestamp_utc")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_group"


def test_filter_literal_accept_and_reject_boundaries(monkeypatch, sources_db):
    """The full allowed alphabet and length are bounded before SQL execution."""
    spec = _spec(kind="reference")
    sources_db.con.execute("CREATE TABLE silver_test_sample (unit VARCHAR, value DOUBLE)")
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, 1)", [("A" * 64,), ("X:Y",)]
    )
    client, url = _route(monkeypatch, sources_db, spec)
    for literal in ("A" * 64, "X:Y"):
        response = client.get(url, params={"filter": f"unit:{literal}"})
        assert response.status_code == 200
        assert response.json()["row_count"] == 1
    for literal in ("A" * 65, "x' OR 1=1", "line\nbreak", "é"):
        response = client.get(url, params={"filter": f"unit:{literal}"})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "bad_filter"


def test_default_filter_clear_and_filter_grammar(monkeypatch, sources_db):
    """Sole clear, explicit pairs, and mixed/duplicate grammar behave distinctly."""
    spec = _spec(kind="reference")
    spec["default_filter"] = {"column": "unit", "equals": "A"}
    spec["dims"].append({"column": "region", "role": "filter", "cardinality": 2})
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (unit VARCHAR, region VARCHAR, value DOUBLE)"
    )
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?, 1)", [("A", "N"), ("B", "S")]
    )
    client, url = _route(monkeypatch, sources_db, spec)
    assert client.get(url).json()["row_count"] == 1
    assert client.get(url + "?filter=").json()["row_count"] == 2
    assert client.get(url + "?filter=unit:B&filter=region:S").json()["row_count"] == 1
    for query in ("filter=unit:A&filter=unit:B", "filter=&filter=unit:A", "filter=unit"):
        response = client.get(url + "?" + query)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "bad_filter"


def test_filters_reports_effective_defaults_and_explicit_replacement(monkeypatch, sources_db):
    """A MID-style default reports reduction; clear and explicit filters replace it."""
    spec = _spec(kind="reference")
    spec["id"] = "mid"
    spec["default_filter"] = {"column": "unit", "equals": "APXMIDP"}
    sources_db.con.execute("CREATE TABLE silver_test_sample (unit VARCHAR, value DOUBLE)")
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, 1)", [("APXMIDP",), ("OTHER",)]
    )
    client, url = _route(monkeypatch, sources_db, spec, source="elexon")
    default = client.get(url).json()
    assert default["filters"] == {"unit": "APXMIDP"}
    assert default["truncation"]["reasons"][0]["type"] == "default_filter"
    assert client.get(url + "?filter=").json()["filters"] == {}
    explicit = client.get(url + "?filter=unit:OTHER").json()
    assert explicit["filters"] == {"unit": "OTHER"}
    assert explicit["truncated"] is False


def test_boolean_filters_match_true_and_false(monkeypatch, sources_db):
    """Both Boolean values retain their matching reference records."""
    spec = _spec(kind="reference", grouped=False)
    spec["dims"] = [{"column": "flag", "role": "filter", "cardinality": 2}]
    sources_db.con.execute("CREATE TABLE silver_test_sample (flag BOOLEAN, value DOUBLE)")
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?)", [(True, 1.0), (False, 2.0)]
    )
    client, url = _route(monkeypatch, sources_db, spec)
    for literal, expected in (("true", 1.0), ("false", 2.0)):
        response = client.get(url, params={"filter": f"flag:{literal}"})
        assert response.status_code == 200
        assert [row["value"] for row in response.json()["rows"]] == [expected]


def test_same_day_range_is_accepted(monkeypatch, sources_db):
    """An inclusive one-day window returns exact UK bounds."""
    stamp = datetime(2026, 8, 1, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)])
    client, url = _route(monkeypatch, sources_db, _spec(grain="irregular"))
    response = client.get(url + "?start=2026-08-01&end=2026-08-01")
    assert response.status_code == 200
    assert response.json()["coverage"]["days_in_window"] == 1
    assert response.json()["window"]["lower_utc"] == "2026-07-31T23:00:00Z"


def test_declared_not_held_returns_cause_before_acquire(monkeypatch):
    """A committed not-held cause is emitted without touching the catalogue."""
    spec = _spec()
    spec["not_held_cause"] = "fetched-empty:test"
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    _forbid_acquire(monkeypatch)
    response = TestClient(app).get("/api/sources/test/sample/rows")
    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "unknown_dataset",
        "message": "Dataset is not held.",
        "not_held_cause": "fetched-empty:test",
    }


def test_cached_missing_schema_returns_cause_before_acquire(monkeypatch):
    """A warm negative metadata entry short-circuits catalogue construction."""
    from app.settings import get_settings

    spec = _spec()
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    _forbid_acquire(monkeypatch)
    config = str(get_settings().duckdb_path)
    rows._cache[(config, "test", "sample")] = (
        rows.time.monotonic(),
        rows.Metadata(None, {}, None, None, None, None, 0, "missing-in-catalogue"),
    )
    response = TestClient(app).get("/api/sources/test/sample/rows")
    assert response.status_code == 404
    assert response.json()["error"]["not_held_cause"] == "missing-in-catalogue"


def test_reference_rejects_dates_before_acquire(monkeypatch):
    """Reference windows fail before any catalogue client is acquired."""
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): _spec(kind="reference")})
    _forbid_acquire(monkeypatch)
    response = TestClient(app).get("/api/sources/test/sample/rows?start=2026-09-22")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_range"


def test_neso_intensity_factors_remains_held_reference(monkeypatch, sources_db):
    """The committed NESO descriptor serves a held, windowless reference."""
    spec = rows.REGISTRY[("neso", "intensity_factors")]
    assert spec["not_held_cause"] is None
    assert spec["kind"] == "reference"
    sources_db.con.execute(
        "CREATE TABLE silver_neso_intensity_factors (ingested_at TIMESTAMPTZ, "
        "fuel VARCHAR, factor_gco2_kwh DOUBLE)"
    )
    sources_db.con.execute(
        "INSERT INTO silver_neso_intensity_factors VALUES "
        "(TIMESTAMPTZ '2026-09-22 00:00:00+00', 'gas', 400)"
    )
    client, url = _route(monkeypatch, sources_db, spec, source="neso")
    response = client.get(url)
    assert response.status_code == 200
    assert response.json()["kind"] == "reference"
    assert response.json()["window"] is None


def test_event_range_preserves_400_elapsed_day_boundary(monkeypatch, sources_db):
    """Events accept 400 elapsed days and reject the next day."""
    spec = _spec(kind="events", grain="irregular")
    first = datetime(2025, 1, 1, tzinfo=UTC)
    _seed(sources_db, [(first, "A", 1.0, first)])
    client, url = _route(monkeypatch, sources_db, spec)
    accepted_end = (first.date() + timedelta(days=400)).isoformat()
    refused_end = (first.date() + timedelta(days=401)).isoformat()
    accepted = client.get(url + f"?start=2025-01-01&end={accepted_end}")
    refused = client.get(url + f"?start=2025-01-01&end={refused_end}")
    assert accepted.status_code == 200
    assert accepted.json()["coverage"]["days_in_window"] == 401
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "bad_range"


def test_start_after_default_end_is_bad_range(monkeypatch, sources_db):
    """An explicit start later than the resolved end fails with bad_range."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)])
    client, url = _route(monkeypatch, sources_db, _spec())
    response = client.get(url + "?start=2026-09-23")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_range"


def test_deep_bound_outside_depth_is_bad_range(monkeypatch, sources_db):
    """Either end outside locally held depth fails before expansion."""
    first = datetime(2025, 1, 1, tzinfo=UTC)
    last = first + timedelta(days=401)
    _seed(sources_db, [(first, "A", 1.0, first), (last, "A", 2.0, last)])
    client, url = _route(monkeypatch, sources_db, _spec())
    for start, end in (
        ("2024-12-31", last.date().isoformat()),
        ("2025-01-01", (last.date() + timedelta(days=1)).isoformat()),
    ):
        response = client.get(url, params={"start": start, "end": end})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "bad_range"


def test_window_unavailable_has_explicit_code(monkeypatch, sources_db):
    """An empty anchor needs an explicit end, while explicit bounds can be empty."""
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, value DOUBLE)"
    )
    client, url = _route(monkeypatch, sources_db, _spec())
    unavailable = client.get(url)
    explicit = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert unavailable.status_code == 422
    assert unavailable.json()["error"]["code"] == "window_unavailable"
    assert explicit.status_code == 200
    assert explicit.json()["row_count"] == 0


def test_events_and_reference_above_cap_return_413(monkeypatch, sources_db):
    """Record kinds refuse above cap with a useful hint and no aggregation."""
    monkeypatch.setattr(rows, "MAX_RESPONSE_ROWS", 2)
    first = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(first + timedelta(hours=i), "A", float(i), first) for i in range(3)])
    for kind in ("events", "reference"):
        rows._cache.clear()
        client, url = _route(monkeypatch, sources_db, _spec(kind=kind))
        response = client.get(
            url + ("?start=2026-09-22&end=2026-09-22" if kind == "events" else "")
        )
        assert response.status_code == 413
        error = response.json()["error"]
        assert error["code"] == "result_too_large"
        assert error["reason"] == "record_cap"
        assert "filter" in error["hint"].lower()


@pytest.mark.parametrize(
    "reason", ["unsupported_cadence", "mixed_identity", "no_meaningful_aggregation"]
)
def test_unsafe_downsample_has_explicit_code(monkeypatch, sources_db, reason):
    """Cadence, identity and absent aggregation have distinct 413 reasons."""
    first = datetime(2026, 9, 22, tzinfo=UTC)
    if reason == "unsupported_cadence":
        spec = _spec(grain="1d")
        _seed(sources_db, [(first, "A", 1.0, first), (first + timedelta(hours=1), "A", 2.0, first)])
    elif reason == "mixed_identity":
        monkeypatch.setattr(rows, "MAX_RESPONSE_ROWS", 5)
        spec = _spec()
        spec["dims"].append({"column": "region", "role": "filter", "cardinality": 2})
        sources_db.con.execute(
            "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, unit VARCHAR, "
            "region VARCHAR, value DOUBLE)"
        )
        sources_db.con.executemany(
            "INSERT INTO silver_test_sample VALUES (?, 'A', ?, 1)",
            [(first, "north"), (first + timedelta(hours=1), "south")],
        )
    else:
        monkeypatch.setattr(rows, "MAX_RESPONSE_ROWS", 5)
        spec = _spec()
        spec["values"] = []
        _seed(sources_db, [(first, "A", 1.0, first)])
    client, url = _route(monkeypatch, sources_db, spec)
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 413
    error = response.json()["error"]
    assert error["code"] == "result_too_large"
    assert error["reason"] == reason
    if reason == "unsupported_cadence":
        assert "cadence" in error["message"].lower()


def test_duplicate_verification_is_bounded(monkeypatch, sources_db):
    """The proof cap refuses before duplicate rows are materialized."""
    monkeypatch.setattr(rows, "MAX_DUPLICATE_PROOF", 1)
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)] * 2)
    client, url = _route(monkeypatch, sources_db, _spec(grain="irregular"))
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 413
    assert response.json()["error"]["reason"] == "duplicate_verification_limit"


def test_duplicate_reason_counts_only_selected_window(monkeypatch, sources_db):
    """Outside duplicates are absent from the selected reduction count."""
    spec = _spec(grain="irregular")
    old = datetime(2026, 9, 21, tzinfo=UTC)
    new = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(old, "A", 1.0, old)] * 3 + [(new, "A", 2.0, new)] * 2)
    client, url = _route(monkeypatch, sources_db, spec)
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 200
    assert response.json()["truncation"]["reasons"] == [
        {"type": "exact_duplicate_rows", "removed_rows": 1}
    ]


def test_rows_writer_lock_returns_503_even_with_warm_metadata(monkeypatch, running_job):
    """A warm metadata entry never bypasses the guarded client acquisition."""
    from app import deps
    from app.settings import get_settings

    spec = _spec()
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): spec})
    config = str(get_settings().duckdb_path)
    rows._cache[(config, "test", "sample")] = (
        rows.time.monotonic(),
        rows.Metadata("silver_test_sample", {}, None, None, None, None, 1),
    )

    class Forbidden:
        def __init__(self, *_):
            raise AssertionError("client constructed during writer job")

    monkeypatch.setattr(deps, "GridflowClient", Forbidden)
    monkeypatch.setattr(sources, "client_ctx", deps.client_ctx)
    response = TestClient(app).get("/api/sources/test/sample/rows")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "refresh_in_progress"


def test_catalogue_missing_has_existing_code(monkeypatch):
    """A missing catalogue retains the shared API error code."""
    from app.errors import CatalogueMissing

    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): _spec()})

    @contextmanager
    def missing():
        raise CatalogueMissing("catalogue absent")
        yield

    monkeypatch.setattr(sources, "client_ctx", missing)
    response = TestClient(app).get("/api/sources/test/sample/rows")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "catalogue_missing"


def test_client_closes_and_unrelated_io_propagates(monkeypatch, sources_db):
    """The route closes success/error acquisitions and exposes unrelated failures."""
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)])
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): _spec(grain="irregular")})
    exits = []

    @contextmanager
    def acquire():
        try:
            yield sources_db
        finally:
            exits.append(True)

    monkeypatch.setattr(sources, "client_ctx", acquire)
    client = TestClient(app)
    assert client.get("/api/sources/test/sample/rows").status_code == 200
    assert len(exits) == 1
    sources_db.con.execute(
        "INSERT INTO silver_test_sample VALUES "
        "(TIMESTAMPTZ '2026-09-22 00:00:00+00', 'A', 2, now())"
    )
    error = client.get("/api/sources/test/sample/rows")
    assert error.status_code == 422
    assert error.json()["error"]["code"] == "ambiguous_series"
    assert len(exits) == 2

    @contextmanager
    def unrelated():
        raise OSError("unrelated disk failure")
        yield

    monkeypatch.setattr(sources, "client_ctx", unrelated)
    response = TestClient(app, raise_server_exceptions=False).get("/api/sources/test/sample/rows")
    assert response.status_code == 500


def test_complete_response_contract_and_truncation_reasons(monkeypatch, sources_db):
    """Default filtering and capture collapse preserve both reduction reasons."""
    spec = _spec(grain="irregular")
    spec["default_filter"] = {"column": "unit", "equals": "A"}
    stamp = datetime(2026, 9, 22, tzinfo=UTC)
    _seed(sources_db, [(stamp, "A", 1.0, stamp)] * 2 + [(stamp, "B", 2.0, stamp)])
    client, url = _route(monkeypatch, sources_db, spec)
    response = client.get(url + "?start=2026-09-22&end=2026-09-22")
    assert response.status_code == 200
    payload = response.json()
    assert payload["relation"] == "silver_test_sample"
    assert payload["kind"] == "series"
    assert payload["filters"] == {"unit": "A"}
    assert payload["grain_ms"] is None
    assert payload["row_count"] == 1
    assert payload["truncated"] is True
    assert {reason["type"] for reason in payload["truncation"]["reasons"]} == {
        "default_filter",
        "exact_duplicate_rows",
    }
    assert payload["truncation"]["rows_before_defaults"] == 3
    assert payload["truncation"]["rows_after_filters"] == 1
    assert payload["truncation"]["returned_rows"] == 1
    assert payload["truncation"]["bucket_ms"] is None
    assert payload["truncation"]["aggregation"] is None
    assert payload["notes"]
