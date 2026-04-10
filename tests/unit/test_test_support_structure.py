from __future__ import annotations

from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
TESTS_ROOT = REPO_ROOT / "tests"


class TestSupportStructureTests(unittest.TestCase):
    def test_support_package_is_not_a_barrel_export_surface(self) -> None:
        init_source = (TESTS_ROOT / "support" / "__init__.py").read_text(encoding="utf-8")
        self.assertNotIn("from .app_harness import", init_source)
        self.assertNotIn("from .fake_home import", init_source)
        self.assertNotIn("from .marketplace_fixture import", init_source)

    def test_tests_import_support_helpers_from_concrete_modules(self) -> None:
        offenders: list[str] = []
        forbidden_import = "from tests." + "support import"
        for path in TESTS_ROOT.rglob("test_*.py"):
            source = path.read_text(encoding="utf-8")
            if forbidden_import in source:
                offenders.append(str(path.relative_to(REPO_ROOT)))
        self.assertEqual(offenders, [])
