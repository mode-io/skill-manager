from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

from skill_manager.errors import MutationError
from skill_manager.harness.contracts import CommandFileRenderFormat

from .models import SlashCommand


class CommandDocumentCodec(Protocol):
    def render(self, command: SlashCommand) -> str: ...

    def parse(self, name: str, content: str) -> SlashCommand: ...


@dataclass(frozen=True)
class FrontmatterMarkdownCommandCodec:
    """Strict codec for the subset of YAML frontmatter Skill Manager owns."""

    def render(self, command: SlashCommand) -> str:
        return "\n".join(
            [
                "---",
                f"description: {json.dumps(command.description.strip())}",
                "---",
                "",
                command.prompt.rstrip(),
                "",
            ]
        )

    def parse(self, name: str, content: str) -> SlashCommand:
        lines = content.splitlines()
        if not lines:
            return SlashCommand(name=name, description=name, prompt="")
        if lines[0].strip() != "---":
            return SlashCommand(name=name, description=name, prompt=content.strip())

        metadata_lines: list[str] = []
        body_start: int | None = None
        for index, line in enumerate(lines[1:], start=1):
            if line.strip() == "---":
                body_start = index + 1
                break
            metadata_lines.append(line)
        if body_start is None:
            raise MutationError("invalid command frontmatter: missing closing ---", status=400)

        metadata = _parse_frontmatter_metadata(metadata_lines)
        description = metadata.get("description", "").strip() or name
        prompt = "\n".join(lines[body_start:]).strip()
        return SlashCommand(name=name, description=description, prompt=prompt)


@dataclass(frozen=True)
class PlainMarkdownCommandCodec:
    def render(self, command: SlashCommand) -> str:
        return "\n".join(
            [
                command.description.rstrip(),
                "",
                command.prompt.rstrip(),
                "",
            ]
        )

    def parse(self, name: str, content: str) -> SlashCommand:
        body = content.strip()
        lines = body.splitlines()
        description = ""
        prompt_lines = lines
        for index, line in enumerate(lines):
            if line.strip():
                description = line.strip()
                prompt_lines = lines[index + 1 :]
                break
        prompt = "\n".join(prompt_lines).strip()
        return SlashCommand(name=name, description=description or name, prompt=prompt or body)


CODECS: dict[CommandFileRenderFormat, CommandDocumentCodec] = {
    "frontmatter_markdown": FrontmatterMarkdownCommandCodec(),
    "cursor_plaintext": PlainMarkdownCommandCodec(),
}


def codec_for_render_format(render_format: CommandFileRenderFormat) -> CommandDocumentCodec:
    return CODECS[render_format]


def render_slash_command(command: SlashCommand, render_format: CommandFileRenderFormat) -> str:
    return codec_for_render_format(render_format).render(command)


def parse_slash_command_document(
    name: str,
    content: str,
    render_format: CommandFileRenderFormat,
) -> SlashCommand:
    return codec_for_render_format(render_format).parse(name, content)


def _parse_frontmatter_metadata(lines: list[str]) -> dict[str, str]:
    metadata: dict[str, str] = {}
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in line:
            raise MutationError(f"invalid command frontmatter line: {line}", status=400)
        key, raw_value = line.split(":", 1)
        key = key.strip()
        if not key:
            raise MutationError(f"invalid command frontmatter line: {line}", status=400)
        metadata[key] = _parse_scalar(raw_value.strip())
    return metadata


def _parse_scalar(value: str) -> str:
    if not value:
        return ""
    if value.startswith('"'):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as error:
            raise MutationError("invalid command frontmatter string", status=400) from error
        if not isinstance(parsed, str):
            raise MutationError("invalid command frontmatter string", status=400)
        return parsed
    if len(value) >= 2 and value[0] == value[-1] == "'":
        return value[1:-1].replace("''", "'")
    return value


__all__ = [
    "CommandDocumentCodec",
    "FrontmatterMarkdownCommandCodec",
    "PlainMarkdownCommandCodec",
    "codec_for_render_format",
    "parse_slash_command_document",
    "render_slash_command",
]
