from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from skill_manager.api.deps import get_container
from skill_manager.api.schemas.scan import (
    DetectedProviderResponse,
    LLMDetectionResponse,
    ScanAvailabilityResponse,
    ScanConfigItem,
    ScanConfigListResponse,
    ScanConfigSecretResponse,
    ScanConfigSaveRequest,
    ScanConfigValidateRequest,
    ScanConfigValidationResponse,
    ScanOptionsRequest,
    ScanResultResponse,
)
from skill_manager.application import BackendContainer
from skill_manager.application.scan.presenters import present_scan_result
from skill_manager.db.dao.scan_config import LLMScanConfigRow

router = APIRouter(prefix="/api/scan")


def _mask_api_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}...{key[-4:]}"


def _config_to_item(c: LLMScanConfigRow) -> ScanConfigItem:
    return ScanConfigItem(
        id=c.id,
        name=c.name,
        baseUrl=c.base_url,
        apiKeyMasked=_mask_api_key(c.api_key),
        model=c.model,
        provider=c.provider,
        apiVersion=c.api_version,
        awsRegion=c.aws_region,
        awsProfile=c.aws_profile,
        maxTokens=c.max_tokens,
        consensusRuns=c.consensus_runs,
        isActive=c.is_active,
        lastValidatedAt=c.last_validated_at,
        lastValidationError=c.last_validation_error,
    )


def _body_to_config(
    body: ScanConfigSaveRequest,
    *,
    config_id: int | None = None,
    is_active: bool = False,
    api_key: str | None = None,
) -> LLMScanConfigRow:
    return LLMScanConfigRow(
        id=config_id,
        name=body.name.strip(),
        base_url=body.baseUrl.strip(),
        api_key=api_key if api_key is not None else body.apiKey.strip(),
        model=body.model.strip(),
        provider=body.provider.strip(),
        api_version=body.apiVersion.strip(),
        aws_region=body.awsRegion.strip(),
        aws_profile=body.awsProfile.strip(),
        aws_session_token=body.awsSessionToken.strip(),
        max_tokens=body.maxTokens,
        consensus_runs=body.consensusRuns,
        is_active=is_active,
    )


@router.get("/availability", response_model=ScanAvailabilityResponse)
def check_scan_availability(container: BackendContainer = Depends(get_container)):
    return {"available": container.scan_service.available}


@router.get("/llm/detection", response_model=LLMDetectionResponse)
def detect_llm(container: BackendContainer = Depends(get_container)):
    result = container.scan_service.detect_llm()
    return LLMDetectionResponse(
        providers=[
            DetectedProviderResponse(
                provider=p.provider,
                apiKeySource=p.api_key_source,
                model=p.model,
                baseUrl=p.base_url,
                isAvailable=p.is_available,
            )
            for p in result.providers
        ],
        defaultModel=result.default_model,
        defaultProvider=result.default_provider,
        hasAnyAvailable=result.has_any_available,
    )


@router.get("/configs", response_model=ScanConfigListResponse)
def list_scan_configs(container: BackendContainer = Depends(get_container)):
    configs = container.scan_service.list_configs()
    active_id = None
    for c in configs:
        if c.is_active:
            active_id = c.id
            break
    return ScanConfigListResponse(
        configs=[_config_to_item(c) for c in configs],
        activeId=active_id,
    )


@router.get("/configs/{config_id}/secret", response_model=ScanConfigSecretResponse)
def reveal_scan_config_secret(
    config_id: int,
    container: BackendContainer = Depends(get_container),
):
    existing = container.scan_service.get_config_by_id(config_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Config {config_id} not found")
    return ScanConfigSecretResponse(apiKey=existing.api_key)


@router.post("/configs", response_model=ScanConfigItem)
def create_scan_config(
    body: ScanConfigSaveRequest,
    container: BackendContainer = Depends(get_container),
):
    config = _body_to_config(body)
    config_id = container.scan_service.save_config_validated(config)
    config.id = config_id
    saved = container.scan_service.get_config_by_id(config_id)
    return _config_to_item(saved or config)


@router.post("/configs/validate", response_model=ScanConfigValidationResponse)
def validate_scan_config(
    body: ScanConfigValidateRequest,
    container: BackendContainer = Depends(get_container),
):
    api_key = body.apiKey.strip()
    if body.existingConfigId is not None and not api_key:
        existing = container.scan_service.get_config_by_id(body.existingConfigId)
        if existing is None:
            return ScanConfigValidationResponse(
                ok=False,
                message=f"Config {body.existingConfigId} not found.",
                errorCode="config_not_found",
            )
        api_key = existing.api_key
    config = _body_to_config(body, config_id=body.existingConfigId, api_key=api_key)
    result = container.scan_service.validate_config(config)
    return ScanConfigValidationResponse(
        ok=result.ok,
        message=result.message,
        provider=result.provider,
        model=result.model,
        durationMs=result.duration_ms,
        errorCode=result.error_code,
    )


@router.put("/configs/{config_id}", response_model=ScanConfigItem)
def update_scan_config(
    config_id: int,
    body: ScanConfigSaveRequest,
    container: BackendContainer = Depends(get_container),
):
    existing = container.scan_service.get_config_by_id(config_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Config {config_id} not found")
    api_key = body.apiKey.strip() or existing.api_key
    config = _body_to_config(body, config_id=config_id, is_active=existing.is_active, api_key=api_key)
    container.scan_service.save_config_validated(config)
    saved = container.scan_service.get_config_by_id(config_id)
    return _config_to_item(saved or config)


@router.delete("/configs/{config_id}")
def delete_scan_config(
    config_id: int,
    container: BackendContainer = Depends(get_container),
):
    container.scan_service.delete_config(config_id)
    return {"ok": True}


@router.put("/configs/{config_id}/active")
def set_active_scan_config(
    config_id: int,
    container: BackendContainer = Depends(get_container),
):
    existing = container.scan_service.get_config_by_id(config_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Config {config_id} not found")
    container.scan_service.set_active_config(config_id)
    return {"ok": True}


@router.post("/skills/{skill_ref:path}", response_model=ScanResultResponse)
def scan_skill(
    skill_ref: str,
    body: ScanOptionsRequest | None = None,
    container: BackendContainer = Depends(get_container),
):
    if not container.scan_service.available:
        raise HTTPException(
            status_code=503,
            detail="Scan service not available. Check LLM configuration.",
        )

    skill_path = container.skills_queries.get_skill_path(skill_ref)
    if skill_path is None:
        raise HTTPException(status_code=404, detail=f"unknown skill ref: {skill_ref}")

    options = body or ScanOptionsRequest()
    result = container.scan_service.scan_skill_with_options(
        skill_path,
        use_llm=options.useLlm,
        llm_api_key=options.llmApiKey,
        llm_model=options.llmModel,
        llm_base_url=options.llmBaseUrl,
        llm_provider=options.llmProvider,
        llm_api_version=options.llmApiVersion,
        llm_max_tokens=options.llmMaxTokens,
        llm_consensus_runs=options.llmConsensusRuns,
        aws_region=options.awsRegion,
        aws_profile=options.awsProfile,
        aws_session_token=options.awsSessionToken,
    )
    return present_scan_result(result)
