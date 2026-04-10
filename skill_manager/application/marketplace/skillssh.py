from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import json
import re
from urllib.parse import quote
from urllib.request import Request, urlopen

from .models import SkillsShSkill

_TIMEOUT_SECONDS = 15
_USER_AGENT = "skill-manager/0.1"
_DETAIL_STOP_MARKERS = frozenset({
    "Weekly Installs",
    "Repository",
    "GitHub Stars",
    "First Seen",
    "Security Audits",
    "Installed on",
})


def fetch_all_time_leaderboard() -> list[SkillsShSkill]:
    html = _fetch_text("https://skills.sh/")
    return parse_homepage_leaderboard(html)


def search_skills(query: str, *, limit: int = 20) -> list[SkillsShSkill]:
    trimmed = query.strip()
    if len(trimmed) < 2:
        raise ValueError("Enter at least 2 characters to search skills.sh.")
    payload = _fetch_json(f"https://skills.sh/api/search?q={quote(trimmed)}&limit={limit}")
    return [
        SkillsShSkill(
            repo=item["source"],
            skill_id=item["skillId"],
            name=item.get("name", item["skillId"]),
            installs=int(item.get("installs", 0) or 0),
            description_hint=item.get("description", ""),
        )
        for item in payload.get("skills", [])
        if isinstance(item, dict) and item.get("source") and item.get("skillId")
    ]


def fetch_detail_page(detail_url: str) -> str:
    return _fetch_text(detail_url)


def parse_homepage_leaderboard(document: str) -> list[SkillsShSkill]:
    marker = "initialSkills"
    marker_index = document.find(marker)
    if marker_index < 0:
        raise ValueError("skills.sh homepage is missing the initial leaderboard payload")
    array_start = document.find("[", marker_index)
    if array_start < 0:
        raise ValueError("skills.sh homepage leaderboard payload is malformed")
    raw_items = _extract_bracketed(document, array_start)
    items = json.loads(bytes(raw_items, "utf-8").decode("unicode_escape"))
    return [
        SkillsShSkill(
            repo=item["source"],
            skill_id=item["skillId"],
            name=item.get("name", item["skillId"]),
            installs=int(item.get("installs", 0) or 0),
        )
        for item in items
        if isinstance(item, dict) and item.get("source") and item.get("skillId")
    ]


def extract_detail_description(document: str, *, skill_name: str, description_hint: str) -> str:
    blocks = _visible_text_blocks(document)
    summary = _section_first_content(blocks, section_name="Summary")
    if summary:
        return summary
    fallback = _section_first_content(blocks, section_name="SKILL.md", skip_values={skill_name})
    if fallback:
        return fallback
    return description_hint


def _fetch_json(url: str) -> dict[str, object]:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": _USER_AGENT})
    with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def _fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": _USER_AGENT})
    with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
        return response.read().decode("utf-8", "replace")


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
