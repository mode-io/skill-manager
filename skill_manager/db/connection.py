from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from .migrations import initialize_schema


class Database:
    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            initialize_schema(self._conn)

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        with self._lock:
            return self._conn.execute(sql, params)

    def execute_fetchone(self, sql: str, params: tuple = ()) -> sqlite3.Row | None:
        with self._lock:
            cursor = self._conn.execute(sql, params)
            return cursor.fetchone()

    def execute_fetchall(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            cursor = self._conn.execute(sql, params)
            return cursor.fetchall()

    def execute_commit(self, sql: str, params: tuple = ()) -> None:
        with self._lock:
            self._conn.execute(sql, params)
            self._conn.commit()

    def execute_many_commit(self, statements: list[tuple[str, tuple]]) -> None:
        with self._lock:
            for sql, params in statements:
                self._conn.execute(sql, params)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    @staticmethod
    def memory() -> Database:
        db = object.__new__(Database)
        db._lock = threading.Lock()
        db._conn = sqlite3.connect(":memory:", check_same_thread=False)
        db._conn.execute("PRAGMA foreign_keys = ON")
        db._conn.row_factory = sqlite3.Row
        initialize_schema(db._conn)
        return db
