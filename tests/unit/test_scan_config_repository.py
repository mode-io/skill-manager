from __future__ import annotations

import unittest

from skill_manager.db import Database
from skill_manager.db.repositories import LLMScanConfigRow, ScanConfigRepository


def config_row(
    name: str,
    *,
    config_id: int | None = None,
    api_key: str = "sk-test-secret",
    is_active: bool = False,
) -> LLMScanConfigRow:
    return LLMScanConfigRow(
        id=config_id,
        name=name,
        base_url="https://api.example.com/v1",
        api_key=api_key,
        model="model-a",
        provider="openai-compatible",
        api_version="",
        aws_region="",
        aws_profile="",
        aws_session_token="",
        max_tokens=8192,
        consensus_runs=1,
        is_active=is_active,
    )


class ScanConfigRepositoryTests(unittest.TestCase):
    def test_crud_active_selection_and_secret_roundtrip(self) -> None:
        db = Database.memory()
        try:
            repository = ScanConfigRepository(db)
            first_id = repository.save(config_row("Default", api_key="sk-first-secret"))
            second_id = repository.save(config_row("Backup", api_key="sk-second-secret"))

            self.assertEqual([row.name for row in repository.list_all()], ["Default", "Backup"])
            self.assertIsNone(repository.get_active())

            repository.set_active(second_id)
            active = repository.get_active()
            self.assertIsNotNone(active)
            self.assertEqual(active.id, second_id)
            self.assertEqual(active.api_key, "sk-second-secret")

            repository.save(config_row("Renamed", config_id=second_id, api_key="sk-updated-secret", is_active=True))
            updated = repository.get_by_id(second_id)
            self.assertIsNotNone(updated)
            self.assertEqual(updated.name, "Renamed")
            self.assertEqual(updated.api_key, "sk-updated-secret")

            repository.delete(first_id)
            self.assertEqual([row.id for row in repository.list_all()], [second_id])
        finally:
            db.close()

    def test_database_initializes_scan_schema_version(self) -> None:
        db = Database.memory()
        try:
            version = db.execute_fetchone("PRAGMA user_version")
            self.assertIsNotNone(version)
            self.assertEqual(version[0], 3)
            legacy = db.execute_fetchone(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'llm_scan_config'"
            )
            self.assertIsNone(legacy)
            db.execute_commit(
                "INSERT INTO llm_scan_configs (name, base_url, api_key, model) VALUES (?1, ?2, ?3, ?4)",
                ("Smoke", "https://api.example.com/v1", "sk-secret", "model-a"),
            )
            row = db.execute_fetchone("SELECT name, api_key FROM llm_scan_configs WHERE name = ?1", ("Smoke",))
            self.assertIsNotNone(row)
            self.assertEqual(row["api_key"], "sk-secret")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
