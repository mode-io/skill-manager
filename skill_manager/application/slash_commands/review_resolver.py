from __future__ import annotations

from pathlib import Path

from skill_manager.atomic_files import atomic_write_text
from skill_manager.errors import MutationError

from .codecs import parse_slash_command_document, render_slash_command
from .models import SlashCommandSyncEntry, SlashReviewAction, SlashTarget
from .path_policy import SlashCommandPathPolicy
from .queries import SlashCommandQueryService
from .store import SlashCommandStore, validate_command_name
from .sync_state import SlashCommandSyncRecord, SlashCommandSyncStateStore, hash_file


class SlashCommandReviewResolver:
    def __init__(
        self,
        store: SlashCommandStore,
        sync_state: SlashCommandSyncStateStore,
        queries: SlashCommandQueryService,
        path_policy: SlashCommandPathPolicy,
    ) -> None:
        self.store = store
        self.sync_state = sync_state
        self.queries = queries
        self.path_policy = path_policy

    def import_unmanaged_command(self, target: SlashTarget, name: str) -> dict[str, object]:
        validate_command_name(name)
        if self.store.get_command(name) is not None:
            raise MutationError(
                f"slash command already exists: resolve {target.id}:{name} from review",
                status=409,
            )
        path = self.path_policy.output_path(target, name)
        if not path.is_file():
            raise MutationError(f"slash command file not found: {path}", status=404)

        command = parse_slash_command_document(
            name,
            path.read_text(encoding="utf-8"),
            target.render_format,
        )
        self.store.create_command(command)
        record = SlashCommandSyncRecord(
            target=target.id,
            path=path,
            content_hash=hash_file(path),
            render_format=target.render_format,
        )
        self.sync_state.add_target(name, record)
        payload = self.queries.get_command(name)
        return {
            "ok": True,
            "command": payload,
            "sync": [SlashCommandSyncEntry(target=target.id, path=path, status="synced").to_dict()],
        }

    def resolve_review_command(
        self,
        *,
        target: SlashTarget,
        name: str,
        action: SlashReviewAction,
    ) -> dict[str, object]:
        validate_command_name(name)
        if action == "restore_managed":
            return self._restore_managed(target, name)
        if action == "adopt_target":
            return self._adopt_target(target, name)
        if action == "remove_binding":
            return self._remove_binding(target, name)
        raise MutationError(f"unknown slash command review action: {action}", status=400)

    def _restore_managed(self, target: SlashTarget, name: str) -> dict[str, object]:
        command = self.store.require_command(name)
        previous = self.sync_state.load().get(name, {}).get(target.id)
        if previous is None:
            raise MutationError(f"slash command target is not managed: {target.id}:{name}", status=409)
        path = self.path_policy.tracked_path(target, previous.path)
        rendered = render_slash_command(command, target.render_format)
        path.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_text(path, rendered)
        record = SlashCommandSyncRecord(
            target=target.id,
            path=path,
            content_hash=hash_file(path),
            render_format=target.render_format,
        )
        self.sync_state.add_target(name, record)
        return self._mutation_payload(name, SlashCommandSyncEntry(target=target.id, path=path, status="synced"))

    def _adopt_target(self, target: SlashTarget, name: str) -> dict[str, object]:
        path = self._review_file_path(target, name)
        if not path.is_file():
            raise MutationError(f"slash command file not found: {path}", status=404)
        parsed = parse_slash_command_document(name, path.read_text(encoding="utf-8"), target.render_format)
        existing = self.store.get_command(name)
        if existing is None:
            self.store.create_command(parsed)
        else:
            self.store.update_command(name, description=parsed.description, prompt=parsed.prompt)
        record = SlashCommandSyncRecord(
            target=target.id,
            path=path,
            content_hash=hash_file(path),
            render_format=target.render_format,
        )
        self.sync_state.add_target(name, record)
        return self._mutation_payload(name, SlashCommandSyncEntry(target=target.id, path=path, status="synced"))

    def _remove_binding(self, target: SlashTarget, name: str) -> dict[str, object]:
        previous = self.sync_state.load().get(name, {}).get(target.id)
        if previous is None:
            raise MutationError(f"slash command target is not managed: {target.id}:{name}", status=409)
        self.sync_state.remove_target(name, target.id)
        return self._mutation_payload(
            name,
            SlashCommandSyncEntry(target=target.id, path=previous.path, status="removed"),
        )

    def _review_file_path(self, target: SlashTarget, name: str) -> Path:
        previous = self.sync_state.load().get(name, {}).get(target.id)
        if previous is not None:
            return self.path_policy.tracked_path(target, previous.path)
        return self.path_policy.output_path(target, name)

    def _mutation_payload(self, name: str, entry: SlashCommandSyncEntry) -> dict[str, object]:
        return {
            "ok": entry.status not in {"failed", "blocked_manual_file", "blocked_modified_file"},
            "command": self.queries.get_command(name),
            "sync": [entry.to_dict()],
        }


__all__ = ["SlashCommandReviewResolver"]
