from __future__ import annotations

import logging
import sqlite3

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 3


def initialize_schema(conn: sqlite3.Connection) -> None:
    create_tables(conn)
    apply_migrations(conn)


def create_tables(conn: sqlite3.Connection) -> None:
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


def apply_migrations(conn: sqlite3.Connection) -> None:
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version < 1:
        _migrate_v0_to_v1(conn)
    if version < 2:
        _migrate_v1_to_v2(conn)
    if version < 3:
        _migrate_v2_to_v3(conn)
    current = conn.execute("PRAGMA user_version").fetchone()[0]
    if current < SCHEMA_VERSION:
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        conn.commit()


def _migrate_v0_to_v1(conn: sqlite3.Connection) -> None:
    logger.info("Schema migration: v0 -> v1 (initial tables)")
    conn.execute("PRAGMA user_version = 1")
    conn.commit()


def _migrate_v1_to_v2(conn: sqlite3.Connection) -> None:
    logger.info("Schema migration: v1 -> v2 (multi-config support)")
    old_exists = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='llm_scan_config'"
    ).fetchone()[0]
    if old_exists:
        rows = conn.execute(
            "SELECT base_url, api_key, model, provider, max_tokens, consensus_runs FROM llm_scan_config WHERE id = 1"
        ).fetchall()
        for row in rows:
            if row["base_url"] or row["api_key"] or row["model"]:
                conn.execute(
                    """INSERT INTO llm_scan_configs (
                           name, base_url, api_key, model, provider,
                           max_tokens, consensus_runs, is_active
                       )
                       VALUES ('Default', ?1, ?2, ?3, ?4, ?5, ?6, 1)""",
                    (
                        row["base_url"],
                        row["api_key"],
                        row["model"],
                        row["provider"],
                        row["max_tokens"],
                        row["consensus_runs"],
                    ),
                )
        conn.execute("DROP TABLE llm_scan_config")
    conn.execute("PRAGMA user_version = 2")
    conn.commit()


def _migrate_v2_to_v3(conn: sqlite3.Connection) -> None:
    logger.info("Schema migration: v2 -> v3 (LLM config validation metadata)")
    existing_columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(llm_scan_configs)").fetchall()
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
            conn.execute(sql)
    conn.execute("PRAGMA user_version = 3")
    conn.commit()
