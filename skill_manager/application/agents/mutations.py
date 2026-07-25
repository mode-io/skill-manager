from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from skill_manager.errors import MutationError

from .adapters import AgentHarnessAdapter, parse_codex_agent
from .inventory import TargetResolver
from .model import AgentAdoptConflict, AgentDefinition, AgentTarget
from .parser import render_agent_document
from .store import AgentStore

ConflictResolution = Literal["keep_store", "replace_store"]


@dataclass(frozen=True)
class BulkAdoptResult:
    adopted: tuple[str, ...]
    skipped: tuple[tuple[str, str], ...]  # (ref, reason)


class AgentMutationService:
    """Writes agent bindings.

    Like the inventory service, targets are resolved per call so a harness the user
    just enabled or disabled in Settings takes effect without a restart.
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

    # -- per-harness binding ------------------------------------------------

    def enable(self, slug: str, harness: str) -> None:
        agent = self._require_agent(slug)
        self._adapter(harness).enable(agent)

    def disable(self, slug: str, harness: str) -> None:
        self._require_agent(slug)
        self._adapter(harness).disable(slug)

    def set_harnesses(self, slug: str, harnesses: list[str]) -> tuple[list[str], list[tuple[str, str]]]:
        agent = self._require_agent(slug)
        wanted = set(harnesses)
        for harness in wanted:
            self._adapter(harness)  # validate before mutating anything
        succeeded: list[str] = []
        failed: list[tuple[str, str]] = []
        for target in self.targets:
            if not target.supports_agents:
                # Nothing to enable or disable; not a failure either.
                continue
            adapter = self.adapters[target.id]
            try:
                if target.id in wanted:
                    adapter.enable(agent)
                else:
                    adapter.disable(slug)
                succeeded.append(target.id)
            except MutationError as error:
                failed.append((target.id, str(error)))
        return succeeded, failed

    # -- adoption -----------------------------------------------------------

    def adopt(self, ref: str, on_conflict: ConflictResolution | None = None) -> str:
        """Take ownership of an unmanaged harness file.

        ``ref`` is ``<harness>/<slug>``. On a store-name collision this raises
        ``AgentAdoptConflict`` unless the caller states which side wins — the server
        never guesses, because either choice discards someone's content.
        """
        harness, slug = self._split_ref(ref)
        adapter = self._adapter(harness)
        harness_path = adapter.binding_path(slug)
        if not harness_path.is_file() or harness_path.is_symlink():
            raise MutationError(f"no unmanaged agent at {harness_path}")

        store_path = self.store.path_for(slug)
        if store_path.exists():
            if on_conflict is None:
                raise AgentAdoptConflict(slug, store_path, harness_path)
            if on_conflict == "replace_store":
                self.store.write_raw(slug, self._as_store_document(adapter, harness_path))
            elif on_conflict != "keep_store":
                raise MutationError(f"unknown conflict resolution: {on_conflict}")
            # keep_store: the store file stands; the harness copy is simply displaced.
            harness_path.unlink()
        elif adapter.renders:
            # Codex agents are TOML; convert into the store's markdown rather than
            # moving a file the store cannot parse.
            self.store.agents_root.mkdir(parents=True, exist_ok=True)
            self.store.write_raw(slug, self._as_store_document(adapter, harness_path))
            harness_path.unlink()
        else:
            self.store.agents_root.mkdir(parents=True, exist_ok=True)
            shutil.move(str(harness_path), str(store_path))

        adapter.enable(self._require_agent(slug))
        return slug

    @staticmethod
    def _as_store_document(adapter: AgentHarnessAdapter, harness_path: Path) -> str:
        """Whatever the harness holds, expressed in the store's markdown format."""
        if not adapter.renders:
            return harness_path.read_text(encoding="utf-8")
        name, description, prompt = parse_codex_agent(harness_path)
        return render_agent_document(name=name, description=description, prompt=prompt)

    def adopt_all(self) -> BulkAdoptResult:
        """Adopt every non-conflicting unmanaged agent; report the rest for the user."""
        adopted: list[str] = []
        skipped: list[tuple[str, str]] = []
        for target in self.targets:
            adapter = self.adapters[target.id]
            for path in adapter.unmanaged_paths():
                ref = f"{target.id}/{path.stem}"
                try:
                    adopted.append(self.adopt(ref))
                except AgentAdoptConflict:
                    skipped.append((ref, "an agent with this name already exists in the store"))
                except MutationError as error:
                    skipped.append((ref, str(error)))
        return BulkAdoptResult(tuple(adopted), tuple(skipped))

    # -- store lifecycle ----------------------------------------------------

    def delete(self, slug: str) -> None:
        self._require_agent(slug)
        for target in self.targets:
            if target.supports_agents:
                self.adapters[target.id].disable(slug)
        self.store.delete(slug)

    # -- helpers ------------------------------------------------------------

    def _require_agent(self, slug: str) -> AgentDefinition:
        agent = self.store.get(slug)
        if agent is None:
            raise MutationError(f"agent not found: {slug}")
        return agent

    def _adapter(self, harness: str) -> AgentHarnessAdapter:
        adapter = self.adapters.get(harness)
        if adapter is None:
            raise MutationError(f"harness does not support agents: {harness}")
        return adapter

    @staticmethod
    def _split_ref(ref: str) -> tuple[str, str]:
        harness, separator, slug = ref.partition("/")
        if not separator or not harness or not slug:
            raise MutationError(f"expected an unmanaged ref of the form <harness>/<slug>: {ref}")
        if slug != Path(slug).name or slug in {".", ".."}:
            raise MutationError(f"unsafe agent ref: {ref!r}")
        return harness, slug


__all__ = ["AgentMutationService", "BulkAdoptResult", "ConflictResolution"]
