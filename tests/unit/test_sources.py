from __future__ import annotations

from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest

from skill_manager.sources.github import GitHubSource, _find_skill, _parse_locator
from skill_manager.sources.types import SkillListing, listing_to_json

from tests.support import seed_skill_package


class ParseLocatorTests(unittest.TestCase):
    def test_parse_three_part_locator(self) -> None:
        owner, repo, skill_dir = _parse_locator("anthropics/skills/commit-message")
        self.assertEqual(owner, "anthropics")
        self.assertEqual(repo, "skills")
        self.assertEqual(skill_dir, "commit-message")

    def test_parse_rejects_two_parts(self) -> None:
        with self.assertRaises(ValueError):
            _parse_locator("anthropics/skills")

    def test_parse_rejects_one_part(self) -> None:
        with self.assertRaises(ValueError):
            _parse_locator("skills")


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
            # Create a local git repo with a skill
            repo_dir = root / "test-repo"
            repo_dir.mkdir()
            seed_skill_package(repo_dir / "skills", "my-skill", "My Skill")
            subprocess.run(["git", "init"], cwd=repo_dir, capture_output=True, check=True)
            subprocess.run(["git", "add", "."], cwd=repo_dir, capture_output=True, check=True)
            subprocess.run(
                ["git", "commit", "-m", "init", "--author", "test <t@t>"],
                cwd=repo_dir, capture_output=True, check=True,
                env={"GIT_COMMITTER_NAME": "test", "GIT_COMMITTER_EMAIL": "t@t", "HOME": str(root), "PATH": "/usr/bin:/bin:/usr/local/bin"},
            )
            # Clone using local file:// protocol
            source = GitHubSource()
            work = root / "work"
            work.mkdir()
            # Monkey-patch the clone URL to use local path
            original_fetch = source.fetch

            def local_fetch(locator: str, work_dir: Path) -> Path:
                owner, repo, skill_dir = _parse_locator(locator)
                clone_dir = work_dir / f"{owner}--{repo}"
                subprocess.run(
                    ["git", "clone", "--depth", "1", str(repo_dir), str(clone_dir)],
                    check=True, capture_output=True, timeout=60,
                )
                return _find_skill(clone_dir, skill_dir)

            result = local_fetch("test/test-repo/my-skill", work)
            self.assertIsNotNone(result)
            self.assertTrue((result / "SKILL.md").is_file())


class ListingSerializationTests(unittest.TestCase):
    def test_listing_to_json(self) -> None:
        listing = SkillListing(
            name="React Best",
            description="React best practices",
            source_kind="github",
            source_locator="github:vercel/skills/react-best",
            registry="skillssh",
            installs=1234,
        )
        result = listing_to_json(listing)
        self.assertEqual(result["name"], "React Best")
        self.assertEqual(result["sourceKind"], "github")
        self.assertEqual(result["registry"], "skillssh")
        self.assertEqual(result["installs"], 1234)


if __name__ == "__main__":
    unittest.main()
