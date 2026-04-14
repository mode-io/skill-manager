from __future__ import annotations

from dataclasses import dataclass

from .client import DEFAULT_SKILLS_SH_BASE_URL, skills_sh_detail_url


@dataclass(frozen=True)
class SkillsShSkill:
    repo: str
    skill_id: str
    name: str
    installs: int
    description_hint: str = ""
    detail_base_url: str = DEFAULT_SKILLS_SH_BASE_URL

    @property
    def source_locator(self) -> str:
        return f"github:{self.repo}/{self.skill_id}"

    @property
    def detail_url(self) -> str:
        return skills_sh_detail_url(self.repo, self.skill_id, base_url=self.detail_base_url)


@dataclass(frozen=True)
class RepoDisplayMetadata:
    stars: int | None
    image_url: str | None
    default_branch: str | None


@dataclass(frozen=True)
class MarketplaceCard:
    id: str
    name: str
    description: str
    installs: int
    stars: int | None
    repo_label: str
    repo_image_url: str | None
    github_folder_url: str | None
    skills_detail_url: str
    install_token: str

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "installs": self.installs,
            "stars": self.stars,
            "repoLabel": self.repo_label,
            "repoImageUrl": self.repo_image_url,
            "githubFolderUrl": self.github_folder_url,
            "skillsDetailUrl": self.skills_detail_url,
            "installToken": self.install_token,
        }


@dataclass(frozen=True)
class MarketplacePageResult:
    items: tuple[MarketplaceCard, ...]
    next_offset: int | None
    has_more: bool

    def to_dict(self) -> dict[str, object]:
        return {
            "items": [item.to_dict() for item in self.items],
            "nextOffset": self.next_offset,
            "hasMore": self.has_more,
        }
