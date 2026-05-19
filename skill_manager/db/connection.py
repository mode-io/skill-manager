from __future__ import annotations

import logging
import sqlite3
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 3


class Database:
    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._conn.row_factory = sqlite3.Row
        self._create_tables()
        self._apply_migrations()

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

    def _create_tables(self) -> None:
        with self._lock:
            self._conn.execute("""
                CREATE TABLE IF NOT EXISTS llm_scan_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    base_url TEXT NOT NULL DEFAULT '',
                    api_key TEXT NOT NULL DEFAULT '',
                    model TEXT NOT NULL DEFAULT '',
                    provider TEXT NOT NULL DEFAULT '',
                    api_version TEXT NOT NULL DEFAULT '',
                    aws_region TEXT NOT NULL DEFAULT '',
                    aws_profile TEXT NOT NULL DEFAULT '',
                    aws_session_token TEXT NOT NULL DEFAULT '',
                    max_tokens INTEGER NOT NULL DEFAULT 8192,
                    consensus_runs INTEGER NOT NULL DEFAULT 1,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    last_validated_at TEXT,
                    last_validation_error TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            self._conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_config_active
                    ON llm_scan_configs(is_active) WHERE is_active = 1
            """)
            self._conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            self._conn.commit()

    def _apply_migrations(self) -> None:
        with self._lock:
            version = self._conn.execute("PRAGMA user_version").fetchone()[0]
            if version < 1:
                self._migrate_v0_to_v1()
            if version < 2:
                self._migrate_v1_to_v2()
            if version < 3:
                self._migrate_v2_to_v3()
            current = self._conn.execute("PRAGMA user_version").fetchone()[0]
            if current < SCHEMA_VERSION:
                self._conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
                self._conn.commit()

    def _migrate_v0_to_v1(self) -> None:
        logger.info("Schema migration: v0 -> v1 (initial tables)")
        self._conn.execute(f"PRAGMA user_version = 1")
        self._conn.commit()

    def _migrate_v1_to_v2(self) -> None:
        logger.info("Schema migration: v1 -> v2 (multi-config support)")
        # Migrate data from old single-row table to new multi-row table
        old_exists = self._conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='llm_scan_config'"
        ).fetchone()[0]
        if old_exists:
            rows = self._conn.execute(
                "SELECT base_url, api_key, model, provider, max_tokens, consensus_runs FROM llm_scan_config WHERE id = 1"
            ).fetchall()
            for row in rows:
                if row["base_url"] or row["api_key"] or row["model"]:
                    self._conn.execute(
                        """INSERT INTO llm_scan_configs (name, base_url, api_key, model, provider, max_tokens, consensus_runs, is_active)
                           VALUES ('Default', ?1, ?2, ?3, ?4, ?5, ?6, 1)""",
                        (row["base_url"], row["api_key"], row["model"], row["provider"], row["max_tokens"], row["consensus_runs"]),
                    )
            self._conn.execute("DROP TABLE llm_scan_config")
        self._conn.execute(f"PRAGMA user_version = 2")
        self._conn.commit()

    def _migrate_v2_to_v3(self) -> None:
        logger.info("Schema migration: v2 -> v3 (LLM config validation metadata)")
        existing_columns = {
            row["name"]
            for row in self._conn.execute("PRAGMA table_info(llm_scan_configs)").fetchall()
        }
        migrations = [
            ("api_version", "ALTER TABLE llm_scan_configs ADD COLUMN api_version TEXT NOT NULL DEFAULT ''"),
            ("aws_region", "ALTER TABLE llm_scan_configs ADD COLUMN aws_region TEXT NOT NULL DEFAULT ''"),
            ("aws_profile", "ALTER TABLE llm_scan_configs ADD COLUMN aws_profile TEXT NOT NULL DEFAULT ''"),
            ("aws_session_token", "ALTER TABLE llm_scan_configs ADD COLUMN aws_session_token TEXT NOT NULL DEFAULT ''"),
            ("last_validated_at", "ALTER TABLE llm_scan_configs ADD COLUMN last_validated_at TEXT"),
            ("last_validation_error", "ALTER TABLE llm_scan_configs ADD COLUMN last_validation_error TEXT NOT NULL DEFAULT ''"),
        ]
        for column, sql in migrations:
            if column not in existing_columns:
                self._conn.execute(sql)
        self._conn.execute("PRAGMA user_version = 3")
        self._conn.commit()

    @staticmethod
    def memory() -> Database:
        db = object.__new__(Database)
        db._lock = threading.Lock()
        db._conn = sqlite3.connect(":memory:", check_same_thread=False)
        db._conn.execute("PRAGMA foreign_keys = ON")
        db._conn.row_factory = sqlite3.Row
        db._create_tables_unsafe(db._conn)
        db._apply_migrations_unsafe(db._conn)
        return db

    @staticmethod
    def _create_tables_unsafe(conn: sqlite3.Connection) -> None:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS llm_scan_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL DEFAULT '',
                api_key TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT '',
                provider TEXT NOT NULL DEFAULT '',
                api_version TEXT NOT NULL DEFAULT '',
                aws_region TEXT NOT NULL DEFAULT '',
                aws_profile TEXT NOT NULL DEFAULT '',
                aws_session_token TEXT NOT NULL DEFAULT '',
                max_tokens INTEGER NOT NULL DEFAULT 8192,
                consensus_runs INTEGER NOT NULL DEFAULT 1,
                is_active INTEGER NOT NULL DEFAULT 0,
                last_validated_at TEXT,
                last_validation_error TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_config_active
                ON llm_scan_configs(is_active) WHERE is_active = 1
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        conn.commit()

    @staticmethod
    def _apply_migrations_unsafe(conn: sqlite3.Connection) -> None:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        if version < SCHEMA_VERSION:
            conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
            conn.commit()
