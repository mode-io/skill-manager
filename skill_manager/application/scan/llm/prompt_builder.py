from __future__ import annotations

import logging
import secrets
from pathlib import Path

from ..models import Skill, SkillManifest

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / "data" / "prompts"


class PromptBuilder:
    def __init__(self) -> None:
        self.protection_rules = self._load_prompt("boilerplate_protection.md")
        self.threat_analysis = self._load_prompt("skill_threat_analysis.md")

    @staticmethod
    def _load_prompt(name: str) -> str:
        path = _PROMPTS_DIR / name
        if path.exists():
            return path.read_text(encoding="utf-8")
        logger.warning("Prompt file not found: %s", path)
        return ""

    def build_analysis_prompt_from_parts(
        self,
        skill: Skill,
        *,
        manifest_text: str,
        instruction_body: str,
        code_text: str,
        referenced_text: str,
        enrichment_context: str | None = None,
    ) -> tuple[str, bool]:
        random_id = secrets.token_hex(16)
        start_tag = f"<!---UNTRUSTED_INPUT_START_{random_id}--->"
        end_tag = f"<!---UNTRUSTED_INPUT_END_{random_id}--->"
        analysis_content = f"""Skill Name: {skill.manifest.name}
Description: {skill.manifest.description}

YAML Manifest Details:
{manifest_text}

Instruction Body (SKILL.md markdown):
{instruction_body}

Script Files (Python/Bash):
{code_text}

Referenced Files:
{referenced_text}
"""
        if enrichment_context:
            analysis_content += f"\nPre-Scan Context (from static analyzers — use this to focus your analysis):\n{enrichment_context}\n"

        injection_detected = start_tag in analysis_content or end_tag in analysis_content

        if injection_detected:
            logger.warning("Potential prompt injection detected in skill %s", skill.manifest.name)

        protected_rules = self.protection_rules.replace("<!---UNTRUSTED_INPUT_START--->", start_tag).replace(
            "<!---UNTRUSTED_INPUT_END--->", end_tag
        )

        prompt = f"""{protected_rules}

{self.threat_analysis}

{start_tag}
{analysis_content}
{end_tag}
"""
        return prompt.strip(), injection_detected

    @staticmethod
    def format_manifest(manifest: SkillManifest) -> str:
        lines = [
            f"- name: {manifest.name}",
            f"- description: {manifest.description}",
            f"- license: {manifest.license or 'Not specified'}",
            f"- compatibility: {manifest.compatibility or 'Not specified'}",
        ]
        if manifest.allowed_tools:
            tools = ", ".join(manifest.allowed_tools) if isinstance(manifest.allowed_tools, list) else str(manifest.allowed_tools)
            lines.append(f"- allowed-tools: {tools}")
        else:
            lines.append("- allowed-tools: Not specified")
        if hasattr(manifest, "metadata") and manifest.metadata:
            lines.append(f"- additional metadata: {manifest.metadata}")
        return "\n".join(lines)

    @staticmethod
    def format_code_files(
        skill: Skill,
        max_file_chars: int = 15_000,
        max_total_chars: int = 100_000,
    ) -> tuple[str, list[dict]]:
        code_types = {"python", "bash", "javascript", "typescript", "yaml", "json", "toml", "config"}
        parts: list[str] = []
        skipped: list[dict] = []
        total = 0
        for sf in skill.files:
            if _is_sensitive_file(sf.relative_path):
                skipped.append({
                    "path": sf.relative_path,
                    "size": sf.size_bytes,
                    "reason": "secret-bearing file is excluded from LLM prompt context",
                    "threshold_name": "llm_analysis.secret_file_redaction",
                })
                continue
            if sf.file_type not in code_types or not sf.content:
                continue
            file_size = len(sf.content)
            if file_size > max_file_chars:
                skipped.append({
                    "path": sf.relative_path,
                    "size": file_size,
                    "reason": f"file size ({file_size:,} chars) exceeds per-file limit ({max_file_chars:,})",
                    "threshold_name": "llm_analysis.max_code_file_chars",
                })
                continue
            if total + file_size > max_total_chars:
                skipped.append({
                    "path": sf.relative_path,
                    "size": file_size,
                    "reason": f"including this file would exceed the total prompt budget ({total + file_size:,} > {max_total_chars:,})",
                    "threshold_name": "llm_analysis.max_total_prompt_chars",
                })
                continue
            # Syntax-highlighted code blocks like skill-scanner
            parts.append(f"**File: {sf.relative_path}**")
            parts.append(f"```{sf.file_type}")
            parts.append(sf.content)
            parts.append("```")
            parts.append("")
            total += file_size
        formatted = "\n".join(parts) if parts else "No script files found."
        return formatted, skipped

    @staticmethod
    def format_referenced_files(
        skill: Skill,
        max_file_chars: int = 10_000,
        remaining_budget: int = 100_000,
    ) -> tuple[str, list[dict]]:
        if not skill.referenced_files:
            return "No referenced files.", []

        parts: list[str] = []
        skipped: list[dict] = []
        total = 0

        parts.append(f"Files referenced in instructions: {', '.join(skill.referenced_files)}")
        parts.append("")

        for ref_file_path in skill.referenced_files:
            # Skip path traversal attempts
            if ".." in ref_file_path or ref_file_path.startswith("/"):
                parts.append(f"**Referenced File: {ref_file_path}** (blocked: path traversal attempt)")
                parts.append("")
                continue

            # Find the file in the skill directory
            full_path = skill.directory / ref_file_path
            if not full_path.exists():
                alt_paths = [
                    skill.directory / "rules" / Path(ref_file_path).name,
                    skill.directory / "references" / ref_file_path,
                    skill.directory / "assets" / ref_file_path,
                    skill.directory / "templates" / ref_file_path,
                ]
                for alt in alt_paths:
                    if alt.exists():
                        full_path = alt
                        break

            if not full_path.exists():
                parts.append(f"**Referenced File: {ref_file_path}** (not found)")
                parts.append("")
                continue

            # Path traversal protection
            if not PromptBuilder._is_path_within_directory(full_path, skill.directory):
                parts.append(f"**Referenced File: {ref_file_path}** (blocked: outside skill directory)")
                parts.append("")
                continue

            try:
                content = full_path.read_text(encoding="utf-8")
                file_size = len(content)

                if file_size > max_file_chars:
                    skipped.append({
                        "path": ref_file_path,
                        "size": file_size,
                        "reason": f"file size ({file_size:,} chars) exceeds per-file limit ({max_file_chars:,})",
                        "threshold_name": "llm_analysis.max_referenced_file_chars",
                    })
                    parts.append(f"**Referenced File: {ref_file_path}** (skipped: exceeds budget)")
                    parts.append("")
                    continue

                if total + file_size > remaining_budget:
                    skipped.append({
                        "path": ref_file_path,
                        "size": file_size,
                        "reason": f"including this file would exceed the total prompt budget ({total + file_size:,} > {remaining_budget:,})",
                        "threshold_name": "llm_analysis.max_total_prompt_chars",
                    })
                    parts.append(f"**Referenced File: {ref_file_path}** (skipped: exceeds total budget)")
                    parts.append("")
                    continue

                suffix = full_path.suffix.lower()
                file_type = "markdown" if suffix in (".md", ".markdown") else "text"

                parts.append(f"**Referenced File: {ref_file_path}**")
                parts.append(f"```{file_type}")
                parts.append(content)
                parts.append("```")
                parts.append("")
                total += file_size

            except Exception as e:
                parts.append(f"**Referenced File: {ref_file_path}** (error reading: {e})")
                parts.append("")

        return "\n".join(parts), skipped

    @staticmethod
    def _is_path_within_directory(path: Path, directory: Path) -> bool:
        try:
            resolved_path = path.resolve()
            resolved_directory = directory.resolve()
            return resolved_path.is_relative_to(resolved_directory)
        except (ValueError, OSError):
            return False


def _is_sensitive_file(relative_path: str) -> bool:
    name = Path(relative_path).name.lower()
    suffix = Path(relative_path).suffix.lower()
    return (
        name == ".env"
        or name.startswith(".env.")
        or name in {"id_rsa", "id_ed25519", "credentials", "credentials.json"}
        or suffix in {".pem", ".key", ".p12", ".pfx"}
    )
