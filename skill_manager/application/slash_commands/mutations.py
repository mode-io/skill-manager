from __future__ import annotations

from collections.abc import Callable
from typing import get_args

from skill_manager.errors import MutationError

from .executor import SlashCommandSyncExecutor
from .models import SlashCommand, SlashReviewAction, SlashTarget, SlashTargetId
from .planner import SlashCommandPlanner
from .queries import SlashCommandQueryService
from .read_models import SlashCommandReadModelService
from .review_resolver import SlashCommandReviewResolver
from .store import SlashCommandStore, validate_command_name
from .sync_state import SlashCommandSyncStateStore
from .targets import default_target_ids, target_by_id


class SlashCommandMutationService:
    def __init__(
        self,
        store: SlashCommandStore,
        sync_state: SlashCommandSyncStateStore,
        queries: SlashCommandQueryService,
        read_models: SlashCommandReadModelService,
        planner: SlashCommandPlanner,
        resolve_targets: Callable[[], tuple[SlashTarget, ...]],
    ) -> None:
        self.store = store
        self.sync_state = sync_state
        self.queries = queries
        self.read_models = read_models
        self.planner = planner
        self.resolve_targets = resolve_targets
        self.path_policy = planner.path_policy
        self.sync_executor = SlashCommandSyncExecutor(sync_state, planner, self.path_policy)
        self.review_resolver = SlashCommandReviewResolver(store, sync_state, queries, self.path_policy)

    def create_command(
        self,
        *,
        name: str,
        description: str,
        prompt: str,
        targets: list[str] | None = None,
    ) -> dict[str, object]:
        command = self.store.create_command(SlashCommand(name=name, description=description, prompt=prompt))
        sync = self.sync_command(command.name, targets=targets)
        payload = self.queries.get_command(command.name)
        return {"ok": sync["ok"], "command": payload, "sync": sync["sync"]}

    def update_command(
        self,
        name: str,
        *,
        description: str,
        prompt: str,
        targets: list[str] | None = None,
    ) -> dict[str, object]:
        self.store.update_command(name, description=description, prompt=prompt)
        sync = self.sync_command(name, targets=targets)
        payload = self.queries.get_command(name)
        return {"ok": sync["ok"], "command": payload, "sync": sync["sync"]}

    def sync_command(self, name: str, *, targets: list[str] | None = None) -> dict[str, object]:
        resolved_targets = self.resolve_targets()
        command = self.store.require_command(name)
        selected = self._selected_targets(targets, resolved_targets)
        return self.sync_executor.sync_command(command, selected, resolved_targets)

    def delete_command(self, name: str) -> dict[str, object]:
        resolved_targets = self.resolve_targets()
        validate_command_name(name)
        self.store.require_command(name)
        records = self.sync_state.load().get(name, {})
        removed = self.sync_executor.remove_tracked_outputs(records, resolved_targets)
        if not removed["ok"]:
            return removed

        self.store.delete_command(name)
        self.sync_state.remove_command(name)
        return {"ok": True, "sync": removed["sync"]}

    def import_unmanaged_command(self, *, target: str, name: str) -> dict[str, object]:
        resolved_targets = self.resolve_targets()
        selected_target = self._require_target(target, resolved_targets)
        return self.review_resolver.import_unmanaged_command(selected_target, name)

    def resolve_review_command(
        self,
        *,
        target: str,
        name: str,
        action: SlashReviewAction,
    ) -> dict[str, object]:
        resolved_targets = self.resolve_targets()
        selected_target = self._require_target(target, resolved_targets)
        return self.review_resolver.resolve_review_command(target=selected_target, name=name, action=action)

    def _selected_targets(self, targets: list[str] | None, resolved_targets: tuple[SlashTarget, ...]) -> tuple[SlashTarget, ...]:
        target_ids = targets if targets is not None else list(default_target_ids(resolved_targets))
        selected: list[SlashTarget] = []
        seen: set[str] = set()
        for target_id in target_ids:
            if target_id in seen:
                continue
            target = self._require_target(target_id, resolved_targets)
            selected.append(target)
            seen.add(target_id)
        return tuple(selected)

    def _require_target(self, target_id: str, resolved_targets: tuple[SlashTarget, ...]) -> SlashTarget:
        target = target_by_id(resolved_targets, target_id)
        if target is not None:
            return target
        # Resolved targets already exclude harnesses disabled in Settings, so a
        # target that is a real slash-command harness yet missing here is disabled,
        # not unknown. Report it the way MCP, hooks, permissions, and skills do.
        if target_id in get_args(SlashTargetId):
            raise MutationError(f"harness support is disabled: {target_id}", status=400)
        raise MutationError(f"unknown slash command target: {target_id}", status=400)


__all__ = ["SlashCommandMutationService"]
