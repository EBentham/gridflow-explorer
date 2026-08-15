"""Server-side Polars transforms: gridflow long/wide frames -> Recharts records.

These pipelines run once, here, and never in React (P1-PLAN.md "Data
transforms"). Both loaders return a bare ``list[dict[str, Any]]`` matching
the `loader: Callable[[GridflowClient, date, date], list[dict[str, Any]]]`
signature declared in `catalogue.py`.

GOTCHA carried through both pipelines: `GridflowClient` returns
``timestamp_utc`` as tz-aware **Europe/London** despite the column name —
it MUST be converted to genuine UTC before serialization
(`dt.convert_time_zone("UTC")`), or summer-time rows silently ship an hour
wrong.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import polars as pl

if TYPE_CHECKING:
    from datetime import date

    from gridflow.serving.client import GridflowClient

logger = logging.getLogger(__name__)

# Raw Elexon FUELHH `fuel_type` -> display series key. `INT*` interconnector
# codes are NOT enumerated here — they are matched by prefix (see
# `load_generation_mix`) so a new interconnector code still lands in
# "imports" without a catalogue/map change. Anything not in this map (and
# not `INT*`) falls into "other" via `replace_strict`'s `default=`.
FUEL_TO_SERIES: dict[str, str] = {
    "NUCLEAR": "nuclear",
    "WIND": "wind",
    "NPSHYD": "hydro",
    "BIOMASS": "biomass",
    "CCGT": "gas",
    "OCGT": "gas_ocgt",
    "COAL": "coal",
    "OIL": "oil",
    "PS": "pumped_storage",
    "OTHER": "other",
}

# The 11 display series, in stacking (bottom-to-top) order — matches the
# `generation-mix` `DATASETS` entry in `catalogue.py`. Declared independently
# rather than imported from there: `catalogue.py` imports the loaders from
# this module, so importing back would be circular. Both lists are read from
# the same P1-PLAN.md table and are exercised together by `test_transforms.py`.
GENERATION_SERIES_KEYS: tuple[str, ...] = (
    "nuclear",
    "wind",
    "hydro",
    "biomass",
    "gas",
    "gas_ocgt",
    "coal",
    "oil",
    "pumped_storage",
    "imports",
    "other",
)


def load_generation_mix(client: GridflowClient, start: date, end: date) -> list[dict[str, Any]]:
    """Load and reshape `generation-mix` records for the given window.

    Pipeline (P1-PLAN.md "generation-mix", exact order):
        0. Drop exact duplicate `(settlement_date, settlement_period,
           fuel_type)` rows (see WHY comment below on the vintage-collapse
           gap this does NOT cover).
        1. Map `fuel_type` -> `series_key`, vectorized: `INT*` prefix ->
           "imports"; else `FUEL_TO_SERIES` lookup, defaulting to "other".
        2. Warn once (not drop) on any unrecognised, non-`INT*` code.
        3. Group by `(timestamp_utc, series_key)`, summing `generation_mw`.
        4. Convert `timestamp_utc` from Europe/London to real UTC.
        5. Pivot wide on `series_key`.
        6. Backfill any declared series key absent from the pivot with `0.0`.
        7. `fill_null(0.0)` — Recharts stacked areas misrender on gaps.
        8. Format `timestamp_utc` as a `Z`-suffixed ISO-8601 string, vectorized.
        9. Sort ascending by timestamp, then emit `to_dicts()`.

    Args:
        client: A live `GridflowClient` (or test stand-in) to query.
        start: Inclusive settlement-date range start.
        end: Inclusive settlement-date range end.

    Returns:
        One dict per timestamp, with `timestamp` plus all 11
        `GENERATION_SERIES_KEYS`, every declared key present and non-null.
    """
    raw = client.get_fuel_generation(start, end)

    # WHY: silver_elexon_fuelhh is APPEND_ONLY and carries exact duplicate
    # rows at backfill chunk boundaries (same settlement_date/period/
    # fuel_type, same generation_mw) — without dropping them the group_by
    # sum below double-counts, showing as ~2x needle spikes on the chart.
    # This can only drop EXACT duplicates, not select the latest of two
    # differing vintages: GridflowClient.get_fuel_generation() (client.py,
    # `_present_bitemporal_exclude_clause` with no `retain=`) strips the
    # `available_at` vintage column before this frame ever arrives here, and
    # there is no `silver_elexon_fuelhh_latest` view (unlike system_prices,
    # `("elexon", "fuelhh")` has no LATEST_VIEW_SPECS entry). A future
    # re-publication with a different generation_mw for the same key would
    # still need an upstream fix (retain `available_at` on the client call,
    # or add a fuelhh latest-view spec) before it can be vintage-collapsed
    # here.
    if raw.height:
        raw = raw.unique(
            subset=["settlement_date", "settlement_period", "fuel_type"], keep="any"
        )

    fuel_codes = set(raw["fuel_type"].unique().to_list()) if raw.height else set()
    unknown = {
        code for code in fuel_codes if not code.startswith("INT") and code not in FUEL_TO_SERIES
    }
    if unknown:
        logger.warning("Unrecognised fuel_type codes falling into 'other': %s", sorted(unknown))

    mapped = raw.with_columns(
        pl.when(pl.col("fuel_type").str.starts_with("INT"))
        .then(pl.lit("imports"))
        .otherwise(pl.col("fuel_type").replace_strict(FUEL_TO_SERIES, default="other"))
        .alias("series_key")
    )

    grouped = mapped.group_by("timestamp_utc", "series_key").agg(pl.col("generation_mw").sum())
    grouped = grouped.with_columns(pl.col("timestamp_utc").dt.convert_time_zone("UTC"))

    pivoted = grouped.pivot(on="series_key", index="timestamp_utc", values="generation_mw")

    missing_keys = [key for key in GENERATION_SERIES_KEYS if key not in pivoted.columns]
    if missing_keys:
        pivoted = pivoted.with_columns([pl.lit(0.0).alias(key) for key in missing_keys])
    pivoted = pivoted.select(["timestamp_utc", *GENERATION_SERIES_KEYS])

    pivoted = pivoted.fill_null(0.0)

    pivoted = pivoted.with_columns(
        pl.col("timestamp_utc").dt.strftime("%Y-%m-%dT%H:%M:%SZ").alias("timestamp")
    )
    pivoted = pivoted.sort("timestamp_utc")

    return pivoted.select(["timestamp", *GENERATION_SERIES_KEYS]).to_dicts()


def load_system_prices(client: GridflowClient, start: date, end: date) -> list[dict[str, Any]]:
    """Load and reshape `system-prices` records for the given window.

    `get_system_prices` already returns a wide frame, so this only selects
    the declared columns, converts Europe/London to real UTC, formats the
    timestamp, sorts, and emits `to_dicts()` (P1-PLAN.md "system-prices").

    Args:
        client: A live `GridflowClient` (or test stand-in) to query.
        start: Inclusive settlement-date range start.
        end: Inclusive settlement-date range end.

    Returns:
        One dict per timestamp with `timestamp`, `system_sell_price`,
        `system_buy_price`, and `net_imbalance_volume`.
    """
    raw = client.get_system_prices(start, end)

    selected = raw.select(
        ["timestamp_utc", "system_sell_price", "system_buy_price", "net_imbalance_volume"]
    )
    selected = selected.with_columns(pl.col("timestamp_utc").dt.convert_time_zone("UTC"))
    selected = selected.with_columns(
        pl.col("timestamp_utc").dt.strftime("%Y-%m-%dT%H:%M:%SZ").alias("timestamp")
    )
    selected = selected.sort("timestamp_utc")

    return selected.select(
        ["timestamp", "system_sell_price", "system_buy_price", "net_imbalance_volume"]
    ).to_dicts()
