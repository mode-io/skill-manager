from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class SettingsStorageResponse(BaseModel):
    platform: Literal["macos", "linux"]
    configDir: str
    dataDir: str
    stateDir: str
    skillsStorePath: str
    marketplaceCachePath: str
    settingsPath: str


class SettingsHarnessResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    supportEnabled: bool
    installed: bool
    managedLocation: str | None


class SettingsResponse(BaseModel):
    storage: SettingsStorageResponse
    harnesses: list[SettingsHarnessResponse]


__all__ = ["SettingsHarnessResponse", "SettingsResponse", "SettingsStorageResponse"]
