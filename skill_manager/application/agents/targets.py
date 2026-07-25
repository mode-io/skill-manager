from __future__ import annotations

import shutil

from skill_manager.harness import AgentFileBindingProfile, HarnessKernelService

from .model import AgentTarget


def resolve_agent_targets(kernel: HarnessKernelService) -> tuple[AgentTarget, ...]:
    """Columns for the agents matrix.

    Deliberately *not* a curated list. Which harnesses appear is decided the same way
    Skills decides it — every harness declaring an agents binding, minus the ones the
    user disabled in settings — so the two pages can never disagree about which
    harnesses exist. Column order follows catalog declaration order, matching Skills.
    """
    enabled = set(kernel.enabled_harness_ids_for_family("agents"))
    targets: list[AgentTarget] = []
    for binding in kernel.bindings_for_family("agents"):
        profile = binding.profile
        if not isinstance(profile, AgentFileBindingProfile):
            continue
        definition = binding.definition
        if definition.harness not in enabled:
            continue
        targets.append(
            AgentTarget(
                id=definition.harness,
                label=definition.label,
                logo_key=definition.logo_key,
                root_path=profile.resolve_root_path(kernel.context),
                output_dir=profile.resolve_output_dir(kernel.context),
                file_glob=profile.file_glob,
                render_format=profile.render_format,
                docs_url=profile.docs_url,
                installed=_is_installed(kernel, definition, profile),
                unavailable_reason=profile.unavailable_reason,
            )
        )
    return tuple(targets)


def target_by_id(targets: tuple[AgentTarget, ...], target_id: str) -> AgentTarget | None:
    return next((target for target in targets if target.id == target_id), None)


def _is_installed(
    kernel: HarnessKernelService, definition, profile: AgentFileBindingProfile
) -> bool:
    if shutil.which(definition.install_probe, path=kernel.context.env.get("PATH")) is not None:
        return True
    if profile.availability == "cli_or_app":
        skills_binding = definition.binding_for("skills")
        app_probes = getattr(skills_binding, "app_probe_paths", ())
        if any(resolver(kernel.context).exists() for resolver in app_probes):
            return True
    # A populated config root is proof enough that the harness is present.
    return profile.resolve_root_path(kernel.context).is_dir()


__all__ = ["resolve_agent_targets", "target_by_id"]
