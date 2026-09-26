"""Executable SQL and schema reconciliation tests for the sources manifest."""

from __future__ import annotations

import copy
from datetime import UTC, date, datetime

import pytest

from app import rows, sources
from app.sources_spec import SOURCES as COMMITTED_SOURCES


def _spec(*datasets):
    return [
        {
            "key": "test",
            "name": "Test",
            "domain": "Electricity",
            "layer": "silver",
            "host": "local",
            "blurb": "Synthetic",
            "families": [
                {
                    "slug": "sample",
                    "label": "Sample",
                    "kind": "series",
                    "page": "build",
                    "route": "/sources/test/sample",
                    "notes": [],
                    "datasets": list(datasets),
                }
            ],
        }
    ]


def _dataset(dataset_id="sample", **updates):
    d = {
        "id": dataset_id,
        "schedule": "daily",
        "kind": "series",
        "verdict": "chart",
        "base_relation": f"silver_test_{dataset_id}",
        "latest_relation": f"silver_test_{dataset_id}_latest",
        "not_held_cause": None,
        "clock": {"column": "timestamp_utc", "grain": "1h", "settlement_cols": []},
        "latest_day_rule": {"mode": "max", "column": "published_at"},
        "values": [{"column": "value", "unit": "MW", "label": "Value"}],
        "dims": [],
        "default_filter": None,
        "dedup": None,
        "row_filter": None,
        "snapshot_column": None,
        "volume_class": "small",
        "notes": [],
    }
    d.update(updates)
    return d


def _one(snapshot):
    return snapshot["sources"][0]["families"][0]["datasets"][0]


def _committed(dataset_id):
    return copy.deepcopy(
        next(
            d
            for source in COMMITTED_SOURCES
            for family in source["families"]
            for d in family["datasets"]
            if d["id"] == dataset_id
        )
    )


def _seed_committed_relation(sources_db, dataset, rows, *, absent=()):
    """Make a live-shaped relation while using the committed selection policy."""
    columns = sorted(sources._required_columns(dataset) - set(absent))
    types = {
        column: (
            "DATE"
            if column in {"settlement_date", "forecast_date"}
            else "INTEGER"
            if column == "settlement_period"
            else "VARCHAR"
            if column in {"boundary", "bm_unit_id", "fuel_type", "national_grid_bm_unit"}
            else "TIMESTAMPTZ"
            if column in {"timestamp_utc", "published_at"}
            else "DOUBLE"
        )
        for column in columns
    }
    definitions = ", ".join(f'"{column}" {types[column]}' for column in columns)
    sources_db.con.execute(f'CREATE TABLE "{dataset["base_relation"]}" ({definitions})')
    defaults = {
        "DATE": date(2026, 9, 1),
        "INTEGER": 1,
        "VARCHAR": "unit-a",
        "TIMESTAMPTZ": datetime(2026, 9, 1, tzinfo=UTC),
        "DOUBLE": 1.0,
    }
    placeholders = ", ".join("?" for _ in columns)
    sources_db.con.executemany(
        f'INSERT INTO "{dataset["base_relation"]}" VALUES ({placeholders})',
        [[row.get(column, defaults[types[column]]) for column in columns] for row in rows],
    )


def test_uk_days_dst_and_publication_anchor_not_future_delivery(
    monkeypatch: pytest.MonkeyPatch, sources_db
) -> None:
    """Detect UTC-day grouping and a planned 2077 delivery leaking into latest day."""
    sources_db.con.execute(
        """
        CREATE TABLE silver_test_sample(
          timestamp_utc TIMESTAMPTZ, published_at TIMESTAMPTZ, value DOUBLE
        );
        INSERT INTO silver_test_sample VALUES
          ('2026-08-09 23:30:00+00', '2026-08-09 12:00:00+00', 1),
          ('2026-10-25 00:30:00+00', '2026-08-09 12:00:00+00', 2),
          ('2026-10-25 01:30:00+00', '2026-08-09 12:00:00+00', 3),
          ('2077-01-01 00:00:00+00', '2026-08-09 12:00:00+00', 4)
        """
    )
    monkeypatch.setattr(sources, "SOURCES", _spec(_dataset()))
    manifest = sources.build_manifest(sources_db)
    result = _one(sources._response(manifest))
    assert result["coverage"]["rows"] == 4
    assert result["coverage"]["first_day"] == "2026-08-10"
    assert result["coverage"]["day_count"] == 3
    assert result["coverage"]["latest_local_day"] == sources._today_uk().isoformat()
    assert result["coverage"]["last_published_day"] == "2026-08-09"
    assert sources_db.table_calls == 1


def test_latest_local_day_matches_rows_default_window_end(
    monkeypatch: pytest.MonkeyPatch, sources_db
) -> None:
    dataset = _dataset(
        latest_relation=None,
        clock={"column": "timestamp_utc", "grain": "irregular", "settlement_cols": []},
    )
    sources_db.con.execute(
        "CREATE TABLE silver_test_sample (timestamp_utc TIMESTAMPTZ, "
        "published_at TIMESTAMPTZ, value DOUBLE)"
    )
    sources_db.con.executemany(
        "INSERT INTO silver_test_sample VALUES (?, ?, ?)",
        [
            (datetime(2026, 8, 1, 10, tzinfo=UTC), datetime(2026, 8, 15, tzinfo=UTC), 1.0),
            (datetime(2026, 8, 2, 10, tzinfo=UTC), datetime(2026, 8, 15, tzinfo=UTC), 2.0),
        ],
    )
    monkeypatch.setattr(sources, "SOURCES", _spec(dataset))
    monkeypatch.setattr(rows, "REGISTRY", {("test", "sample"): dataset})
    rows._cache.clear()
    manifest_coverage = _one(sources._response(sources.build_manifest(sources_db)))["coverage"]
    request = rows.validate("test", "sample", None, None, None, None)
    rows_response = rows.execute(sources_db, request, f"test-{id(sources_db)}")
    assert rows_response["row_count"] == 2
    assert manifest_coverage["latest_local_day"] == "2026-08-02"
    assert manifest_coverage["latest_local_day"] == rows_response["window"]["end"]
    assert manifest_coverage["last_published_day"] == "2026-08-15"


def test_latest_relation_and_missing_column_isolated(
    monkeypatch: pytest.MonkeyPatch, sources_db, caplog
) -> None:
    """Detect malformed latest views falling back to base or disabling a healthy sibling."""
    sources_db.con.execute(
        """
        CREATE TABLE silver_test_sample(
            timestamp_utc TIMESTAMPTZ, published_at TIMESTAMPTZ, value DOUBLE
        );
        INSERT INTO silver_test_sample VALUES ('2026-09-01', '2026-09-01', 1);
        CREATE VIEW silver_test_sample_latest AS
          SELECT timestamp_utc, published_at FROM silver_test_sample;
        CREATE TABLE silver_test_other(
            timestamp_utc TIMESTAMPTZ, published_at TIMESTAMPTZ, value DOUBLE
        );
        INSERT INTO silver_test_other VALUES ('2026-09-02', '2026-09-02', 2);
        """
    )
    monkeypatch.setattr(sources, "SOURCES", _spec(_dataset(), _dataset("other")))
    result = sources.build_manifest(sources_db)
    cards = result["sources"][0]["families"][0]["datasets"]
    assert cards[0]["held"] is False
    assert cards[0]["not_held_cause"] == "missing-in-catalogue"
    assert cards[0]["coverage"] is None
    assert cards[1]["held"] is True
    assert cards[1]["relation"] == "silver_test_other"
    assert "test/sample" in caplog.text
    assert "value" in caplog.text


@pytest.mark.parametrize(
    ("field", "invalid_type"),
    [("clock", "VARCHAR"), ("clock", "BIGINT"), ("anchor", "VARCHAR")],
)
def test_missing_spec_column_only_disables_affected_dataset_with_type_mismatch(
    monkeypatch: pytest.MonkeyPatch, sources_db, caplog, field, invalid_type
) -> None:
    sources_db.con.execute(
        f"CREATE TABLE silver_test_sample("
        f"timestamp_utc {invalid_type if field == 'clock' else 'TIMESTAMPTZ'}, "
        f"published_at {invalid_type if field == 'anchor' else 'TIMESTAMPTZ'}, "
        "value DOUBLE)"
    )
    sources_db.con.execute(
        "CREATE TABLE silver_test_other("
        "timestamp_utc TIMESTAMPTZ, published_at TIMESTAMPTZ, value DOUBLE); "
        "INSERT INTO silver_test_other VALUES ('2026-09-01', '2026-09-01', 1)"
    )
    monkeypatch.setattr(sources, "SOURCES", _spec(_dataset(), _dataset("other")))
    cards = sources.build_manifest(sources_db)["sources"][0]["families"][0]["datasets"]
    assert cards[0]["held"] is False
    assert cards[0]["relation"] is None
    assert cards[0]["not_held_cause"] == "missing-in-catalogue"
    assert cards[0]["coverage"] is None
    assert cards[1]["held"] is True
    assert cards[1]["coverage"]["rows"] == 1
    assert caplog.text.count("test/sample") == 1


@pytest.mark.parametrize("dataset_id", ["tsdf", "inddem", "indgen"])
def test_vintage_dedup_preserves_entity_keys(
    monkeypatch: pytest.MonkeyPatch, sources_db, dataset_id
) -> None:
    dataset = _committed(dataset_id)
    _seed_committed_relation(
        sources_db,
        dataset,
        [
            {"boundary": "N", "published_at": datetime(2026, 9, 1, tzinfo=UTC)},
            {"boundary": "N", "published_at": datetime(2026, 9, 2, tzinfo=UTC)},
            {"boundary": "S", "published_at": datetime(2026, 9, 1, tzinfo=UTC)},
        ],
    )
    monkeypatch.setattr(sources, "SOURCES", _spec(dataset))
    card = _one(sources.build_manifest(sources_db))
    assert card["held"] is True
    assert card["coverage"]["rows"] == 2
    selected = sources_db.query(sources._selected_sql(dataset["base_relation"], dataset))
    assert set(selected["boundary"].to_list()) == {"N", "S"}


@pytest.mark.parametrize(
    ("dataset_id", "absent", "entity_column"),
    [
        ("tsdfd", ("settlement_date",), "forecast_date"),
        ("uou2t14d", ("settlement_period",), "bm_unit_id"),
    ],
)
def test_daily_vintage_keys_match_held_relation(
    monkeypatch: pytest.MonkeyPatch, sources_db, dataset_id, absent, entity_column
) -> None:
    dataset = _committed(dataset_id)
    second_entity = date(2026, 9, 2) if dataset_id == "tsdfd" else "unit-b"
    _seed_committed_relation(
        sources_db,
        dataset,
        [
            {},
            {"published_at": datetime(2026, 9, 2, tzinfo=UTC)},
            {entity_column: second_entity},
        ],
        absent=absent,
    )
    monkeypatch.setattr(sources, "SOURCES", _spec(dataset))
    card = _one(sources.build_manifest(sources_db))
    assert card["held"] is True
    assert card["relation"] == dataset["base_relation"]
    assert card["coverage"]["rows"] == 2


def test_declared_not_held_relation_warns_but_stays_unheld(
    monkeypatch: pytest.MonkeyPatch, sources_db, caplog
) -> None:
    """Detect a new catalogue landing hidden by stale committed metadata."""
    sources_db.con.execute("CREATE TABLE silver_test_sample(value INTEGER)")
    d = _dataset(not_held_cause="never-fetched")
    monkeypatch.setattr(sources, "SOURCES", _spec(d))
    card = _one(sources.build_manifest(sources_db))
    assert card["held"] is False
    assert card["coverage"] is None
    assert card["not_held_cause"] == "never-fetched"
    assert "Declared not held" in caplog.text


def test_filter_dedup_snapshot_and_null_anchor(monkeypatch: pytest.MonkeyPatch, sources_db) -> None:
    """Detect v1 rows, old snapshots, or duplicate revisions inflating coverage."""
    sources_db.con.execute(
        """
        CREATE TABLE silver_test_sample(
          timestamp_utc TIMESTAMPTZ, published_at TIMESTAMPTZ,
          value DOUBLE, vintage_policy_id VARCHAR, id VARCHAR, available_at TIMESTAMPTZ
        );
        INSERT INTO silver_test_sample VALUES
          ('2077-01-01', '2026-09-01', 1, 'v1', 'a', '2026-09-01'),
          ('2026-09-02', NULL, 2, 'v2', 'old', '2026-09-01'),
          ('2026-09-03', NULL, 3, 'v2', 'a', '2026-09-02'),
          ('2026-09-03', NULL, 4, 'v2', 'a', '2026-09-02')
        """
    )
    d = _dataset(
        row_filter={"column": "vintage_policy_id", "equals": "v2"},
        snapshot_column="available_at",
        dedup={
            "keys": ["id"],
            "order_by": [{"column": "value", "direction": "desc", "nulls": "last"}],
        },
    )
    monkeypatch.setattr(sources, "SOURCES", _spec(d))
    card = _one(sources._response(sources.build_manifest(sources_db)))
    assert card["coverage"]["rows"] == 1
    assert card["coverage"]["last_day"] == "2026-09-03"
    assert card["coverage"]["latest_local_day"] == "2026-09-03"


def test_dotted_and_reserved_identifiers_and_quoted_scalar_execute(
    monkeypatch: pytest.MonkeyPatch, sources_db
) -> None:
    """Detect unquoted SQL identifiers or unescaped committed equality values."""
    sources_db.con.execute(
        """
        CREATE TABLE silver_test_sample(
            timestamp_utc TIMESTAMPTZ, published_at TIMESTAMPTZ,
            "q_0.05" DOUBLE, "start" VARCHAR, owner VARCHAR
        );
        INSERT INTO silver_test_sample VALUES
            ('2026-09-03', '2026-09-02', 10, 'a', 'O''Neil'),
            ('2026-09-04', '2026-09-02', 11, 'b', 'Someone else');
        """
    )
    d = _dataset(
        values=[{"column": "q_0.05", "unit": None, "label": "Quantile"}],
        dims=[{"column": "start", "role": "filter", "cardinality": None}],
        row_filter={"column": "owner", "equals": "O'Neil"},
    )
    monkeypatch.setattr(sources, "SOURCES", _spec(d))
    card = _one(sources._response(sources.build_manifest(sources_db)))
    assert card["held"] is True
    assert card["coverage"]["rows"] == 1
    assert card["coverage"]["last_day"] == "2026-09-03"


def test_reference_null_days_and_utc_last_ingested(
    monkeypatch: pytest.MonkeyPatch, sources_db
) -> None:
    """Detect reference dates displayed as daily coverage or local-time ingestion."""
    sources_db.con.execute(
        """
        CREATE TABLE silver_test_sample(value DOUBLE, ingested_at TIMESTAMPTZ);
        INSERT INTO silver_test_sample VALUES (1, '2026-09-01 23:30:00+00');
        """
    )
    d = _dataset(
        kind="reference",
        clock=None,
        latest_day_rule={"mode": "reference", "column": None},
    )
    monkeypatch.setattr(sources, "SOURCES", _spec(d))
    coverage = _one(sources._response(sources.build_manifest(sources_db)))["coverage"]
    assert coverage["rows"] == 1
    assert coverage["day_count"] is None
    assert coverage["latest_local_day"] is None
    assert coverage["last_ingested"] == "2026-09-01T23:30:00Z"


def test_today_cap_recomputed_without_mutating_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Detect a cached future anchor becoming permanently stuck at yesterday."""
    snapshot = {
        "generated_at": "2026-09-25T00:00:00Z",
        "sources": [
            {
                "families": [
                    {
                        "datasets": [
                            {"coverage": {"_anchor_day": "2077-01-01", "latest_local_day": None}}
                        ]
                    }
                ]
            }
        ],
    }
    before = copy.deepcopy(snapshot)
    monkeypatch.setattr(sources, "_today_uk", lambda: datetime(2026, 9, 26, tzinfo=UTC).date())
    assert _one(sources._response(snapshot))["coverage"]["latest_local_day"] == "2026-09-26"
    assert snapshot == before
