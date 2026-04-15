from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import socket
import subprocess
import time
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

_CACHE_TTL_SECONDS = 900
_TIMEOUT_SECONDS = 10


@dataclass(frozen=True)
class GitHubRepoMetadata:
    repo: str | None
    stars: int
    default_branch: str | None = None


class GitHubRepoMetadataError(Exception):
    def __init__(self, repo: str, detail: str, *, status_code: int | None = None) -> None:
        self.repo = repo
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


MetadataFetcher = Callable[[str], GitHubRepoMetadata | None]


def _parse_locator(locator: str) -> tuple[str, str, str]:
    parts = locator.split("/", 2)
    if len(parts) != 3:
        raise ValueError(f"invalid github locator (expected owner/repo/skill-dir): {locator}")
    return parts[0], parts[1], parts[2]


def _parse_repo_identity(locator: str) -> tuple[str, str, str | None]:
    stripped = locator.removeprefix("github:")
    parts = stripped.split("/")
    if len(parts) == 2:
        return parts[0], parts[1], None
    if len(parts) == 3:
        return parts[0], parts[1], parts[2]
    raise ValueError(f"invalid github locator (expected owner/repo or owner/repo/skill-dir): {locator}")


def github_repo_from_locator(locator: str) -> str | None:
    try:
        owner, repo, _ = _parse_repo_identity(locator)
    except ValueError:
        return None
    return f"{owner}/{repo}"


def github_skill_dir_from_locator(locator: str) -> str | None:
    try:
        _, _, skill_dir = _parse_repo_identity(locator)
    except ValueError:
        return None
    return skill_dir


def is_valid_github_repo(repo: str) -> bool:
    if repo.count("/") != 1:
        return False
    owner, name = repo.split("/", 1)
    return bool(owner and name and " " not in owner and " " not in name)


def github_repo_owner(repo: str) -> str | None:
    if not is_valid_github_repo(repo):
        return None
    return repo.split("/", 1)[0]


def github_repo_url(repo: str) -> str:
    return f"https://github.com/{repo}"


def github_owner_avatar_url(repo: str, *, size: int = 96) -> str | None:
    owner = github_repo_owner(repo)
    if owner is None:
        return None
    return f"https://github.com/{owner}.png?size={size}"


def _github_headers(accept: str) -> dict[str, str]:
    return {
        "Accept": accept,
        "User-Agent": "skill-manager/0.1",
    }


def _default_metadata_fetcher(repo: str) -> GitHubRepoMetadata | None:
    request = Request(
        f"https://api.github.com/repos/{repo}",
        headers=_github_headers("application/vnd.github+json"),
    )
    try:
        with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code == 404:
            return None
        raise GitHubRepoMetadataError(repo, f"upstream returned HTTP {error.code}", status_code=error.code) from error
    except TimeoutError as error:
        raise GitHubRepoMetadataError(repo, str(error)) from error
    except URLError as error:
        reason = error.reason
        if isinstance(reason, (TimeoutError, socket.timeout)):
            raise GitHubRepoMetadataError(repo, str(reason)) from error
        raise GitHubRepoMetadataError(repo, str(reason)) from error
    except OSError as error:
        raise GitHubRepoMetadataError(repo, str(error)) from error

    stars = payload.get("stargazers_count", 0)
    default_branch = payload.get("default_branch")

    try:
        star_count = int(stars)
    except (TypeError, ValueError):
        star_count = 0
    if not isinstance(default_branch, str) or not default_branch:
        default_branch = None

    return GitHubRepoMetadata(
        repo=repo,
        stars=star_count,
        default_branch=default_branch,
    )


class GitHubRepoMetadataClient:
    def __init__(
        self,
        *,
        metadata_fetcher: MetadataFetcher | None = None,
        ttl_seconds: int = _CACHE_TTL_SECONDS,
    ) -> None:
        self._metadata_fetcher = metadata_fetcher or _default_metadata_fetcher
        self._ttl_seconds = ttl_seconds
        self._metadata_cache: dict[str, tuple[float, GitHubRepoMetadata | None]] = {}

    def metadata_for_repo(self, repo: str) -> GitHubRepoMetadata | None:
        if not is_valid_github_repo(repo):
            return None
        cached = self._metadata_cache.get(repo)
        now = time.time()
        if cached is not None and (now - cached[0]) < self._ttl_seconds:
            return cached[1]

        value = self._metadata_fetcher(repo)
        if value is not None:
            self._metadata_cache[repo] = (now, value)
        else:
            self._metadata_cache.pop(repo, None)
        return value


def _find_skill(clone_dir: Path, skill_dir: str) -> Path | None:
    for skill_md in clone_dir.rglob("SKILL.md"):
        if skill_md.parent.name == skill_dir:
            return skill_md.parent
    for skill_md in clone_dir.rglob("SKILL.md"):
        try:
            content = skill_md.read_text(encoding="utf-8")
            for line in content.splitlines()[1:]:
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
    def fetch(self, locator: str, work_dir: Path) -> Path:
        owner, repo, skill_dir = _parse_locator(locator)
        clone_dir = work_dir / f"{owner}--{repo}"
        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
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
