from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"
    SAFE = "SAFE"

    def rank(self) -> int:
        return {"CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2, "INFO": 1, "SAFE": 0}[self.value]


class ThreatCategory(str, Enum):
    PROMPT_INJECTION = "prompt_injection"
    COMMAND_INJECTION = "command_injection"
    DATA_EXFILTRATION = "data_exfiltration"
    UNAUTHORIZED_TOOL_USE = "unauthorized_tool_use"
    OBFUSCATION = "obfuscation"
    HARDCODED_SECRETS = "hardcoded_secrets"
    SOCIAL_ENGINEERING = "social_engineering"
    RESOURCE_ABUSE = "resource_abuse"
    POLICY_VIOLATION = "policy_violation"
    SUPPLY_CHAIN_ATTACK = "supply_chain_attack"
    MALWARE = "malware"
    HARMFUL_CONTENT = "harmful_content"


AITECH_TO_CATEGORY: dict[str, ThreatCategory] = {
    "AITech-1.1": ThreatCategory.PROMPT_INJECTION,
    "AITech-1.2": ThreatCategory.PROMPT_INJECTION,
    "AITech-4.3": ThreatCategory.UNAUTHORIZED_TOOL_USE,
    "AITech-8.2": ThreatCategory.DATA_EXFILTRATION,
    "AITech-9.1": ThreatCategory.COMMAND_INJECTION,
    "AITech-9.2": ThreatCategory.OBFUSCATION,
    "AITech-9.3": ThreatCategory.SUPPLY_CHAIN_ATTACK,
    "AITech-12.1": ThreatCategory.UNAUTHORIZED_TOOL_USE,
    "AITech-13.1": ThreatCategory.RESOURCE_ABUSE,
    "AITech-15.1": ThreatCategory.HARMFUL_CONTENT,
}

VALID_AITECH_CODES = set(AITECH_TO_CATEGORY.keys())


@dataclass
class Finding:
    id: str
    rule_id: str
    category: ThreatCategory
    severity: Severity
    title: str
    description: str
    file_path: str | None = None
    line_number: int | None = None
    snippet: str | None = None
    remediation: str | None = None
    analyzer: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ScanResult:
    skill_name: str
    is_safe: bool
    max_severity: Severity
    findings: list[Finding] = field(default_factory=list)
    analyzers_used: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0

    @staticmethod
    def from_findings(skill_name: str, findings: list[Finding], analyzers_used: list[str], duration: float) -> ScanResult:
        if findings:
            max_sev = max(findings, key=lambda f: f.severity.rank()).severity
        else:
            max_sev = Severity.SAFE
        is_safe = all(f.severity in (Severity.INFO, Severity.SAFE) for f in findings)
        return ScanResult(
            skill_name=skill_name,
            is_safe=is_safe,
            max_severity=max_sev,
            findings=findings,
            analyzers_used=analyzers_used,
            duration_seconds=duration,
        )


@dataclass
class SkillManifest:
    name: str
    description: str
    license: str | None = None
    compatibility: str | None = None
    allowed_tools: list[str] | str | None = None
    metadata: dict[str, Any] | None = None


@dataclass
class SkillFile:
    path: Path
    relative_path: str
    file_type: str
    content: str | None = None
    size_bytes: int = 0


@dataclass
class Skill:
    directory: Path
    manifest: SkillManifest
    instruction_body: str
    files: list[SkillFile] = field(default_factory=list)
    referenced_files: list[str] = field(default_factory=list)
