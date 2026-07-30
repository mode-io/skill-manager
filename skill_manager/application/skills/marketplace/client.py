from __future__ import annotations

from urllib.parse import quote

from skill_manager.application.marketplace_http import (
    MarketplaceHttpClient,
    configured_base_url,
    configured_marketplace_ca_file,
)

DEFAULT_SKILLS_SH_BASE_URL = "https://skills.sh"
MARKETPLACE_BASE_URL_ENV = "SKILL_MANAGER_MARKETPLACE_BASE_URL"


def configured_marketplace_base_url(env: dict[str, str] | None = None) -> str:
    return configured_base_url(env, env_var=MARKETPLACE_BASE_URL_ENV, default=DEFAULT_SKILLS_SH_BASE_URL)


def skills_sh_detail_url(repo: str, skill_id: str, *, base_url: str = DEFAULT_SKILLS_SH_BASE_URL) -> str:
    normalized = (base_url or DEFAULT_SKILLS_SH_BASE_URL).rstrip("/")
    return f"{normalized}/{quote(repo, safe='/')}/{quote(skill_id, safe='')}"


class SkillsShClient(MarketplaceHttpClient):
    DEFAULT_BASE_URL = DEFAULT_SKILLS_SH_BASE_URL
    BASE_URL_ENV = MARKETPLACE_BASE_URL_ENV

    def detail_url(self, repo: str, skill_id: str) -> str:
        return skills_sh_detail_url(repo, skill_id, base_url=self.base_url)

    def fetch_text(self, path_or_url: str) -> str:
        return self._request(path_or_url).decode("utf-8", "replace")


__all__ = [
    "DEFAULT_SKILLS_SH_BASE_URL",
    "MARKETPLACE_BASE_URL_ENV",
    "SkillsShClient",
    "configured_marketplace_base_url",
    "configured_marketplace_ca_file",
    "skills_sh_detail_url",
]
