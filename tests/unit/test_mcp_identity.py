from __future__ import annotations

import unittest
from pathlib import Path

from skill_manager.application.mcp.contracts import McpHarnessScan, McpObservedEntry
from skill_manager.application.mcp.identity import build_identity_plan
from skill_manager.application.mcp.store import McpServerSpec, McpSource


def _http_spec(name: str, url: str) -> McpServerSpec:
    return McpServerSpec(
        name=name,
        display_name=name.title(),
        source=McpSource.adopted("cursor", name),
        transport="http",
        url=url,
    )


def _stdio_spec(name: str, args: tuple[str, ...]) -> McpServerSpec:
    return McpServerSpec(
        name=name,
        display_name=name.title(),
        source=McpSource.adopted("cursor", name),
        transport="stdio",
        command="uvx",
        args=args,
    )


def _scan(
    harness: str,
    label: str,
    entries: list[McpObservedEntry],
) -> McpHarnessScan:
    return McpHarnessScan(
        harness=harness,
        label=label,
        logo_key=harness,
        installed=True,
        config_present=True,
        config_path=Path(f"/tmp/{harness}.json"),
        entries=tuple(entries),
    )


class BuildIdentityPlanTests(unittest.TestCase):
    def test_identical_entries_merge_into_one_group(self) -> None:
        scans = [
            _scan(
                "cursor",
                "Cursor",
                [
                    McpObservedEntry(
                        name="exa",
                        state="unmanaged",
                        raw_payload={"url": "https://exa.run"},
                        parsed_spec=_http_spec("exa", "https://exa.run"),
                    )
                ],
            ),
            _scan(
                "claude",
                "Claude",
                [
                    McpObservedEntry(
                        name="exa",
                        state="unmanaged",
                        raw_payload={"url": "https://exa.run"},
                        parsed_spec=_http_spec("exa", "https://exa.run"),
                    )
                ],
            ),
        ]
        plan = build_identity_plan(scans)
        self.assertEqual(len(plan.groups), 1)
        self.assertEqual(plan.groups[0].name, "exa")
        self.assertTrue(plan.groups[0].identical)
        self.assertIsNotNone(plan.groups[0].canonical_spec)
        self.assertEqual({s.harness for s in plan.groups[0].sightings}, {"cursor", "claude"})
        self.assertEqual(plan.issues, ())

    def test_differing_specs_classify_as_differs(self) -> None:
        scans = [
            _scan(
                "cursor",
                "Cursor",
                [
                    McpObservedEntry(
                        name="exa",
                        state="unmanaged",
                        raw_payload={"url": "https://exa.run"},
                        parsed_spec=_http_spec("exa", "https://exa.run"),
                    )
                ],
            ),
            _scan(
                "claude",
                "Claude",
                [
                    McpObservedEntry(
                        name="exa",
                        state="unmanaged",
                        raw_payload={"command": "uvx", "args": ["exa-mcp"]},
                        parsed_spec=_stdio_spec("exa", ("exa-mcp",)),
                    )
                ],
            ),
        ]
        plan = build_identity_plan(scans)
        self.assertEqual(len(plan.groups), 1)
        self.assertFalse(plan.groups[0].identical)
        self.assertIsNone(plan.groups[0].canonical_spec)
        self.assertEqual(len(plan.groups[0].sightings), 2)

    def test_excluded_names_are_skipped(self) -> None:
        scans = [
            _scan(
                "cursor",
                "Cursor",
                [
                    McpObservedEntry(
                        name="exa",
                        state="unmanaged",
                        raw_payload={"url": "https://exa.run"},
                        parsed_spec=_http_spec("exa", "https://exa.run"),
                    )
                ],
            ),
            _scan(
                "claude",
                "Claude",
                [
                    McpObservedEntry(
                        name="other",
                        state="unmanaged",
                        raw_payload={"url": "https://other.run"},
                        parsed_spec=_http_spec("other", "https://other.run"),
                    )
                ],
            ),
        ]
        plan = build_identity_plan(scans, excluded_names=["exa"])
        self.assertEqual([group.name for group in plan.groups], ["other"])

    def test_unparseable_entries_are_reported_as_issues(self) -> None:
        scans = [
            _scan(
                "cursor",
                "Cursor",
                [
                    McpObservedEntry(
                        name="broken",
                        state="unmanaged",
                        raw_payload={"command": ["unexpected"]},
                        parse_issue="command must be a string",
                    )
                ],
            )
        ]
        plan = build_identity_plan(scans)
        self.assertEqual(plan.groups, ())
        self.assertEqual(len(plan.issues), 1)
        self.assertEqual(plan.issues[0].name, "broken")
        self.assertEqual(plan.issues[0].harness, "cursor")
        self.assertEqual(plan.issues[0].reason, "command must be a string")


if __name__ == "__main__":
    unittest.main()
