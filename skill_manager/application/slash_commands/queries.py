from __future__ import annotations

from .read_models import SlashCommandReadModelService


class SlashCommandQueryService:
    def __init__(self, read_models: SlashCommandReadModelService) -> None:
        self.read_models = read_models

    def list_commands(self) -> dict[str, object]:
        return self.read_models.list_commands()

    def get_command(self, name: str) -> dict[str, object] | None:
        return self.read_models.get_command(name)


__all__ = ["SlashCommandQueryService"]
