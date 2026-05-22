from __future__ import annotations

from skill_manager.db import Database
from skill_manager.db.repositories.scan_config import LLMScanConfigRow, ScanConfigRepository


class ScanConfigDao:
    """Compatibility wrapper for older scan code; new code should use ScanConfigRepository."""

    def list_all(self, db: Database) -> list[LLMScanConfigRow]:
        return ScanConfigRepository(db).list_all()

    def get_active(self, db: Database) -> LLMScanConfigRow | None:
        return ScanConfigRepository(db).get_active()

    def get_by_id(self, db: Database, config_id: int) -> LLMScanConfigRow | None:
        return ScanConfigRepository(db).get_by_id(config_id)

    def save(self, db: Database, config: LLMScanConfigRow) -> int:
        return ScanConfigRepository(db).save(config)

    def delete(self, db: Database, config_id: int) -> None:
        ScanConfigRepository(db).delete(config_id)

    def set_active(self, db: Database, config_id: int) -> None:
        ScanConfigRepository(db).set_active(config_id)
