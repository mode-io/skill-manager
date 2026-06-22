import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { applyMcpHarnessBindingState } from "./invalidation";
import { mcpManagementKeys } from "./keys";
import type {
  McpInventoryColumnDto,
  McpInventoryDto,
  McpInventoryEntryDto,
  McpServerDetailDto,
} from "./management-types";

describe("applyMcpHarnessBindingState", () => {
  it("does not mark drifted-only bindings as enabled", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<McpInventoryDto>(mcpManagementKeys.inventory(), {
      columns: [column("cursor")],
      entries: [
        entry("remote", {
          enabledStatus: "enabled",
          sightings: [{ harness: "cursor", state: "drifted", driftDetail: "changed" }],
        }),
      ],
    });
    queryClient.setQueryData<McpServerDetailDto>(
      mcpManagementKeys.detail("remote"),
      detail("remote", {
        enabledStatus: "enabled",
        sightings: [{ harness: "cursor", state: "drifted", driftDetail: "changed" }],
      }),
    );

    applyMcpHarnessBindingState(queryClient, "remote", "cursor", "drifted");

    const inventory = queryClient.getQueryData<McpInventoryDto>(mcpManagementKeys.inventory());
    const server = queryClient.getQueryData<McpServerDetailDto>(mcpManagementKeys.detail("remote"));
    expect(inventory?.entries[0]?.enabledStatus).toBe("disabled");
    expect(server?.enabledStatus).toBe("disabled");
  });

  it("ignores managed bindings on non-addressable harness columns", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<McpInventoryDto>(mcpManagementKeys.inventory(), {
      columns: [
        column("cursor"),
        column("openclaw", { installed: false, configPresent: false, mcpWritable: false }),
      ],
      entries: [
        entry("remote", {
          enabledStatus: "enabled",
          sightings: [{ harness: "openclaw", state: "managed", driftDetail: null }],
        }),
      ],
    });

    applyMcpHarnessBindingState(queryClient, "remote", "cursor", "missing");

    const inventory = queryClient.getQueryData<McpInventoryDto>(mcpManagementKeys.inventory());
    expect(inventory?.entries[0]?.enabledStatus).toBe("disabled");
  });
});

function column(
  harness: string,
  overrides: Partial<McpInventoryColumnDto> = {},
): McpInventoryColumnDto {
  return {
    configPresent: true,
    harness,
    installed: true,
    label: harness,
    logoKey: null,
    mcpUnavailableReason: null,
    mcpWritable: true,
    ...overrides,
  };
}

function entry(
  name: string,
  overrides: Partial<McpInventoryEntryDto> = {},
): McpInventoryEntryDto {
  return {
    availabilityStatus: "unavailable",
    availabilityReason: null,
    canEnable: true,
    displayName: name,
    enabledStatus: "disabled",
    installConfigStatus: { hasFields: false, missingRequired: [], configured: true },
    kind: "managed",
    mcpStatus: { kind: "unchecked", reason: null },
    name,
    sightings: [],
    spec: {
      args: null,
      command: "npx",
      displayName: name,
      env: null,
      headers: null,
      installedAt: "2026-01-01T00:00:00Z",
      name,
      revision: `${name}-rev`,
      source: { kind: "manual", locator: name },
      transport: "stdio",
      url: null,
    },
    ...overrides,
  };
}

function detail(
  name: string,
  overrides: Partial<McpServerDetailDto> = {},
): McpServerDetailDto {
  return {
    ...entry(name),
    configChoices: [],
    env: [],
    marketplaceLink: null,
    ...overrides,
  };
}
