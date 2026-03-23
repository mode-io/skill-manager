from __future__ import annotations

from dataclasses import dataclass

from skill_manager.domain import CatalogConflict, CatalogEntry, CatalogSighting, CheckIssue, CheckReport, HarnessBinding, HarnessScan


@dataclass(frozen=True)
class HarnessSummaryView:
    harness: str
    label: str
    detected: bool
    manageable: bool
    builtin_support: bool
    discovery_mode: str
    detection_details: tuple[str, ...]
    issues: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "harness": self.harness,
            "label": self.label,
            "detected": self.detected,
            "manageable": self.manageable,
            "builtinSupport": self.builtin_support,
            "discoveryMode": self.discovery_mode,
            "detectionDetails": list(self.detection_details),
            "issues": list(self.issues),
        }

    @classmethod
    def from_scan(cls, scan: HarnessScan) -> "HarnessSummaryView":
        return cls(
            harness=scan.harness,
            label=scan.label,
            detected=scan.detected,
            manageable=scan.manageable,
            builtin_support=scan.builtin_support,
            discovery_mode=scan.discovery_mode,
            detection_details=scan.detection_details,
            issues=scan.issues,
        )


@dataclass(frozen=True)
class HarnessBindingView:
    harness: str
    label: str
    state: str
    scopes: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "harness": self.harness,
            "label": self.label,
            "state": self.state,
            "scopes": list(self.scopes),
        }

    @classmethod
    def from_binding(cls, binding: HarnessBinding) -> "HarnessBindingView":
        return cls(
            harness=binding.harness,
            label=binding.label,
            state=binding.state,
            scopes=binding.scopes,
        )


@dataclass(frozen=True)
class CatalogConflictView:
    conflict_type: str
    message: str
    revisions: tuple[str, ...]
    harnesses: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "conflictType": self.conflict_type,
            "message": self.message,
            "revisions": list(self.revisions),
            "harnesses": list(self.harnesses),
        }

    @classmethod
    def from_conflict(cls, conflict: CatalogConflict) -> "CatalogConflictView":
        return cls(
            conflict_type=conflict.conflict_type,
            message=conflict.message,
            revisions=conflict.revisions,
            harnesses=conflict.harnesses,
        )


@dataclass(frozen=True)
class CatalogSightingView:
    kind: str
    harness: str | None
    label: str
    scope: str | None
    package_path: str | None
    revision: str
    source_kind: str
    source_locator: str

    def to_dict(self) -> dict[str, object]:
        return {
            "kind": self.kind,
            "harness": self.harness,
            "label": self.label,
            "scope": self.scope,
            "packagePath": self.package_path,
            "revision": self.revision,
            "sourceKind": self.source_kind,
            "sourceLocator": self.source_locator,
        }

    @classmethod
    def from_sighting(cls, sighting: CatalogSighting) -> "CatalogSightingView":
        return cls(
            kind=sighting.kind,
            harness=sighting.harness,
            label=sighting.label,
            scope=sighting.scope,
            package_path=str(sighting.package_path) if sighting.package_path is not None else None,
            revision=sighting.revision,
            source_kind=sighting.source.kind,
            source_locator=sighting.source.locator,
        )


@dataclass(frozen=True)
class CatalogEntryView:
    skill_ref: str
    declared_name: str
    ownership: str
    source_kind: str
    source_locator: str
    revision: str
    harnesses: tuple[HarnessBindingView, ...]
    builtin_harnesses: tuple[str, ...]
    issues: tuple[str, ...]
    conflicts: tuple[CatalogConflictView, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "skillRef": self.skill_ref,
            "declaredName": self.declared_name,
            "ownership": self.ownership,
            "sourceKind": self.source_kind,
            "sourceLocator": self.source_locator,
            "revision": self.revision,
            "harnesses": [binding.to_dict() for binding in self.harnesses],
            "builtinHarnesses": list(self.builtin_harnesses),
            "issues": list(self.issues),
            "conflicts": [conflict.to_dict() for conflict in self.conflicts],
        }

    @classmethod
    def from_entry(cls, entry: CatalogEntry) -> "CatalogEntryView":
        return cls(
            skill_ref=entry.skill_ref,
            declared_name=entry.declared_name,
            ownership=entry.ownership,
            source_kind=entry.source.kind,
            source_locator=entry.source.locator,
            revision=entry.primary_revision,
            harnesses=tuple(HarnessBindingView.from_binding(binding) for binding in entry.bindings),
            builtin_harnesses=entry.builtin_harnesses,
            issues=entry.issues,
            conflicts=tuple(CatalogConflictView.from_conflict(conflict) for conflict in entry.conflicts),
        )


@dataclass(frozen=True)
class CatalogDetailView:
    summary: CatalogEntryView
    sightings: tuple[CatalogSightingView, ...]

    def to_dict(self) -> dict[str, object]:
        payload = self.summary.to_dict()
        payload["sightings"] = [sighting.to_dict() for sighting in self.sightings]
        return payload

    @classmethod
    def from_entry(cls, entry: CatalogEntry) -> "CatalogDetailView":
        return cls(
            summary=CatalogEntryView.from_entry(entry),
            sightings=tuple(CatalogSightingView.from_sighting(sighting) for sighting in entry.sightings),
        )


@dataclass(frozen=True)
class CheckIssueView:
    severity: str
    message: str
    code: str

    def to_dict(self) -> dict[str, str]:
        return {
            "severity": self.severity,
            "message": self.message,
            "code": self.code,
        }

    @classmethod
    def from_issue(cls, issue: CheckIssue) -> "CheckIssueView":
        return cls(severity=issue.severity, message=issue.message, code=issue.code)


@dataclass(frozen=True)
class CheckReportView:
    status: str
    issues: tuple[CheckIssueView, ...]
    warnings: tuple[CheckIssueView, ...]
    counts: dict[str, int]

    def to_dict(self) -> dict[str, object]:
        return {
            "status": self.status,
            "issues": [issue.to_dict() for issue in self.issues],
            "warnings": [warning.to_dict() for warning in self.warnings],
            "counts": dict(self.counts),
        }

    @classmethod
    def from_report(cls, report: CheckReport) -> "CheckReportView":
        return cls(
            status=report.status,
            issues=tuple(CheckIssueView.from_issue(issue) for issue in report.issues),
            warnings=tuple(CheckIssueView.from_issue(issue) for issue in report.warnings),
            counts=report.counts,
        )
