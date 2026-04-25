from __future__ import annotations

import unittest

from skill_manager.application.mcp.stdio import parse_static_stdio_function


class StaticStdioParserTests(unittest.TestCase):
    def test_parses_static_command_and_args(self) -> None:
        recipe = "(config) => ({ command: 'npx', args: ['-y', '@acme/server'] })"

        command = parse_static_stdio_function(recipe)

        assert command is not None
        self.assertEqual(command.command, "npx")
        self.assertEqual(command.args, ("-y", "@acme/server"))

    def test_rejects_dynamic_config_reference(self) -> None:
        recipe = "(config) => ({ command: 'npx', args: ['-y', config.package] })"

        self.assertIsNone(parse_static_stdio_function(recipe))

    def test_treats_missing_args_as_empty(self) -> None:
        recipe = "() => ({ command: 'uvx' })"

        command = parse_static_stdio_function(recipe)

        assert command is not None
        self.assertEqual(command.command, "uvx")
        self.assertEqual(command.args, ())


if __name__ == "__main__":
    unittest.main()
