"""The dataset catalogue: the registry of everything `/api/datasets` serves.

`DATASETS` is the single place series metadata lives — on the backend, this
is what makes "adding dataset N+1 = one config entry" true (the frontend's
matching seam is `screens/registry.ts`, added in T5).

`DatasetSpec.cli_source` / `cli_dataset` exist now, unused until P3's
subprocess runner maps a dataset to a `gridflow pipeline <source> <dataset>`
invocation — added here so P3 needs no catalogue migration. They are
internal only: `to_catalogue_entry` deliberately omits them (and `loader`)
from the JSON the frontend receives.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from app.errors import UnknownDataset
from app.transforms import load_generation_mix, load_system_prices

if TYPE_CHECKING:
    from datetime import date

    from gridflow.serving.client import GridflowClient

Loader = Callable[["GridflowClient", "date", "date"], list[dict[str, Any]]]


@dataclass(frozen=True)
class SeriesSpec:
    """One chart series: its record key and its display label.

    Attributes:
        key: The JSON key this series' values are stored under in each
            data record (snake_case).
        label: Human-readable label for legends/tooltips.
    """

    key: str
    label: str


@dataclass(frozen=True)
class DatasetSpec:
    """One entry in the dataset catalogue.

    Attributes:
        dataset_id: Kebab-case URL slug (not `id` — see the naming
            convention in P1-PLAN.md's "Locked conventions"). Serialized to
            JSON as `"id"` by `to_catalogue_entry`.
        title: Human-readable dataset title.
        description: One-sentence dataset description.
        chart: Suggested chart kind for the default screen (`"stacked-area"`
            or `"line"`).
        unit: Display unit for the dataset's values.
        default_range_days: Inclusive window size used when the caller
            omits `start`/`end`.
        timestamp_key: The record key holding the ISO-8601 timestamp.
        series: Series metadata in display (stacking) order.
        loader: Callable that fetches and reshapes records for a window.
        cli_source: The gridflow CLI source name for P3's fetch runner.
        cli_dataset: The gridflow CLI dataset name for P3's fetch runner.
    """

    dataset_id: str
    title: str
    description: str
    chart: str
    unit: str
    default_range_days: int
    timestamp_key: str
    series: tuple[SeriesSpec, ...]
    loader: Loader
    cli_source: str
    cli_dataset: str


DATASETS: dict[str, DatasetSpec] = {
    "generation-mix": DatasetSpec(
        dataset_id="generation-mix",
        title="Generation mix",
        description="Half-hourly GB generation by fuel type (Elexon FUELHH).",
        chart="stacked-area",
        unit="MW",
        default_range_days=7,
        timestamp_key="timestamp",
        series=(
            SeriesSpec("nuclear", "Nuclear"),
            SeriesSpec("wind", "Wind"),
            SeriesSpec("hydro", "Hydro"),
            SeriesSpec("biomass", "Biomass"),
            SeriesSpec("gas", "Gas"),
            SeriesSpec("gas_ocgt", "Gas (OCGT)"),
            SeriesSpec("coal", "Coal"),
            SeriesSpec("oil", "Oil"),
            SeriesSpec("pumped_storage", "Pumped Storage"),
            SeriesSpec("imports", "Imports"),
            SeriesSpec("other", "Other"),
        ),
        loader=load_generation_mix,
        cli_source="elexon",
        cli_dataset="fuelhh",
    ),
    "system-prices": DatasetSpec(
        dataset_id="system-prices",
        title="System prices",
        description="Elexon system sell/buy imbalance prices.",
        chart="line",
        unit="GBP/MWh",
        default_range_days=7,
        timestamp_key="timestamp",
        series=(
            SeriesSpec("system_sell_price", "Sell price"),
            SeriesSpec("system_buy_price", "Buy price"),
        ),
        loader=load_system_prices,
        cli_source="elexon",
        cli_dataset="system_prices",
    ),
}


def list_datasets() -> list[DatasetSpec]:
    """Return every catalogue entry, in declaration order.

    Returns:
        All `DatasetSpec`s currently registered.
    """
    return list(DATASETS.values())


def get_dataset(dataset_id: str) -> DatasetSpec:
    """Look up a catalogue entry by its URL slug.

    Args:
        dataset_id: The kebab-case dataset id from the route path.

    Returns:
        The matching `DatasetSpec`.

    Raises:
        UnknownDataset: `dataset_id` is not in the catalogue. The message
            lists the known ids.
    """
    try:
        return DATASETS[dataset_id]
    except KeyError:
        known = ", ".join(sorted(DATASETS))
        raise UnknownDataset(f"Unknown dataset '{dataset_id}'. Known datasets: {known}.") from None


def to_catalogue_entry(spec: DatasetSpec) -> dict[str, Any]:
    """Serialize a `DatasetSpec` into the `/api/datasets` JSON shape.

    Maps `dataset_id` -> `"id"` and omits the CLI-mapping fields and
    `loader`, which are internal to the backend (P1-PLAN.md "API contract").

    Args:
        spec: The catalogue entry to serialize.

    Returns:
        A JSON-serializable dict matching the documented `/api/datasets`
        entry shape.
    """
    return {
        "id": spec.dataset_id,
        "title": spec.title,
        "description": spec.description,
        "chart": spec.chart,
        "unit": spec.unit,
        "default_range_days": spec.default_range_days,
        "timestamp_key": spec.timestamp_key,
        "series": [{"key": s.key, "label": s.label} for s in spec.series],
    }
