import { postJson, putJson, fetchJson, deleteJson } from "../../../api/http";
import type {
  LLMDetection,
  ScanConfigItem,
  ScanConfigListResponse,
  ScanConfigSavePayload,
  ScanConfigSecretResponse,
  ScanConfigValidatePayload,
  ScanConfigValidationResponse,
  ScanResult,
} from "./scan-types";

export async function detectLLM(): Promise<LLMDetection> {
  return fetchJson<LLMDetection>("/scan/llm/detection");
}

export async function scanSkill(
  skillRef: string,
  options?: ScanSkillOptions,
): Promise<ScanResult> {
  return postJson<ScanResult>(
    `/scan/skills/${encodeURIComponent(skillRef)}`,
    options ?? {},
  );
}

export interface ScanSkillOptions {
  useLlm?: boolean;
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmProvider?: string;
  llmApiVersion?: string;
  llmMaxTokens?: number;
  llmConsensusRuns?: number;
  awsRegion?: string;
  awsProfile?: string;
  awsSessionToken?: string;
}

export async function getScanConfigs(): Promise<ScanConfigListResponse> {
  return fetchJson<ScanConfigListResponse>("/scan/configs");
}

export async function revealScanConfigApiKey(id: number): Promise<ScanConfigSecretResponse> {
  return fetchJson<ScanConfigSecretResponse>(`/scan/configs/${id}/secret`);
}

export async function createScanConfig(config: ScanConfigSavePayload): Promise<ScanConfigItem> {
  return postJson<ScanConfigItem>("/scan/configs", config);
}

export async function updateScanConfig(id: number, config: ScanConfigSavePayload): Promise<ScanConfigItem> {
  return putJson<ScanConfigItem>(`/scan/configs/${id}`, config);
}

export async function validateScanConfig(config: ScanConfigValidatePayload): Promise<ScanConfigValidationResponse> {
  return postJson<ScanConfigValidationResponse>("/scan/configs/validate", config);
}

export async function deleteScanConfig(id: number): Promise<void> {
  await deleteJson(`/scan/configs/${id}`);
}

export async function setActiveScanConfig(id: number): Promise<void> {
  await putJson(`/scan/configs/${id}/active`, {});
}
