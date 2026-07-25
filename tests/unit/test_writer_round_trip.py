from __future__ import annotations

import unittest

from skill_manager.application.mcp.mappers import (
    AntigravityCliMapper,
    ClaudeCodeMapper,
    CodexMapper,
    CursorMapper,
    HermesMapper,
    OpenClawMapper,
    OpenCodeMapper,
    TransportMapper,
)
from skill_manager.application.mcp.store import McpSource
from skill_manager.application.slash_commands.codecs import (
    FrontmatterMarkdownCommandCodec,
    PlainMarkdownCommandCodec,
)

# These tests codify the recommendation in RECOMMENDATIONS.md §1.1: a writer that
# rewrites a user-authored artifact from only the subset of fields it understands can
# silently destroy config. For each writer we pin three properties:
#
#   1. Idempotency  -- projecting an input twice yields the same output as once. This
#      is the direct detector for the historical bug class ("a component rewrote the
#      whole artifact on every save and drifted").
#   2. Owned-field preservation -- the fields the writer models round-trip exactly.
#   3. Loss-surface characterization -- the unknown fields/comments the writer currently
#      drops are named and locked, so any future change to preserve them is deliberate
#      and reviewable (the data-loss surface stops being invisible).


# ---------------------------------------------------------------------------
# Slash-command frontmatter codec
# ---------------------------------------------------------------------------


class FrontmatterCodecRoundTripTests(unittest.TestCase):
    """The frontmatter codec owns ``description`` + ``prompt`` only.

    Real Claude/Codex command files carry extra frontmatter (``allowed-tools``,
    ``model``, comments). The codec must never churn what it rewrites; today it
    projects down to the owned pair (characterized below) rather than preserving
    extras.
    """

    def setUp(self) -> None:
        self.codec = FrontmatterMarkdownCommandCodec()
        self.fixture = (
            "---\n"
            'description: "Review code"\n'
            "allowed-tools: bash\n"
            "# a comment the writer does not model\n"
            "model: big\n"
            "---\n"
            "\n"
            "Review:\n"
            "$ARGUMENTS\n"
        )

    def test_owned_fields_round_trip(self) -> None:
        parsed = self.codec.parse("code-review", self.fixture)
        reparsed = self.codec.parse("code-review", self.codec.render(parsed))
        self.assertEqual(reparsed.description, "Review code")
        self.assertEqual(reparsed.prompt, "Review:\n$ARGUMENTS")
        self.assertEqual(reparsed, parsed)  # the owned pair survives unchanged

    def test_render_is_idempotent(self) -> None:
        once = self.codec.render(self.codec.parse("code-review", self.fixture))
        twice = self.codec.render(self.codec.parse("code-review", once))
        self.assertEqual(once, twice)

    def test_unknown_frontmatter_keys_are_currently_dropped(self) -> None:
        rendered = self.codec.render(self.codec.parse("code-review", self.fixture))
        self.assertNotIn("allowed-tools", rendered)
        self.assertNotIn("model", rendered)

    def test_frontmatter_comments_are_currently_dropped(self) -> None:
        rendered = self.codec.render(self.codec.parse("code-review", self.fixture))
        self.assertNotIn("a comment the writer does not model", rendered)


class PlainMarkdownCodecRoundTripTests(unittest.TestCase):
    def setUp(self) -> None:
        self.codec = PlainMarkdownCommandCodec()
        self.fixture = "Review code\n\nReview:\n$ARGUMENTS\n"

    def test_owned_fields_round_trip(self) -> None:
        parsed = self.codec.parse("code-review", self.fixture)
        reparsed = self.codec.parse("code-review", self.codec.render(parsed))
        self.assertEqual(reparsed, parsed)

    def test_render_is_idempotent(self) -> None:
        once = self.codec.render(self.codec.parse("code-review", self.fixture))
        twice = self.codec.render(self.codec.parse("code-review", once))
        self.assertEqual(once, twice)



# ---------------------------------------------------------------------------
# MCP transport mappers
# ---------------------------------------------------------------------------


def _stdio_raw() -> dict[str, object]:
    """A realistic harness entry carrying fields the model does not own."""
    return {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "exa-mcp-server"],
        "env": {"EXA_API_KEY": "secret"},
        "disabled": True,
        "autoApprove": ["read"],
    }


def _http_raw() -> dict[str, object]:
    return {
        "type": "http",
        "url": "https://mcp.example.com",
        "headers": {"Authorization": "Bearer x"},
        "disabled": True,
        "priority": 1,
    }


def _project(mapper: TransportMapper, raw: dict[str, object]) -> dict[str, object]:
    spec = mapper.dict_to_spec("srv", raw, source=McpSource.manual("srv"))
    return mapper.spec_to_dict(spec)


class _StdioHttpMapperRoundTripMixin:
    mapper: TransportMapper

    def test_modeled_stdio_fields_round_trip(self) -> None:
        spec = self.mapper.dict_to_spec("srv", _stdio_raw(), source=McpSource.manual("srv"))
        self.assertEqual(spec.transport, "stdio")
        self.assertEqual(spec.command, "npx")
        self.assertEqual(spec.args, ("-y", "exa-mcp-server"))
        self.assertEqual(spec.env_dict(), {"EXA_API_KEY": "secret"})

    def test_modeled_http_fields_round_trip(self) -> None:
        spec = self.mapper.dict_to_spec("srv", _http_raw(), source=McpSource.manual("srv"))
        self.assertIn(spec.transport, ("http", "sse"))
        self.assertEqual(spec.url, "https://mcp.example.com")
        self.assertEqual(spec.headers_dict(), {"Authorization": "Bearer x"})

    def test_projection_is_idempotent(self) -> None:
        once = _project(self.mapper, _stdio_raw())
        self.assertEqual(_project(self.mapper, once), once)

    def test_unknown_stdio_fields_are_currently_dropped(self) -> None:
        projected = _project(self.mapper, _stdio_raw())
        self.assertNotIn("disabled", projected)
        self.assertNotIn("autoApprove", projected)


class ClaudeCodeMapperRoundTripTests(_StdioHttpMapperRoundTripMixin, unittest.TestCase):
    mapper = ClaudeCodeMapper()


class CursorMapperRoundTripTests(_StdioHttpMapperRoundTripMixin, unittest.TestCase):
    mapper = CursorMapper()


class CodexMapperRoundTripTests(_StdioHttpMapperRoundTripMixin, unittest.TestCase):
    mapper = CodexMapper()

    def test_http_headers_use_harness_key(self) -> None:
        projected = _project(self.mapper, _http_raw())
        self.assertEqual(projected.get("http_headers"), {"Authorization": "Bearer x"})


class HermesMapperRoundTripTests(_StdioHttpMapperRoundTripMixin, unittest.TestCase):
    mapper = HermesMapper()


class OpenClawMapperRoundTripTests(_StdioHttpMapperRoundTripMixin, unittest.TestCase):
    mapper = OpenClawMapper()


class AntigravityCliMapperRoundTripTests(_StdioHttpMapperRoundTripMixin, unittest.TestCase):
    mapper = AntigravityCliMapper()

    def test_http_uses_server_url_key(self) -> None:
        projected = _project(self.mapper, _http_raw())
        self.assertEqual(projected.get("serverUrl"), "https://mcp.example.com")


class OpenCodeMapperRoundTripTests(unittest.TestCase):
    """OpenCode's ``enabled`` flag is force-written to ``True``.

    That is a real data-loss vector: a server the user disabled gets re-enabled on
    the next managed write. It is characterized here so the behavior stays visible.
    """

    mapper = OpenCodeMapper()

    def test_modeled_stdio_fields_round_trip(self) -> None:
        raw = {
            "type": "local",
            "command": ["npx", "-y", "exa-mcp-server"],
            "environment": {"EXA_API_KEY": "secret"},
            "autoApprove": True,
        }
        projected = _project(self.mapper, raw)
        self.assertEqual(projected.get("type"), "local")
        self.assertEqual(projected.get("command"), ["npx", "-y", "exa-mcp-server"])
        self.assertEqual(projected.get("environment"), {"EXA_API_KEY": "secret"})

    def test_projection_is_idempotent(self) -> None:
        once = _project(self.mapper, {"type": "local", "command": ["npx", "x"]})
        self.assertEqual(_project(self.mapper, once), once)

    def test_disabled_server_is_re_enabled_on_write(self) -> None:
        projected = _project(
            self.mapper, {"type": "local", "command": ["npx", "x"], "enabled": False}
        )
        self.assertTrue(projected["enabled"])

    def test_unknown_fields_are_currently_dropped(self) -> None:
        projected = _project(
            self.mapper, {"type": "local", "command": ["npx", "x"], "autoApprove": True}
        )
        self.assertNotIn("autoApprove", projected)


if __name__ == "__main__":
    unittest.main()

    def setUp(self) -> None:
        self.codec = PlainMarkdownCommandCodec()
        self.fixture = "Review code\n\nReview:\n$ARGUMENTS\n"

    def test_owned_fields_round_trip(self) -> None:
        parsed = self.codec.parse("code-review", self.fixture)
        reparsed = self.codec.parse("code-review", self.codec.render(parsed))
        self.assertEqual(reparsed, parsed)

    def test_render_is_idempotent(self) -> None:
        once = self.codec.render(self.codec.parse("code-review", self.fixture))
        twice = self.codec.render(self.codec.parse("code-review", once))
        self.assertEqual(once, twice)
