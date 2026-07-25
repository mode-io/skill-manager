from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel

from skill_manager.paths import AppPaths


class ScaffoldRequest(BaseModel):
    asset_type: str  # "skill", "agent", "mcp", "hook"
    name: str
    description: str


class ScaffoldService:
    def __init__(self, paths: AppPaths):
        self.paths = paths

    def scaffold_asset(self, req: ScaffoldRequest) -> Path:
        templates_dir = Path(__file__).parent.parent / "data" / "templates"
        slug = req.name.lower().replace(" ", "-").replace("/", "-")
        
        if req.asset_type == "skill":
            template_path = templates_dir / "skill.md"
            out_dir = self.paths.skills_store_root / slug
            out_file = out_dir / "SKILL.md"
        elif req.asset_type == "agent":
            template_path = templates_dir / "agent.md"
            out_dir = self.paths.agents_root
            out_file = out_dir / f"{slug}.md"
        elif req.asset_type == "mcp":
            template_path = templates_dir / "mcp.json"
            out_dir = self.paths.data_dir / "mcp" / "scaffolded"
            out_file = out_dir / f"{slug}.json"
        elif req.asset_type == "hook":
            template_path = templates_dir / "hook.sh"
            out_dir = self.paths.data_dir / "hooks" / "scaffolded"
            out_file = out_dir / f"{slug}.sh"
        else:
            raise ValueError(f"Unknown asset type: {req.asset_type}")

        if not template_path.exists():
            raise FileNotFoundError(f"Template for {req.asset_type} not found at {template_path}")

        template_content = template_path.read_text(encoding="utf-8")
        
        hydrated = template_content.replace("{{name}}", req.name)
        hydrated = hydrated.replace("{{description}}", req.description)
        
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file.write_text(hydrated, encoding="utf-8")
        
        return out_file

