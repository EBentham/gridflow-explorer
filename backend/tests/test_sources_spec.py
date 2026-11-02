"""Inventory checks independent of the serving specification."""

from __future__ import annotations

import copy
import json
from collections import Counter
from pathlib import Path

import pytest

from app import sources
from app.sources import validate_spec
from app.sources_spec import DATASET_DEFAULTS, SOURCES


def _datasets():
    for source in SOURCES:
        for family in source["families"]:
            for dataset in family["datasets"]:
                yield source, family, dataset


def test_every_seed_identity_schedule_and_family_appears_once() -> None:
    """Detect omissions, duplicate source/id pairs, and schedule or family drift."""
    expected = json.loads(
        (Path(__file__).parent / "fixtures" / "sources_expected.json").read_text(encoding="utf-8")
    )
    actual = [
        {
            "source": s["key"],
            "id": d["id"],
            "family": f["label"],
            "schedule": d["schedule"],
        }
        for s, f, d in _datasets()
    ]
    assert len(actual) == len(expected) == 172
    assert Counter((d["source"], d["id"]) for d in actual) == Counter(
        (d["source"], d["id"]) for d in expected
    )
    assert sorted(actual, key=lambda x: (x["source"], x["id"])) == sorted(
        expected, key=lambda x: (x["source"], x["id"])
    )


def test_family_page_counts_routes_and_corrections() -> None:
    """Detect P4 scope drift and misrouted forecasts or installed capacity."""
    validate_spec()
    families = [(s, f) for s in SOURCES for f in s["families"]]
    assert Counter(f["page"] for _, f in families) == {
        "build": 45,
        "table-only": 12,
        "not-built": 10,
        "pinned": 2,
        "external": 1,
    }
    for source, family in families:
        if family["page"] in {"build", "table-only"}:
            assert family["route"] == f"/sources/{source['key']}/{family['slug']}"
        elif family["page"] == "not-built":
            assert family["route"] is None
    gold_forecasts = next(
        f for s, f in families if s["key"] == "gold" and f["label"] == "Demand forecasts"
    )
    assert gold_forecasts["route"] == "/forecasts"

    emission_factors = next(
        f for s, f in families if s["key"] == "neso" and f["slug"] == "emission-factors-by-fuel"
    )
    assert emission_factors["kind"] == "reference"
    assert emission_factors["page"] == "table-only"
    assert emission_factors["route"] == "/sources/neso/emission-factors-by-fuel"
    assert {d["id"] for d in gold_forecasts["datasets"]} == {
        "gold_forecasts",
        "gold_forecast_metrics",
    }
    margin = [(s, f, d) for s, f, d in _datasets() if d["id"] == "forecast_margin"]
    assert len(margin) == 1
    assert margin[0][1]["label"] == "Installed capacity, yearly"
    assert margin[0][2]["kind"] == "reference"
    assert all(
        d["kind"] == "events"
        for s, _, d in _datasets()
        if s["key"] == "entsoe" and d["id"].startswith("outages_")
    )


def test_spec_uses_literal_columns_and_null_unknown_units() -> None:
    """Detect research shorthand or invented units leaking into the public contract."""
    for _, _, dataset in _datasets():
        for item in dataset["values"] + dataset["dims"]:
            assert all(char not in item["column"] for char in "*,{}()")
        for value in dataset["values"]:
            if value["unit"] is None:
                assert any("unit" in note.lower() for note in dataset["notes"])
        for key in ("default_filter", "row_filter"):
            rule = dataset[key]
            assert rule is None or set(rule) == {"column", "equals"}


def test_left_out_keys_are_filled_with_fresh_values() -> None:
    """Every reader indexes the full key set; one shared default list would leak notes."""
    datasets = [d for _, _, d in _datasets()]
    assert all(set(DATASET_DEFAULTS) <= set(d) for d in datasets)
    assert len({id(d["notes"]) for d in datasets}) == len(datasets)
    assert all(d["clock"] is None or "settlement_cols" in d["clock"] for d in datasets)


@pytest.mark.parametrize(
    ("damage", "message"),
    [
        (lambda d: d.update(latest_relation="x; DROP TABLE y"), "not an identifier"),
        (lambda d: d["values"][0].update(column=""), "Invalid declared column"),
        (lambda d: d.update(default_filter={"column": "absent", "equals": "x"}), "dimension"),
    ],
    ids=["relation", "column", "default-filter"],
)
def test_validate_spec_rejects_malformed_committed_rules(monkeypatch, damage, message) -> None:
    """Committed names, columns and default filters are checked once, not per request."""
    damaged = copy.deepcopy(SOURCES)
    damage(damaged[0]["families"][0]["datasets"][0])
    monkeypatch.setattr(sources, "SOURCES", damaged)
    with pytest.raises(ValueError, match=message):
        validate_spec()
