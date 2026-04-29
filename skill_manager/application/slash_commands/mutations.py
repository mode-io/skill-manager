from __future__ import annotations

from skill_manager.errors import MutationError

from .executor import SlashCommandSyncExecutor
from .models import SlashCommand, SlashReviewAction, SlashTarget
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
        targets: tuple[SlashTarget, ...],
    ) -> None:
        self.store = store
        self.sync_state = sync_state
        self.queries = queries
        self.read_models = read_models
        self.planner = planner
        self.targets = targets
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
        command = self.store.require_command(name)
        selected = self._selected_targets(targets)
        return self.sync_executor.sync_command(command, selected, self.targets)

    def delete_command(self, name: str) -> dict[str, object]:
        validate_command_name(name)
        self.store.require_command(name)
        records = self.sync_state.load().get(name, {})
        removed = self.sync_executor.remove_tracked_outputs(records, self.targets)
        if not removed["ok"]:
            return removed

        self.store.delete_command(name)
        self.sync_state.remove_command(name)
        return {"ok": True, "sync": removed["sync"]}

    def import_unmanaged_command(self, *, target: str, name: str) -> dict[str, object]:
        selected_target = self._require_target(target)
        return self.review_resolver.import_unmanaged_command(selected_target, name)

    def resolve_review_command(
        self,
        *,
        target: str,
        name: str,
        action: SlashReviewAction,
    ) -> dict[str, object]:
        selected_target = self._require_target(target)
        return self.review_resolver.resolve_review_command(target=selected_target, name=name, action=action)

    def _selected_targets(self, targets: list[str] | None) -> tuple[SlashTarget, ...]:
        target_ids = targets if targets is not None else list(default_target_ids(self.targets))
        selected: list[SlashTarget] = []
        seen: set[str] = set()
        for target_id in target_ids:
            if target_id in seen:
                continue
            target = self._require_target(target_id)
            selected.append(target)
            seen.add(target_id)
        return tuple(selected)

    def _require_target(self, target_id: str) -> SlashTarget:
        target = target_by_id(self.targets, target_id)
        if target is None:
            raise MutationError(f"unknown slash command target: {target_id}", status=400)
        if not target.enabled:
            raise MutationError(f"harness support is disabled: {target_id}", status=400)
        return target


__all__ = ["SlashCommandMutationService"]
