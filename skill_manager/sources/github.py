from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import subprocess
import time
from typing import Callable
from urllib.request import Request, urlopen

_CACHE_TTL_SECONDS = 900
_TIMEOUT_SECONDS = 10


@dataclass(frozen=True)
class GitHubRepoMetadata:
    repo: str | None
    repo_url: str | None
    owner_login: str | None
    owner_avatar_url: str | None
    stars: int


@dataclass(frozen=True)
class GitHubOwnerMetadata:
    login: str
    profile_url: str | None
    avatar_url: str | None


@dataclass(frozen=True)
class GitHubAvatarAsset:
    content_type: str
    body: bytes


@dataclass(frozen=True)
class GitHubIdentity:
    repo: str | None
    owner: str | None


@dataclass(frozen=True)
class GitHubIdentitySnapshot:
    identity: GitHubIdentity
    repo_metadata: GitHubRepoMetadata | None
    owner_metadata: GitHubOwnerMetadata | None

    @property
    def repo(self) -> str | None:
        return self.identity.repo

    @property
    def owner(self) -> str | None:
        return self.identity.owner

    @property
    def repo_url(self) -> str | None:
        if self.repo_metadata is not None and self.repo_metadata.repo_url:
            return self.repo_metadata.repo_url
        if self.repo is not None:
            return github_repo_url(self.repo)
        return None

    @property
    def owner_url(self) -> str | None:
        if self.owner_metadata is not None and self.owner_metadata.profile_url:
            return self.owner_metadata.profile_url
        if self.owner is not None:
            return f"https://github.com/{self.owner}"
        return None

    @property
    def avatar_url(self) -> str | None:
        if self.owner_metadata is not None and self.owner_metadata.avatar_url:
            return self.owner_metadata.avatar_url
        if self.repo_metadata is not None and self.repo_metadata.owner_avatar_url:
            return self.repo_metadata.owner_avatar_url
        return None

    @property
    def stars(self) -> int:
        if self.repo_metadata is not None:
            return self.repo_metadata.stars
        return 0


MetadataFetcher = Callable[[str], GitHubRepoMetadata | None]
OwnerFetcher = Callable[[str], GitHubOwnerMetadata | None]
AvatarFetcher = Callable[[str], GitHubAvatarAsset | None]


def _parse_locator(locator: str) -> tuple[str, str, str]:
    """Parse 'owner/repo/skill-dir' into (owner, repo, skill_dir)."""
    parts = locator.split("/", 2)
    if len(parts) != 3:
        raise ValueError(f"invalid github locator (expected owner/repo/skill-dir): {locator}")
    return parts[0], parts[1], parts[2]


def github_repo_from_locator(locator: str) -> str | None:
    try:
        owner, repo, _ = _parse_locator(locator.removeprefix("github:"))
    except ValueError:
        return None
    return f"{owner}/{repo}"


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
    except Exception:  # noqa: BLE001
        return None

    owner_payload = payload.get("owner")
    owner_login = owner_payload.get("login") if isinstance(owner_payload, dict) else None
    owner_avatar_url = owner_payload.get("avatar_url") if isinstance(owner_payload, dict) else None
    repo_url = payload.get("html_url")
    stars = payload.get("stargazers_count", 0)

    if not isinstance(owner_login, str) or not owner_login:
        owner_login = _owner_from_repo(repo)
    if not isinstance(owner_avatar_url, str) or not owner_avatar_url:
        owner_avatar_url = None
    if not isinstance(repo_url, str) or not repo_url:
        repo_url = github_repo_url(repo)
    try:
        star_count = int(stars)
    except (TypeError, ValueError):
        star_count = 0

    return GitHubRepoMetadata(
        repo=repo,
        repo_url=repo_url,
        owner_login=owner_login,
        owner_avatar_url=owner_avatar_url,
        stars=star_count,
    )


def _default_avatar_fetcher(avatar_url: str) -> GitHubAvatarAsset | None:
    request = Request(avatar_url, headers=_github_headers("image/*"))
    try:
        with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            content_type = response.headers.get("Content-Type", "application/octet-stream").split(";", 1)[0]
            body = response.read()
    except Exception:  # noqa: BLE001
        return None
    return GitHubAvatarAsset(content_type=content_type, body=body)


def _default_owner_fetcher(login: str) -> GitHubOwnerMetadata | None:
    request = Request(
        f"https://api.github.com/users/{login}",
        headers=_github_headers("application/vnd.github+json"),
    )
    try:
        with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:  # noqa: BLE001
        return None

    owner_login = payload.get("login")
    avatar_url = payload.get("avatar_url")
    profile_url = payload.get("html_url")
    if not isinstance(owner_login, str) or not owner_login:
        owner_login = login
    if not isinstance(avatar_url, str) or not avatar_url:
        avatar_url = None
    if not isinstance(profile_url, str) or not profile_url:
        profile_url = f"https://github.com/{owner_login}"
    return GitHubOwnerMetadata(
        login=owner_login,
        profile_url=profile_url,
        avatar_url=avatar_url,
    )


def _owner_from_repo(repo: str | None) -> str | None:
    if not repo or repo.count("/") != 1:
        return None
    return repo.split("/", 1)[0]


def github_repo_url(repo: str) -> str:
    return f"https://github.com/{repo}"


def _is_valid_repo(repo: str) -> bool:
    if repo.count("/") != 1:
        return False
    owner, name = repo.split("/", 1)
    return bool(owner and name and " " not in owner and " " not in name)


class GitHubRepoMetadataClient:
    def __init__(
        self,
        *,
        metadata_fetcher: MetadataFetcher | None = None,
        owner_fetcher: OwnerFetcher | None = None,
        avatar_fetcher: AvatarFetcher | None = None,
        ttl_seconds: int = _CACHE_TTL_SECONDS,
    ) -> None:
        self._metadata_fetcher = metadata_fetcher or _default_metadata_fetcher
        self._owner_fetcher = owner_fetcher or _default_owner_fetcher
        self._avatar_fetcher = avatar_fetcher or _default_avatar_fetcher
        self._ttl_seconds = ttl_seconds
        self._metadata_cache: dict[str, tuple[float, GitHubRepoMetadata | None]] = {}
        self._owner_cache: dict[str, tuple[float, GitHubOwnerMetadata | None]] = {}
        self._avatar_cache: dict[str, tuple[float, GitHubAvatarAsset | None]] = {}

    def identity_snapshot(self, *, repo: str | None = None, owner: str | None = None) -> GitHubIdentitySnapshot:
        identity = self._normalize_identity(repo=repo, owner=owner)
        repo_metadata = self.metadata_for_repo(identity.repo) if identity.repo is not None else None
        resolved_owner = identity.owner
        if repo_metadata is not None and repo_metadata.owner_login:
            resolved_owner = repo_metadata.owner_login
        needs_owner_metadata = (
            resolved_owner is not None
            and (
                repo_metadata is None
                or not repo_metadata.owner_avatar_url
            )
        )
        owner_metadata = self.owner_metadata_for_login(resolved_owner) if needs_owner_metadata else None
        return GitHubIdentitySnapshot(
            identity=GitHubIdentity(repo=identity.repo, owner=resolved_owner),
            repo_metadata=repo_metadata,
            owner_metadata=owner_metadata,
        )

    def metadata_for_repo(self, repo: str) -> GitHubRepoMetadata | None:
        identity = self._normalize_identity(repo=repo)
        if identity.repo is None:
            return None
        return self._get_or_fetch(
            self._metadata_cache,
            identity.repo,
            lambda: self._metadata_fetcher(identity.repo),
        )

    def owner_metadata_for_login(self, login: str) -> GitHubOwnerMetadata | None:
        identity = self._normalize_identity(owner=login)
        if identity.owner is None:
            return None
        return self._get_or_fetch(
            self._owner_cache,
            identity.owner,
            lambda: self._owner_fetcher(identity.owner),
        )

    def avatar_for_repo(self, repo: str) -> GitHubAvatarAsset | None:
        return self.avatar_for_identity(repo=repo)

    def avatar_for_owner(self, login: str) -> GitHubAvatarAsset | None:
        return self.avatar_for_identity(owner=login)

    def avatar_for_identity(
        self,
        *,
        repo: str | None = None,
        owner: str | None = None,
    ) -> GitHubAvatarAsset | None:
        snapshot = self.identity_snapshot(repo=repo, owner=owner)
        avatar_url = snapshot.avatar_url
        cache_key = self._avatar_cache_key(snapshot.identity)
        if cache_key is None or avatar_url is None:
            return None
        cached = self._avatar_cache.get(cache_key)
        now = time.time()
        if cached is not None and (now - cached[0]) < self._ttl_seconds:
            return cached[1]

        asset = self._avatar_fetcher(avatar_url)
        if asset is not None:
            self._avatar_cache[cache_key] = (now, asset)
        return asset

    def _get_or_fetch(
        self,
        cache: dict[str, tuple[float, GitHubRepoMetadata | GitHubOwnerMetadata | GitHubAvatarAsset | None]],
        key: str,
        fetcher: Callable[[], GitHubRepoMetadata | GitHubOwnerMetadata | GitHubAvatarAsset | None],
    ) -> GitHubRepoMetadata | GitHubOwnerMetadata | GitHubAvatarAsset | None:
        cached = cache.get(key)
        now = time.time()
        if cached is not None and (now - cached[0]) < self._ttl_seconds:
            return cached[1]

        value = fetcher()
        if value is not None:
            cache[key] = (now, value)
        else:
            cache.pop(key, None)
        return value

    @staticmethod
    def _normalize_identity(*, repo: str | None = None, owner: str | None = None) -> GitHubIdentity:
        normalized_repo = repo if isinstance(repo, str) and _is_valid_repo(repo) else None
        normalized_owner = owner if isinstance(owner, str) and owner and "/" not in owner and " " not in owner else None
        if normalized_owner is None and normalized_repo is not None:
            normalized_owner = _owner_from_repo(normalized_repo)
        return GitHubIdentity(repo=normalized_repo, owner=normalized_owner)

    @staticmethod
    def _avatar_cache_key(identity: GitHubIdentity) -> str | None:
        if identity.repo is not None:
            return identity.repo
        if identity.owner is not None:
            return f"owner:{identity.owner}"
        return None


def _find_skill(clone_dir: Path, skill_dir: str) -> Path | None:
    """Find a skill directory by dir name or SKILL.md name field (recursive)."""
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
    """Fetches skill packages from GitHub repositories."""

    def fetch(self, locator: str, work_dir: Path) -> Path:
        """Clone a repo and extract a single skill directory.

        Locator format: 'owner/repo/skill-dir'
        """
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
