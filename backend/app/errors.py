"""The API's single authoritative error contract.

Every handled non-2xx response from this API has the shape
``{"error": {"code": <machine_code>, "message": <human sentence>}}``. That
mapping is implemented once, as an ``@app.exception_handler(ApiError)`` in
``main.py`` (added in T4). This module only defines the codes and the
exception hierarchy that carries them.

Deliberately not handled here: any exception that is *not* an ``ApiError``.
A schema drift, a SQL bug, or a corrupt catalogue must surface as a genuine
500 rather than being disguised as one of these four coded outcomes.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    """Machine-readable error codes for the API's error envelope."""

    UNKNOWN_DATASET = "unknown_dataset"
    BAD_RANGE = "bad_range"
    CATALOGUE_MISSING = "catalogue_missing"
    REFRESH_IN_PROGRESS = "refresh_in_progress"


class ApiError(Exception):
    """Base class for every coded, handled API error.

    Attributes:
        code: Machine-readable error code from `ErrorCode`.
        http_status: HTTP status the exception handler should respond with.
        message: Human-readable sentence returned in the error envelope.
    """

    code: ErrorCode
    http_status: int

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class UnknownDataset(ApiError):
    """Raised when a requested `dataset_id` is not in the catalogue."""

    code = ErrorCode.UNKNOWN_DATASET
    http_status = 404


class BadRange(ApiError):
    """Raised for an unparseable date, `start > end`, or a span > 400 days."""

    code = ErrorCode.BAD_RANGE
    http_status = 422


class CatalogueMissing(ApiError):
    """Raised when `GridflowClient` construction raises `FileNotFoundError`."""

    code = ErrorCode.CATALOGUE_MISSING
    http_status = 503


class RefreshInProgress(ApiError):
    """Raised when a fetch job is running or DuckDB reports a locked file.

    The `/data` route always answers 503 for this. The P3 `/fetch` route
    answers 409 for the same code — that status choice lives with the
    route, not with this exception, since the same error can mean two
    different things depending on which endpoint hit it.
    """

    code = ErrorCode.REFRESH_IN_PROGRESS
    http_status = 503


def error_envelope(code: ErrorCode, message: str) -> dict[str, Any]:
    """Build the API's single `{"error": {"code", "message"}}` envelope.

    The one definition of this shape (P3-PLAN.md "Only two additions to
    shipped code"). `main.py`'s `handle_api_error` uses it for every
    `ApiError`, and the P3 `/fetch` route's 409 path (a job already running,
    which is not itself an `ApiError` raise — `try_start` returns `None`)
    uses the same helper so there remains exactly one envelope shape in the
    codebase.

    Args:
        code: Machine-readable error code.
        message: Human-readable sentence.

    Returns:
        `{"error": {"code": code, "message": message}}`.
    """
    return {"error": {"code": code, "message": message}}
