from __future__ import annotations

from pathlib import Path

from skill_manager.errors import MutationError

from .models import SlashTarget


class SlashCommandPathPolicy:
    def output_path(self, target: SlashTarget, command_name: str) -> Path:
        return self._normalize(target.output_dir / f"{command_name}.md")

    def tracked_path(self, target: SlashTarget, path: Path) -> Path:
        normalized = self._normalize(path)
        output_dir = self._normalize(target.output_dir)
        try:
            normalized.relative_to(output_dir)
        except ValueError as error:
            raise MutationError(
                f"tracked slash command path is outside {target.label} locations: {path}",
                status=409,
            ) from error
        return normalized

    def path_identity(self, path: Path) -> str:
        return str(self._normalize(path))

    def _normalize(self, path: Path) -> Path:
        return path.expanduser().resolve(strict=False)


__all__ = ["SlashCommandPathPolicy"]
