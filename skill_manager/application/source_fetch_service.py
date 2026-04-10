from __future__ import annotations

from pathlib import Path

from skill_manager.errors import MutationError
from skill_manager.sources import GitHubSource


class SourceFetchService:
    def __init__(self, *, github: GitHubSource | None = None) -> None:
        self._github = github or GitHubSource()

    def fetch(self, *, source_kind: str, source_locator: str, work_dir: Path) -> Path:
        try:
            if source_kind == "github":
                locator = source_locator.removeprefix("github:")
                return self._github.fetch(locator, work_dir)
        except MutationError:
            raise
        except Exception as error:  # noqa: BLE001
            raise MutationError(str(error), status=400) from error
        raise MutationError(f"unsupported source kind: {source_kind}", status=400)
