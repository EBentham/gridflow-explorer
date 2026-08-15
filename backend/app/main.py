"""FastAPI application entrypoint.

Route mounting and the ``ApiError`` exception handler are added in T4, once
the dataset router exists. For now this exposes only a health probe so T1's
scaffold has something to verify end-to-end.
"""

from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="gridflow-explorer")


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness probe.

    Returns:
        A fixed status payload confirming the process is up.
    """
    return {"status": "ok"}
