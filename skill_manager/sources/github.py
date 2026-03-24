from __future__ import annotations

from pathlib import Path
import subprocess

def _parse_locator(locator: str) -> tuple[str, str, str]:
    """Parse 'owner/repo/skill-dir' into (owner, repo, skill_dir)."""
    parts = locator.split("/", 2)
    if len(parts) != 3:
        raise ValueError(f"invalid github locator (expected owner/repo/skill-dir): {locator}")
    return parts[0], parts[1], parts[2]


def _find_skill(clone_dir: Path, skill_dir: str) -> Path | None:
    """Find a skill directory by dir name or SKILL.md name field (recursive)."""
    # First pass: match directory name
    for skill_md in clone_dir.rglob("SKILL.md"):
        if skill_md.parent.name == skill_dir:
            return skill_md.parent
    # Second pass: match the name field in SKILL.md frontmatter
    for skill_md in clone_dir.rglob("SKILL.md"):
        try:
            content = skill_md.read_text(encoding="utf-8")
            for line in content.splitlines()[1:]:  # skip first ---
                if line.strip() == "---":
                    break
                if line.startswith("name:"):
                    name_value = line.split(":", 1)[1].strip().strip("'\"")
                    if name_value == skill_dir:
                        return skill_md.parent
        except Exception:  # noqa: BLE001
            continue
    return None


class GitHubSource:
    """Fetches skill packages from GitHub repositories."""

    def fetch(self, locator: str, work_dir: Path) -> Path:
        """Clone a repo and extract a single skill directory.

        Locator format: 'owner/repo/skill-dir'
        """
        owner, repo, skill_dir = _parse_locator(locator)
        clone_dir = work_dir / f"{owner}--{repo}"
        subprocess.run(
            [
                "git", "clone", "--depth", "1",
                f"https://github.com/{owner}/{repo}.git",
                str(clone_dir),
            ],
            check=True,
            capture_output=True,
            timeout=60,
        )
        skill_path = _find_skill(clone_dir, skill_dir)
        if skill_path is None:
            raise ValueError(f"skill directory '{skill_dir}' not found in {owner}/{repo}")
        return skill_path
