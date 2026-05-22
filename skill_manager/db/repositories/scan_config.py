from __future__ import annotations

from dataclasses import dataclass
import sqlite3

from ..connection import Database


@dataclass
class LLMScanConfigRow:
    id: int | None
    name: str
    base_url: str
    api_key: str
    model: str
    provider: str
    api_version: str
    aws_region: str
    aws_profile: str
    aws_session_token: str
    max_tokens: int
    consensus_runs: int
    is_active: bool
    last_validated_at: str | None = None
    last_validation_error: str = ""


_CONFIG_COLUMNS = (
    "id, name, base_url, api_key, model, provider, api_version, aws_region, "
    "aws_profile, aws_session_token, max_tokens, consensus_runs, is_active, "
    "last_validated_at, last_validation_error"
)


class ScanConfigRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def list_all(self) -> list[LLMScanConfigRow]:
        rows = self.db.execute_fetchall(
            f"SELECT {_CONFIG_COLUMNS} FROM llm_scan_configs ORDER BY id"
        )
        return [_row_to_config(row) for row in rows]

    def get_active(self) -> LLMScanConfigRow | None:
        row = self.db.execute_fetchone(
            f"SELECT {_CONFIG_COLUMNS} FROM llm_scan_configs WHERE is_active = 1"
        )
        return _row_to_config(row) if row else None

    def get_by_id(self, config_id: int) -> LLMScanConfigRow | None:
        row = self.db.execute_fetchone(
            f"SELECT {_CONFIG_COLUMNS} FROM llm_scan_configs WHERE id = ?1",
            (config_id,),
        )
        return _row_to_config(row) if row else None

    def save(self, config: LLMScanConfigRow) -> int:
        if config.id is not None:
            self.db.execute_commit(
                """UPDATE llm_scan_configs
                   SET name=?1, base_url=?2, api_key=?3, model=?4, provider=?5,
                       api_version=?6, aws_region=?7, aws_profile=?8, aws_session_token=?9,
                       max_tokens=?10, consensus_runs=?11, is_active=?12,
                       last_validated_at=?13, last_validation_error=?14,
                       updated_at=datetime('now')
                   WHERE id=?15""",
                (
                    config.name,
                    config.base_url,
                    config.api_key,
                    config.model,
                    config.provider,
                    config.api_version,
                    config.aws_region,
                    config.aws_profile,
                    config.aws_session_token,
                    config.max_tokens,
                    config.consensus_runs,
                    int(config.is_active),
                    config.last_validated_at,
                    config.last_validation_error,
                    config.id,
                ),
            )
            return config.id
        row = self.db.execute_fetchone(
            """INSERT INTO llm_scan_configs (
                   name, base_url, api_key, model, provider,
                   api_version, aws_region, aws_profile, aws_session_token,
                   max_tokens, consensus_runs, is_active, last_validated_at, last_validation_error
               )
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
               RETURNING id""",
            (
                config.name,
                config.base_url,
                config.api_key,
                config.model,
                config.provider,
                config.api_version,
                config.aws_region,
                config.aws_profile,
                config.aws_session_token,
                config.max_tokens,
                config.consensus_runs,
                int(config.is_active),
                config.last_validated_at,
                config.last_validation_error,
            ),
        )
        return row["id"]

    def delete(self, config_id: int) -> None:
        self.db.execute_commit("DELETE FROM llm_scan_configs WHERE id = ?1", (config_id,))

    def set_active(self, config_id: int) -> None:
        self.db.execute_many_commit([
            ("UPDATE llm_scan_configs SET is_active = 0 WHERE is_active = 1", ()),
            ("UPDATE llm_scan_configs SET is_active = 1, updated_at=datetime('now') WHERE id = ?1", (config_id,)),
        ])


def _row_to_config(row: sqlite3.Row) -> LLMScanConfigRow:
    return LLMScanConfigRow(
        id=row["id"],
        name=row["name"],
        base_url=row["base_url"],
        api_key=row["api_key"],
        model=row["model"],
        provider=row["provider"],
        api_version=row["api_version"],
        aws_region=row["aws_region"],
        aws_profile=row["aws_profile"],
        aws_session_token=row["aws_session_token"],
        max_tokens=row["max_tokens"],
        consensus_runs=row["consensus_runs"],
        is_active=bool(row["is_active"]),
        last_validated_at=row["last_validated_at"],
        last_validation_error=row["last_validation_error"],
    )
