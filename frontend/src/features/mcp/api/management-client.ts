import { deleteJson, fetchJson, postJson } from "../../../api/http";

import type {
  McpApplyConfigResponseDto,
  McpInventoryDto,
  McpServerDetailDto,
  McpNeedsReviewByServerDto,
  SetMcpHarnessesResponseDto,
  UninstallMcpResponseDto,
} from "./management-types";

export async function fetchMcpInventory(): Promise<McpInventoryDto> {
  return fetchJson<McpInventoryDto>("/mcp/servers");
}

export async function enableMcpServer(args: {
  name: string;
  harness: string;
}): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/mcp/servers/${encodeURIComponent(args.name)}/enable`, {
    harness: args.harness,
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
}): Promise<SetMcpHarnessesResponseDto> {
  return postJson<SetMcpHarnessesResponseDto>(
    `/mcp/servers/${encodeURIComponent(args.name)}/set-harnesses`,
    { target: args.target },
  );
}

export async function uninstallMcpServer(name: string): Promise<UninstallMcpResponseDto> {
  return deleteJson<UninstallMcpResponseDto>(`/mcp/servers/${encodeURIComponent(name)}`);
}

export async function fetchMcpServerDetail(name: string): Promise<McpServerDetailDto> {
  return fetchJson<McpServerDetailDto>(`/mcp/servers/${encodeURIComponent(name)}`);
}

export async function reconcileMcpServer(args: {
  name: string;
  sourceKind: "managed" | "harness";
  sourceHarness?: string | null;
  harnesses?: string[];
}): Promise<McpApplyConfigResponseDto> {
  return postJson<McpApplyConfigResponseDto>(
    `/mcp/servers/${encodeURIComponent(args.name)}/reconcile`,
    {
      sourceKind: args.sourceKind,
      sourceHarness: args.sourceHarness ?? null,
      harnesses: args.harnesses,
    },
  );
}

export async function fetchMcpNeedsReviewByServer(): Promise<McpNeedsReviewByServerDto> {
  return fetchJson<McpNeedsReviewByServerDto>("/mcp/unmanaged/by-server");
}

export async function adoptMcpServer(body: {
  name: string;
  sourceHarness?: string | null;
  harnesses?: string[];
}): Promise<McpApplyConfigResponseDto> {
  return postJson<McpApplyConfigResponseDto>("/mcp/unmanaged/adopt", body);
}
