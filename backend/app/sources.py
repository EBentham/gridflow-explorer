"""Read-only source manifest, coverage selection, and process-local cache."""

from __future__ import annotations

import copy
import logging
import threading
import time
from datetime import UTC, date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter

from app.deps import client_ctx
from app.errors import RefreshInProgress
from app.sources_spec import SOURCES

router = APIRouter()
LOG = logging.getLogger(__name__)
LONDON = ZoneInfo("Europe/London")
TTL_SECONDS = 600
_lock = threading.Lock()
_snapshot: dict[str, Any] | None = None
_refreshed_at = 0.0

_PUBLIC_DATASET = (
    "id",
    "schedule",
    "kind",
    "verdict",
    "clock",
    "latest_day_rule",
    "values",
    "dims",
    "default_filter",
    "volume_class",
    "notes",
)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _today_uk() -> date:
    return _utc_now().astimezone(LONDON).date()


def _iso_z(value: datetime | None) -> str | None:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z") if value else None


def _quote(identifier: str) -> str:
    """Quote a committed identifier after matching it against catalogue metadata."""
    return '"' + identifier.replace('"', '""') + '"'


def _literal(value: str | int | float | bool | None) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not (-float("inf") < value < float("inf")):
            raise ValueError("Non-finite SQL literal")
        return str(value)
    raise TypeError(f"Unsupported SQL literal: {type(value)!r}")


def validate_spec() -> None:
    """Reject duplicate identities, routes, or malformed committed rules before acquisition."""
    identities: set[tuple[str, str]] = set()
    for source in SOURCES:
        slugs: set[str] = set()
        for family in source["families"]:
            if family["slug"] in slugs:
                raise ValueError(f"Duplicate family slug: {source['key']}/{family['slug']}")
            slugs.add(family["slug"])
            for dataset in family["datasets"]:
                identity = (source["key"], dataset["id"])
                if identity in identities:
                    raise ValueError(f"Duplicate dataset identity: {identity}")
                identities.add(identity)
                rule = dataset["latest_day_rule"]
                if rule["mode"] not in {"max", "reference", "unknown"}:
                    raise ValueError(f"Invalid latest-day rule: {identity}")
                if rule["mode"] == "max" and not rule["column"]:
                    raise ValueError(f"Missing latest-day anchor: {identity}")


def _required_columns(dataset: dict[str, Any]) -> set[str]:
    columns = {v["column"] for v in dataset["values"]}
    columns.update(d["column"] for d in dataset["dims"])
    clock = dataset["clock"]
    if clock:
        if clock["column"]:
            columns.add(clock["column"])
        columns.update(clock["settlement_cols"])
    rule = dataset["latest_day_rule"]
    if rule["mode"] == "max":
        columns.add(rule["column"])
    for key in ("default_filter", "row_filter"):
        if dataset[key]:
            columns.add(dataset[key]["column"])
    if dataset["snapshot_column"]:
        columns.add(dataset["snapshot_column"])
    dedup = dataset["dedup"]
    if dedup:
        columns.update(dedup["keys"])
        columns.update(item["column"] for item in dedup["order_by"])
    return columns


def _uk_date(column: str, types: dict[str, str]) -> str:
    quoted = _quote(column)
    kind = types[column].upper()
    if kind == "DATE":
        return quoted
    if "WITH TIME ZONE" in kind or kind == "TIMESTAMPTZ":
        return f"CAST(timezone('Europe/London', {quoted}) AS DATE)"
    if kind.startswith("TIMESTAMP"):
        # Naive timestamps are accepted only for the committed UTC-named clock.
        if not column.endswith("_utc"):
            raise ValueError(f"Naive timestamp has no verified UTC encoding: {column}")
        return f"CAST(timezone('Europe/London', timezone('UTC', {quoted})) AS DATE)"
    raise ValueError(f"Unsupported date column type: {column} {kind}")


def _selected_sql(relation: str, dataset: dict[str, Any]) -> str:
    """Compile mandatory filter, newest snapshot, then deterministic dedup."""
    sql = f"SELECT * FROM {_quote(relation)}"
    row_filter = dataset["row_filter"]
    if row_filter:
        sql += f" WHERE {_quote(row_filter['column'])} = {_literal(row_filter['equals'])}"
    snapshot = dataset["snapshot_column"]
    if snapshot:
        col = _quote(snapshot)
        sql = (
            f"SELECT * FROM ({sql}) AS filtered WHERE {col} = "
            f"(SELECT max({col}) FROM ({sql}) AS all_snapshots)"
        )
    dedup = dataset["dedup"]
    if dedup:
        keys = ", ".join(_quote(k) for k in dedup["keys"])
        order = ", ".join(
            f"{_quote(o['column'])} {o['direction'].upper()} NULLS {o['nulls'].upper()}"
            for o in dedup["order_by"]
        )
        if not order:
            order = keys
        sql = (
            "SELECT * EXCLUDE (__source_rank) FROM "
            f"(SELECT *, row_number() OVER (PARTITION BY {keys} ORDER BY {order}) "
            f"AS __source_rank FROM ({sql}) AS before_dedup) AS ranked "
            "WHERE __source_rank = 1"
        )
    return sql


def _coverage_sql(relation: str, dataset: dict[str, Any], types: dict[str, str]) -> str:
    selected = _selected_sql(relation, dataset)
    reference = dataset["kind"] == "reference"
    clock = dataset["clock"]
    day = (
        _uk_date(clock["column"], types)
        if not reference and clock and clock["column"]
        else "CAST(NULL AS DATE)"
    )
    rule = dataset["latest_day_rule"]
    anchor = (
        _uk_date(rule["column"], types)
        if not reference and rule["mode"] == "max"
        else "CAST(NULL AS DATE)"
    )
    ingest_col = "written_at" if dataset["id"] == "gold_forecast_metrics" else "ingested_at"
    ingested = f"max({_quote(ingest_col)})" if reference and ingest_col in types else "NULL"
    return (
        f"WITH selected AS ({selected}) "
        f"SELECT count(*) AS rows, min({day}) AS first_day, max({day}) AS last_day, "
        f"count(DISTINCT {day}) AS day_count, max({anchor}) AS anchor_day, "
        f"{ingested} AS last_ingested FROM selected"
    )


def _day_string(value: date | datetime | None) -> str | None:
    return (
        value.date().isoformat()
        if isinstance(value, datetime)
        else value.isoformat()
        if value
        else None
    )


def _coverage(
    client: Any, relation: str, dataset: dict[str, Any], types: dict[str, str]
) -> dict[str, Any]:
    row = client.query(_coverage_sql(relation, dataset, types)).to_dicts()[0]
    reference = dataset["kind"] == "reference"
    result: dict[str, Any] = {
        "rows": row["rows"],
        "first_day": None if reference else _day_string(row["first_day"]),
        "last_day": None if reference else _day_string(row["last_day"]),
        "day_count": None if reference else row["day_count"],
        "latest_local_day": None,
    }
    if reference:
        result["last_ingested"] = _iso_z(row["last_ingested"])
    else:
        # Preserve the uncapped anchor in the private cache. The cap is applied
        # to a response copy so a cache crossing UK midnight gets today's date.
        result["_anchor_day"] = _day_string(row["anchor_day"])
    return result


def build_manifest(client: Any, *, generated_at: datetime | None = None) -> dict[str, Any]:
    """Build one complete manifest using a single GridflowClient handle."""
    validate_spec()
    generated_at = generated_at or _utc_now()
    tables = set(client.get_tables())
    schema = client.query(
        "SELECT table_name, column_name, data_type FROM information_schema.columns "
        "WHERE table_schema = 'main'"
    ).to_dicts()
    columns: dict[str, dict[str, str]] = {}
    for row in schema:
        columns.setdefault(row["table_name"], {})[row["column_name"]] = row["data_type"]
    result: dict[str, Any] = {"generated_at": _iso_z(generated_at), "sources": []}
    for source in SOURCES:
        public_source = {
            k: copy.deepcopy(source[k]) for k in ("key", "name", "domain", "host", "blurb", "layer")
        }
        public_source["families"] = []
        result["sources"].append(public_source)
        for family in source["families"]:
            public_family = {
                k: copy.deepcopy(family[k])
                for k in ("slug", "label", "kind", "page", "route", "notes")
            }
            public_family["datasets"] = []
            public_source["families"].append(public_family)
            for dataset in family["datasets"]:
                public = {k: copy.deepcopy(dataset[k]) for k in _PUBLIC_DATASET}
                cause = dataset["not_held_cause"]
                candidate = dataset["base_relation"]
                latest = dataset["latest_relation"]
                if cause:
                    if (candidate and candidate in tables) or (latest and latest in tables):
                        LOG.warning(
                            "Declared not held but catalogue relation exists: %s/%s (%s)",
                            source["key"],
                            dataset["id"],
                            latest if latest in tables else candidate,
                        )
                    public.update(held=False, relation=None, not_held_cause=cause, coverage=None)
                else:
                    selected = latest if latest and latest in tables else candidate
                    types = columns.get(selected, {})
                    missing = _required_columns(dataset) - set(types)
                    invalid_dates = []
                    if selected in tables:
                        date_columns = []
                        if dataset["kind"] != "reference":
                            clock = dataset["clock"]
                            if clock and clock["column"]:
                                date_columns.append(clock["column"])
                            rule = dataset["latest_day_rule"]
                            if rule["mode"] == "max":
                                date_columns.append(rule["column"])
                        for column in set(date_columns) - missing:
                            try:
                                _uk_date(column, types)
                            except ValueError as exc:
                                invalid_dates.append(str(exc))
                    if selected not in tables or missing or invalid_dates:
                        LOG.warning(
                            "Missing catalogue schema for %s/%s: relation=%s "
                            "missing=%s invalid_dates=%s",
                            source["key"],
                            dataset["id"],
                            selected,
                            sorted(missing) if selected in tables else ["<relation>"],
                            sorted(invalid_dates),
                        )
                        public.update(
                            held=False,
                            relation=None,
                            not_held_cause="missing-in-catalogue",
                            coverage=None,
                        )
                    else:
                        public.update(
                            held=True,
                            relation=selected,
                            not_held_cause=None,
                            coverage=_coverage(client, selected, dataset, columns[selected]),
                        )
                        if (
                            public["coverage"]["rows"]
                            and not public["coverage"].get("_anchor_day")
                            and dataset["latest_day_rule"]["mode"] == "max"
                        ):
                            public["notes"].append("Rows have no usable latest-day anchor.")
                        if (
                            public["coverage"]["rows"]
                            and public["coverage"]["day_count"] == 0
                            and dataset["kind"] != "reference"
                        ):
                            public["notes"].append("Rows have no usable coverage dates.")
                public_family["datasets"].append(public)
    return result


def _response(snapshot: dict[str, Any]) -> dict[str, Any]:
    payload = copy.deepcopy(snapshot)
    today = _today_uk()
    payload["today_uk"] = today.isoformat()
    for source in payload["sources"]:
        for family in source["families"]:
            for dataset in family["datasets"]:
                coverage = dataset["coverage"]
                if coverage and "_anchor_day" in coverage:
                    anchor = coverage.pop("_anchor_day")
                    coverage["latest_local_day"] = (
                        min(date.fromisoformat(anchor), today).isoformat() if anchor else None
                    )
    return payload


@router.get("/api/sources")
def get_sources() -> dict[str, Any]:
    """Serve a fresh or stale complete snapshot, rebuilding lazily."""
    global _snapshot, _refreshed_at
    validate_spec()
    now = time.monotonic()
    if _snapshot is not None and now - _refreshed_at < TTL_SECONDS:
        return _response(_snapshot)
    if not _lock.acquire(blocking=False):
        if _snapshot is not None:
            return _response(_snapshot)
        _lock.acquire()
    try:
        if _snapshot is not None and time.monotonic() - _refreshed_at < TTL_SECONDS:
            return _response(_snapshot)
        try:
            with client_ctx() as client:
                built = build_manifest(client, generated_at=_utc_now())
        except RefreshInProgress:
            if _snapshot is not None:
                return _response(_snapshot)
            raise
        _snapshot = built
        _refreshed_at = time.monotonic()
        return _response(built)
    finally:
        _lock.release()
