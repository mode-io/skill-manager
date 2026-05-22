import type { components } from "../../../api/generated";

export type ScanFinding = components["schemas"]["ScanFindingResponse"];
export type ScanResult = components["schemas"]["ScanResultResponse"];
export type LLMDetection = components["schemas"]["LLMDetectionResponse"];
export type ScanConfigItem = components["schemas"]["ScanConfigItem"];
export type ScanConfigListResponse = components["schemas"]["ScanConfigListResponse"];
export type ScanConfigSecretResponse = components["schemas"]["ScanConfigSecretResponse"];
export type ScanConfigSaveRequest = components["schemas"]["ScanConfigSaveRequest"];
export type ScanConfigValidateRequest = components["schemas"]["ScanConfigValidateRequest"];
export type ScanConfigValidationResponse = components["schemas"]["ScanConfigValidationResponse"];

type RequiredScanConfigFields = "name" | "baseUrl" | "apiKey" | "model";

export type ScanConfigSavePayload =
  Pick<ScanConfigSaveRequest, RequiredScanConfigFields> &
  Partial<Omit<ScanConfigSaveRequest, RequiredScanConfigFields>>;

export type ScanConfigValidatePayload =
  Pick<ScanConfigValidateRequest, RequiredScanConfigFields> &
  Partial<Omit<ScanConfigValidateRequest, RequiredScanConfigFields>>;
