import type {
  McpInventoryDto,
  McpInventoryEntryDto,
} from "../../features/mcp/api/management-types";

export function mcpInventoryPayload(
  entries: McpInventoryEntryDto[] = [],
  overrides: Partial<McpInventoryDto> = {},
): McpInventoryDto {
  return {
    columns: [],
    entries,
    issues: [],
    ...overrides,
  };
}

export function mcpInventoryEntry({
  name,
  kind,
  displayName = name,
  sightings = [],
  canEnable = kind === "managed",
  enabledStatus = "disabled",
  availabilityStatus = "unavailable",
  availabilityReason = null,
  mcpStatus = availabilityStatus === "available"
    ? { kind: "available" as const, reason: null }
    : availabilityReason
      ? {
          kind: "connection_issue" as const,
          reason: availabilityReason,
        }
      : { kind: "unchecked" as const, reason: null },
  installConfigStatus = {
    hasFields: false,
    missingRequired: [],
    configured: true,
  },
  spec = null,
}: Pick<McpInventoryEntryDto, "name" | "kind"> & Partial<McpInventoryEntryDto>): McpInventoryEntryDto {
  return {
    name,
    displayName,
    kind,
    canEnable,
    enabledStatus,
    availabilityStatus,
    availabilityReason,
    mcpStatus,
    installConfigStatus,
    spec,
    sightings,
  };
}
