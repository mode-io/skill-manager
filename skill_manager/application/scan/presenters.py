from __future__ import annotations

from .models import Finding, ScanResult


def present_scan_result(result: ScanResult) -> dict:
    return {
        "skillName": result.skill_name,
        "isSafe": result.is_safe,
        "maxSeverity": result.max_severity.value,
        "findingsCount": len(result.findings),
        "findings": [_present_finding(f) for f in result.findings],
        "analyzersUsed": result.analyzers_used,
        "durationSeconds": result.duration_seconds,
    }


def _present_finding(f: Finding) -> dict:
    return {
        "id": f.id,
        "ruleId": f.rule_id,
        "category": f.category.value,
        "severity": f.severity.value,
        "title": f.title,
        "description": f.description,
        "filePath": f.file_path,
        "lineNumber": f.line_number,
        "snippet": f.snippet,
        "remediation": f.remediation,
        "analyzer": f.analyzer,
        "metadata": f.metadata,
    }
