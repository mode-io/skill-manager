from __future__ import annotations

from pathlib import Path
import shutil
from uuid import uuid4

from skill_manager.errors import MutationError


class SymlinkHarnessManager:
    def __init__(self, managed_root: Path) -> None:
        self.managed_root = managed_root

    def enable_shared_package(self, package_path: Path) -> None:
        resolved_target = package_path.resolve()
        link = self.managed_root / package_path.name
        if link.is_symlink():
            if link.resolve() == resolved_target:
                return
            raise MutationError(f"symlink already exists but points to {link.resolve()}, not {resolved_target}")
        if link.exists():
            raise MutationError(f"real directory exists at {link}; will not overwrite")
        self.managed_root.mkdir(parents=True, exist_ok=True)
        link.symlink_to(resolved_target)

    def disable_shared_package(self, package_dir: str) -> None:
        link = self.managed_root / package_dir
        if not link.exists() and not link.is_symlink():
            return
        if not link.is_symlink():
            raise MutationError(f"not a symlink at {link}; will not delete real directory")
        link.unlink()

    def adopt_local_copy(self, existing_dir: Path, package_path: Path) -> None:
        resolved_target = package_path.resolve()
        if not existing_dir.exists() and not existing_dir.is_symlink():
            raise MutationError(f"directory does not exist: {existing_dir}")
        if existing_dir.is_symlink():
            if existing_dir.resolve() == resolved_target:
                return
            raise MutationError(f"symlink exists but points to {existing_dir.resolve()}, not {resolved_target}")
        shutil.rmtree(existing_dir)
        existing_dir.symlink_to(resolved_target)

    def has_binding(self, package_dir: str) -> bool:
        candidate = self.managed_root / package_dir
        return candidate.exists() or candidate.is_symlink()

    def prepare_materialize(self, package_dir: str, expected_target: Path) -> None:
        existing_link = self.managed_root / package_dir
        if not existing_link.exists() and not existing_link.is_symlink():
            raise MutationError(f"directory does not exist: {existing_link}")
        if not existing_link.is_symlink():
            raise MutationError(f"not a symlink at {existing_link}; will not overwrite real directory")
        resolved_target = expected_target.resolve()
        if existing_link.resolve() != resolved_target:
            raise MutationError(f"symlink exists but points to {existing_link.resolve()}, not {resolved_target}")

    def materialize_binding(self, package_dir: str, source_path: Path) -> None:
        existing_link = self.managed_root / package_dir
        resolved_target = source_path.resolve()
        self.prepare_materialize(package_dir=package_dir, expected_target=resolved_target)

        temp_copy = existing_link.parent / f".{existing_link.name}.materialize-{uuid4().hex}"
        backup_link = existing_link.parent / f".{existing_link.name}.backup-{uuid4().hex}"

        try:
            shutil.copytree(resolved_target, temp_copy)
            existing_link.rename(backup_link)
            temp_copy.rename(existing_link)
        except OSError as error:
            if backup_link.exists() and not existing_link.exists():
                backup_link.rename(existing_link)
            if temp_copy.exists():
                shutil.rmtree(temp_copy, ignore_errors=True)
            raise MutationError(f"unable to restore local copy at {existing_link}: {error}") from error

        if backup_link.exists():
            backup_link.unlink()

    def prepare_remove(self, package_dir: str) -> None:
        link = self.managed_root / package_dir
        if not link.exists() and not link.is_symlink():
            return
        if not link.is_symlink():
            raise MutationError(f"not a symlink at {link}; will not delete real directory")

    def remove_binding(self, package_dir: str) -> None:
        self.disable_shared_package(package_dir)
