from __future__ import annotations

from pathlib import Path
import sys


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def repo_frontend_dist() -> Path:
    return repo_root() / "frontend" / "dist"


def bundled_frontend_dist() -> Path | None:
    if getattr(sys, "frozen", False):
        bundle_root = Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
        candidate = bundle_root / "frontend_dist"
        if candidate.is_dir():
            return candidate
    package_candidate = Path(__file__).resolve().parents[1] / "web_dist"
    if package_candidate.is_dir():
        return package_candidate
    return None


def resolve_frontend_dist(frontend_dist: str | Path | None = None) -> Path | None:
    if frontend_dist is not None:
        candidate = Path(frontend_dist)
        return candidate if candidate.exists() and candidate.is_dir() else None

    candidates: list[Path] = []
    bundled = bundled_frontend_dist()
    if bundled is not None:
        candidates.append(bundled)
    candidates.append(repo_frontend_dist())

    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            return candidate
    return None
