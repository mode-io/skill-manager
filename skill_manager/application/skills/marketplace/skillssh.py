from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
from dataclasses import dataclass
import json
import re
from urllib.parse import quote

from skill_manager.errors import MarketplaceUpstreamError
from skill_manager.sources import is_valid_github_repo

from .client import DEFAULT_SKILLS_SH_BASE_URL, SkillsShClient
from .models import SkillsShSkill

_DETAIL_STOP_MARKERS = frozenset({
    "Weekly Installs",
    "Repository",
    "GitHub Stars",
    "First Seen",
    "Security Audits",
    "Installed on",
})


@dataclass(frozen=True)
class RawSkillsShSkill:
    source: str
    skill_id: str
    name: str
    installs: int
    description_hint: str = ""


def fetch_all_time_leaderboard(*, client: SkillsShClient | None = None) -> list[SkillsShSkill]:
    active_client = client or SkillsShClient.from_environment()
    html = active_client.fetch_text("/")
    try:
        return parse_homepage_leaderboard(html, detail_base_url=active_client.base_url)
    except ValueError as error:
        raise MarketplaceUpstreamError("payload", active_client.absolute_url("/"), str(error)) from error


def search_skills(query: str, *, limit: int = 20, client: SkillsShClient | None = None) -> list[SkillsShSkill]:
    active_client = client or SkillsShClient.from_environment()
    trimmed = query.strip()
    if len(trimmed) < 2:
        raise ValueError("Enter at least 2 characters to search skills.sh.")
    path = f"/api/search?q={quote(trimmed)}&limit={limit}"
    payload = active_client.fetch_json(path)
    raw_items = payload.get("skills")
    if not isinstance(raw_items, list):
        raise MarketplaceUpstreamError("payload", active_client.absolute_url(path), "skills.sh search payload is malformed")
    return normalize_skills(
        raw_skills=[
            raw_skill_from_payload(item)
            for item in raw_items
            if isinstance(item, dict)
        ],
        detail_base_url=active_client.base_url,
    )


def fetch_detail_page(detail_url: str, *, client: SkillsShClient | None = None) -> str:
    active_client = client or SkillsShClient.from_environment()
    return active_client.fetch_text(detail_url)


def parse_homepage_leaderboard(
    document: str,
    *,
    detail_base_url: str = DEFAULT_SKILLS_SH_BASE_URL,
) -> list[SkillsShSkill]:
    marker = "initialSkills"
    marker_index = document.find(marker)
    if marker_index < 0:
        raise ValueError("skills.sh homepage is missing the initial leaderboard payload")
    array_start = document.find("[", marker_index)
    if array_start < 0:
        raise ValueError("skills.sh homepage leaderboard payload is malformed")
    raw_items = _extract_bracketed(document, array_start)
    items = json.loads(bytes(raw_items, "utf-8").decode("unicode_escape"))
    return normalize_skills(
        raw_skills=[
            raw_skill_from_payload(item)
            for item in items
            if isinstance(item, dict)
        ],
        detail_base_url=detail_base_url,
    )


def extract_detail_description(document: str, *, skill_name: str, description_hint: str) -> str:
    blocks = _visible_text_blocks(document)
    summary = _section_first_content(blocks, section_name="Summary")
    if summary:
        return summary
    fallback = _section_first_content(blocks, section_name="SKILL.md", skip_values={skill_name})
    if fallback:
        return fallback
    return description_hint


def normalize_skills(*, raw_skills: list[RawSkillsShSkill | None], detail_base_url: str) -> list[SkillsShSkill]:
    normalized: list[SkillsShSkill] = []
    for raw_skill in raw_skills:
        skill = normalize_skill(raw_skill, detail_base_url=detail_base_url)
        if skill is not None:
            normalized.append(skill)
    return normalized


def normalize_skill(raw_skill: RawSkillsShSkill | None, *, detail_base_url: str) -> SkillsShSkill | None:
    if raw_skill is None or not is_valid_github_repo(raw_skill.source):
        return None
    return SkillsShSkill(
        repo=raw_skill.source,
        skill_id=raw_skill.skill_id,
        name=raw_skill.name,
        installs=raw_skill.installs,
        description_hint=raw_skill.description_hint,
        detail_base_url=detail_base_url,
    )


def raw_skill_from_payload(payload: dict[str, object]) -> RawSkillsShSkill | None:
    source = payload.get("source")
    skill_id = payload.get("skillId")
    if not isinstance(source, str) or not source or not isinstance(skill_id, str) or not skill_id:
        return None
    installs = payload.get("installs", 0)
    try:
        install_count = int(installs or 0)
    except (TypeError, ValueError):
        install_count = 0
    name = payload.get("name", skill_id)
    return RawSkillsShSkill(
        source=source,
        skill_id=skill_id,
        name=name if isinstance(name, str) and name else skill_id,
        installs=install_count,
        description_hint=payload.get("description", "") if isinstance(payload.get("description", ""), str) else "",
    )


def _extract_bracketed(document: str, start_index: int) -> str:
    depth = 0
    for index in range(start_index, len(document)):
        character = document[index]
        if character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
            if depth == 0:
                return document[start_index:index + 1]
    raise ValueError("unterminated skills.sh payload")


def _section_first_content(
    blocks: list[str],
    *,
    section_name: str,
    skip_values: set[str] | None = None,
) -> str:
    skip = skip_values or set()
    try:
        start = blocks.index(section_name)
    except ValueError:
        return ""
    for block in blocks[start + 1:]:
        if block in _DETAIL_STOP_MARKERS or block == "Summary" or block == "SKILL.md":
            break
        normalized = re.sub(r"\s+", " ", block).strip()
        if not normalized or normalized in skip:
            continue
        if len(normalized) < 20 or " " not in normalized:
            continue
        return normalized
    return ""


def _visible_text_blocks(document: str) -> list[str]:
    parser = _VisibleTextParser()
    parser.feed(document)
    parser.close()
    return parser.blocks


class _VisibleTextParser(HTMLParser):
    _BLOCK_TAGS = {
        "p",
        "div",
        "section",
        "article",
        "header",
        "footer",
        "main",
        "li",
        "ul",
        "ol",
        "table",
        "tr",
        "td",
        "th",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "pre",
    }
    _SKIP_TAGS = {"script", "style", "noscript", "template"}

    def __init__(self) -> None:
        super().__init__()
        self.blocks: list[str] = []
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._SKIP_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth == 0 and (tag in self._BLOCK_TAGS or tag == "br"):
            self._flush()

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
            return
        if self._skip_depth == 0 and tag in self._BLOCK_TAGS:
            self._flush()

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        text = unescape(data)
        if text.strip():
            self._parts.append(text)

    def close(self) -> None:
        self._flush()
        super().close()

    def _flush(self) -> None:
        if not self._parts:
            return
        text = re.sub(r"\s+", " ", "".join(self._parts)).strip()
        self._parts.clear()
        if text:
            self.blocks.append(text)
