from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from skill_manager.application import BackendContainer

from .errors import install_error_handlers
from .routers import health, marketplace, mcp, settings, skills, slash_commands


def create_app(
    container: BackendContainer,
    *,
    frontend_dist: Path | None = None,
) -> FastAPI:
    app = FastAPI(title="skill-manager", docs_url=None, redoc_url=None, openapi_url="/api/openapi.json")
    app.state.container = container
    app.state.frontend_dist = frontend_dist if frontend_dist is not None and frontend_dist.exists() else None
    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(settings.router)
    app.include_router(skills.router)
    app.include_router(slash_commands.router)
    app.include_router(marketplace.router)
    app.include_router(mcp.router)

    @app.get("/{full_path:path}", include_in_schema=False, response_model=None)
    def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"error": f"unknown api path: /{full_path}"})
        dist = app.state.frontend_dist
        if dist is None:
            return HTMLResponse("<html><body><h1>skill-manager</h1><p>Frontend build missing.</p></body></html>")

        requested = (dist / full_path).resolve() if full_path else dist / "index.html"
        dist_root = dist.resolve()
        if full_path and str(requested).startswith(str(dist_root)) and requested.exists() and requested.is_file():
            return FileResponse(requested)

        index_path = dist / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return HTMLResponse("<html><body><h1>skill-manager</h1><p>Frontend build missing.</p></body></html>", status_code=404)

    return app
