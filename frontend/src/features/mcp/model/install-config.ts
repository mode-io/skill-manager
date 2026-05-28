import type { components } from "../../../api/generated";

export type McpInstallConfigDto = components["schemas"]["McpInstallConfigResponse"];
export type McpInstallConfigFieldDto = components["schemas"]["McpInstallConfigFieldResponse"];
export type McpInstallConfigValues = Record<string, string | boolean | number>;
export type InstallConfigFormValues = Record<string, string | boolean>;

export interface PendingMcpInstallConfig {
  qualifiedName: string;
  targetLabel: string;
  displayName: string;
  installConfig: McpInstallConfigDto;
}

export function buildInitialInstallConfigValues(
  fields: readonly McpInstallConfigFieldDto[],
): InstallConfigFormValues {
  const initial: InstallConfigFormValues = {};
  for (const field of fields) {
    initial[field.name] = field.format === "boolean" ? field.default === "true" : field.default || "";
  }
  return initial;
}

export function missingRequiredInstallConfigFields(
  fields: readonly McpInstallConfigFieldDto[],
  values: InstallConfigFormValues,
): string[] {
  return fields
    .filter((field) => field.required && isEmptyInstallConfigValue(values[field.name]))
    .map((field) => field.name);
}

export function buildInstallConfigPayload(
  fields: readonly McpInstallConfigFieldDto[],
  values: InstallConfigFormValues,
): McpInstallConfigValues {
  const config: McpInstallConfigValues = {};
  for (const field of fields) {
    const value = values[field.name];
    if (isEmptyInstallConfigValue(value)) {
      continue;
    }
    config[field.name] = field.format === "number" ? Number(value) : value;
  }
  return config;
}

export function isEmptyInstallConfigValue(value: string | boolean | undefined): boolean {
  return value === undefined || value === "";
}
