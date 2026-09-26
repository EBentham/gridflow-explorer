"""Inventory checks independent of the serving specification."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from app.sources import validate_spec
from app.sources_spec import SOURCES


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
            "held": d["not_held_cause"] is None,
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
        "table-only": 11,
        "not-built": 11,
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
