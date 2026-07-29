from __future__ import annotations

import errno
import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import BinaryIO, Iterator

if os.name == "nt":
    import msvcrt
else:
    import fcntl


def atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        _replace_file(tmp_path, path)
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise


@contextmanager
def file_lock(lock_path: Path) -> Iterator[None]:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with open(lock_path, "a+b") as lock_fd:
        _lock_file(lock_fd)
        try:
            yield
        finally:
            _unlock_file(lock_fd)


def _replace_file(source: Path, destination: Path) -> None:
    attempts = 8 if os.name == "nt" else 1
    for attempt in range(attempts):
        try:
            os.replace(source, destination)
            return
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(0.025 * (attempt + 1))


def _lock_file(lock_fd: BinaryIO) -> None:
    if os.name != "nt":
        fcntl.flock(lock_fd.fileno(), fcntl.LOCK_EX)
        return

    while True:
        lock_fd.seek(0)
        try:
            msvcrt.locking(lock_fd.fileno(), msvcrt.LK_NBLCK, 1)
            return
        except OSError as error:
            if error.errno not in {errno.EACCES, errno.EAGAIN, errno.EDEADLK}:
                raise
            time.sleep(0.05)


def _unlock_file(lock_fd: BinaryIO) -> None:
    if os.name != "nt":
        fcntl.flock(lock_fd.fileno(), fcntl.LOCK_UN)
        return
    lock_fd.seek(0)
    msvcrt.locking(lock_fd.fileno(), msvcrt.LK_UNLCK, 1)
