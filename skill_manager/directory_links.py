from __future__ import annotations

import os
from pathlib import Path
import shutil
import stat
import subprocess


def create_directory_link(link: Path, target: Path) -> None:
    resolved_target = target.resolve(strict=True)
    if not resolved_target.is_dir():
        raise NotADirectoryError(f"directory link target is not a directory: {resolved_target}")
    if link.exists() or is_directory_link(link):
        raise FileExistsError(f"directory link path already exists: {link}")

    link.parent.mkdir(parents=True, exist_ok=True)
    if os.name != "nt":
        link.symlink_to(resolved_target, target_is_directory=True)
        return

    command_interpreter = os.environ.get("COMSPEC") or shutil.which("cmd.exe")
    if not command_interpreter:
        raise OSError("Windows command interpreter was not found; cannot create directory junction")
    result = subprocess.run(
        [command_interpreter, "/d", "/c", "mklink", "/J", str(link), str(resolved_target)],
        check=False,
        capture_output=True,
        text=True,
        errors="replace",
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        message = f"unable to create directory junction at {link}"
        if detail:
            message = f"{message}: {detail}"
        raise OSError(message)


def is_directory_link(path: Path) -> bool:
    return path.is_symlink() or _is_junction(path)


def resolve_directory_link(path: Path) -> Path:
    if not is_directory_link(path):
        raise OSError(f"not a managed directory link: {path}")
    return path.resolve(strict=False)


def remove_directory_link(path: Path) -> None:
    if path.is_symlink():
        path.unlink()
        return
    if _is_junction(path):
        path.rmdir()
        return
    raise OSError(f"not a managed directory link: {path}")


def _is_junction(path: Path) -> bool:
    if os.name != "nt":
        return False
    try:
        metadata = path.lstat()
    except (FileNotFoundError, OSError):
        return False
    attributes = getattr(metadata, "st_file_attributes", 0)
    reparse_tag = getattr(metadata, "st_reparse_tag", 0)
    return bool(attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT) and (
        reparse_tag == stat.IO_REPARSE_TAG_MOUNT_POINT
    )


__all__ = [
    "create_directory_link",
    "is_directory_link",
    "remove_directory_link",
    "resolve_directory_link",
]
