from __future__ import annotations

import unittest

from skill_manager.application.mcp.env import annotate_env, is_env_var_reference


class IsEnvVarReferenceTests(unittest.TestCase):
    def test_matches_env_syntax(self) -> None:
        self.assertTrue(is_env_var_reference("${env:EXA_API_KEY}"))
        self.assertTrue(is_env_var_reference("${env:A1_B2}"))

    def test_rejects_non_references(self) -> None:
        self.assertFalse(is_env_var_reference("abc-123"))
        self.assertFalse(is_env_var_reference(""))
        self.assertFalse(is_env_var_reference("env:EXA_API_KEY"))
        self.assertFalse(is_env_var_reference("${EXA_API_KEY}"))


class AnnotateEnvTests(unittest.TestCase):
    def test_returns_raw_values(self) -> None:
        rows = annotate_env({"EXA_API_KEY": "literal-secret", "PORT": "80"})
        by_key = {row["key"]: row for row in rows}

        self.assertEqual(by_key["EXA_API_KEY"]["value"], "literal-secret")
        self.assertFalse(by_key["EXA_API_KEY"]["isEnvRef"])
        self.assertEqual(by_key["PORT"]["value"], "80")

    def test_marks_env_ref_and_keeps_value(self) -> None:
        rows = annotate_env({"EXA_API_KEY": "${env:EXA_API_KEY}"})
        row = rows[0]

        self.assertEqual(row["value"], "${env:EXA_API_KEY}")
        self.assertTrue(row["isEnvRef"])


if __name__ == "__main__":
    unittest.main()
