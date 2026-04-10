from __future__ import annotations

from pathlib import Path


def read_skill_document_markdown(package_root: Path | None) -> str | None:
    if package_root is None:
        return None

    skill_path = package_root / "SKILL.md"
    if not skill_path.is_file():
        return None

    document = skill_path.read_text(encoding="utf-8").strip()
    if not document:
        return None
    return strip_frontmatter(document)


def strip_frontmatter(document: str) -> str | None:
    lines = document.splitlines()
    if lines[:1] != ["---"]:
        return document.strip() or None

    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            return "\n".join(lines[index + 1:]).strip() or None

    return document.strip() or None
