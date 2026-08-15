"""Explorer-local settings.

`GridflowClient()` with no argument resolves its own DuckDB path through
gridflow's `load_settings()`, which loads gridflow's own repo `.env`
anchored to the gridflow package location — so it works regardless of our
cwd. We still pass the path explicitly (see `deps.client_ctx`) so the
explorer's own configuration is self-describing and testable independent of
gridflow's install location.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Explorer-local settings, loaded from `GRIDFLOW_EXPLORER_*` env vars.

    Attributes:
        duckdb_path: Explicit override for the gridflow catalogue path.
            `None` defers to gridflow's own resolution.
    """

    model_config = SettingsConfigDict(
        env_prefix="GRIDFLOW_EXPLORER_", env_file=".env", extra="ignore"
    )

    duckdb_path: Path | None = None


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide cached `Settings` instance.

    Returns:
        The single `Settings` instance for this process.
    """
    return Settings()
