from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from skill_manager.application.skills.manifest import (
    SkillStoreEntry,
    SkillStoreManifest,
    write_skill_store_manifest,
)
from skill_manager.application.skills.package import fingerprint_package


@dataclass(frozen=True)
class FakeHomeSpec:
    root: Path
    home: Path
    xdg_config_home: Path
    xdg_data_home: Path

    @property
    def skills_store_root(self) -> Path:
        return self.xdg_data_home / "skill-manager" / "shared"

    @property
    def codex_root(self) -> Path:
        return self.home / ".agents" / "skills"

    @property
    def codex_legacy_root(self) -> Path:
        return self.home / ".codex" / "skills"

    @property
    def claude_root(self) -> Path:
        return self.home / ".claude" / "skills"

    @property
    def cursor_root(self) -> Path:
        return self.home / ".cursor" / "skills"

    @property
    def opencode_root(self) -> Path:
        return self.xdg_config_home / "opencode" / "skills"

    @property
    def openclaw_home(self) -> Path:
        return self.home / ".openclaw"

    @property
    def openclaw_managed_root(self) -> Path:
        return self.openclaw_home / "skills"

    @property
    def bin_dir(self) -> Path:
        return self.root / "bin"

    def env(self) -> dict[str, str]:
        return {
            "HOME": str(self.home),
            "XDG_CONFIG_HOME": str(self.xdg_config_home),
            "XDG_DATA_HOME": str(self.xdg_data_home),
            "PATH": str(self.bin_dir),
        }


def create_fake_home_spec(root: Path, *, seed_openclaw_state: bool = True) -> FakeHomeSpec:
    spec = FakeHomeSpec(
        root=root,
        home=root / "home",
        xdg_config_home=root / "config",
        xdg_data_home=root / "data",
    )
    for path in (
        spec.skills_store_root,
        spec.codex_root,
        spec.codex_legacy_root,
        spec.claude_root,
        spec.cursor_root,
        spec.opencode_root,
        spec.openclaw_managed_root,
        spec.bin_dir,
    ):
        path.mkdir(parents=True, exist_ok=True)

    for executable in ("codex", "claude", "cursor-agent", "opencode"):
        write_cli_stub(spec.bin_dir / executable, executable)
    if seed_openclaw_state:
        write_cli_stub(spec.bin_dir / "openclaw", "openclaw")
    return spec


def write_cli_stub(path: Path, executable: str) -> None:
    script = f"""#!/bin/sh
printf '%s\\n' '{executable}'
"""
    path.write_text(script, encoding="utf-8")
    path.chmod(0o755)


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


def seed_store_manifest(spec: FakeHomeSpec, entries: list[SkillStoreEntry]) -> None:
    write_skill_store_manifest(
        spec.skills_store_root.parent / "manifest.json",
        SkillStoreManifest(entries=tuple(entries)),
    )


def seed_malformed_shared_directory(spec: FakeHomeSpec, directory_name: str) -> None:
    broken = spec.skills_store_root / directory_name
    broken.mkdir(parents=True, exist_ok=True)
    (broken / "notes.txt").write_text("missing SKILL.md", encoding="utf-8")


def seed_mixed_fixture(spec: FakeHomeSpec) -> None:
    shared_audit = seed_skill_package(
        spec.skills_store_root,
        "shared-audit",
        "Shared Audit",
        body="Shared package fixture.",
        support_files={"assets/policy.txt": "shared-policy"},
    )
    seed_store_manifest(
        spec,
        [
            SkillStoreEntry(
                package_dir="shared-audit",
                declared_name="Shared Audit",
                source_kind="github",
                source_locator="github:mode-io/shared-audit",
                revision=_package_revision(shared_audit),
            )
        ],
    )

    shared_support = {"notes.md": "same bytes across harnesses"}
    seed_skill_package(spec.codex_legacy_root, "trace-lens", "Trace Lens", body="trace", support_files=shared_support)
    seed_skill_package(spec.claude_root, "trace-lens-copy", "Trace Lens", body="trace", support_files=shared_support)
    seed_skill_package(spec.opencode_root, "policy-kit", "Policy Kit", body="opencode policy")

    seed_malformed_shared_directory(spec, "broken-shared")


def seed_divergent_source_fixture(spec: FakeHomeSpec) -> None:
    source_locator = "github:mode-io/policy-kit"
    seed_skill_package(
        spec.codex_legacy_root,
        "policy-kit",
        "Policy Kit",
        body="policy from codex",
        source_kind="github",
        source_locator=source_locator,
    )
    seed_skill_package(
        spec.claude_root,
        "policy-kit-copy",
        "Policy Kit",
        body="policy from claude",
        source_kind="github",
        source_locator=source_locator,
    )


def seed_shared_only_fixture(spec: FakeHomeSpec) -> None:
    shared_audit = seed_skill_package(
        spec.skills_store_root,
        "shared-audit",
        "Shared Audit",
        body="Shared package fixture.",
    )
    seed_store_manifest(
        spec,
        [
            SkillStoreEntry(
                package_dir="shared-audit",
                declared_name="Shared Audit",
                source_kind="github",
                source_locator="github:mode-io/shared-audit",
                revision=_package_revision(shared_audit),
            )
        ],
    )


def seed_managed_linked_fixture(spec: FakeHomeSpec) -> None:
    seed_shared_only_fixture(spec)
    target = spec.skills_store_root / "shared-audit"
    codex_link = spec.codex_root / "shared-audit"
    codex_link.symlink_to(target)


def _package_revision(path: Path) -> str:
    revision, _ = fingerprint_package(path)
    return revision
