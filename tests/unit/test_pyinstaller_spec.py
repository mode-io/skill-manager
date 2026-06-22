from __future__ import annotations

from pathlib import Path
import unittest


class PyInstallerSpecTests(unittest.TestCase):
    def test_litellm_data_files_are_bundled_for_packaged_scan_imports(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        spec = (repo_root / "packaging" / "pyinstaller" / "skill-manager.spec").read_text(encoding="utf-8")

        self.assertIn('collect_data_files("litellm")', spec)

    def test_tiktoken_namespace_plugins_are_hidden_imports(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        spec = (repo_root / "packaging" / "pyinstaller" / "skill-manager.spec").read_text(encoding="utf-8")

        self.assertIn('collect_submodules("tiktoken_ext")', spec)


if __name__ == "__main__":
    unittest.main()
