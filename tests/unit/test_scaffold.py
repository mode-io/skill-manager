import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.scaffold import ScaffoldRequest, ScaffoldService
from skill_manager.paths import resolve_app_paths
from tests.unit.test_paths import isolated_env


class ScaffoldServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryDirectory()
        base = Path(self.temp.name)
        with isolated_env("darwin"):
            self.paths = resolve_app_paths({"HOME": str(base)})
        self.service = ScaffoldService(self.paths)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_scaffold_agent_new_frontmatter(self) -> None:
        req = ScaffoldRequest(
            asset_type="agent",
            name="Test Agent",
            description="A test agent",
        )
        out_file = self.service.scaffold_asset(req)
        self.assertTrue(out_file.exists())
        content = out_file.read_text(encoding="utf-8")
        
        self.assertIn("name: Test Agent", content)
        self.assertIn("description: A test agent", content)
        self.assertNotIn("capabilities:", content)
        self.assertNotIn("harnesses:", content)
        self.assertNotIn("skills:", content)
        self.assertNotIn("mcps:", content)

if __name__ == "__main__":
    unittest.main()
