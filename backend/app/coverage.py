"""Per-dataset local-coverage computation for the `/coverage` route.

Answers "which days of the requested range are present locally" so the
frontend can say "N of M days missing" and offer the P3 fetch button.

**Tradeoff, stated:** this pulls the range's rows via the dataset's existing
SDK getter and takes distinct `settlement_date` values, rather than issuing a
narrow `SELECT DISTINCT settlement_date`. Accepted deliberately — it avoids
hardcoding gridflow's private relation names into the explorer, and this is
a local dev tool where the extra row-pull cost is immaterial.

**Limitation, stated not fixed:** a date with only *partial* rows (e.g. a
half-day of settlement periods) counts as present. Coverage answers "is
there anything for this day", not "is this day complete".
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import polars as pl
    from gridflow.serving.client import GridflowClient

    from app.catalogue import DatasetSpec

# Maps dataset_id -> the SDK call that returns a frame carrying a
# `settlement_date` column for that dataset. Both source frames used by P1's
# transforms (`get_fuel_generation`, `get_system_prices`) carry that column,
# so no new SDK surface is needed. A module-level dict, not a `DatasetSpec`
# field, per P3-PLAN.md ("DatasetSpec gains no new field") — keeps the
# catalogue frozen for the weekend.
_GETTERS: dict[str, Callable[[GridflowClient, date, date], pl.DataFrame]] = {
    "generation-mix": lambda client, start, end: client.get_fuel_generation(start, end),
    "system-prices": lambda client, start, end: client.get_system_prices(start, end),
}


def dataset_coverage(
    client: GridflowClient, spec: DatasetSpec, start: date, end: date
) -> dict[str, Any]:
    """Compute local coverage for one dataset over `[start, end]`.

    Args:
        client: A live `GridflowClient` (or test stand-in) to query.
        spec: The catalogue entry identifying which SDK getter to call.
        start: Inclusive requested range start.
        end: Inclusive requested range end.

    Returns:
        A dict matching the documented `/coverage` response shape:
        `dataset_id`, `requested` (`start`/`end`), `present_dates`,
        `missing_dates`, `missing_day_count`, `requested_day_count` — the
        first two lists as sorted ISO date strings.
    """
    getter = _GETTERS[spec.dataset_id]
    frame = getter(client, start, end)

    present: set[date] = set(frame["settlement_date"].unique().to_list()) if frame.height else set()

    requested_days = [start + timedelta(days=offset) for offset in range((end - start).days + 1)]
    missing_days = [day for day in requested_days if day not in present]
    present_days = sorted(day for day in present if start <= day <= end)

    return {
        "dataset_id": spec.dataset_id,
        "requested": {"start": start.isoformat(), "end": end.isoformat()},
        "present_dates": [day.isoformat() for day in present_days],
        "missing_dates": [day.isoformat() for day in missing_days],
        "missing_day_count": len(missing_days),
        "requested_day_count": len(requested_days),
    }
