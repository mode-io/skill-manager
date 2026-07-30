from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class MarketplaceInstallationResponse(BaseModel):
    status: Literal["installable", "installed"]
    installedSkillRef: str | None = None


class MarketplaceSkillItemResponse(BaseModel):
    id: str
    name: str
    description: str
    installs: int
    stars: int | None = None
    repoLabel: str
    repoUrl: str
    repoImageUrl: str | None = None
    skillsDetailUrl: str
    installToken: str
    installation: MarketplaceInstallationResponse


class MarketplaceSkillPageResponse(BaseModel):
    items: list[MarketplaceSkillItemResponse]
    nextOffset: int | None = None
    hasMore: bool


class MarketplaceSkillSourceLinksResponse(BaseModel):
    repoLabel: str
    repoUrl: str
    folderUrl: str | None = None
    skillsDetailUrl: str


class MarketplaceSkillDetailResponse(BaseModel):
    id: str
    name: str
    description: str
    installs: int
    stars: int | None = None
    repoLabel: str
    repoImageUrl: str | None = None
    sourceLinks: MarketplaceSkillSourceLinksResponse
    installation: MarketplaceInstallationResponse
    installToken: str


class MarketplaceSkillDocumentResponse(BaseModel):
    status: Literal["ready", "unavailable"]
    documentMarkdown: str | None = None


__all__ = [
    "MarketplaceInstallationResponse",
    "MarketplaceSkillDetailResponse",
    "MarketplaceSkillDocumentResponse",
    "MarketplaceSkillItemResponse",
    "MarketplaceSkillPageResponse",
    "MarketplaceSkillSourceLinksResponse",
]
