from __future__ import annotations

import unittest

from skill_manager.application.marketplace_descriptions import MarketplaceDescriptionResolver


class MarketplaceDescriptionResolverTests(unittest.TestCase):
    def test_resolve_uses_canonical_manifest_description(self) -> None:
        resolver = MarketplaceDescriptionResolver(
            github_fetcher=_StaticFetcher(
                {
                    "github:mode-io/skills/mode-switch": "---\nname: Mode Switch\ndescription: Canonical mode switch description.\n---\n\n# Mode Switch\n"
                }
            )
        )

        result = resolver.resolve(
            source_kind="github",
            source_locator="github:mode-io/skills/mode-switch",
            description_hint="Registry hint",
        )

        self.assertEqual(result.description, "Canonical mode switch description.")
        self.assertEqual(result.status, "resolved")

    def test_resolve_falls_back_to_registry_hint_when_source_is_unavailable(self) -> None:
        resolver = MarketplaceDescriptionResolver(
            github_fetcher=_StaticFetcher({}),
        )

        result = resolver.resolve(
            source_kind="github",
            source_locator="github:mode-io/skills/missing",
            description_hint="Registry description",
        )

        self.assertEqual(result.description, "Registry description")
        self.assertEqual(result.status, "fallback")

    def test_resolve_supports_agentskill_manifest_fetcher(self) -> None:
        resolver = MarketplaceDescriptionResolver(
            agentskill_fetcher=_StaticFetcher(
                {
                    "agentskill:openclaw/switch-modes": "---\nname: Switch Modes\ndescription: Canonical agent skill description.\n---\n\n# Switch Modes\n"
                }
            )
        )

        result = resolver.resolve(
            source_kind="agentskill",
            source_locator="agentskill:openclaw/switch-modes",
            description_hint="Registry hint",
        )

        self.assertEqual(result.description, "Canonical agent skill description.")
        self.assertEqual(result.status, "resolved")

    def test_resolve_reports_missing_when_manifest_has_no_description(self) -> None:
        resolver = MarketplaceDescriptionResolver(
            github_fetcher=_StaticFetcher(
                {
                    "github:mode-io/skills/no-desc": "---\nname: No Desc\n---\n\n# No Desc\n"
                }
            )
        )

        result = resolver.resolve(
            source_kind="github",
            source_locator="github:mode-io/skills/no-desc",
            description_hint="Hint ignored",
        )

        self.assertIsNone(result.description)
        self.assertEqual(result.status, "missing")

    def test_resolved_and_missing_results_are_cached_but_unavailable_is_not(self) -> None:
        fetcher = _CountingFetcher(
            {
                "github:mode-io/skills/resolved": "---\nname: Resolved\ndescription: Canonical text.\n---\n\n# Resolved\n",
                "github:mode-io/skills/missing": "---\nname: Missing\n---\n\n# Missing\n",
            }
        )
        resolver = MarketplaceDescriptionResolver(github_fetcher=fetcher)

        resolver.resolve(source_kind="github", source_locator="github:mode-io/skills/resolved")
        resolver.resolve(source_kind="github", source_locator="github:mode-io/skills/resolved")
        resolver.resolve(source_kind="github", source_locator="github:mode-io/skills/missing")
        resolver.resolve(source_kind="github", source_locator="github:mode-io/skills/missing")
        resolver.resolve(source_kind="github", source_locator="github:mode-io/skills/unavailable", description_hint="Hint")
        resolver.resolve(source_kind="github", source_locator="github:mode-io/skills/unavailable", description_hint="Hint")

        self.assertEqual(fetcher.calls["github:mode-io/skills/resolved"], 1)
        self.assertEqual(fetcher.calls["github:mode-io/skills/missing"], 1)
        self.assertEqual(fetcher.calls["github:mode-io/skills/unavailable"], 2)


class _StaticFetcher:
    def __init__(self, payloads: dict[str, str]) -> None:
        self.payloads = payloads

    def fetch_manifest_text(self, source_locator: str) -> str | None:
        return self.payloads.get(source_locator)


class _CountingFetcher(_StaticFetcher):
    def __init__(self, payloads: dict[str, str]) -> None:
        super().__init__(payloads)
        self.calls: dict[str, int] = {}

    def fetch_manifest_text(self, source_locator: str) -> str | None:
        self.calls[source_locator] = self.calls.get(source_locator, 0) + 1
        return super().fetch_manifest_text(source_locator)


if __name__ == "__main__":
    unittest.main()
