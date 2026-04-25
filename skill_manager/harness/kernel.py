from __future__ import annotations

import shutil
from dataclasses import dataclass

from .catalog import harness_definitions_for_family, supported_harness_definitions, supported_harness_ids
from .contracts import (
    BindingProfile,
    FamilyKey,
    FileTreeBindingProfile,
    HarnessDefinition,
    HarnessStatus,
)
from .resolution import ResolutionContext, resolve_context
from .support_store import HarnessSupportStore


@dataclass(frozen=True)
class FamilyBinding:
    definition: HarnessDefinition
    profile: BindingProfile


class HarnessKernelService:
    def __init__(
        self,
        *,
        definitions: tuple[HarnessDefinition, ...],
        context: ResolutionContext,
        support_store: HarnessSupportStore,
    ) -> None:
        self._definitions = definitions
        self.context = context
        self.support_store = support_store

    @classmethod
    def from_environment(
        cls,
        env: dict[str, str] | None = None,
        *,
        support_store: HarnessSupportStore,
    ) -> "HarnessKernelService":
        return cls(
            definitions=supported_harness_definitions(),
            context=resolve_context(env),
            support_store=support_store,
        )

    def supported_harness_ids(self) -> tuple[str, ...]:
        return supported_harness_ids()

    def is_known_harness(self, harness: str) -> bool:
        return any(definition.harness == harness for definition in self._definitions)

    def definition(self, harness: str) -> HarnessDefinition | None:
        return next((definition for definition in self._definitions if definition.harness == harness), None)

    def enabled_harness_ids(self) -> tuple[str, ...]:
        return self.support_store.enabled_harnesses(self.supported_harness_ids())

    def enabled_harness_ids_for_family(self, family: FamilyKey) -> tuple[str, ...]:
        supported = tuple(binding.definition.harness for binding in self.bindings_for_family(family))
        return self.support_store.enabled_harnesses(supported)

    def bindings_for_family(self, family: FamilyKey) -> tuple[FamilyBinding, ...]:
        bindings: list[FamilyBinding] = []
        for definition in self._definitions:
            profile = definition.binding_for(family)
            if profile is None:
                continue
            bindings.append(FamilyBinding(definition=definition, profile=profile))
        return tuple(bindings)

    def binding_for(self, harness: str, family: FamilyKey) -> BindingProfile | None:
        definition = self.definition(harness)
        if definition is None:
            return None
        return definition.binding_for(family)

    def harness_statuses(self) -> tuple[HarnessStatus, ...]:
        statuses: list[HarnessStatus] = []
        for definition in self._definitions:
            skills_binding = definition.binding_for("skills")
            managed_location = None
            if isinstance(skills_binding, FileTreeBindingProfile):
                managed_location = skills_binding.resolve_managed_root(self.context)
            statuses.append(
                HarnessStatus(
                    harness=definition.harness,
                    label=definition.label,
                    logo_key=definition.logo_key,
                    installed=shutil.which(
                        definition.install_probe,
                        path=self.context.env.get("PATH"),
                    )
                    is not None,
                    managed_location=managed_location,
                )
            )
        return tuple(statuses)


__all__ = ["FamilyBinding", "HarnessKernelService", "harness_definitions_for_family"]
