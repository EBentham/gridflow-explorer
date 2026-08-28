"""Forecast queries + Polars-to-records transforms for `/api/forecasts/*`.

Forecasts are a sibling read surface to `app.transforms` (catalogue
datasets), not a `DatasetSpec`: a different query shape (one settlement
day, not a `[start, end]` range), a different response shape, and no
coverage/fetch semantics — gridflow_models, not this app, writes these
rows.

GOTCHA (shared with `transforms.py`): `GridflowClient` returns
``issued_at``/``delivery_time``/``written_at`` as tz-aware **Europe/London**
despite the ``_utc``-flavoured column names. Every forecast read path
converts them with ``dt.convert_time_zone("UTC")`` before serialization,
verified against a real BST settlement day (2025-07-12 period 1 delivers
at 2025-07-11 23:00 UTC, not 00:00) — see P4-forecast-screen-SPEC.md.

DEVIATION from the spec's assumption that ``GridflowClient.query(sql)``
takes bind parameters: it does not (``def query(self, sql: str) ->
pl.DataFrame``, verified against the installed `gridflow` package — no
`params` argument exists on the public client, and reaching into its
private connection would both violate "reuse `client_ctx()` unchanged"
in spirit and make the mandated supersession test unwritable against a
stub frame). Both loaders below therefore issue a **constant, predicate-free
SQL string** (`"SELECT * FROM gold_forecasts"` / `"... gold_forecast_metrics"`)
— there is nothing to interpolate, so "parameterised SQL only" holds
vacuously — and every predicate (day, model_id, vintage_policy_id,
supersession) is applied in Polars afterwards, mirroring `transforms.py`'s
existing precedent of doing all reshaping in Polars rather than SQL. The
store is small (tens of thousands of rows total), so a full-view pull per
request is cheap for this local single-user tool.

DEVIATION from the spec's `/metrics` shape: the store has no
``scope='overall'`` metric rows — only ``scope`` in {``run``, ``fold``}
(verified against the real catalogue). ``run``-scope rows are the closest
existing equivalent to "overall" and already carry every gate verdict in
today's data, so `variant_metrics` filters to ``scope == "run"`` OR a
non-null ``gate_passed``, per-Variant, rather than inventing an aggregate
that is not in the store.

RESOLVED CORRECTNESS DEFECT (previously documented here as an open
contradiction; ADR-057 sections 2 and 3 settle it, so this is a fix, not
a decision left to the reader): a single `model_id` can carry more than
one `vintage_policy_id` at once, and the two are genuinely different
producers, not redundant or stale copies of each other. ADR-057 section 2
states this plainly: "scoped by producer, not by supersession — the rows
already in the store are not wrong, they describe a different producer."
Verified on the real store — `day_ahead.lgbm_demand.v1` currently has two:
`v1_rolling_23h30m` (2022-01-31 through 2026-08-22, the pre-change
producer) and `v1_day_anchored_noon_d1` (2024-08-31 through 2026-08-22,
the producer after the issue-anchored feature change). ADR-057 section 3
puts `vintage_policy_id` into the supersession identity for exactly this
reason: two policies can legitimately share the same
`issued_at`/`delivery_time`, and without `vintage_policy_id` in the key,
supersession would silently shadow one genuinely different forecast with
another — a collision that is now realised in this store.

**A Variant, as this screen means it, is therefore `(model_id,
vintage_policy_id)` — not `model_id` alone.** `list_variants`,
`day_forecast`, and `variant_metrics` all partition on the pair: two
Variants are listed today, `/day` records carry `vintage_policy_id` so
the two policies' rows are always separable, and `/metrics` groups per
pair so one policy's gates are never attributed to the other.
"""

from __future__ import annotations

import re
from datetime import date
from typing import TYPE_CHECKING, Any

import polars as pl

from app.errors import UnknownVariant

if TYPE_CHECKING:
    from collections.abc import Sequence

    from gridflow.serving.client import GridflowClient

# ADR-057 section 6's row-level supersession identity: the raw
# `gold_forecasts` view applies no resolution at all (a plain glob with no
# QUALIFY), so after any re-issue it returns superseded rows alongside
# current ones. This partition key, tie-broken by `written_at` then
# `run_id` (both DESC, newest wins), is the exact rule verbatim.
_SUPERSESSION_KEY: tuple[str, ...] = (
    "model_id",
    "vintage_kind",
    "vintage_policy_id",
    "issued_at",
    "delivery_time",
)

# A Variant's identity for this screen (see module docstring's RESOLVED
# note): `model_id` alone is not enough — two `vintage_policy_id`s can and
# do coexist under one `model_id`, describing different producers.
_VARIANT_KEY: tuple[str, ...] = ("model_id", "vintage_policy_id")

# The seven quantile columns carried on every `gold_forecasts` row, matched
# by a `q_0` prefix so a future quantile level (e.g. `q_0.01`) flows through
# `day_forecast`'s response without a code change.
_QUANTILE_PREFIX = "q_0"

_DAY_RESPONSE_COLUMNS: tuple[str, ...] = (
    "model_id",
    "vintage_policy_id",
    "delivery_time",
    "settlement_period",
    "actual",
)

_METRICS_RESPONSE_COLUMNS: tuple[str, ...] = (
    "model_id",
    "vintage_policy_id",
    "run_id",
    "metric_kind",
    "scope",
    "metric_name",
    "metric_value",
    "gate_passed",
    "gate_threshold",
    "gate_message",
    "train_size",
    "valid_size",
    "n_folds",
    "gates_passed",
    "perfect_prog_caveat",
)

_VARIANT_RESPONSE_COLUMNS: tuple[str, ...] = (
    "model_id",
    "title",
    "vintage_kind",
    "vintage_policy_id",
    "perfect_prog_caveat",
    "run_id",
    "written_at",
    "gates_passed",
    "first_settlement_date",
    "last_settlement_date",
    "n_days",
)

# Strips a leading `v<digits>_` version token before deriving a policy
# label — the version is already carried in the model's own title, so
# repeating it in the policy label would be redundant noise.
_VERSION_PREFIX_RE = re.compile(r"^v\d+_")


def _title_for(model_id: str) -> str:
    """Derive a readable label from a dotted `model_id`.

    E.g. ``"day_ahead.lgbm_demand.v1"`` -> ``"Day Ahead · Lgbm Demand · V1"``.
    Cosmetic only — not stored, not covered by a gate.

    Args:
        model_id: The raw dotted model identifier.

    Returns:
        A human-readable title.
    """
    parts = model_id.split(".")
    return " · ".join(part.replace("_", " ").title() for part in parts)


def _policy_label_for(vintage_policy_id: str) -> str:
    """Derive a readable label from a `vintage_policy_id`.

    Same mechanical derivation as `_title_for` (split on separators,
    title-case, rejoin), minus a redundant leading version token. E.g.
    ``"v1_day_anchored_noon_d1"`` -> ``"Day Anchored Noon D1"``. Cosmetic
    only — not stored, not covered by a gate.

    Args:
        vintage_policy_id: The raw vintage policy identifier.

    Returns:
        A human-readable label.
    """
    stripped = _VERSION_PREFIX_RE.sub("", vintage_policy_id)
    label = " ".join(part.title() for part in stripped.split("_") if part)
    return label or vintage_policy_id


def _variant_title_for(model_id: str, vintage_policy_id: str) -> str:
    """Derive a Variant's display title from its `(model_id, vintage_policy_id)` pair.

    E.g. ``("day_ahead.lgbm_demand.v1", "v1_day_anchored_noon_d1")`` ->
    ``"Day Ahead · Lgbm Demand · V1 -- Day Anchored Noon D1"``.

    Args:
        model_id: The raw dotted model identifier.
        vintage_policy_id: The raw vintage policy identifier.

    Returns:
        A human-readable Variant title.
    """
    return f"{_title_for(model_id)} -- {_policy_label_for(vintage_policy_id)}"


def _load_forecasts(client: GridflowClient) -> pl.DataFrame:
    """Load the full `gold_forecasts` view with timestamps converted to UTC.

    No SQL predicate is applied (see module docstring's DEVIATION note) —
    every filter downstream is a Polars operation.

    Args:
        client: A live `GridflowClient` (or test stand-in) to query.

    Returns:
        The raw frame, `issued_at`/`delivery_time`/`written_at` converted
        to genuine UTC. Empty (zero rows) when the store holds no forecasts.
    """
    raw = client.query("SELECT * FROM gold_forecasts")
    if raw.height == 0:
        return raw
    return raw.with_columns(
        pl.col("issued_at").dt.convert_time_zone("UTC"),
        pl.col("delivery_time").dt.convert_time_zone("UTC"),
        pl.col("written_at").dt.convert_time_zone("UTC"),
    )


def _load_metrics(client: GridflowClient) -> pl.DataFrame:
    """Load the full `gold_forecast_metrics` view with `written_at` in UTC.

    Args:
        client: A live `GridflowClient` (or test stand-in) to query.

    Returns:
        The raw frame, `written_at` converted to genuine UTC. Empty (zero
        rows) when the store holds no metrics.
    """
    raw = client.query("SELECT * FROM gold_forecast_metrics")
    if raw.height == 0:
        return raw
    return raw.with_columns(pl.col("written_at").dt.convert_time_zone("UTC"))


def _supersede(forecasts: pl.DataFrame) -> pl.DataFrame:
    """Apply ADR-057 section 6's row-level supersession rule.

    Equivalent to::

        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY model_id, vintage_kind, vintage_policy_id,
                         issued_at, delivery_time
            ORDER BY written_at DESC, run_id DESC
        ) = 1

    Verified byte-for-byte against that SQL on the real catalogue (60,477
    raw rows -> 42,129 superseded rows, identical row set either way).
    `vintage_policy_id` is part of the partition key deliberately (ADR-057
    section 3): two policies can share an `issued_at`/`delivery_time`, and
    without it in the key one producer's forecast would silently shadow
    the other's.

    Args:
        forecasts: The raw (unsuperseded) `gold_forecasts` frame, tz-converted.

    Returns:
        One row per `_SUPERSESSION_KEY`, the newest by
        `(written_at, run_id)` descending.
    """
    if forecasts.height == 0:
        return forecasts
    return forecasts.sort(["written_at", "run_id"], descending=True).unique(
        subset=list(_SUPERSESSION_KEY), keep="first", maintain_order=True
    )


def list_variants(client: GridflowClient) -> list[dict[str, Any]]:
    """List every forecast Variant present, from its newest run.

    A Variant is `(model_id, vintage_policy_id)` — see module docstring's
    RESOLVED note. Two `vintage_policy_id`s under one `model_id` yield two
    entries, each with its own `first_settlement_date`/`last_settlement_date`/
    `n_days`, since those spans genuinely differ per producer.

    Args:
        client: A live `GridflowClient` (or test stand-in) to query.

    Returns:
        One dict per distinct `(model_id, vintage_policy_id)` pair (see
        module `_VARIANT_RESPONSE_COLUMNS` for keys), or `[]` when the
        store holds no forecasts.
    """
    forecasts = _supersede(_load_forecasts(client))
    if forecasts.height == 0:
        return []

    day_stats = forecasts.group_by(list(_VARIANT_KEY)).agg(
        pl.col("settlement_date").min().alias("first_settlement_date"),
        pl.col("settlement_date").max().alias("last_settlement_date"),
        pl.col("settlement_date").n_unique().alias("n_days"),
    )

    metrics = _load_metrics(client)
    metrics_cols = [
        "model_id",
        "vintage_policy_id",
        "run_id",
        "written_at",
        "vintage_kind",
        "perfect_prog_caveat",
        "gates_passed",
    ]
    if metrics.height:
        newest_run = (
            metrics.sort("written_at", descending=True)
            .unique(subset=list(_VARIANT_KEY), keep="first", maintain_order=True)
            .select(metrics_cols)
        )
    else:
        # WHY: an explicit empty-but-typed frame (rather than skipping the
        # join) so `day_stats.join(..., how="left")` always has the
        # expected columns to fill with nulls, even if forecasts exist
        # with no matching metrics rows (a training run that failed to
        # write metrics) — an edge case not observed on the real store but
        # one this join must not crash on.
        newest_run = pl.DataFrame(
            schema={
                "model_id": pl.String,
                "vintage_policy_id": pl.String,
                "run_id": pl.String,
                "written_at": pl.Datetime(time_unit="us", time_zone="UTC"),
                "vintage_kind": pl.String,
                "perfect_prog_caveat": pl.Boolean,
                "gates_passed": pl.Boolean,
            }
        )

    joined = day_stats.join(newest_run, on=list(_VARIANT_KEY), how="left")
    joined = joined.with_columns(
        pl.col("first_settlement_date").cast(pl.String),
        pl.col("last_settlement_date").cast(pl.String),
        pl.col("written_at").dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    joined = joined.sort(list(_VARIANT_KEY))

    records = joined.to_dicts()
    for record in records:
        record["title"] = _variant_title_for(record["model_id"], record["vintage_policy_id"])
    return [{key: record[key] for key in _VARIANT_RESPONSE_COLUMNS} for record in records]


def day_forecast(
    client: GridflowClient,
    day: date,
    model_ids: Sequence[str] | None,
    vintage_policy_ids: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    """Return one record per settlement period of `day`, per requested Variant.

    A Variant is `(model_id, vintage_policy_id)` — see module docstring's
    RESOLVED note. `model_ids` and `vintage_policy_ids` combine with AND:
    both omitted means every Variant present; either given narrows on that
    dimension only.

    Args:
        client: A live `GridflowClient` (or test stand-in) to query.
        day: The settlement day to return.
        model_ids: Zero or more `model_id`s to restrict to; `None` or empty
            means every `model_id` present.
        vintage_policy_ids: Zero or more `vintage_policy_id`s to restrict
            to; `None` or empty means every policy present.

    Returns:
        `[]` for a valid day with no matching rows (the empty state) — see
        `UnknownVariant` for the distinct "this value does not exist" case.
        Each record carries `vintage_policy_id`, so two policies under one
        `model_id` are always separable.

    Raises:
        UnknownVariant: One or more requested `model_ids`/`vintage_policy_ids`
            is not present anywhere in the store.
    """
    forecasts = _supersede(_load_forecasts(client))
    known_model_ids = set(forecasts["model_id"].unique().to_list()) if forecasts.height else set()
    known_policy_ids = (
        set(forecasts["vintage_policy_id"].unique().to_list()) if forecasts.height else set()
    )

    unknown: list[str] = []
    if model_ids:
        unknown.extend(sorted(set(model_ids) - known_model_ids))
    if vintage_policy_ids:
        unknown.extend(sorted(set(vintage_policy_ids) - known_policy_ids))
    if unknown:
        raise UnknownVariant(f"Unknown model_id/vintage_policy_id value(s): {', '.join(unknown)}.")

    if forecasts.height == 0:
        return []

    day_rows = forecasts.filter(pl.col("settlement_date") == day)
    if model_ids:
        day_rows = day_rows.filter(pl.col("model_id").is_in(list(model_ids)))
    if vintage_policy_ids:
        day_rows = day_rows.filter(pl.col("vintage_policy_id").is_in(list(vintage_policy_ids)))
    if day_rows.height == 0:
        return []

    quantile_cols = [c for c in day_rows.columns if c.startswith(_QUANTILE_PREFIX)]
    day_rows = day_rows.sort(["model_id", "vintage_policy_id", "settlement_period"]).with_columns(
        pl.col("delivery_time").dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    )
    columns = [*_DAY_RESPONSE_COLUMNS, *quantile_cols]
    return day_rows.select(columns).to_dicts()


def variant_metrics(
    client: GridflowClient,
    model_ids: Sequence[str] | None,
    vintage_policy_ids: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    """Return the newest run's metrics for each requested (or every) Variant.

    A Variant is `(model_id, vintage_policy_id)` — see module docstring's
    RESOLVED note; grouping the newest run per `model_id` alone would
    attribute one policy's gates to the other. See also module DEVIATION
    note: the store has no `scope='overall'` rows, so this returns
    `scope == "run"` rows plus every row carrying a gate verdict
    (`gate_passed` non-null) — identical sets in today's data.

    Args:
        client: A live `GridflowClient` (or test stand-in) to query.
        model_ids: Zero or more `model_id`s to restrict to; `None` or empty
            means every `model_id` present.
        vintage_policy_ids: Zero or more `vintage_policy_id`s to restrict
            to; `None` or empty means every policy present.

    Returns:
        `[]` when the store holds no metrics, or no metrics match the
        requested filters.
    """
    metrics = _load_metrics(client)
    if metrics.height == 0:
        return []

    if model_ids:
        metrics = metrics.filter(pl.col("model_id").is_in(list(model_ids)))
    if vintage_policy_ids:
        metrics = metrics.filter(pl.col("vintage_policy_id").is_in(list(vintage_policy_ids)))
    if metrics.height == 0:
        return []

    newest_run_ids = (
        metrics.sort("written_at", descending=True)
        .unique(subset=list(_VARIANT_KEY), keep="first", maintain_order=True)
        .select([*_VARIANT_KEY, "run_id"])
    )
    newest = metrics.join(newest_run_ids, on=[*_VARIANT_KEY, "run_id"], how="inner")
    newest = newest.filter((pl.col("scope") == "run") | pl.col("gate_passed").is_not_null())
    newest = newest.sort([*_VARIANT_KEY, "metric_name"])
    return newest.select(list(_METRICS_RESPONSE_COLUMNS)).to_dicts()
