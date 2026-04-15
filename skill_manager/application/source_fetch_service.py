from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from skill_manager.errors import MutationError
from skill_manager.sources import GitHubSource


@dataclass(frozen=True)
class FetchedSourcePackage:
    package_path: Path
    source_ref: str | None = None
    source_path: str | None = None


class SourceFetchService:
    def __init__(self, *, github: GitHubSource | None = None) -> None:
        self._github = github or GitHubSource()

    def fetch_package(self, *, source_kind: str, source_locator: str, work_dir: Path) -> FetchedSourcePackage:
        try:
            if source_kind == "github":
                locator = source_locator.removeprefix("github:")
                resolved = self._github.resolve(locator, work_dir)
                return FetchedSourcePackage(
                    package_path=resolved.package_path,
                    source_ref=resolved.ref,
                    source_path=resolved.relative_path,
                )
        except MutationError:
            raise
        except Exception as error:  # noqa: BLE001
            raise MutationError(str(error), status=400) from error
        raise MutationError(f"unsupported source kind: {source_kind}", status=400)

    def fetch(self, *, source_kind: str, source_locator: str, work_dir: Path) -> Path:
        return self.fetch_package(
            source_kind=source_kind,
            source_locator=source_locator,
            work_dir=work_dir,
        ).package_path
