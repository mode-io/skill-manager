from __future__ import annotations

from pydantic import BaseModel


class CliMarketplaceItemResponse(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    marketplaceUrl: str
    iconUrl: str | None = None
    githubUrl: str | None = None
    websiteUrl: str | None = None
    stars: int | None = None
    language: str | None = None
    category: str | None = None
    hasMcp: bool
    hasSkill: bool
    isOfficial: bool
    isTui: bool
    sourceType: str | None = None
    vendorName: str | None = None


class CliMarketplacePageResponse(BaseModel):
    items: list[CliMarketplaceItemResponse]
    nextOffset: int | None = None
    hasMore: bool


class CliMarketplaceDetailResponse(CliMarketplaceItemResponse):
    longDescription: str | None = None
    installCommand: str | None = None


__all__ = [
    "CliMarketplaceDetailResponse",
    "CliMarketplaceItemResponse",
    "CliMarketplacePageResponse",
]
