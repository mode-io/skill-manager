import { postJson, putJson, fetchJson, deleteJson } from "./http";

export interface ScanFinding {
  id: string;
  ruleId: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  filePath: string | null;
  lineNumber: number | null;
  snippet: string | null;
  remediation: string | null;
  analyzer: string | null;
}

export interface ScanResult {
  skillName: string;
  isSafe: boolean;
  maxSeverity: string;
  findingsCount: number;
  findings: ScanFinding[];
  analyzersUsed: string[];
  durationSeconds: number;
}

export interface ScanAvailability {
  available: boolean;
}

export interface DetectedProvider {
  provider: string;
  apiKeySource: string;
  model: string | null;
  baseUrl: string | null;
  isAvailable: boolean;
}

export interface LLMDetection {
  providers: DetectedProvider[];
  defaultModel: string | null;
  defaultProvider: string | null;
  hasAnyAvailable: boolean;
}

export async function checkScanAvailability(): Promise<ScanAvailability> {
  return fetchJson<ScanAvailability>("/scan/availability");
}

export async function detectLLM(): Promise<LLMDetection> {
  return fetchJson<LLMDetection>("/scan/llm/detection");
}

export async function scanSkill(
  skillRef: string,
  options?: {
    useBehavioral?: boolean;
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
  },
): Promise<ScanResult> {
  return postJson<ScanResult>(
    `/scan/skills/${encodeURIComponent(skillRef)}`,
    options ?? {},
  );
}

export interface ScanConfigItem {
  id: number;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  model: string;
  provider: string;
  apiVersion: string;
  awsRegion: string;
  awsProfile: string;
  maxTokens: number;
  consensusRuns: number;
  isActive: boolean;
  lastValidatedAt: string | null;
  lastValidationError: string;
}

export interface ScanConfigListResponse {
  configs: ScanConfigItem[];
  activeId: number | null;
}

export interface ScanConfigSecretResponse {
  apiKey: string;
}

export interface ScanConfigSaveRequest {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  provider?: string;
  apiVersion?: string;
  maxTokens?: number;
  consensusRuns?: number;
  awsRegion?: string;
  awsProfile?: string;
  awsSessionToken?: string;
}

export interface ScanConfigValidateRequest extends ScanConfigSaveRequest {
  existingConfigId?: number;
}

export interface ScanConfigValidationResponse {
  ok: boolean;
  message: string;
  provider: string | null;
  model: string | null;
  durationMs: number | null;
  errorCode: string | null;
}

export async function getScanConfigs(): Promise<ScanConfigListResponse> {
  return fetchJson<ScanConfigListResponse>("/scan/configs");
}

export async function revealScanConfigApiKey(id: number): Promise<ScanConfigSecretResponse> {
  return fetchJson<ScanConfigSecretResponse>(`/scan/configs/${id}/secret`);
}

export async function createScanConfig(config: ScanConfigSaveRequest): Promise<ScanConfigItem> {
  return postJson<ScanConfigItem>("/scan/configs", config);
}

export async function updateScanConfig(id: number, config: ScanConfigSaveRequest): Promise<ScanConfigItem> {
  return putJson<ScanConfigItem>(`/scan/configs/${id}`, config);
}

export async function validateScanConfig(config: ScanConfigValidateRequest): Promise<ScanConfigValidationResponse> {
  return postJson<ScanConfigValidationResponse>("/scan/configs/validate", config);
}

export async function deleteScanConfig(id: number): Promise<void> {
  await deleteJson(`/scan/configs/${id}`);
}

export async function setActiveScanConfig(id: number): Promise<void> {
  await putJson(`/scan/configs/${id}/active`, {});
}
