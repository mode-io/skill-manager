from __future__ import annotations

from pathlib import Path
from typing import Callable

from .adapters import AgentHarnessAdapter, parse_codex_agent
from .model import (
    AgentBinding,
    AgentDetail,
    AgentEntry,
    AgentHarnessDetail,
    AgentInventory,
    AgentIssue,
    AgentParseError,
    AgentTarget,
)
from .parser import parse_agent_file
from .store import AgentStore

TargetResolver = Callable[[], tuple[tuple[AgentTarget, ...], dict[str, AgentHarnessAdapter]]]


class AgentInventoryService:
    """Reads the agents inventory.

    Targets are resolved **per call**, not cached at construction: the user can
    enable or disable a harness in Settings at any time, and the matrix has to follow
    immediately, exactly as the skills read model does.
    """

    def __init__(self, store: AgentStore, resolve: TargetResolver) -> None:
        self.store = store
        self._resolve = resolve

    @property
    def targets(self) -> tuple[AgentTarget, ...]:
        return self._resolve()[0]

    @property
    def adapters(self) -> dict[str, AgentHarnessAdapter]:
        return self._resolve()[1]

    def build(self) -> AgentInventory:
        targets, adapters = self._resolve()
        managed, issues = self.store.scan()
        issue_list = list(issues)

        entries = [
            self._managed_entry(targets, adapters, agent.slug, agent.name, agent.description)
            for agent in managed
        ]
        entries.extend(self._unmanaged_entries(targets, adapters, issue_list))
        return AgentInventory(
            columns=targets,
            entries=tuple(entries),
            issues=tuple(issue_list),
        )

    def detail(self, slug: str) -> AgentDetail | None:
        """Everything the detail view needs, including where each harness copy lives."""
        agent = self.store.get(slug)
        if agent is None:
            return None
        targets, adapters = self._resolve()
        harnesses: list[AgentHarnessDetail] = []
        for target in targets:
            adapter = adapters[target.id]
            if not target.supports_agents:
                state, detail = "unsupported", target.unavailable_reason
                method = "none"
            else:
                method = "rendered" if adapter.renders else "symlink"
                if adapter.is_dangling(slug):
                    state, detail = "disabled", "symlink points at a missing file"
                elif adapter.is_enabled(slug):
                    state, detail = "enabled", None
                elif adapter.binding_path(slug).exists():
                    state, detail = "disabled", "a file we do not manage occupies this name"
                else:
                    state, detail = "disabled", None
            harnesses.append(
                AgentHarnessDetail(
                    harness=target.id,
                    label=target.label,
                    logo_key=target.logo_key,
                    state=state,
                    detail=detail,
                    path=adapter.binding_path(slug),
                    install_method=method,
                    installed=target.installed,
                )
            )
        return AgentDetail(
            ref=agent.slug,
            name=agent.name,
            description=agent.description,
            prompt=agent.prompt,
            tools=agent.tools,
            document=agent.path.read_text(encoding="utf-8"),
            store_path=agent.path,
            harnesses=tuple(harnesses),
            can_delete=True,
            configuration=tuple(
                (key, _format_config_value(value)) for key, value in agent.extra_metadata
            ),
        )

    def _managed_entry(
        self,
        targets: tuple[AgentTarget, ...],
        adapters: dict[str, AgentHarnessAdapter],
        slug: str,
        name: str,
        description: str,
    ) -> AgentEntry:
        bindings: list[AgentBinding] = []
        for target in targets:
            adapter = adapters[target.id]
            if not target.supports_agents:
                # Keeps the column for parity with the other families, but says why
                # rather than offering a toggle that cannot work.
                bindings.append(
                    AgentBinding(target.id, "unsupported", target.unavailable_reason)
                )
            elif adapter.is_dangling(slug):
                bindings.append(
                    AgentBinding(target.id, "disabled", "symlink points at a missing file")
                )
            elif adapter.is_enabled(slug):
                bindings.append(AgentBinding(target.id, "enabled"))
            else:
                detail = None
                if adapter.binding_path(slug).exists():
                    detail = "a file we do not manage occupies this name"
                bindings.append(AgentBinding(target.id, "disabled", detail))
        return AgentEntry(
            ref=slug,
            name=name,
            description=description,
            kind="managed",
            harness_path=None,
            bindings=tuple(bindings),
            can_adopt=False,
            can_delete=True,
        )

    def _unmanaged_entries(
        self,
        targets: tuple[AgentTarget, ...],
        adapters: dict[str, AgentHarnessAdapter],
        issues: list[AgentIssue],
    ) -> list[AgentEntry]:
        entries: list[AgentEntry] = []
        for target in targets:
            adapter = adapters[target.id]
            for path in adapter.unmanaged_paths():
                entries.append(self._unmanaged_entry(targets, target, path, issues))
            for path in adapter.orphaned_links():
                issues.append(
                    AgentIssue(
                        name=f"{target.id}/{path.stem}",
                        reason=(
                            f"{path} links to an agent that is no longer in the store; "
                            "remove it or re-create the agent"
                        ),
                    )
                )
        return entries

    def _unmanaged_entry(
        self,
        targets: tuple[AgentTarget, ...],
        target: AgentTarget,
        path: Path,
        issues: list[AgentIssue],
    ) -> AgentEntry:
        slug = path.stem
        try:
            if target.render_format == "codex_toml":
                name, description, _prompt = parse_codex_agent(path)
            else:
                parsed = parse_agent_file(path)
                name, description = parsed.name, parsed.description
        except AgentParseError as error:
            issues.append(AgentIssue(name=f"{target.id}/{slug}", reason=str(error)))
            name, description = slug, ""
        return AgentEntry(
            # Namespaced so the same slug found in two harnesses stays two distinct rows.
            ref=f"{target.id}/{slug}",
            name=name,
            description=description,
            kind="unmanaged",
            harness_path=path,
            bindings=tuple(
                AgentBinding(column.id, "unsupported", column.unavailable_reason)
                if not column.supports_agents
                else AgentBinding(column.id, "enabled" if column.id == target.id else "disabled")
                for column in targets
            ),
            can_adopt=True,
            can_delete=False,
        )


def _format_config_value(value: object) -> str:
    """Render a frontmatter value for display without interpreting it."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        return "[]" if not value else ", ".join(str(item) for item in value)
    if isinstance(value, dict):
        count = len(value)
        return f"({count} {'entry' if count == 1 else 'entries'})"
    return str(value)


__all__ = ["AgentInventoryService"]
