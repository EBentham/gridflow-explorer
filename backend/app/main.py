"""FastAPI application entrypoint.

Mounts the dataset router, the P4 forecasts router, and the P3 jobs router,
and registers the single `ApiError` exception handler that implements the
API's authoritative error envelope (`{"error": {"code", "message"}}`,
P1-PLAN.md "Error shape"), built by `errors.error_envelope` — the same
helper the `/fetch` route's 409 path uses, so there remains exactly one
definition of the envelope shape.
Deliberately **no** catch-all handler is registered: any exception that is
not an `ApiError` must still surface as a genuine 500 rather than being
disguised as a coded error.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.errors import ApiError, error_envelope
from app.routers.datasets import router as datasets_router
from app.routers.forecasts import router as forecasts_router
from app.routers.jobs import router as jobs_router
from app.sources import router as sources_router

app = FastAPI(title="gridflow-explorer")
app.include_router(datasets_router)
app.include_router(forecasts_router)
app.include_router(jobs_router)
app.include_router(sources_router)


@app.exception_handler(ApiError)
def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
    """Render every `ApiError` as the authoritative error envelope.

    Args:
        request: The incoming request (required by FastAPI's handler
            signature; unused).
        exc: The raised `ApiError`, carrying its own `code`, `http_status`,
            and `message`.

    Returns:
        A `JSONResponse` with the mapped status and
        `{"error": {"code", "message"}}` body.
    """
    return JSONResponse(status_code=exc.http_status, content=error_envelope(exc.code, exc.message))


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness probe.

    Returns:
        A fixed status payload confirming the process is up.
    """
    return {"status": "ok"}
