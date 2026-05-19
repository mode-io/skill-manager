from __future__ import annotations

from pydantic import BaseModel


class ScanOptionsRequest(BaseModel):
    useLlm: bool = True
    llmApiKey: str | None = None
    llmModel: str | None = None
    llmBaseUrl: str | None = None
    llmProvider: str | None = None
    llmApiVersion: str | None = None
    llmMaxTokens: int = 8192
    llmConsensusRuns: int = 1
    awsRegion: str | None = None
    awsProfile: str | None = None
    awsSessionToken: str | None = None


class ScanFindingResponse(BaseModel):
    id: str
    ruleId: str
    category: str
    severity: str
    title: str
    description: str
    filePath: str | None = None
    lineNumber: int | None = None
    snippet: str | None = None
    remediation: str | None = None
    analyzer: str | None = None
    metadata: dict = {}


class ScanResultResponse(BaseModel):
    skillName: str
    isSafe: bool
    maxSeverity: str
    findingsCount: int
    findings: list[ScanFindingResponse]
    analyzersUsed: list[str]
    durationSeconds: float


class ScanAvailabilityResponse(BaseModel):
    available: bool


class DetectedProviderResponse(BaseModel):
    provider: str
    apiKeySource: str
    model: str | None = None
    baseUrl: str | None = None
    isAvailable: bool


class LLMDetectionResponse(BaseModel):
    providers: list[DetectedProviderResponse]
    defaultModel: str | None = None
    defaultProvider: str | None = None
    hasAnyAvailable: bool


class ScanConfigItem(BaseModel):
    id: int
    name: str
    baseUrl: str
    apiKeyMasked: str
    model: str
    provider: str
    apiVersion: str
    awsRegion: str
    awsProfile: str
    maxTokens: int
    consensusRuns: int
    isActive: bool
    lastValidatedAt: str | None = None
    lastValidationError: str = ""


class ScanConfigSecretResponse(BaseModel):
    apiKey: str


class ScanConfigListResponse(BaseModel):
    configs: list[ScanConfigItem]
    activeId: int | None


class ScanConfigSaveRequest(BaseModel):
    name: str
    baseUrl: str
    apiKey: str
    model: str
    provider: str = ""
    apiVersion: str = ""
    maxTokens: int = 8192
    consensusRuns: int = 1
    awsRegion: str = ""
    awsProfile: str = ""
    awsSessionToken: str = ""


class ScanConfigValidateRequest(ScanConfigSaveRequest):
    existingConfigId: int | None = None


class ScanConfigValidationResponse(BaseModel):
    ok: bool
    message: str
    provider: str | None = None
    model: str | None = None
    durationMs: int | None = None
    errorCode: str | None = None
