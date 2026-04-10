from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path

from skill_manager.domain import fingerprint_package
from skill_manager.store import ManifestEntry, StoreManifest, write_manifest


@dataclass(frozen=True)
class FakeHomeSpec:
    root: Path
    home: Path
    xdg_config_home: Path
    xdg_data_home: Path

    @property
    def shared_store_root(self) -> Path:
        return self.xdg_data_home / "skill-manager" / "shared"

    @property
    def openclaw_home(self) -> Path:
        return self.home / ".openclaw"

    @property
    def openclaw_config(self) -> Path:
        return self.openclaw_home / "openclaw.json"

    @property
    def openclaw_workspace(self) -> Path:
        return self.openclaw_home / "workspace"

    @property
    def openclaw_managed_root(self) -> Path:
        return self.openclaw_home / "skills"

    @property
    def openclaw_cli_payload(self) -> Path:
        return self.openclaw_home / "skills-list.json"

    @property
    def bin_dir(self) -> Path:
        return self.root / "bin"

    @property
    def openclaw_cli(self) -> Path:
        return self.bin_dir / "openclaw"

    def env(self) -> dict[str, str]:
        return {
            "HOME": str(self.home),
            "XDG_CONFIG_HOME": str(self.xdg_config_home),
            "XDG_DATA_HOME": str(self.xdg_data_home),
            "SKILL_MANAGER_CODEX_ROOT": str(self.home / ".codex" / "skills"),
            "SKILL_MANAGER_CLAUDE_ROOT": str(self.home / ".claude" / "skills"),
            "SKILL_MANAGER_CURSOR_ROOT": str(self.home / ".cursor" / "skills"),
            "SKILL_MANAGER_OPENCODE_ROOT": str(self.xdg_config_home / "opencode" / "skills"),
            "SKILL_MANAGER_OPENCLAW_CONFIG": str(self.openclaw_config),
            "SKILL_MANAGER_OPENCLAW_CLI": str(self.openclaw_cli),
        }


def create_fake_home_spec(root: Path, *, seed_openclaw_state: bool = True) -> FakeHomeSpec:
    spec = FakeHomeSpec(
        root=root,
        home=root / "home",
        xdg_config_home=root / "config",
        xdg_data_home=root / "data",
    )
    for path in (
        spec.home / ".codex" / "skills",
        spec.home / ".claude" / "skills",
        spec.home / ".cursor" / "skills",
        spec.xdg_config_home / "opencode" / "skills",
        spec.shared_store_root,
    ):
        path.mkdir(parents=True, exist_ok=True)
    if seed_openclaw_state:
        for path in (
            spec.openclaw_workspace,
            spec.openclaw_managed_root,
            spec.bin_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)
        seed_openclaw_config(spec)
        seed_openclaw_cli_payload(spec)
        write_openclaw_cli_stub(spec)
    return spec


def seed_skill_package(
    root: Path,
    directory_name: str,
    declared_name: str,
    *,
    body: str = "",
    description: str | None = None,
    support_files: dict[str, str] | None = None,
    source_kind: str | None = None,
    source_locator: str | None = None,
) -> Path:
    package_root = root / directory_name
    package_root.mkdir(parents=True, exist_ok=True)
    frontmatter = ["---", f"name: {declared_name}"]
    if description is not None:
        frontmatter.append(f"description: {description}")
    if source_kind is not None:
        frontmatter.append(f"source_kind: {source_kind}")
    if source_locator is not None:
        frontmatter.append(f"source_locator: {source_locator}")
    frontmatter.append("---")
    skill_md = "\n".join(frontmatter + ["", f"# {declared_name}", "", body or "Bootstrap test fixture.", ""])
    (package_root / "SKILL.md").write_text(skill_md, encoding="utf-8")
    for relative_path, contents in (support_files or {}).items():
        target = package_root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(contents, encoding="utf-8")
    return package_root


def seed_builtin_catalog(path: Path, items: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"builtins": items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def seed_openclaw_config(
    spec: FakeHomeSpec,
    *,
    workspace: Path | None = None,
    extra_skill_dirs: list[Path] | None = None,
) -> None:
    payload = {
        "agents": {
            "defaults": {
                "workspace": str(workspace or spec.openclaw_workspace),
            }
        },
        "skills": {
            "load": {
                "extraDirs": [str(path) for path in (extra_skill_dirs or [])],
            }
        },
    }
    spec.openclaw_config.parent.mkdir(parents=True, exist_ok=True)
    spec.openclaw_config.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def seed_openclaw_cli_payload(
    spec: FakeHomeSpec,
    *,
    skills: list[dict[str, object]] | None = None,
    workspace: Path | None = None,
    managed_root: Path | None = None,
) -> None:
    payload = {
        "workspaceDir": str(workspace or spec.openclaw_workspace),
        "managedSkillsDir": str(managed_root or spec.openclaw_managed_root),
        "skills": skills or [],
    }
    spec.openclaw_cli_payload.parent.mkdir(parents=True, exist_ok=True)
    spec.openclaw_cli_payload.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_openclaw_cli_stub(spec: FakeHomeSpec) -> None:
    script = f"""#!/bin/sh
if [ "$1" = "skills" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  cat '{spec.openclaw_cli_payload}'
  exit 0
fi
if [ "$1" = "config" ] && [ "$2" = "file" ]; then
  printf '%s\\n' '{spec.openclaw_config}'
  exit 0
fi
echo "unsupported openclaw test command: $*" >&2
exit 1
"""
    spec.openclaw_cli.write_text(script, encoding="utf-8")
    spec.openclaw_cli.chmod(0o755)


def seed_store_manifest(spec: FakeHomeSpec, entries: list[ManifestEntry]) -> None:
    write_manifest(spec.shared_store_root.parent / "manifest.json", StoreManifest(entries=tuple(entries)))


def seed_malformed_shared_directory(spec: FakeHomeSpec, directory_name: str) -> None:
    broken = spec.shared_store_root / directory_name
    broken.mkdir(parents=True, exist_ok=True)
    (broken / "notes.txt").write_text("missing SKILL.md", encoding="utf-8")


def seed_mixed_fixture(spec: FakeHomeSpec) -> None:
    shared_audit = seed_skill_package(
        spec.shared_store_root,
        "shared-audit",
        "Shared Audit",
        body="Shared package fixture.",
        support_files={"assets/policy.txt": "shared-policy"},
    )
    seed_store_manifest(
        spec,
        [
            ManifestEntry(
                package_dir="shared-audit",
                declared_name="Shared Audit",
                source_kind="github",
                source_locator="github:mode-io/shared-audit",
                revision=_package_revision(shared_audit),
            )
        ],
    )

    shared_support = {"notes.md": "same bytes across harnesses"}
    seed_skill_package(spec.home / ".codex" / "skills", "trace-lens", "Trace Lens", body="trace", support_files=shared_support)
    seed_skill_package(spec.home / ".claude" / "skills", "trace-lens-copy", "Trace Lens", body="trace", support_files=shared_support)
    seed_skill_package(spec.xdg_config_home / "opencode" / "skills", "policy-kit", "Policy Kit", body="opencode policy")
    seed_builtin_catalog(
        spec.xdg_config_home / "opencode" / "builtins.json",
        [{"id": "builtin-opencode-review", "name": "Review Helper", "detail": "Bundled with OpenCode"}],
    )
    seed_openclaw_cli_payload(
        spec,
        skills=[
            {
                "id": "builtin-openclaw-observe",
                "name": "Observe",
                "source": "openclaw-bundled",
            }
        ],
    )

    seed_malformed_shared_directory(spec, "broken-shared")


def seed_divergent_source_fixture(spec: FakeHomeSpec) -> None:
    source_locator = "github:mode-io/policy-kit"
    seed_skill_package(
        spec.home / ".codex" / "skills",
        "policy-kit",
        "Policy Kit",
        body="policy from codex",
        source_kind="github",
        source_locator=source_locator,
    )
    seed_skill_package(
        spec.home / ".claude" / "skills",
        "policy-kit-copy",
        "Policy Kit",
        body="policy from claude",
        source_kind="github",
        source_locator=source_locator,
    )


def seed_shared_only_fixture(spec: FakeHomeSpec) -> None:
    """Shared store skill not linked to any harness — for testing enable flow."""
    shared_audit = seed_skill_package(
        spec.shared_store_root,
        "shared-audit",
        "Shared Audit",
        body="Shared package fixture.",
    )
    seed_store_manifest(
        spec,
        [
            ManifestEntry(
                package_dir="shared-audit",
                declared_name="Shared Audit",
                source_kind="github",
                source_locator="github:mode-io/shared-audit",
                revision=_package_revision(shared_audit),
            )
        ],
    )


def seed_managed_linked_fixture(spec: FakeHomeSpec) -> None:
    """Shared store skill linked into Codex — for testing managed detail locations."""
    seed_shared_only_fixture(spec)
    target = spec.shared_store_root / "shared-audit"
    codex_link = spec.home / ".codex" / "skills" / "shared-audit"
    codex_link.symlink_to(target)


def _package_revision(path: Path) -> str:
    revision, _ = fingerprint_package(path)
    return revision
