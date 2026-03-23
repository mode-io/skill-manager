from __future__ import annotations

from skill_manager.domain import CheckIssue, CheckReport, HarnessScan, StoreScan

from .view_models import CheckReportView


def build_check_report(*, store_scan: StoreScan, harness_scans: tuple[HarnessScan, ...]) -> CheckReportView:
    issues = [CheckIssue(severity="error", message=message, code="store-integrity") for message in store_scan.issues]
    warnings = [
        CheckIssue(severity="warning", message=issue, code="discovery-warning")
        for scan in harness_scans
        for issue in scan.issues
    ]
    status = "error" if issues else "warning" if warnings else "ok"
    report = CheckReport(
        status=status,
        issues=tuple(issues),
        warnings=tuple(warnings),
        counts={
            "shared": len(store_scan.packages),
            "discoveredHarnesses": len([scan for scan in harness_scans if scan.detected]),
            "warnings": len(warnings),
            "errors": len(issues),
        },
    )
    return CheckReportView.from_report(report)
