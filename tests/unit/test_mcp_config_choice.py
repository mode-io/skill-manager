from __future__ import annotations

import unittest
from pathlib import Path

from skill_manager.application.mcp.config_choice import (
    config_choices_payload,
    recommended_observed_harness,
)
from skill_manager.application.mcp.contracts import McpHarnessScan, McpObservedEntry
from skill_manager.application.mcp.store import McpServerSpec, McpSource


def _stdio_spec(name: str, harness: str, env: tuple[tuple[str, str], ...] | None = None) -> McpServerSpec:
    return McpServerSpec(
        name=name,
        display_name=name,
        source=McpSource.adopted(harness, name),
        transport="stdio",
        command="uvx",
        args=(f"{name}-mcp",),
        env=env,
    )


def _http_spec(name: str, harness: str, url: str) -> McpServerSpec:
    return McpServerSpec(
        name=name,
        display_name=name,
        source=McpSource.adopted(harness, name),
        transport="http",
        url=url,
    )


class ConfigChoiceTests(unittest.TestCase):
    def test_config_choices_have_stable_ids_and_one_recommendation(self) -> None:
        managed = _http_spec("exa", "managed", "https://managed.example")
        scans = (
            McpHarnessScan(
                harness="cursor",
                label="Cursor",
                logo_key="cursor",
                installed=True,
                config_present=True,
                config_path=Path("/tmp/cursor.json"),
                entries=(
                    McpObservedEntry(
                        name="exa",
                        state="drifted",
                        raw_payload={"command": "uvx", "env": {"EXA_API_KEY": "${EXA_API_KEY}"}},
                        parsed_spec=_stdio_spec("exa", "cursor", env=(("EXA_API_KEY", "${EXA_API_KEY}"),)),
                    ),
                ),
            ),
            McpHarnessScan(
                harness="claude",
                label="Claude",
                logo_key="claude",
                installed=True,
                config_present=True,
                config_path=Path("/tmp/claude.json"),
                entries=(
                    McpObservedEntry(
                        name="exa",
                        state="drifted",
                        raw_payload={"url": "https://remote.example"},
                        parsed_spec=_http_spec("exa", "claude", "https://remote.example"),
                    ),
                ),
            ),
        )

        choices = config_choices_payload("exa", managed, scans)

        self.assertEqual([choice["id"] for choice in choices], ["managed", "harness:cursor", "harness:claude"])
        recommended = [choice for choice in choices if choice["recommended"]]
        self.assertEqual(len(recommended), 1)
        self.assertEqual(recommended[0]["id"], "harness:cursor")

    def test_recommended_observed_harness_prefers_stdio_env_reference(self) -> None:
        class Sighting:
            def __init__(self, harness: str, spec: McpServerSpec) -> None:
                self.harness = harness
                self.spec = spec

        selected = recommended_observed_harness(
            [
                Sighting("claude", _http_spec("exa", "claude", "https://remote.example")),
                Sighting("cursor", _stdio_spec("exa", "cursor", env=(("EXA_API_KEY", "${EXA_API_KEY}"),))),
            ]
        )

        self.assertEqual(selected, "cursor")


if __name__ == "__main__":
    unittest.main()
