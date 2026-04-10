from __future__ import annotations

from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest

from skill_manager.application.marketplace.skillssh import extract_detail_description, parse_homepage_leaderboard
from skill_manager.sources.github import GitHubSource, _find_skill, _parse_locator, github_repo_from_locator, github_skill_dir_from_locator

from tests.support.fake_home import seed_skill_package


class ParseLocatorTests(unittest.TestCase):
    def test_parse_three_part_locator(self) -> None:
        owner, repo, skill_dir = _parse_locator("anthropics/skills/commit-message")
        self.assertEqual(owner, "anthropics")
        self.assertEqual(repo, "skills")
        self.assertEqual(skill_dir, "commit-message")

    def test_parse_rejects_two_parts(self) -> None:
        with self.assertRaises(ValueError):
            _parse_locator("anthropics/skills")

    def test_github_repo_from_locator(self) -> None:
        self.assertEqual(github_repo_from_locator("github:anthropics/skills/commit-message"), "anthropics/skills")

    def test_github_repo_from_two_part_locator(self) -> None:
        self.assertEqual(github_repo_from_locator("github:mode-io/shared-audit"), "mode-io/shared-audit")

    def test_github_skill_dir_from_locator(self) -> None:
        self.assertEqual(github_skill_dir_from_locator("github:anthropics/skills/commit-message"), "commit-message")
        self.assertIsNone(github_skill_dir_from_locator("github:mode-io/shared-audit"))


class FindSkillTests(unittest.TestCase):
    def test_find_skill_in_nested_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            seed_skill_package(root / "skills", "commit-message", "Commit Message")
            result = _find_skill(root, "commit-message")
            self.assertIsNotNone(result)
            self.assertEqual(result.name, "commit-message")

    def test_find_skill_returns_none_when_missing(self) -> None:
        with TemporaryDirectory() as temp_dir:
            result = _find_skill(Path(temp_dir), "nonexistent")
            self.assertIsNone(result)


class GitHubSourceTests(unittest.TestCase):
    def test_fetch_from_local_bare_repo(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            repo_dir = root / "test-repo"
            repo_dir.mkdir()
            seed_skill_package(repo_dir / "skills", "my-skill", "My Skill")
            subprocess.run(["git", "init"], cwd=repo_dir, capture_output=True, check=True)
            subprocess.run(["git", "add", "."], cwd=repo_dir, capture_output=True, check=True)
            subprocess.run(
                ["git", "commit", "-m", "init", "--author", "test <t@t>"],
                cwd=repo_dir,
                capture_output=True,
                check=True,
                env={
                    "GIT_COMMITTER_NAME": "test",
                    "GIT_COMMITTER_EMAIL": "t@t",
                    "HOME": str(root),
                    "PATH": "/usr/bin:/bin:/usr/local/bin",
                },
            )
            work = root / "work"
            work.mkdir()

            def local_fetch(locator: str, work_dir: Path) -> Path:
                owner, repo, skill_dir = _parse_locator(locator)
                clone_dir = work_dir / f"{owner}--{repo}"
                subprocess.run(
                    ["git", "clone", "--depth", "1", str(repo_dir), str(clone_dir)],
                    check=True,
                    capture_output=True,
                    timeout=60,
                )
                return _find_skill(clone_dir, skill_dir)

            result = local_fetch("test/test-repo/my-skill", work)
            self.assertIsNotNone(result)
            self.assertTrue((result / "SKILL.md").is_file())

class SkillsShParsingTests(unittest.TestCase):
    def test_parse_homepage_leaderboard_reads_embedded_initial_skills_payload(self) -> None:
        html = """
        <html>
          <body>
            <script>
              self.__next_f.push([1,"{\\"initialSkills\\":[{\\"source\\":\\"mode-io/skills\\",\\"skillId\\":\\"mode-switch\\",\\"name\\":\\"Mode Switch\\",\\"installs\\":128},{\\"source\\":\\"vercel-labs/skills\\",\\"skillId\\":\\"trace-scout\\",\\"name\\":\\"Trace Scout\\",\\"installs\\":84}]}"])
            </script>
          </body>
        </html>
        """
        skills = parse_homepage_leaderboard(html)
        self.assertEqual([(item.repo, item.skill_id, item.installs) for item in skills], [
            ("mode-io/skills", "mode-switch", 128),
            ("vercel-labs/skills", "trace-scout", 84),
        ])

    def test_extract_detail_description_prefers_summary_then_skill_body_then_hint(self) -> None:
        summary_html = """
        <section>
          <h2>Summary</h2>
          <p>Investigate Azure telemetry and platform health.</p>
          <h2>SKILL.md</h2>
          <p>Ignored fallback body.</p>
        </section>
        """
        self.assertEqual(
            extract_detail_description(summary_html, skill_name="Azure Observability", description_hint="Hint"),
            "Investigate Azure telemetry and platform health.",
        )

        skill_body_html = """
        <section>
          <h2>SKILL.md</h2>
          <p>Azure Observability</p>
          <p>Use this skill to review Azure incidents and monitoring signals.</p>
        </section>
        """
        self.assertEqual(
            extract_detail_description(skill_body_html, skill_name="Azure Observability", description_hint="Hint"),
            "Use this skill to review Azure incidents and monitoring signals.",
        )

        self.assertEqual(
            extract_detail_description("<html><body><p>No useful sections.</p></body></html>", skill_name="Azure Observability", description_hint="Hint"),
            "Hint",
        )


if __name__ == "__main__":
    unittest.main()
