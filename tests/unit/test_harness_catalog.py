from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock
import unittest

from skill_manager.harness.catalog import supported_harness_definitions
from skill_manager.harness.contracts import FileTreeBindingProfile
from skill_manager.harness.resolution import ResolutionContext
from skill_manager.platform_context import PlatformName


def _hermes_profile() -> FileTreeBindingProfile:
    hermes = next(
        definition
        for definition in supported_harness_definitions()
        if definition.harness == "hermes"
    )
    profile = hermes.binding_for("skills")
    assert isinstance(profile, FileTreeBindingProfile)
    return profile


def _context(
    *,
    platform: PlatformName,
    home: Path,
    env: dict[str, str],
) -> ResolutionContext:
    return ResolutionContext(
        env=env,
        platform=platform,
        sys_platform={"windows": "win32", "macos": "darwin"}.get(platform, "linux"),
        home=home,
        xdg_config_home=home / ".config",
        xdg_data_home=home / ".local" / "share",
        xdg_state_home=home / ".local" / "state",
    )


class HarnessCatalogTests(unittest.TestCase):
    def test_cursor_uses_native_editor_command_as_windows_fallback(self) -> None:
        cursor = next(
            definition
            for definition in supported_harness_definitions()
            if definition.harness == "cursor"
        )

        self.assertEqual(
            cursor.install_probes_for("windows"),
            ("cursor-agent", "cursor"),
        )
        self.assertEqual(
            cursor.install_probes_for("linux"),
            ("cursor-agent",),
        )
        self.assertEqual(
            cursor.install_probes_for("macos"),
            ("cursor-agent",),
        )

    def test_hermes_windows_default_matches_native_installer_root(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            context = _context(
                platform="windows",
                home=root / "home",
                env={"LOCALAPPDATA": str(root / "local-app-data")},
            )
            with mock.patch(
                "skill_manager.harness.catalog.live_user_environment_value",
                return_value=None,
            ):
                managed_root = _hermes_profile().resolve_managed_root(context)

        self.assertEqual(
            managed_root,
            root / "local-app-data" / "hermes" / "skills",
        )

    def test_hermes_windows_reads_live_user_home_when_process_env_is_stale(self) -> None:
        context = _context(
            platform="windows",
            home=Path("C:/Users/tester"),
            env={"LOCALAPPDATA": "C:/Users/tester/AppData/Local"},
        )
        with mock.patch(
            "skill_manager.harness.catalog.live_user_environment_value",
            side_effect=lambda name, env: str(Path(env["LOCALAPPDATA"]) / "custom-hermes")
            if name == "HERMES_HOME"
            else None,
        ):
            managed_root = _hermes_profile().resolve_managed_root(context)

        self.assertEqual(
            managed_root,
            Path("C:/Users/tester/AppData/Local/custom-hermes/skills"),
        )

    def test_hermes_windows_preserves_existing_legacy_home(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            legacy_home = root / "home" / ".hermes"
            legacy_home.mkdir(parents=True)
            context = _context(
                platform="windows",
                home=root / "home",
                env={"LOCALAPPDATA": str(root / "local-app-data")},
            )
            with mock.patch(
                "skill_manager.harness.catalog.live_user_environment_value",
                return_value=None,
            ):
                managed_root = _hermes_profile().resolve_managed_root(context)

        self.assertEqual(managed_root, legacy_home / "skills")

    def test_hermes_non_windows_keeps_dot_hermes_default(self) -> None:
        context = _context(
            platform="linux",
            home=Path("/home/tester"),
            env={"LOCALAPPDATA": "/unexpected/windows/path"},
        )
        with mock.patch(
            "skill_manager.harness.catalog.live_user_environment_value"
        ) as read_user_environment:
            managed_root = _hermes_profile().resolve_managed_root(context)

        self.assertEqual(managed_root, Path("/home/tester/.hermes/skills"))
        read_user_environment.assert_not_called()


if __name__ == "__main__":
    unittest.main()
