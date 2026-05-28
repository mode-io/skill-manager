import { deleteJson, fetchJson, postJson } from "../../../api/http";

import type {
  McpApplyConfigResponseDto,
  McpAvailabilityCheckResponseDto,
  McpInventoryDto,
  McpServerDetailDto,
  McpNeedsReviewByServerDto,
  SetMcpHarnessesResponseDto,
  UninstallMcpResponseDto,
} from "./management-types";
import type { McpInstallConfigValues } from "../model/install-config";

export async function fetchMcpInventory(): Promise<McpInventoryDto> {
  return fetchJson<McpInventoryDto>("/mcp/servers");
}

export async function enableMcpServer(args: {
  name: string;
  harness: string;
  config?: McpInstallConfigValues;
}): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/mcp/servers/${encodeURIComponent(args.name)}/enable`, {
    harness: args.harness,
    config: args.config,
  });
}

export async function disableMcpServer(args: {
  name: string;
  harness: string;
}): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/mcp/servers/${encodeURIComponent(args.name)}/disable`, {
    harness: args.harness,
  });
}

export async function setMcpServerHarnesses(args: {
  name: string;
  target: "enabled" | "disabled";
  config?: McpInstallConfigValues;
}): Promise<SetMcpHarnessesResponseDto> {
  return postJson<SetMcpHarnessesResponseDto>(
    `/mcp/servers/${encodeURIComponent(args.name)}/set-harnesses`,
    { target: args.target, config: args.config },
  );
}

export async function uninstallMcpServer(name: string): Promise<UninstallMcpResponseDto> {
  return deleteJson<UninstallMcpResponseDto>(`/mcp/servers/${encodeURIComponent(name)}`);
}

export async function fetchMcpServerDetail(name: string): Promise<McpServerDetailDto> {
  return fetchJson<McpServerDetailDto>(`/mcp/servers/${encodeURIComponent(name)}`);
}

export async function checkMcpServerAvailability(name: string): Promise<McpAvailabilityCheckResponseDto> {
  return postJson<McpAvailabilityCheckResponseDto>(
    `/mcp/servers/${encodeURIComponent(name)}/availability/check`,
  );
}

export async function reconcileMcpServer(args: {
  name: string;
  sourceKind: "managed" | "harness";
  observedHarness?: string | null;
  harnesses?: string[];
}): Promise<McpApplyConfigResponseDto> {
  return postJson<McpApplyConfigResponseDto>(
    `/mcp/servers/${encodeURIComponent(args.name)}/reconcile`,
    {
      sourceKind: args.sourceKind,
      observedHarness: args.observedHarness ?? null,
      harnesses: args.harnesses,
    },
  );
}

export async function fetchMcpNeedsReviewByServer(): Promise<McpNeedsReviewByServerDto> {
  return fetchJson<McpNeedsReviewByServerDto>("/mcp/unmanaged/by-server");
}

export async function adoptMcpServer(body: {
  name: string;
  observedHarness?: string | null;
  harnesses?: string[];
}): Promise<McpApplyConfigResponseDto> {
  return postJson<McpApplyConfigResponseDto>("/mcp/unmanaged/adopt", body);
}
