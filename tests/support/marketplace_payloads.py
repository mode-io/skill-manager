from __future__ import annotations

import json

FIXTURE_SKILLS = [
    {
        "repo": "mode-io/skills",
        "skillId": "mode-switch",
        "name": "Mode Switch",
        "installs": 128,
        "description": "Switch between supported skill execution modes.",
    },
    {
        "repo": "vercel-labs/skills",
        "skillId": "trace-scout",
        "name": "Trace Scout",
        "installs": 84,
        "description": "Review traces and highlight suspicious flows.",
    },
    {
        "repo": "microsoft/github-copilot-for-azure",
        "skillId": "azure-observability",
        "name": "Azure Observability",
        "installs": 32,
        "description": "Investigate Azure telemetry and platform health.",
    },
    {
        "repo": "mode-io/skills",
        "skillId": "switch-audit",
        "name": "Switch Audit",
        "installs": 12,
        "description": "Audit switch transitions across environments.",
    },
]

FIXTURE_FOLDER_URLS = {
    "mode-switch": "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
    "trace-scout": "https://github.com/vercel-labs/skills/tree/main/skills/trace-scout",
    "azure-observability": "https://github.com/microsoft/github-copilot-for-azure/tree/main/skills/azure-observability",
    "switch-audit": "https://github.com/mode-io/skills/tree/main/skills/switch-audit",
}


def fixture_homepage_html() -> str:
    payload = [
        {
            "source": item["repo"],
            "skillId": item["skillId"],
            "name": item["name"],
            "installs": item["installs"],
        }
        for item in FIXTURE_SKILLS
    ]
    return (
        "<html><body><script>"
        f"const initialSkills = {json.dumps(payload)};"
        "</script></body></html>"
    )


def fixture_search_payload(query: str, *, limit: int) -> dict[str, object]:
    needle = query.strip().lower()
    return {
        "skills": [
            {
                "source": item["repo"],
                "skillId": item["skillId"],
                "name": item["name"],
                "installs": item["installs"],
                "description": item["description"],
            }
            for item in FIXTURE_SKILLS
            if needle in item["name"].lower() or needle in item["description"].lower()
        ][:limit]
    }


def fixture_detail_html(repo: str, skill_id: str) -> str | None:
    record = next((item for item in FIXTURE_SKILLS if item["repo"] == repo and item["skillId"] == skill_id), None)
    if record is None:
        return None
    return f"""
    <section>
      <h2>Summary</h2>
      <p>{record["description"]}</p>
      <h2>SKILL.md</h2>
      <p>{record["name"]}</p>
      <p>{record["description"]}</p>
    </section>
    """
