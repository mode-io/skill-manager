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
        errors = exc.errors()
        if not errors:
            return JSONResponse(status_code=422, content={"error": "Invalid request."})
        first = errors[0]
        msg = first.get("msg", "Invalid request.") if isinstance(first, dict) else "Invalid request."
        loc = first.get("loc", ()) if isinstance(first, dict) else ()
        field_path = ".".join(str(part) for part in loc if part != "body")
        message = f"{field_path}: {msg}" if field_path else msg
        return JSONResponse(status_code=422, content={"error": message})
