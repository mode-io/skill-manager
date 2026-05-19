from __future__ import annotations

import logging
import re
from pathlib import Path

import frontmatter

from .models import Skill, SkillFile, SkillManifest

logger = logging.getLogger(__name__)

_FILE_TYPE_MAP: dict[str, str] = {
    ".py": "python",
    ".sh": "bash",
    ".bash": "bash",
    ".js": "javascript",
    ".ts": "typescript",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".md": "markdown",
    ".txt": "text",
    ".toml": "toml",
    ".cfg": "config",
    ".ini": "config",
    ".env": "env",
}

_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class SkillLoader:
    def load(self, skill_directory: str | Path) -> Skill:
        skill_directory = Path(skill_directory)
        if not skill_directory.is_dir():
            raise ValueError(f"Not a directory: {skill_directory}")

        skill_md = skill_directory / "SKILL.md"
        if skill_md.exists():
            manifest, instruction_body = self._parse_skill_md(skill_md)
        else:
            manifest = SkillManifest(name=skill_directory.name, description="(no description)")
            instruction_body = ""

        files = self._discover_files(skill_directory)
        referenced_files = self._extract_references(instruction_body)

        return Skill(
            directory=skill_directory,
            manifest=manifest,
            instruction_body=instruction_body,
            files=files,
            referenced_files=referenced_files,
        )

    def _parse_skill_md(self, path: Path) -> tuple[SkillManifest, str]:
        content = path.read_text(encoding="utf-8")
        try:
            post = frontmatter.loads(content)
            meta = post.metadata
            body = post.content
        except Exception:
            meta = {}
            body = content

        # Extract additional metadata beyond known fields
        known_keys = {"name", "description", "license", "compatibility", "allowed-tools", "allowed_tools"}
        extra_metadata = {k: v for k, v in meta.items() if k not in known_keys} if isinstance(meta, dict) else None

        return SkillManifest(
            name=str(meta.get("name", path.parent.name)),
            description=str(meta.get("description", "(no description)")),
            license=meta.get("license"),
            compatibility=meta.get("compatibility"),
            allowed_tools=meta.get("allowed-tools") or meta.get("allowed_tools"),
            metadata=extra_metadata or None,
        ), body

    def _discover_files(self, directory: Path) -> list[SkillFile]:
        files: list[SkillFile] = []
        root = directory.resolve()
        for path in sorted(directory.rglob("*")):
            if not path.is_file() or path.is_symlink():
                continue
            try:
                if not path.resolve().is_relative_to(root):
                    continue
            except (OSError, ValueError):
                continue
            rel_parts = path.relative_to(directory).parts
            if ".git" in rel_parts:
                continue

            relative_path = str(path.relative_to(directory))
            file_type = _FILE_TYPE_MAP.get(path.suffix.lower(), "other")
            size = path.stat().st_size
            content = None
            if size < _MAX_FILE_SIZE and file_type != "other":
                try:
                    content = path.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    file_type = "other"

            files.append(SkillFile(path=path, relative_path=relative_path, file_type=file_type, content=content, size_bytes=size))
        return files

    def _extract_references(self, body: str) -> list[str]:
        refs: list[str] = []
        for _, link in re.findall(r"\[([^\]]+)\]\(([^\)]+)\)", body):
            if not link.startswith(("http://", "https://", "#")) and ".." not in link and not link.startswith("/"):
                refs.append(link)
        return list(set(refs))
