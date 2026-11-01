"""The registry behind the two pinned screens' `/api/datasets/{id}/*` routes.

Each entry maps a URL slug to its loader, its default window and the
`gridflow pipeline <source> <dataset>` the fetch runner invokes. Display
labels live in the frontend; the dataset pages list datasets from
`/api/sources`.
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
class DatasetSpec:
    """One entry in the dataset catalogue.

    Attributes:
        dataset_id: Kebab-case URL slug (not `id` — see the naming
            convention in P1-PLAN.md's "Locked conventions").
        default_range_days: Inclusive window size used when the caller
            omits `start`/`end`.
        loader: Callable that fetches and reshapes records for a window.
        cli_source: The gridflow CLI source name for P3's fetch runner.
        cli_dataset: The gridflow CLI dataset name for P3's fetch runner.
    """

    dataset_id: str
    default_range_days: int
    loader: Loader
    cli_source: str
    cli_dataset: str


DATASETS: dict[str, DatasetSpec] = {
    "generation-mix": DatasetSpec(
        dataset_id="generation-mix",
        default_range_days=7,
        loader=load_generation_mix,
        cli_source="elexon",
        cli_dataset="fuelhh",
    ),
    "system-prices": DatasetSpec(
        dataset_id="system-prices",
        default_range_days=7,
        loader=load_system_prices,
        cli_source="elexon",
        cli_dataset="system_prices",
    ),
}


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
