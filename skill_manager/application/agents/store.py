from __future__ import annotations

import re
from pathlib import Path

from skill_manager.atomic_files import atomic_write_text
from skill_manager.errors import MutationError

from .model import AgentDefinition, AgentIssue, AgentParseError
from .parser import parse_agent_file, render_agent_document

_SLUG_SAFE = re.compile(r"[^a-z0-9._-]+")


def slugify(name: str) -> str:
    slug = _SLUG_SAFE.sub("-", name.strip().lower()).strip("-.")
    if not slug:
        raise MutationError(f"cannot derive a file name from {name!r}")
    return slug


class AgentStore:
    """The agents Skill Manager owns: flat ``<slug>.md`` files under ``agents_root``."""

    def __init__(self, agents_root: Path) -> None:
        self.agents_root = agents_root

    def path_for(self, slug: str) -> Path:
        if slug != Path(slug).name or slug in {"", ".", ".."}:
            raise MutationError(f"unsafe agent ref: {slug!r}")
        return self.agents_root / f"{slug}.md"

    def scan(self) -> tuple[tuple[AgentDefinition, ...], tuple[AgentIssue, ...]]:
        agents: list[AgentDefinition] = []
        issues: list[AgentIssue] = []
        if not self.agents_root.is_dir():
            return (), ()
        for path in sorted(self.agents_root.glob("*.md")):
            try:
                agents.append(parse_agent_file(path))
            except AgentParseError as error:
                issues.append(AgentIssue(name=path.stem, reason=str(error)))
        return tuple(agents), tuple(issues)

    def get(self, slug: str) -> AgentDefinition | None:
        path = self.path_for(slug)
        if not path.is_file():
            return None
        try:
            return parse_agent_file(path)
        except AgentParseError:
            return None

    def exists(self, slug: str) -> bool:
        return self.path_for(slug).is_file()

    def create(
        self, *, name: str, description: str, prompt: str, tools: tuple[str, ...] = ()
    ) -> AgentDefinition:
        slug = slugify(name)
        path = self.path_for(slug)
        if path.exists():
            raise MutationError(f"an agent named {slug} already exists")
        self.agents_root.mkdir(parents=True, exist_ok=True)
        atomic_write_text(
            path,
            render_agent_document(
                name=name, description=description, prompt=prompt, tools=tools
            ),
        )
        return parse_agent_file(path)

    def update(
        self,
        slug: str,
        *,
        name: str | None = None,
        description: str | None = None,
        prompt: str | None = None,
        tools: tuple[str, ...] | None = None,
    ) -> AgentDefinition:
        current = self.get(slug)
        if current is None:
            raise MutationError(f"agent not found: {slug}")
        atomic_write_text(
            current.path,
            render_agent_document(
                name=name if name is not None else current.name,
                description=description if description is not None else current.description,
                prompt=prompt if prompt is not None else current.prompt,
                tools=tools if tools is not None else current.tools,
                # Carry the original frontmatter forward so keys we do not interpret
                # (model, permissionMode, hooks, …) survive the edit.
                base_metadata=current.metadata,
            ),
        )
        return parse_agent_file(current.path)

    def write_raw(self, slug: str, document: str) -> None:
        """Adopt path: keep the harness file's bytes verbatim rather than re-rendering."""
        self.agents_root.mkdir(parents=True, exist_ok=True)
        atomic_write_text(self.path_for(slug), document)

    def delete(self, slug: str) -> None:
        path = self.path_for(slug)
        if not path.exists():
            raise MutationError(f"agent not found: {slug}")
        if path.is_symlink():
            raise MutationError(f"refusing to delete a symlink in the store: {path}")
        path.unlink()


__all__ = ["AgentStore", "slugify"]
