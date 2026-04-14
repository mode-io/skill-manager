from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from skill_manager.errors import MarketplaceUpstreamError, MutationError


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def handle_http_error(_request: Request, exc: HTTPException) -> JSONResponse:
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(status_code=exc.status_code, content={"error": message})

    @app.exception_handler(MutationError)
    async def handle_mutation_error(_request: Request, exc: MutationError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content={"error": str(exc)})

    @app.exception_handler(MarketplaceUpstreamError)
    async def handle_marketplace_upstream_error(_request: Request, exc: MarketplaceUpstreamError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content={"error": str(exc)})

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        first_error = exc.errors()[0] if exc.errors() else None
        message = first_error.get("msg") if isinstance(first_error, dict) else "Invalid request."
        return JSONResponse(status_code=422, content={"error": message})
