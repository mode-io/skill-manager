from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.directory_links import (
    create_directory_link,
    is_directory_link,
    remove_directory_link,
    resolve_directory_link,
)


class DirectoryLinkTests(unittest.TestCase):
    def test_directory_link_roundtrip_preserves_target(self) -> None:
        with TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / "目标 with spaces"
            target.mkdir()
            (target / "SKILL.md").write_text("# test\n", encoding="utf-8")
            link = root / "链接 with spaces"

            create_directory_link(link, target)

            self.assertTrue(is_directory_link(link))
            self.assertEqual(resolve_directory_link(link), target.resolve())
            self.assertEqual((link / "SKILL.md").read_text(encoding="utf-8"), "# test\n")

            remove_directory_link(link)
            self.assertFalse(link.exists())
            self.assertTrue(target.is_dir())

    def test_refuses_to_replace_existing_real_directory(self) -> None:
        with TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / "target"
            target.mkdir()
            link = root / "existing"
            link.mkdir()

            with self.assertRaises(FileExistsError):
                create_directory_link(link, target)

            self.assertTrue(link.is_dir())
            self.assertFalse(is_directory_link(link))


if __name__ == "__main__":
    unittest.main()
