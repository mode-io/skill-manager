from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.application.scan.context_builder import PromptContextBuilder


class PromptContextBuilderTests(unittest.TestCase):
    def test_prompt_context_redacts_sensitive_files_and_reports_exact_skips(self) -> None:
        with TemporaryDirectory(prefix="skill-manager-scan-context-") as tempdir:
            skill_dir = Path(tempdir) / "sample-skill"
            skill_dir.mkdir()
            (skill_dir / "SKILL.md").write_text(
                "\n".join([
                    "---",
                    "name: Sample Skill",
                    "description: Scan fixture",
                    "---",
                    "",
                    "# Sample Skill",
                    "",
                    "Review [rules](rules.md).",
                    "",
                ]),
                encoding="utf-8",
            )
            (skill_dir / "script.py").write_text("print('included script')\n", encoding="utf-8")
            (skill_dir / "rules.md").write_text("Always validate inputs.\n", encoding="utf-8")
            (skill_dir / ".env").write_text("OPENAI_API_KEY=sk-should-not-leak\n", encoding="utf-8")

            context = PromptContextBuilder().build(skill_dir)

            self.assertIn("Sample Skill", context.prompt)
            self.assertIn("print('included script')", context.prompt)
            self.assertIn("Always validate inputs.", context.prompt)
            self.assertNotIn("sk-should-not-leak", context.prompt)
            self.assertEqual(
                [(item.path, item.threshold_name) for item in context.skipped_items],
                [(".env", "llm_analysis.secret_file_redaction")],
            )

    def test_prompt_context_omits_over_budget_instruction_body_from_sent_prompt(self) -> None:
        with TemporaryDirectory(prefix="skill-manager-scan-budget-") as tempdir:
            skill_dir = Path(tempdir) / "large-skill"
            skill_dir.mkdir()
            oversized_marker = "OVER_BUDGET_INSTRUCTION"
            (skill_dir / "SKILL.md").write_text(
                "\n".join([
                    "---",
                    "name: Large Skill",
                    "description: Large fixture",
                    "---",
                    "",
                    oversized_marker * 3000,
                    "",
                ]),
                encoding="utf-8",
            )

            context = PromptContextBuilder().build(skill_dir)

            self.assertNotIn(oversized_marker, context.prompt)
            self.assertEqual(len(context.skipped_items), 1)
            skipped = context.skipped_items[0]
            self.assertEqual(skipped.path, "SKILL.md (instruction body)")
            self.assertEqual(skipped.threshold_name, "llm_analysis.max_instruction_body_chars")


if __name__ == "__main__":
    unittest.main()
