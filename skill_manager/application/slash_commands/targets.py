from __future__ import annotations

from typing import cast

from skill_manager.harness import CommandFileBindingProfile, HarnessKernelService

from .models import SlashTarget, SlashTargetId


TARGET_ORDER: tuple[SlashTargetId, ...] = ("opencode", "claude", "cursor", "codex")


def resolve_slash_targets(kernel: HarnessKernelService) -> tuple[SlashTarget, ...]:
    enabled = set(kernel.enabled_harness_ids_for_family("slash_commands"))
    targets: dict[str, SlashTarget] = {}
    for binding in kernel.bindings_for_family("slash_commands"):
        profile = binding.profile
        if not isinstance(profile, CommandFileBindingProfile):
            continue
        target_id = cast(SlashTargetId, binding.definition.harness)
        root_path = profile.resolve_root_path(kernel.context)
        output_dir = profile.resolve_output_dir(kernel.context)
        is_enabled = target_id in enabled
        available = root_path.exists()
        targets[target_id] = SlashTarget(
            id=target_id,
            label=binding.definition.label,
            root_path=root_path,
            output_dir=output_dir,
            invocation_prefix=profile.invocation_prefix,
            render_format=profile.render_format,
            scope=profile.scope,
            docs_url=profile.docs_url,
            file_glob=profile.file_glob,
            supports_frontmatter=profile.supports_frontmatter,
            support_note=profile.support_note,
            enabled=is_enabled,
            available=available,
            default_selected=is_enabled and available,
        )
    return tuple(targets[target_id] for target_id in TARGET_ORDER if target_id in targets)


def default_target_ids(targets: tuple[SlashTarget, ...]) -> tuple[SlashTargetId, ...]:
    return tuple(target.id for target in targets if target.default_selected)


def target_by_id(targets: tuple[SlashTarget, ...], target_id: str) -> SlashTarget | None:
    return next((target for target in targets if target.id == target_id), None)


__all__ = ["TARGET_ORDER", "default_target_ids", "resolve_slash_targets", "target_by_id"]
