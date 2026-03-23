from __future__ import annotations

from pathlib import Path

from skill_manager.domain import CheckIssue, SourceDescriptor, StoreScan, find_skill_roots, parse_skill_package

from .manifest import load_manifest


def default_shared_store_root(env: dict[str, str] | None = None) -> Path:
    active_env = env or {}
    home = Path(active_env.get("HOME", str(Path.home())))
    xdg_data_home = Path(active_env.get("XDG_DATA_HOME", home / ".local" / "share"))
    return xdg_data_home / "skill-manager" / "shared"


class SharedStore:
    def __init__(self, root: Path, manifest_path: Path | None = None) -> None:
        self.root = root
        self.manifest_path = manifest_path or root.parent / "manifest.json"

    def scan(self) -> StoreScan:
        manifest = load_manifest(self.manifest_path)
        manifest_index = {entry.package_dir: entry for entry in manifest.entries}
        packages = []
        for path in find_skill_roots(self.root):
            entry = manifest_index.get(path.name)
            source = SourceDescriptor(
                kind=entry.source_kind if entry else "shared-store",
                locator=entry.source_locator if entry else f"shared-store:{path.name}",
            )
            packages.append(parse_skill_package(path, default_source=source))
        return StoreScan(packages=tuple(packages), issues=tuple(issue.message for issue in self.check_integrity()))

    def check_integrity(self) -> tuple[CheckIssue, ...]:
        issues: list[CheckIssue] = []
        if not self.root.exists():
            return ()
        for path in sorted(self.root.iterdir()):
            if path.is_dir() and not (path / "SKILL.md").is_file():
                issues.append(
                    CheckIssue(
                        severity="error",
                        code="shared-missing-skill-md",
                        message=f"Shared package is missing SKILL.md: {path.name}",
                    )
                )
        return tuple(issues)
