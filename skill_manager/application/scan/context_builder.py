from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .loader import SkillLoader
from .models import Skill
from .llm.prompt_builder import PromptBuilder

MAX_INSTRUCTION_CHARS = 50_000
MAX_CODE_FILE_CHARS = 15_000
MAX_REFERENCED_FILE_CHARS = 10_000
MAX_TOTAL_PROMPT_CHARS = 100_000


@dataclass(frozen=True)
class PromptSkippedItem:
    path: str
    size: int
    reason: str
    threshold_name: str


@dataclass(frozen=True)
class PromptContext:
    skill: Skill
    prompt: str
    injection_detected: bool
    skipped_items: tuple[PromptSkippedItem, ...] = field(default_factory=tuple)


class PromptContextBuilder:
    def __init__(
        self,
        loader: SkillLoader | None = None,
        prompt_builder: PromptBuilder | None = None,
    ) -> None:
        self.loader = loader or SkillLoader()
        self.prompt_builder = prompt_builder or PromptBuilder()

    def build(self, skill_path: Path, *, enrichment_context: str | None = None) -> PromptContext:
        skill = self.loader.load(skill_path)
        skipped: list[PromptSkippedItem] = []

        instruction_body = skill.instruction_body
        if len(instruction_body) > MAX_INSTRUCTION_CHARS:
            skipped.append(PromptSkippedItem(
                path="SKILL.md (instruction body)",
                size=len(instruction_body),
                reason=(
                    f"instruction body ({len(instruction_body):,} chars) exceeds "
                    f"limit ({MAX_INSTRUCTION_CHARS:,})"
                ),
                threshold_name="llm_analysis.max_instruction_body_chars",
            ))
            instruction_body = ""

        manifest_text = self.prompt_builder.format_manifest(skill.manifest)
        budget_used = len(instruction_body) + len(manifest_text)

        code_text, code_skipped = self.prompt_builder.format_code_files(
            skill,
            max_file_chars=MAX_CODE_FILE_CHARS,
            max_total_chars=max(0, MAX_TOTAL_PROMPT_CHARS - budget_used),
        )
        skipped.extend(_skipped_items(code_skipped))
        budget_used += len(code_text)

        ref_text, ref_skipped = self.prompt_builder.format_referenced_files(
            skill,
            max_file_chars=MAX_REFERENCED_FILE_CHARS,
            remaining_budget=max(0, MAX_TOTAL_PROMPT_CHARS - budget_used),
        )
        skipped.extend(_skipped_items(ref_skipped))

        prompt, injection_detected = self.prompt_builder.build_analysis_prompt_from_parts(
            skill,
            manifest_text=manifest_text,
            instruction_body=instruction_body,
            code_text=code_text,
            referenced_text=ref_text,
            enrichment_context=enrichment_context,
        )
        return PromptContext(
            skill=skill,
            prompt=prompt,
            injection_detected=injection_detected,
            skipped_items=tuple(skipped),
        )


def _skipped_items(items: list[dict]) -> list[PromptSkippedItem]:
    skipped: list[PromptSkippedItem] = []
    for item in items:
        skipped.append(PromptSkippedItem(
            path=str(item["path"]),
            size=int(item["size"]),
            reason=str(item["reason"]),
            threshold_name=str(item["threshold_name"]),
        ))
    return skipped
