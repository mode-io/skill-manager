from __future__ import annotations

import sys
import unittest
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from skill_manager.paths import APP_NAME, resolve_app_paths


@contextmanager
def isolated_env(platform: str):
    """Pin sys.platform and clear inherited XDG/HOME so tests fully control env."""
    cleared = {key: "" for key in (
        "XDG_CONFIG_HOME",
        "XDG_DATA_HOME",
        "XDG_STATE_HOME",
        "HOME",
        "SKILL_MANAGER_SETTINGS_PATH",
        "SKILL_MANAGER_STATE_DIR",
    )}
    with mock.patch.object(sys, "platform", platform), mock.patch.dict("os.environ", cleared, clear=False):
        yield


class ResolveAppPathsTests(unittest.TestCase):
    def test_macos_default_layout_collapses_to_application_support(self) -> None:
        with isolated_env("darwin"), TemporaryDirectory() as temp:
            home = Path(temp) / "home"
            paths = resolve_app_paths({"HOME": str(home)})
            base = home / "Library" / "Application Support" / APP_NAME
            self.assertEqual(paths.config_dir, base)
            self.assertEqual(paths.data_dir, base)
            self.assertEqual(paths.state_dir, base)
            self.assertEqual(paths.skills_store_root, base / "shared")
            self.assertEqual(paths.skills_store_manifest, base / "manifest.json")
            self.assertEqual(paths.marketplace_cache_root, base / "marketplace")
            self.assertEqual(paths.settings_path, base / "settings.json")
            self.assertEqual(paths.runtime_state_path, base / "runtime.json")
            self.assertEqual(paths.server_log_path, base / "server.log")

    def test_xdg_overrides_each_dir_independently(self) -> None:
        with isolated_env("darwin"), TemporaryDirectory() as temp:
            root = Path(temp)
            env = {
                "HOME": str(root / "home"),
                "XDG_CONFIG_HOME": str(root / "cfg"),
                "XDG_DATA_HOME": str(root / "data"),
                "XDG_STATE_HOME": str(root / "state"),
            }
            paths = resolve_app_paths(env)
            self.assertEqual(paths.config_dir, root / "cfg" / APP_NAME)
            self.assertEqual(paths.data_dir, root / "data" / APP_NAME)
            self.assertEqual(paths.state_dir, root / "state" / APP_NAME)
            self.assertEqual(paths.skills_store_root, root / "data" / APP_NAME / "shared")
            self.assertEqual(paths.settings_path, root / "cfg" / APP_NAME / "settings.json")

    def test_settings_path_env_overrides_settings_path(self) -> None:
        with isolated_env("darwin"), TemporaryDirectory() as temp:
            custom = Path(temp) / "elsewhere" / "settings.json"
            env = {
                "HOME": str(Path(temp) / "home"),
                "SKILL_MANAGER_SETTINGS_PATH": str(custom),
            }
            paths = resolve_app_paths(env)
            self.assertEqual(paths.settings_path, custom)

    def test_state_dir_env_overrides_state_paths(self) -> None:
        with isolated_env("darwin"), TemporaryDirectory() as temp:
            custom_state = Path(temp) / "runtime"
            env = {
                "HOME": str(Path(temp) / "home"),
                "SKILL_MANAGER_STATE_DIR": str(custom_state),
            }
            paths = resolve_app_paths(env)
            self.assertEqual(paths.state_dir, custom_state)
            self.assertEqual(paths.runtime_state_path, custom_state / "runtime.json")
            self.assertEqual(paths.server_log_path, custom_state / "server.log")

    def test_linux_defaults_use_xdg_basedir_layout(self) -> None:
        with isolated_env("linux"), TemporaryDirectory() as temp:
            home = Path(temp) / "home"
            paths = resolve_app_paths({"HOME": str(home)})
            self.assertEqual(paths.config_dir, home / ".config" / APP_NAME)
            self.assertEqual(paths.data_dir, home / ".local" / "share" / APP_NAME)
            self.assertEqual(paths.state_dir, home / ".local" / "state" / APP_NAME)


if __name__ == "__main__":
    unittest.main()
