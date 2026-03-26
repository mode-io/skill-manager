from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

from .types import SkillListing

_TIMEOUT = 10


def _fetch_json(url: str) -> dict:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "skill-manager/0.1"})
    with urlopen(request, timeout=_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def search_skillssh(query: str, *, limit: int = 20) -> list[SkillListing]:
    """Search skills.sh (Vercel) registry. Results resolve to GitHub sources."""
    url = f"https://skills.sh/api/search?q={quote(query)}&limit={limit}"
    payload = _fetch_json(url)
    return [
        SkillListing(
            name=item.get("name", item.get("skillId", "")),
            description=item.get("description", ""),
            source_kind="github",
            source_locator=f"github:{item['source']}/{item['skillId']}"
            if "source" in item and "skillId" in item
            else "",
            registry="skillssh",
            installs=item.get("installs", 0),
            github_repo=item.get("source"),
            github_owner=_extract_github_owner(item),
        )
        for item in payload.get("skills", [])
        if item.get("source") and item.get("skillId")
    ]


def search_agentskill(query: str, *, limit: int = 20) -> list[SkillListing]:
    """Search agentskill.sh registry."""
    url = f"https://agentskill.sh/api/agent/search?q={quote(query)}&limit={limit}"
    payload = _fetch_json(url)
    items = payload.get("skills", payload.get("results", []))
    return [
        SkillListing(
            name=item.get("name", ""),
            description=item.get("description", ""),
            source_kind="agentskill",
            source_locator=f"agentskill:{item['slug']}",
            registry="agentskill",
            installs=item.get("installCount", 0),
            github_repo=_extract_github_repo(item),
            github_owner=_extract_github_owner(item),
            github_stars=int(item.get("githubStars", 0) or 0),
        )
        for item in items
        if item.get("slug")
    ]


def fetch_agentskill(slug: str, work_dir: Path) -> Path:
    """Fetch skill content from agentskill.sh install API."""
    url = f"https://agentskill.sh/api/agent/skills/{quote(slug, safe='')}/install?platform=claude"
    payload = _fetch_json(url)
    skill_dir = work_dir / slug
    skill_dir.mkdir(parents=True)
    content = payload.get("skillMd", payload.get("content", payload.get("skill", "")))
    if not content:
        raise ValueError(f"empty skill content returned for {slug}")
    (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")
    return skill_dir


def _extract_github_repo(item: dict[str, object]) -> str | None:
    for key in ("githubRepo", "repo", "repository", "source"):
        value = item.get(key)
        if isinstance(value, str) and value.count("/") == 1 and not value.startswith("http"):
            return value
    for key in ("githubUrl", "repoUrl", "repositoryUrl"):
        value = item.get(key)
        if isinstance(value, str) and "github.com/" in value:
            repo = value.split("github.com/", 1)[1].strip("/")
            parts = repo.split("/")
            if len(parts) >= 2:
                return f"{parts[0]}/{parts[1]}"
    return None


def _extract_github_owner(item: dict[str, object]) -> str | None:
    for key in ("owner", "githubOwner", "ownerLogin"):
        value = item.get(key)
        if isinstance(value, str) and value and "/" not in value and not value.startswith("http"):
            return value
    repo = _extract_github_repo(item)
    if repo is not None:
        return repo.split("/", 1)[0]
    slug = item.get("slug")
    if isinstance(slug, str) and slug.count("/") >= 1:
        return slug.split("/", 1)[0]
    return None
