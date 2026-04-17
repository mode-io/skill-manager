from __future__ import annotations

import threading
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from skill_manager.store._atomic import atomic_write_text, file_lock


class AtomicWriteTextTests(unittest.TestCase):
    def test_writes_full_content_to_target_path(self) -> None:
        with TemporaryDirectory() as temp:
            target = Path(temp) / "out.json"
            atomic_write_text(target, "hello\n")
            self.assertEqual(target.read_text(encoding="utf-8"), "hello\n")

    def test_creates_parent_directories(self) -> None:
        with TemporaryDirectory() as temp:
            target = Path(temp) / "deep" / "nested" / "file.txt"
            atomic_write_text(target, "x")
            self.assertEqual(target.read_text(encoding="utf-8"), "x")

    def test_replaces_existing_file_atomically(self) -> None:
        with TemporaryDirectory() as temp:
            target = Path(temp) / "out.txt"
            target.write_text("old", encoding="utf-8")
            atomic_write_text(target, "new")
            self.assertEqual(target.read_text(encoding="utf-8"), "new")

    def test_failed_write_leaves_no_temp_files_and_keeps_original(self) -> None:
        with TemporaryDirectory() as temp:
            target = Path(temp) / "out.txt"
            target.write_text("preserved", encoding="utf-8")
            with mock.patch("os.replace", side_effect=OSError("boom")):
                with self.assertRaises(OSError):
                    atomic_write_text(target, "broken")
            self.assertEqual(target.read_text(encoding="utf-8"), "preserved")
            tmp_files = [p for p in Path(temp).iterdir() if p.name != "out.txt"]
            self.assertEqual(tmp_files, [])


class FileLockTests(unittest.TestCase):
    def test_serializes_concurrent_critical_sections(self) -> None:
        with TemporaryDirectory() as temp:
            lock_path = Path(temp) / "guard.lock"
            shared: list[str] = []
            holding = threading.Event()

            def writer(label: str, hold_after_acquire: float) -> None:
                with file_lock(lock_path):
                    shared.append(f"enter:{label}")
                    if hold_after_acquire:
                        holding.set()
                        threading.Event().wait(hold_after_acquire)
                    shared.append(f"exit:{label}")

            t1 = threading.Thread(target=writer, args=("a", 0.1))
            t1.start()
            holding.wait(timeout=1.0)
            t2 = threading.Thread(target=writer, args=("b", 0.0))
            t2.start()
            t1.join()
            t2.join()
            self.assertEqual(shared, ["enter:a", "exit:a", "enter:b", "exit:b"])


if __name__ == "__main__":
    unittest.main()
