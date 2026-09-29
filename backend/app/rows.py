"""Registry-backed, read-only rows selection for the source catalogue."""

from __future__ import annotations

import logging
import math
import re
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import Any
from zoneinfo import ZoneInfo

import duckdb
import polars as pl

from app.sources import _required_columns
from app.sources_spec import SOURCES

LONDON = ZoneInfo("Europe/London")
MAX_RESPONSE_ROWS = 50_000
MAX_DUPLICATE_PROOF = 50_000
TTL_SECONDS = 600
_ROWS_MEMORY_CEILING = "8GiB"
ROWS_OPERATION_TIMEOUT_SECONDS = 30
ROWS_REQUEST_TIMEOUT_SECONDS = 30
MIN_OPERATION_SECONDS = 0.05
LOG = logging.getLogger(__name__)
GRAINS = {
    "15s": 15_000,
    "5min": 300_000,
    "15min": 900_000,
    "30min": 1_800_000,
    "60min": 3_600_000,
    "1h": 3_600_000,
    "24h": 86_400_000,
    "1d": 86_400_000,
    "7d": 604_800_000,
}
NUMERIC_KINDS = frozenset(
    {
        "TINYINT",
        "SMALLINT",
        "INTEGER",
        "BIGINT",
        "HUGEINT",
        "UTINYINT",
        "USMALLINT",
        "UINTEGER",
        "UBIGINT",
        "UHUGEINT",
        "DOUBLE",
        "FLOAT",
        "REAL",
        "BIGNUM",
        "DECIMAL",
    }
)
FILTER_VALUE = re.compile(r"[A-Za-z0-9 _.\-/:]{1,64}\Z")
DATE_VALUE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}\Z")


class RowsErrorCode(StrEnum):
    UNKNOWN_DATASET = "unknown_dataset"
    BAD_IDENTIFIER = "bad_identifier"
    BAD_RANGE = "bad_range"
    BAD_FILTER = "bad_filter"
    BAD_GROUP = "bad_group"
    BAD_COLUMNS = "bad_columns"
    QUERY_TIMEOUT = "query_timeout"
    WINDOW_UNAVAILABLE = "window_unavailable"
    AMBIGUOUS_SERIES = "ambiguous_series"
    RESULT_TOO_LARGE = "result_too_large"


class RowsError(Exception):
    def __init__(
        self, code: RowsErrorCode, message: str, *, details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}
        self.http_status = (
            404
            if code == RowsErrorCode.UNKNOWN_DATASET
            else 413
            if code == RowsErrorCode.RESULT_TOO_LARGE
            else 503
            if code == RowsErrorCode.QUERY_TIMEOUT
            else 422
        )

    def envelope(self) -> dict[str, Any]:
        return {"error": {"code": self.code, "message": self.message, **self.details}}


def _error(code: RowsErrorCode, message: str, **details: Any) -> RowsError:
    return RowsError(code, message, details=details)


def _quote(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def _registry() -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (source["key"], dataset["id"]): dataset
        for source in SOURCES
        for family in source["families"]
        for dataset in family["datasets"]
    }


REGISTRY = _registry()


def _projection(dataset: dict[str, Any]) -> tuple[str, ...]:
    return tuple(sorted(_required_columns(dataset)))


def _clock_column(dataset: dict[str, Any]) -> str | None:
    if dataset["kind"] == "events":
        return dataset["latest_day_rule"]["column"]
    clock = dataset["clock"]
    return clock["column"] if clock else None


def _parse_date(value: str | None) -> date | None:
    if value is None:
        return None
    if not DATE_VALUE.fullmatch(value):
        raise _error(RowsErrorCode.BAD_RANGE, "Date must be YYYY-MM-DD.")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise _error(RowsErrorCode.BAD_RANGE, "Date is invalid.") from exc


@dataclass(frozen=True)
class Request:
    source: str
    dataset: dict[str, Any]
    start: date | None
    end: date | None
    group: str | None
    filters: tuple[tuple[str, str], ...]
    use_defaults: bool
    columns: tuple[str, ...] | None = None


def validate(
    source: str,
    dataset_id: str,
    start: str | None,
    end: str | None,
    group: str | None,
    filters: list[str] | None,
    columns: list[str] | None = None,
) -> Request:
    dataset = REGISTRY.get((source, dataset_id))
    if dataset is None:
        raise _error(RowsErrorCode.UNKNOWN_DATASET, "Unknown source or dataset.")
    if dataset["not_held_cause"]:
        raise _error(
            RowsErrorCode.UNKNOWN_DATASET,
            "Dataset is not held.",
            not_held_cause=dataset["not_held_cause"],
        )
    relations = (dataset["base_relation"], dataset["latest_relation"])
    if not dataset["base_relation"] or any(
        value is not None and not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value)
        for value in relations
    ):
        raise _error(RowsErrorCode.BAD_IDENTIFIER, "Unregistered relation identifier.")
    if any(not column or not isinstance(column, str) for column in _projection(dataset)):
        raise _error(RowsErrorCode.BAD_IDENTIFIER, "Invalid declared projection.")
    first = _parse_date(start)
    last = _parse_date(end)
    if dataset["kind"] == "reference" and (first or last):
        raise _error(RowsErrorCode.BAD_RANGE, "Reference records have no date window.")
    if first and last and first > last:
        raise _error(RowsErrorCode.BAD_RANGE, "start is after end.")
    if last == date.max:
        raise _error(RowsErrorCode.BAD_RANGE, "End date exceeds supported bounds.")
    dims = {dim["column"] for dim in dataset["dims"]}
    if group is not None and group not in dims:
        raise _error(RowsErrorCode.BAD_GROUP, "Group must be a declared dimension.")
    if group is None and dataset["kind"] == "series":
        group = next(
            (dim["column"] for dim in dataset["dims"] if dim["role"] == "series"),
            None,
        ) or next((dim["column"] for dim in dataset["dims"]), None)
    if filters is None:
        parsed: dict[str, str] = {}
        default = dataset["default_filter"]
        if default:
            parsed[default["column"]] = str(default["equals"])
    elif filters == [""]:
        parsed = {}
    else:
        if "" in filters:
            raise _error(RowsErrorCode.BAD_FILTER, "Empty filter cannot be combined.")
        parsed = {}
        for item in filters:
            if ":" not in item:
                raise _error(RowsErrorCode.BAD_FILTER, "Filter needs column:value.")
            column, value = item.split(":", 1)
            if column not in dims or not FILTER_VALUE.fullmatch(value) or column in parsed:
                raise _error(RowsErrorCode.BAD_FILTER, "Invalid or duplicate dimension filter.")
            parsed[column] = value
    if any(column not in dims for column in parsed):
        raise _error(RowsErrorCode.BAD_IDENTIFIER, "Default filter is not a dimension.")
    selected_columns = None
    if columns is not None:
        names = tuple(name.strip() for name in columns[0].split(",")) if len(columns) == 1 else ()
        if (
            not names
            or any(not name for name in names)
            or len(set(names)) != len(names)
            or any(name not in _projection(dataset) for name in names)
        ):
            raise _error(
                RowsErrorCode.BAD_COLUMNS,
                "Columns must be a non-empty, unique subset of the declared projection.",
            )
        selected_columns = names
    return Request(
        source,
        dataset,
        first,
        last,
        group,
        tuple(parsed.items()),
        filters is None,
        selected_columns,
    )


@dataclass(frozen=True)
class Metadata:
    relation: str | None
    types: dict[str, str]
    first_day: date | None
    last_day: date | None
    day_count: int | None
    rows: int
    cause: str | None = None


_cache: dict[tuple[str, str, str], tuple[float, Metadata]] = {}
_cache_lock = threading.Lock()


class _TempOperations:
    """Allow only request-owned TEMP DDL and interruption on the client's connection."""

    def __init__(self, connection: duckdb.DuckDBPyConnection, prefix: str) -> None:
        self._connection = connection
        self._prefix = prefix

    def create(self, name: str, selection: str) -> None:
        if not name.startswith(self._prefix) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
            raise ValueError("TEMP name is not owned by this rows request")
        if not selection.lstrip().upper().startswith(("SELECT ", "WITH ")) or ";" in selection:
            raise ValueError("TEMP creation requires one generated selection")
        self._connection.execute(f"CREATE TEMP TABLE {_quote(name)} AS {selection}")

    def drop(self, name: str) -> None:
        if not name.startswith(self._prefix) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
            raise ValueError("TEMP name is not owned by this rows request")
        self._connection.execute(f"DROP TABLE IF EXISTS temp.main.{_quote(name)}")

    def interrupt(self) -> None:
        self._connection.interrupt()


def _temp_operations(client: Any, prefix: str) -> _TempOperations:
    """Confine private installed-client access to this adapter factory."""
    return _TempOperations(client._require_con(), prefix)


def _query_timeout() -> RowsError:
    return _error(RowsErrorCode.QUERY_TIMEOUT, "Rows query exceeded its time limit.")


class _DeadlineClient:
    """Bound each database call by the shared monotonic request deadline."""

    def __init__(self, client: Any, deadline: float) -> None:
        self.client = client
        self.deadline = deadline
        self.prefix = "__rows_" + uuid.uuid4().hex + "_"
        self.operations = _temp_operations(client, self.prefix)

    def check(self) -> None:
        if time.monotonic() >= self.deadline:
            raise _query_timeout()

    def run(self, operation: Any, *, cleanup_budget: float | None = None) -> Any:
        remaining = self.deadline - time.monotonic() if cleanup_budget is None else cleanup_budget
        if remaining <= MIN_OPERATION_SECONDS:
            raise _query_timeout()
        timeout = min(ROWS_OPERATION_TIMEOUT_SECONDS, remaining)
        lock = threading.Lock()
        active = True
        expired = False
        stop = threading.Event()

        def interrupt() -> None:
            nonlocal expired
            with lock:
                if not active:
                    return
                expired = True
            while not stop.is_set():
                self.operations.interrupt()
                stop.wait(0.05)

        timer = threading.Timer(timeout, interrupt)
        timer.start()
        try:
            try:
                result = operation()
            except duckdb.InterruptException as exc:
                with lock:
                    timed_out = expired
                if timed_out:
                    raise _query_timeout() from exc
                raise
        finally:
            with lock:
                active = False
                timed_out = expired
            stop.set()
            timer.cancel()
            timer.join()
        if timed_out or (cleanup_budget is None and time.monotonic() >= self.deadline):
            raise _query_timeout()
        return result

    def query(self, sql: str) -> pl.DataFrame:
        return self.run(lambda: self.client.query(sql))

    def get_tables(self) -> list[str]:
        return self.run(self.client.get_tables)

    def create(self, name: str, sql: str) -> None:
        self.run(lambda: self.operations.create(name, sql))

    def drop(self, name: str, *, cleanup_budget: float | None = None) -> None:
        self.run(lambda: self.operations.drop(name), cleanup_budget=cleanup_budget)


class _SelectionScope:
    """Own reusable selections for one rows execution and clean them on exit."""

    def __init__(self, client: Any) -> None:
        self.client = client
        self.prefix = (
            client.prefix
            if isinstance(client, _DeadlineClient)
            else "__rows_" + uuid.uuid4().hex + "_"
        )
        self.owned: list[str] = []
        self.semantic: str | None = None
        self.semantic_key: tuple[str, dict[str, Any]] | None = None
        self.operations = (
            client if isinstance(client, _DeadlineClient) else _temp_operations(client, self.prefix)
        )

    def query(self, sql: str) -> pl.DataFrame:
        return self.client.query(sql)

    def get_tables(self) -> list[str]:
        return self.client.get_tables()

    def stage(self, sql: str) -> str:
        name = f"{self.prefix}{len(self.owned)}"
        self.owned.append(name)
        try:
            self.operations.create(name, sql)
        except duckdb.OutOfMemoryException:
            self.operations.drop(name)
            self.owned.pop()
            return sql
        return f"SELECT * FROM temp.main.{_quote(name)}"

    def selection(self, relation: str, dataset: dict[str, Any]) -> str:
        if self.semantic is None:
            selected = _selected_sql(relation, dataset)
            dedup = dataset["dedup"]
            if (dedup and dedup["order_by"]) or dataset["row_filter"] or dataset["snapshot_column"]:
                selected = self.stage(selected)
            self.semantic = selected
            self.semantic_key = (relation, dataset)
        elif self.semantic_key != (relation, dataset):
            raise ValueError("Rows selection reused with a different relation or dataset")
        return self.semantic

    def close(self, primary: BaseException | None = None) -> None:
        first_drop_error: duckdb.Error | None = None
        cleanup_deadline = time.monotonic() + 1
        names = list(reversed(self.owned))
        for index, name in enumerate(names):
            try:
                if isinstance(self.operations, _DeadlineClient):
                    self.operations.drop(name, cleanup_budget=cleanup_deadline - time.monotonic())
                else:
                    self.operations.drop(name)
            except RowsError:
                LOG.warning(
                    "Rows TEMP cleanup budget exhausted; leaving %s for connection close",
                    names[index:],
                )
                break
            except duckdb.Error as exc:
                LOG.exception("Failed to drop rows TEMP table %s", name)
                if first_drop_error is None:
                    first_drop_error = exc
        if primary is None and first_drop_error is not None:
            raise first_drop_error


def _cache_key(request: Request, config: str) -> tuple[str, str, str]:
    return (config, request.source, request.dataset["id"])


def cached_status(request: Request, config: str) -> Metadata | None:
    with _cache_lock:
        hit = _cache.get(_cache_key(request, config))
        if hit and time.monotonic() - hit[0] < TTL_SECONDS:
            return hit[1]
    return None


def _clock_kind(column: str, types: dict[str, str]) -> str | None:
    kind = types[column].upper()
    if kind == "DATE":
        return "date"
    if kind == "TIMESTAMPTZ" or "WITH TIME ZONE" in kind:
        return "aware"
    if kind.startswith("TIMESTAMP") and column.endswith("_utc"):
        return "naive_utc"
    return None


def _instant(column: str, types: dict[str, str]) -> str:
    name = _quote(column)
    return f"timezone('UTC', {name})" if _clock_kind(column, types) == "naive_utc" else name


def _uk_day(column: str, types: dict[str, str]) -> str:
    name = _instant(column, types)
    if _clock_kind(column, types) == "date":
        return name
    return f"CAST(timezone('Europe/London', {name}) AS DATE)"


def _selected_sql(relation: str, dataset: dict[str, Any]) -> str:
    """Retain every top ordered tie, then apply committed semantic selection."""
    sql = f"SELECT * FROM {_quote(relation)}"
    dedup = dataset["dedup"]
    if dedup and dedup["order_by"]:
        keys = ", ".join(_quote(key) for key in dedup["keys"])
        order = ", ".join(
            f"{_quote(item['column'])} {item['direction'].upper()} NULLS {item['nulls'].upper()}"
            for item in dedup["order_by"]
        )
        sql = (
            "SELECT * EXCLUDE (__rows_rank) FROM (SELECT *, rank() OVER "
            f"(PARTITION BY {keys} ORDER BY {order}) AS __rows_rank FROM "
            f"({sql}) AS before_dedup) AS ranked WHERE __rows_rank = 1"
        )
    row_filter = dataset["row_filter"]
    if row_filter:
        col = _quote(row_filter["column"])
        sql = f"SELECT * FROM ({sql}) AS mandatory WHERE {col} = {_literal(row_filter['equals'])}"
    snapshot = dataset["snapshot_column"]
    if snapshot:
        col = _quote(snapshot)
        sql = (
            f"SELECT * FROM ({sql}) AS snapshots WHERE {col} = "
            f"(SELECT max({col}) FROM ({sql}) AS all_snapshots)"
        )
    return sql


def _metadata(client: Any, request: Request, config: str) -> Metadata:
    hit = cached_status(request, config)
    if hit is not None:
        return hit
    dataset = request.dataset
    tables = set(client.get_tables())
    relation = dataset["latest_relation"]
    if not relation or relation not in tables:
        relation = dataset["base_relation"]
    types: dict[str, str] = {}
    if relation in tables:
        rows = client.query(
            "SELECT column_name, data_type FROM information_schema.columns "
            f"WHERE table_schema = 'main' AND table_name = {_literal(relation)}"
        ).to_dicts()
        types = {row["column_name"]: row["data_type"] for row in rows}
    missing = set(_projection(dataset)) - set(types)
    clocks = {_clock_column(dataset), dataset["latest_day_rule"]["column"]}
    if dataset["kind"] == "reference":
        clocks = {_clock_column(dataset)}
    unsupported = any(
        column in types and _clock_kind(column, types) is None for column in clocks if column
    )
    if relation not in tables or missing or unsupported:
        meta = Metadata(None, types, None, None, None, 0, "missing-in-catalogue")
    else:
        selected = (
            client.selection(relation, dataset)
            if isinstance(client, _SelectionScope)
            else _selected_sql(relation, dataset)
        )
        clock = _clock_column(dataset)
        day_sql = _uk_day(clock, types) if clock else "CAST(NULL AS DATE)"
        result = client.query(
            f"SELECT count(*) AS n, min({day_sql}) AS first_day, "
            f"max({day_sql}) AS last_day, count(DISTINCT {day_sql}) AS day_count "
            f"FROM ({selected}) AS covered"
        ).to_dicts()[0]
        meta = Metadata(
            relation,
            types,
            result["first_day"],
            result["last_day"],
            result["day_count"],
            result["n"],
        )
    with _cache_lock:
        if len(_cache) >= 256:
            _cache.clear()
        _cache[_cache_key(request, config)] = (time.monotonic(), meta)
    return meta


def _window(request: Request, meta: Metadata) -> tuple[date, date, datetime, datetime] | None:
    if request.dataset["kind"] == "reference":
        return None
    anchor = meta.last_day
    if isinstance(anchor, datetime):
        anchor = anchor.date()
    if request.end is None:
        if anchor is None:
            raise _error(RowsErrorCode.WINDOW_UNAVAILABLE, "Latest-day anchor is unavailable.")
        end = min(anchor, datetime.now(UTC).astimezone(LONDON).date())
    else:
        end = request.end
    try:
        start = request.start or end - timedelta(days=6)
        upper_day = end + timedelta(days=1)
    except OverflowError as exc:
        raise _error(RowsErrorCode.BAD_RANGE, "Default window overflows supported dates.") from exc
    if start > end:
        raise _error(RowsErrorCode.BAD_RANGE, "start is after resolved end.")
    elapsed = (end - start).days
    if elapsed > 400:
        if request.dataset["kind"] == "events":
            raise _error(RowsErrorCode.BAD_RANGE, "Event range exceeds 400 elapsed days.")
        if meta.first_day is None or meta.last_day is None:
            raise _error(RowsErrorCode.WINDOW_UNAVAILABLE, "Local clock depth is unavailable.")
        if start < meta.first_day or end > meta.last_day:
            raise _error(RowsErrorCode.BAD_RANGE, "Deep window exceeds local clock depth.")
    lower = datetime.combine(start, datetime.min.time(), LONDON).astimezone(UTC)
    upper = datetime.combine(upper_day, datetime.min.time(), LONDON).astimezone(UTC)
    return start, end, lower, upper


def _window_predicate(
    window: tuple[date, date, datetime, datetime], column: str, types: dict[str, str]
) -> str:
    start, end, lower, upper = window
    if _clock_kind(column, types) == "date":
        return f"{_quote(column)} BETWEEN DATE '{start}' AND DATE '{end}'"
    instant = _instant(column, types)
    return (
        f"{instant} >= TIMESTAMPTZ '{lower.isoformat()}' "
        f"AND {instant} < TIMESTAMPTZ '{upper.isoformat()}'"
    )


def _filter_sql(filters: tuple[tuple[str, str], ...], types: dict[str, str]) -> str:
    parts = [f"CAST({_quote(column)} AS VARCHAR) = {_literal(value)}" for column, value in filters]
    return " AND ".join(parts) if parts else "TRUE"


def _identity(dataset: dict[str, Any], clock: str | None) -> tuple[str, ...]:
    passthrough = set(dataset["clock"]["settlement_cols"]) if dataset["clock"] else set()
    dedup = dataset["dedup"]
    fields = {dim["column"] for dim in dataset["dims"]}
    if dedup:
        fields.update(dedup["keys"])
    return tuple(sorted(fields - passthrough - {clock}))


def _ambiguity(
    request: Request,
    varying: list[str],
    *,
    observation: bool = False,
    observed_group: Any = None,
) -> RowsError:
    dims = {dim["column"] for dim in request.dataset["dims"]}
    keys = set(request.dataset["dedup"]["keys"]) if request.dataset["dedup"] else set()
    varying_dims = sorted(set(varying) & dims) if not observation else []
    varying_keys = sorted(set(varying) & keys) if not observation else []
    hint = "Try a narrower date window."
    if varying_dims:
        preferred = next(
            (
                dim["column"]
                for dim in request.dataset["dims"]
                if dim["role"] == "series" and dim["column"] in varying_dims
            ),
            varying_dims[0],
        )
        hint = f"group={preferred}"
        if (
            request.group
            and request.group != preferred
            and observed_group is not None
            and FILTER_VALUE.fullmatch(str(observed_group))
        ):
            hint += f"&filter={request.group}:{observed_group}"
    elif observation:
        hint = "Try a clean date window; no declared filter resolves this instant."
    return _error(
        RowsErrorCode.AMBIGUOUS_SERIES,
        "Selected records do not identify one series.",
        group=request.group,
        varying_dimensions=varying_dims,
        varying_keys=varying_keys,
        varying_columns=sorted(varying),
        hint=hint,
    )


def _check_entity(client: Any, request: Request, sql: str, clock: str) -> None:
    identity = _identity(request.dataset, clock)
    determined = {column for column, _ in request.filters}
    if request.group:
        determined.add(request.group)
    row_filter = request.dataset["row_filter"]
    if row_filter:
        determined.add(row_filter["column"])
    if set(identity) <= determined:
        return
    group = _quote(request.group) if request.group else "NULL"
    cols = ", ".join(_quote(column) for column in identity)
    conflict = client.query(
        f"WITH selected AS ({sql}), identities AS "
        f"(SELECT DISTINCT {_quote(clock)} AS __native_clock, "
        f"{group} AS __native_group, {cols} FROM selected) "
        "SELECT __native_clock, __native_group FROM identities "
        "GROUP BY 1, 2 HAVING count(*) > 1 "
        "ORDER BY __native_clock, __native_group LIMIT 1"
    ).to_dicts()
    if conflict:
        raise _ambiguity(
            request,
            sorted(set(identity) - determined),
            observed_group=conflict[0]["__native_group"],
        )


def _byte_rows(frame: pl.DataFrame, columns: tuple[str, ...]) -> list[bytes]:
    return [
        frame.select(columns).slice(i, 1).write_ipc(None).getvalue() for i in range(frame.height)
    ]


def _native_collision_check(
    client: Any, request: Request, sql: str, clock: str, projection: tuple[str, ...]
) -> tuple[int, str]:
    group = _quote(request.group) if request.group else "NULL"
    key = f"{_quote(clock)}, {group}"
    repeated = (
        f"SELECT {key}, count(*) AS copies FROM ({sql}) AS selected "
        f"GROUP BY {key} HAVING count(*) > 1"
    )
    count = client.query(
        f"SELECT coalesce(sum(copies),0) AS n FROM ({repeated}) AS repeated"
    ).to_dicts()[0]["n"]
    if count > MAX_DUPLICATE_PROOF:
        raise _error(
            RowsErrorCode.RESULT_TOO_LARGE,
            "Too many duplicate candidates to verify.",
            reason="duplicate_verification_limit",
            hint="Narrow the date window or filter a dimension.",
        )
    if count:
        same = f"s.{_quote(clock)} IS NOT DISTINCT FROM r.{_quote(clock)}"
        if request.group:
            same += f" AND s.{group} IS NOT DISTINCT FROM r.{group}"
        cols = ", ".join(f"s.{_quote(column)}" for column in projection)
        frame = client.query(
            f"WITH s AS ({sql}), r AS ({repeated}) SELECT {cols} FROM s JOIN r ON {same}"
        )
        keys = [clock] + ([request.group] if request.group else [])
        signatures: dict[tuple[Any, ...], tuple[bytes, int]] = {}
        byte_rows = _byte_rows(frame, projection)
        key_rows = list(frame.select(keys).iter_rows())
        frame = frame[
            sorted(
                range(frame.height),
                key=lambda index: (
                    tuple(str(value) for value in key_rows[index]),
                    byte_rows[index],
                ),
            )
        ]
        byte_rows = _byte_rows(frame, projection)
        for index, (values, raw) in enumerate(
            zip(frame.select(keys).iter_rows(), byte_rows, strict=True)
        ):
            if (
                index % 256 == 0
                and isinstance(client, _SelectionScope)
                and isinstance(client.client, _DeadlineClient)
            ):
                client.client.check()
            if values in signatures and signatures[values][0] != raw:
                previous = signatures[values][1]
                varying = [
                    column
                    for column in projection
                    if _byte_rows(frame.select(column).slice(previous, 1), (column,))[0]
                    != _byte_rows(frame.select(column).slice(index, 1), (column,))[0]
                ]
                raise _ambiguity(request, varying, observation=True)
            signatures[values] = (raw, index)
        removed = int(count) - len(signatures)
    else:
        removed = 0
    if not count:
        distinct = f"SELECT {', '.join(_quote(c) for c in projection)} FROM ({sql}) AS checked"
    else:
        distinct = (
            f"SELECT DISTINCT {', '.join(_quote(c) for c in projection)} FROM ({sql}) AS checked"
        )
        if isinstance(client, _SelectionScope):
            distinct = client.stage(distinct)
    return removed, distinct


def _check_output_key(
    client: Any, request: Request, sql: str, clock: str, types: dict[str, str]
) -> None:
    group = _quote(request.group) if request.group else "NULL"
    instant = _instant(clock, types)
    collision = client.query(
        f"SELECT count(*) AS n FROM (SELECT epoch_ms({instant}) AS ts_ms, "
        f"{group} AS group_value, count(*) AS copies FROM ({sql}) AS native "
        "GROUP BY ts_ms, group_value HAVING count(*) > 1) AS collisions"
    ).to_dicts()[0]["n"]
    if collision:
        raise _ambiguity(request, [clock], observation=True)


def _check_bucket_identity(
    client: Any, request: Request, sql: str, clock: str, types: dict[str, str], width: int
) -> None:
    identity = _identity(request.dataset, clock)
    determined = {column for column, _ in request.filters}
    if request.group:
        determined.add(request.group)
    row_filter = request.dataset["row_filter"]
    if row_filter:
        determined.add(row_filter["column"])
    remaining = tuple(column for column in identity if column not in determined)
    if not remaining:
        return
    group = _quote(request.group) if request.group else "NULL"
    bucket = f"floor(epoch_ms({_instant(clock, types)}) / {width})"
    cols = ", ".join(_quote(column) for column in remaining)
    collisions = client.query(
        f"WITH entities AS (SELECT DISTINCT {bucket} AS bucket_id, "
        f"{group} AS group_value, {cols} FROM ({sql}) AS native) "
        "SELECT count(*) AS n FROM (SELECT bucket_id, group_value FROM entities "
        "GROUP BY bucket_id, group_value HAVING count(*) > 1) AS conflicts"
    ).to_dicts()[0]["n"]
    if collisions:
        raise _limit("mixed_identity", "Filter the varying entity fields before downsampling.")


def _serialize(value: Any, notes: list[str]) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and not math.isfinite(value):
        if "Nonfinite numeric values are shown as null." not in notes:
            notes.append("Nonfinite numeric values are shown as null.")
        return None
    if isinstance(value, (list, dict)):
        return str(value)
    return value


def _ts_ms(value: date | datetime) -> int:
    if isinstance(value, datetime):
        aware = value if value.tzinfo else value.replace(tzinfo=UTC)
    else:
        aware = datetime.combine(value, datetime.min.time(), UTC)
    return int(aware.timestamp() * 1000)


def _grain(dataset: dict[str, Any]) -> int | None:
    clock = dataset["clock"]
    return GRAINS.get(clock["grain"]) if clock else None


def _numeric_kind(kind: str) -> bool:
    normalized = kind.upper()
    return (
        normalized in NUMERIC_KINDS
        or re.fullmatch(r"DECIMAL\(\d+,\s*\d+\)", normalized) is not None
    )


def _limit(reason: str, hint: str) -> RowsError:
    return _error(
        RowsErrorCode.RESULT_TOO_LARGE,
        "Selected records have conflicting cadence or identity."
        if reason == "unsupported_cadence"
        else "Result exceeds the safe row limit.",
        reason=reason,
        hint=hint,
    )


def _record_rows(
    client: Any,
    sql: str,
    projection: tuple[str, ...],
    clock: str | None,
    kind: str,
    group: str | None = None,
) -> pl.DataFrame:
    if kind == "reference":
        order_columns = list(projection)
    else:
        order_columns = [column for column in (clock, group) if column in projection]
        order_columns.extend(column for column in projection if column not in order_columns)
    order = ", ".join(
        f"{_quote(column)} {'DESC' if kind == 'events' and column == clock else 'ASC'} NULLS LAST"
        for column in order_columns
    )
    return client.query(
        f"SELECT {', '.join(_quote(column) for column in projection)} "
        f"FROM ({sql}) AS final ORDER BY {order} LIMIT {MAX_RESPONSE_ROWS + 1}"
    )


def _top_pn(
    client: Any, sql: str, clock: str | None = None
) -> tuple[list[str], int, int, int, int]:
    ordered_clock = f" ORDER BY {_quote(clock)} ASC NULLS LAST" if clock else ""
    ranked = client.query(
        f"SELECT bm_unit_id, avg(level_to{ordered_clock}) "
        f"AS mean_level FROM ({sql}) AS observations "
        "WHERE bm_unit_id IS NOT NULL GROUP BY bm_unit_id "
        "ORDER BY mean_level DESC NULLS LAST, bm_unit_id ASC LIMIT 20"
    ).to_dicts()
    ids = [row["bm_unit_id"] for row in ranked]
    totals = client.query(
        f"SELECT count(*) AS n, count(DISTINCT bm_unit_id) AS groups, "
        f"count(*) FILTER (WHERE bm_unit_id IS NULL) AS null_rows "
        f"FROM ({sql}) AS observations"
    ).to_dicts()[0]
    total = totals["n"]
    selected = client.query(
        f"SELECT count(*) AS n FROM ({sql}) AS observations WHERE bm_unit_id IN "
        f"({', '.join(_literal(value) for value in ids) or 'NULL'})"
    ).to_dicts()[0]["n"]
    return ids, total, selected, totals["groups"], totals["null_rows"]


def _bucket_sql(sql: str, request: Request, meta: Metadata, clock: str, width: int) -> str:
    """Aggregate only after the native collision and identity gates."""
    instant = _instant(clock, meta.types)
    bucket = f"floor(epoch_ms({instant}) / {width}) * {width}"
    groups = f", {_quote(request.group)}" if request.group else ""
    select = [f"{bucket} AS bucket_ms{groups}"]
    by = f"bucket_ms{groups}"
    for value in request.dataset["values"]:
        column = value["column"]
        if _numeric_kind(meta.types[column]):
            select.append(
                f"avg({_quote(column)} ORDER BY {_quote(clock)} ASC NULLS LAST) AS {_quote(column)}"
            )
        else:
            select.append(
                f"CASE WHEN count(DISTINCT {_quote(column)}) <= 1 "
                f"THEN min({_quote(column)}) ELSE NULL END AS {_quote(column)}"
            )
    for col in request.dataset["clock"]["settlement_cols"]:
        select.append(
            f"CASE WHEN count(DISTINCT {_quote(col)}) <= 1 THEN min({_quote(col)}) "
            f"ELSE NULL END AS {_quote(col)}"
        )
    return f"SELECT {', '.join(select)} FROM ({sql}) AS native GROUP BY {by}"


def _varying_ancillary_columns(
    client: Any, sql: str, request: Request, meta: Metadata, clock: str, width: int
) -> list[str]:
    """Find nonnumeric measurements nulled by aggregation in any bucket."""
    columns = sorted(
        value["column"]
        for value in request.dataset["values"]
        if not _numeric_kind(meta.types[value["column"]])
    )
    if not columns:
        return []
    bucket = f"floor(epoch_ms({_instant(clock, meta.types)}) / {width})"
    group = _quote(request.group) if request.group else "NULL"
    counts = ", ".join(
        f"count(DISTINCT {_quote(column)}) > 1 AS {_quote(column)}" for column in columns
    )
    varied = ", ".join(
        f"coalesce(bool_or({_quote(column)}), false) AS {_quote(column)}" for column in columns
    )
    flags = client.query(
        f"SELECT {varied} FROM (SELECT {counts} FROM ({sql}) AS native "
        f"GROUP BY {bucket}, {group}) AS buckets"
    ).to_dicts()[0]
    return [column for column in columns if flags[column]]


def _memory_bytes(value: str) -> Decimal:
    """Parse DuckDB's normalized binary memory setting for policy comparison."""
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*([KMGTPE]?i?B)\s*", value, re.I)
    if match is None:
        raise RuntimeError(f"Unrecognized DuckDB memory_limit: {value!r}")
    unit = match.group(2).upper().replace("I", "")
    return Decimal(match.group(1)) * (Decimal(1024) ** "BKMGTPE".index(unit[0]))


def _configure_resources(client: Any) -> None:
    """Disable spill and cap memory without raising an existing lower limit.

    DuckDB applies temp_directory and memory_limit to the shared instance, not
    just this rows request. Other callers using that instance (including
    /api/sources, dataset transforms, and GridflowClient users) observe the
    no-spill and capped-memory settings even after this request's connection
    closes, until those settings are changed.
    """
    current = client.query("SELECT current_setting('memory_limit') AS memory_limit").to_dicts()[0][
        "memory_limit"
    ]
    lower_to_ceiling = _memory_bytes(current) > _memory_bytes(_ROWS_MEMORY_CEILING)
    memory_set = f" SET memory_limit={_literal(_ROWS_MEMORY_CEILING)};" if lower_to_ceiling else ""
    applied = client.query(
        f"SET temp_directory='';{memory_set} "
        "SELECT current_setting('temp_directory') AS temp_directory, "
        "current_setting('memory_limit') AS memory_limit"
    ).to_dicts()[0]
    expected = _ROWS_MEMORY_CEILING if lower_to_ceiling else current
    if applied["temp_directory"] != "" or _memory_bytes(applied["memory_limit"]) != _memory_bytes(
        expected
    ):
        raise RuntimeError(f"DuckDB rows resource policy was not applied: {applied!r}")


def execute(client: Any, request: Request, config: str) -> dict[str, Any]:
    """Execute one rows request with instance resource policy and owned TEMP stages."""
    bounded = _DeadlineClient(client, time.monotonic() + ROWS_REQUEST_TIMEOUT_SECONDS)
    _configure_resources(bounded)
    scope = _SelectionScope(bounded)
    try:
        result = _execute_selected(scope, request, config)
        bounded.check()
    except BaseException as primary:
        scope.close(primary)
        raise
    else:
        scope.close(None)
        return result


def _execute_selected(client: Any, request: Request, config: str) -> dict[str, Any]:
    dataset = request.dataset
    meta = _metadata(client, request, config)
    if meta.cause:
        raise _error(
            RowsErrorCode.UNKNOWN_DATASET,
            "Dataset schema is unavailable.",
            not_held_cause=meta.cause,
        )
    if not meta.relation:
        raise RuntimeError("Rows metadata has no relation")
    window = _window(request, meta)
    clock = _clock_column(dataset)
    projection = _projection(dataset)
    selected = client.selection(meta.relation, dataset)
    if request.filters:
        selected = (
            f"SELECT * FROM ({selected}) AS filtered "
            f"WHERE {_filter_sql(request.filters, meta.types)}"
        )
    if dataset["kind"] == "series" and clock:
        _check_entity(client, request, selected, clock)
    if window and clock:
        predicate = _window_predicate(window, clock, meta.types)
        selected = f"SELECT * FROM ({selected}) AS windowed WHERE {predicate}"
        selected = client.stage(selected)
    before_defaults = None
    reasons: list[dict[str, Any]] = []
    if request.use_defaults and dataset["default_filter"]:
        unfiltered = client.selection(meta.relation, dataset)
        predicate = _window_predicate(window, clock, meta.types) if window and clock else "TRUE"
        before_defaults = client.query(
            f"SELECT count(*) AS n FROM ({unfiltered}) AS before_defaults WHERE {predicate}"
        ).to_dicts()[0]["n"]
        after = client.query(
            f"SELECT count(*) AS n FROM ({selected}) AS after_defaults"
        ).to_dicts()[0]["n"]
        if before_defaults > after:
            reasons.append({"type": "default_filter", "omitted_rows": before_defaults - after})
    if dataset["kind"] == "series" and clock:
        selected_before_collapse = selected
        removed, selected = _native_collision_check(client, request, selected, clock, projection)
        if request.source == "elexon" and dataset["id"] == "pn" and request.use_defaults:
            ids, total, kept, total_groups, null_rows = _top_pn(client, selected, clock)
            before_defaults = total
            unit_filter = f"bm_unit_id IN ({', '.join(_literal(value) for value in ids) or 'NULL'})"
            if removed:
                selected_raw_top = (
                    f"SELECT * FROM ({selected_before_collapse}) AS top_units WHERE {unit_filter}"
                )
                removed, selected = _native_collision_check(
                    client, request, selected_raw_top, clock, projection
                )
            else:
                selected = f"SELECT * FROM ({selected}) AS top_units WHERE {unit_filter}"
                selected = client.stage(selected)
            if total > kept:
                reasons.append(
                    {
                        "type": "default_top_n",
                        "label": "top 20 units by mean notified end level",
                        "selected_ids": ids,
                        "omitted_rows": total - kept,
                        "omitted_groups": total_groups - len(ids),
                        "excluded_null_unit_rows": null_rows,
                    }
                )
        _check_output_key(client, request, selected, clock, meta.types)
        if removed:
            reasons.append({"type": "exact_duplicate_rows", "removed_rows": removed})
    count = client.query(f"SELECT count(*) AS n FROM ({selected}) AS final_count").to_dicts()[0][
        "n"
    ]
    filtered_count = count
    notes = list(dataset["notes"])
    if dataset["row_filter"]:
        row_filter = dataset["row_filter"]
        notes.append(
            f"Mandatory semantic filter includes only rows where "
            f"{row_filter['column']} equals {row_filter['equals']}."
        )
    if dataset["kind"] == "events" and dataset["id"].startswith("outages_"):
        notes.append("Rows coverage uses publication time; /api/sources uses its declared clock.")
    if dataset["kind"] != "reference":
        notes.append("Independent source and rows metadata caches can temporarily differ.")
    if clock and _clock_kind(clock, meta.types) == "date":
        notes.append(
            "DATE labels plot at UTC midnight; this is not a gas-day boundary or event instant."
        )
    grain = _grain(dataset) if dataset["kind"] == "series" else None
    native_grain = grain
    width = None
    frame: pl.DataFrame
    if dataset["kind"] == "series" and window and clock:
        start, end, lower, upper = window
        if grain is None:
            notes.append("Irregular or unrecognized cadence: stored timestamps are not gap-filled.")
        # Count the expanded grid before allocating it.
        groups = client.query(
            f"SELECT count(DISTINCT {_quote(request.group)}) AS n FROM ({selected}) AS groups"
            if request.group
            else f"SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS n FROM ({selected}) AS groups"
        ).to_dicts()[0]["n"]
        native_size = count
        if grain and groups:
            span_ms = int((upper - lower).total_seconds() * 1000)
            if grain >= GRAINS["1d"] and _clock_kind(clock, meta.types) == "aware":
                days = (end - start).days + 1
                native_size = groups * (math.ceil(days / 7) if grain == GRAINS["7d"] else days)
            else:
                native_size = groups * math.ceil(span_ms / grain)
        deep = (end - start).days > 400
        if native_size > MAX_RESPONSE_ROWS or deep:
            if not dataset["values"]:
                raise _limit("no_meaningful_aggregation", "Narrow the date window.")
            candidates = [
                size
                for size in (
                    900_000,
                    1_800_000,
                    3_600_000,
                    7_200_000,
                    14_400_000,
                    21_600_000,
                    43_200_000,
                )
                if (grain is None or size > grain and size % grain == 0)
            ]
            candidates.extend(day * 86_400_000 for day in range(1, 402))
            for candidate in candidates:
                client.client.check()
                if grain and (candidate <= grain or candidate % grain):
                    continue
                _check_bucket_identity(client, request, selected, clock, meta.types, candidate)
                bucket = _bucket_sql(selected, request, meta, clock, candidate)
                occupied = client.query(
                    f"SELECT count(*) AS n FROM ({bucket}) AS bucket_count"
                ).to_dicts()[0]["n"]
                expanded = (
                    groups * math.ceil(int((upper - lower).total_seconds() * 1000) / candidate)
                    if grain
                    else occupied
                )
                if expanded <= MAX_RESPONSE_ROWS and (grain or occupied < count):
                    varied_columns = _varying_ancillary_columns(
                        client, selected, request, meta, clock, candidate
                    )
                    width = candidate
                    selected = bucket
                    count = occupied
                    reasons.append({"type": "downsample", "bucket_ms": candidate})
                    if varied_columns:
                        reasons.append({"type": "ancillary_null", "columns": varied_columns})
                        notes.append(
                            "Varying nonnumeric values become null within downsampled buckets."
                        )
                    if deep:
                        reasons.append({"type": "deep_range"})
                    break
            if width is None:
                raise _limit("unsafe_downsample", "Narrow the date window or filter a dimension.")
        if width:
            frame = client.query(
                f"SELECT * FROM ({selected}) AS buckets ORDER BY bucket_ms ASC NULLS LAST"
                + (f", {_quote(request.group)} ASC NULLS LAST" if request.group else "")
                + " LIMIT 50001"
            )
            grain = width if native_grain is not None else None
        else:
            frame = _record_rows(client, selected, projection, clock, "series", request.group)
    else:
        if count > MAX_RESPONSE_ROWS:
            raise _limit("record_cap", "Narrow the date window or filter a dimension.")
        frame = _record_rows(client, selected, projection, clock, dataset["kind"], request.group)
    if frame.height > MAX_RESPONSE_ROWS:
        raise _limit("row_cap", "Narrow the date window or filter a dimension.")
    rows: list[dict[str, Any]] = []
    for item in frame.to_dicts():
        if len(rows) % 256 == 0:
            client.client.check()
        if width:
            ms = int(item.pop("bucket_ms"))
            item["ts"] = max(ms, _ts_ms(window[2])) if window else ms
        elif clock and clock in item:
            item["ts"] = _ts_ms(item[clock]) if item[clock] is not None else None
        rows.append({key: _serialize(value, notes) for key, value in item.items()})
    if dataset["kind"] == "series" and window and native_grain and grain and rows:
        lower_ms = _ts_ms(window[2])
        upper_ms = _ts_ms(window[3])
        calendar_cadence = (
            not width
            and dataset["clock"]["grain"] in {"1d", "24h", "7d"}
            and _clock_kind(clock, meta.types) == "aware"
        )
        phases_by_group: dict[Any, set[int]] = {}
        local_phases_by_group: dict[Any, set[Any]] = {}
        for row in rows:
            group_value = row.get(request.group) if request.group else None
            phases_by_group.setdefault(group_value, set()).add(row["ts"] % grain)
            if calendar_cadence:
                local = datetime.fromtimestamp(row["ts"] / 1000, UTC).astimezone(LONDON)
                phase = (
                    local.timetz().replace(tzinfo=None),
                    local.date().weekday() if grain == GRAINS["7d"] else None,
                )
                local_phases_by_group.setdefault(group_value, set()).add(phase)
        groups_seen = sorted(phases_by_group, key=lambda value: (value is None, str(value)))
        observed = {
            (row["ts"], row.get(request.group) if request.group else None): row for row in rows
        }
        expanded_rows = []
        for group_value in groups_seen:
            client.client.check()
            utc_phases = phases_by_group[group_value]
            use_local_grid = calendar_cadence and len(utc_phases) != 1
            if not width and len(utc_phases) == 1:
                phase = next(iter(utc_phases))
                first = lower_ms + (phase - lower_ms) % grain
                utc_grid = range(first, upper_ms, grain)
                if calendar_cadence:
                    weekly = grain == GRAINS["7d"]
                    counts: dict[date, int] = {}
                    for ts in utc_grid:
                        local_day = datetime.fromtimestamp(ts / 1000, UTC).astimezone(LONDON).date()
                        key = (
                            local_day - timedelta(days=local_day.weekday()) if weekly else local_day
                        )
                        counts[key] = counts.get(key, 0) + 1
                    if weekly:
                        local_phases = local_phases_by_group[group_value]
                        weekday = next(iter(local_phases))[1] if len(local_phases) == 1 else None
                        expected = (
                            {
                                day - timedelta(days=day.weekday())
                                for offset in range((window[1] - window[0]).days + 1)
                                if (day := window[0] + timedelta(days=offset)).weekday() == weekday
                            }
                            if weekday is not None
                            else set(counts)
                        )
                    else:
                        expected = {
                            window[0] + timedelta(days=offset)
                            for offset in range((window[1] - window[0]).days + 1)
                        }
                    use_local_grid = set(counts) != expected or any(
                        count != 1 for count in counts.values()
                    )
            if use_local_grid:
                phases = local_phases_by_group[group_value]
                if len(phases) != 1:
                    raise _limit(
                        "unsupported_cadence", "Filter the mixed identities or cadence phases."
                    )
                local_time, weekday = next(iter(phases))
                grid = []
                for offset in range((window[1] - window[0]).days + 1):
                    day = window[0] + timedelta(days=offset)
                    if weekday is not None and day.weekday() != weekday:
                        continue
                    local_point = datetime.combine(day, local_time, LONDON)
                    utc_point = local_point.astimezone(UTC)
                    if utc_point.astimezone(LONDON).replace(tzinfo=None) != datetime.combine(
                        day, local_time
                    ):
                        raise _limit(
                            "unsupported_cadence",
                            "Choose a window with an unambiguous local phase.",
                        )
                    grid.append(_ts_ms(utc_point))
                grid_points = set(grid)
                if any(ts not in grid_points for ts, group in observed if group == group_value):
                    raise _limit(
                        "unsupported_cadence", "Filter the mixed identities or cadence phases."
                    )
            elif width:
                first = lower_ms // grain * grain
                grid = (max(raw_ts, lower_ms) for raw_ts in range(first, upper_ms, grain))
            else:
                if len(utc_phases) != 1:
                    raise _limit(
                        "unsupported_cadence", "Filter the mixed identities or cadence phases."
                    )
                grid = utc_grid
            for ts in grid:
                if len(expanded_rows) % 256 == 0:
                    client.client.check()
                record = observed.get((ts, group_value))
                if record is None:
                    record = {"ts": ts}
                    if request.group:
                        record[request.group] = group_value
                    record.update({value["column"]: None for value in dataset["values"]})
                    record.update({col: None for col in dataset["clock"]["settlement_cols"]})
                expanded_rows.append(record)
                if len(expanded_rows) > MAX_RESPONSE_ROWS:
                    raise _limit("row_cap", "Narrow the date window or filter a dimension.")
        rows = sorted(
            expanded_rows,
            key=lambda row: (
                row["ts"],
                row.get(request.group) is None if request.group else True,
                str(row.get(request.group)) if request.group else "",
            ),
        )
    coverage = {
        "first_day": meta.first_day.isoformat() if meta.first_day else None,
        "last_day": meta.last_day.isoformat() if meta.last_day else None,
        "latest_local_day": min(
            meta.last_day, datetime.now(UTC).astimezone(LONDON).date()
        ).isoformat()
        if meta.last_day
        else None,
        "days_in_window": (window[1] - window[0]).days + 1 if window else None,
    }
    truncation = None
    if reasons:
        truncation = {
            "row_cap": MAX_RESPONSE_ROWS,
            "reasons": reasons,
            "rows_before_defaults": before_defaults,
            "rows_after_filters": filtered_count,
            "returned_rows": len(rows),
            "bucket_ms": width,
            "aggregation": "mean" if width else None,
        }
    if window and not rows and meta.rows:
        if meta.first_day and meta.last_day:
            notes.append(
                f"No rows in this window; held data runs {meta.first_day.isoformat()} "
                f"to {meta.last_day.isoformat()}."
            )
        else:
            notes.append("No rows in this window; the dataset has rows outside it.")
    result = {
        "dataset": dataset["id"],
        "source": request.source,
        "kind": dataset["kind"],
        "relation": meta.relation,
        "window": {
            "start": window[0].isoformat(),
            "end": window[1].isoformat(),
            "tz": "Europe/London",
        }
        if window
        else None,
        "grain_ms": grain,
        "columns": [
            {"column": value["column"], "unit": value["unit"], "label": value["label"]}
            for value in dataset["values"]
        ],
        "group": request.group,
        "filters": dict(request.filters),
        "rows": rows,
        "row_count": len(rows),
        "truncated": bool(reasons),
        "truncation": truncation,
        "coverage": coverage,
        "notes": notes,
    }
    if request.columns is not None:
        retained = set(request.columns)
        retained.add("ts")
        if request.group:
            retained.add(request.group)
        result["rows"] = [
            {key: value for key, value in row.items() if key in retained} for row in result["rows"]
        ]
        result["columns"] = [
            value for value in result["columns"] if value["column"] in request.columns
        ]
    return result
