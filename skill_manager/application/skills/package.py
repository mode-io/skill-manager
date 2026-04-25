from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path

from .identity import SkillRef, SourceDescriptor


class SkillParseError(ValueError):
    """Raised when a skill folder cannot be parsed safely."""


@dataclass(frozen=True)
class SkillManifest:
    declared_name: str
    description: str
    source_kind: str | None
    source_locator: str | None


@dataclass(frozen=True)
class SkillPackage:
    declared_name: str
    description: str
    root_path: Path
    resolved_path: Path
    relative_files: tuple[str, ...]
    revision: str
    source: SourceDescriptor

    @property
    def ref(self) -> SkillRef:
        return SkillRef(source=self.source, declared_name=self.declared_name)


def find_skill_roots(root: Path) -> tuple[Path, ...]:
    if not root.exists() or not root.is_dir():
        return ()
    return tuple(sorted(path for path in root.iterdir() if path.is_dir() and (path / "SKILL.md").is_file()))


def fingerprint_package(root: Path) -> tuple[str, tuple[str, ...]]:
    if not root.is_dir():
        raise SkillParseError(f"skill root does not exist: {root}")
    digest = hashlib.sha256()
    relative_files: list[str] = []
    for path in sorted(candidate for candidate in root.rglob("*") if candidate.is_file()):
        if path.name == ".DS_Store":
            continue
        relative_path = path.relative_to(root).as_posix()
        relative_files.append(relative_path)
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    if "SKILL.md" not in relative_files:
        raise SkillParseError(f"missing SKILL.md in {root}")
    return digest.hexdigest(), tuple(relative_files)


def parse_skill_package(root: Path, *, default_source: SourceDescriptor) -> SkillPackage:
    skill_path = root / "SKILL.md"
    if not skill_path.is_file():
        raise SkillParseError(f"missing SKILL.md in {root}")
    content = skill_path.read_text(encoding="utf-8")
    manifest = parse_skill_manifest_text(content)
    fingerprint, relative_files = fingerprint_package(root)
    source = _resolve_source(
        {
            "source_kind": manifest.source_kind or "",
            "source_locator": manifest.source_locator or "",
        },
        default_source=default_source,
    )
    return SkillPackage(
        declared_name=manifest.declared_name,
        description=manifest.description,
        root_path=root,
        resolved_path=root.resolve(),
        relative_files=relative_files,
        revision=fingerprint,
        source=source,
    )


def parse_skill_manifest_text(document: str) -> SkillManifest:
    metadata = _parse_frontmatter(document)
    return SkillManifest(
        declared_name=_extract_declared_name(document, metadata),
        description=_normalize_metadata_scalar(metadata.get("description", "")),
        source_kind=_optional_metadata_value(metadata, "source_kind"),
        source_locator=_optional_metadata_value(metadata, "source_locator"),
    )


def _resolve_source(metadata: dict[str, str], *, default_source: SourceDescriptor) -> SourceDescriptor:
    source_kind = metadata.get("source_kind", "").strip()
    source_locator = metadata.get("source_locator", "").strip()
    if source_kind and source_locator:
        return SourceDescriptor(kind=source_kind, locator=source_locator)
    return default_source


def _extract_declared_name(document: str, metadata: dict[str, str]) -> str:
    if metadata.get("name", "").strip():
        return _normalize_metadata_scalar(metadata["name"])
    for raw_line in document.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    raise SkillParseError("unable to determine declared skill name")


def _parse_frontmatter(document: str) -> dict[str, str]:
    lines = document.splitlines()
    metadata: dict[str, str] = {}
    if lines[:1] != ["---"]:
        return metadata
    i = 1
    while i < len(lines):
        raw_line = lines[i]
        if raw_line.strip() == "---":
            break
        if ":" not in raw_line:
            i += 1
            continue
        key, value = raw_line.split(":", 1)
        value = value.strip()
        # Handle YAML block scalars (>-, >, |, |-)
        if value in (">-", ">", "|", "|-"):
            join_char = " " if value.startswith(">") else "\n"
            continuation: list[str] = []
            i += 1
            while i < len(lines):
                cont_line = lines[i]
                if cont_line.strip() == "---":
                    break
                if cont_line and not cont_line[0].isspace():
                    break
                continuation.append(cont_line.strip())
                i += 1
            value = join_char.join(part for part in continuation if part)
        else:
            value = _normalize_metadata_scalar(value)
            i += 1
        metadata[key.strip()] = value
    return metadata


def _optional_metadata_value(metadata: dict[str, str], key: str) -> str | None:
    value = _normalize_metadata_scalar(metadata.get(key, ""))
    return value or None


def _normalize_metadata_scalar(value: str) -> str:
    normalized = value.strip()
    if len(normalized) >= 2 and normalized[0] == normalized[-1] and normalized[0] in {"'", '"'}:
        return normalized[1:-1].strip()
    return normalized
