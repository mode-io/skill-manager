import { fetchJson, postJson, putJson, deleteJson } from "../../../api/http";
import { apiPath } from "../../../api/paths";
import type {
  AgentInventoryDto,
  AgentCreateRequest,
  AgentUpdateRequest,
  AgentSummaryResponse,
  AgentAdoptConflict,
  AdoptAllResponse,
  AgentDetailDto,
} from "./types";

export async function fetchAgentsInventory(): Promise<AgentInventoryDto> {
  return fetchJson<AgentInventoryDto>("/agents");
}

export async function fetchAgentDetail(ref: string): Promise<AgentDetailDto> {
  return fetchJson<AgentDetailDto>(`/agents/${ref}`);
}

export async function createAgent(
  request: AgentCreateRequest,
): Promise<AgentSummaryResponse> {
  return postJson<AgentSummaryResponse>("/agents", request);
}

export async function updateAgent({
  ref,
  request,
}: {
  ref: string;
  request: AgentUpdateRequest;
}): Promise<AgentSummaryResponse> {
  return putJson<AgentSummaryResponse>(`/agents/${ref}`, request);
}

export async function adoptAgent(
  ref: string,
  onConflict?: "keep_store" | "replace_store",
): Promise<void | AgentAdoptConflict> {
  const body = onConflict ? { onConflict } : undefined;
  const response = await fetch(apiPath(`/agents/${ref}/adopt`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 409) {
    return (await response.json()) as AgentAdoptConflict;
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to adopt agent");
  }
}

export async function adoptAllAgents(): Promise<AdoptAllResponse> {
  return postJson<AdoptAllResponse>("/agents/adopt-all");
}

export async function deleteAgent(ref: string): Promise<void> {
  await deleteJson<void>(`/agents/${ref}`);
}

export async function enableAgent(ref: string, harness: string): Promise<void> {
  await postJson<void>(`/agents/${ref}/enable`, { harness });
}

export async function disableAgent(ref: string, harness: string): Promise<void> {
  await postJson<void>(`/agents/${ref}/disable`, { harness });
}

export async function setAgentHarnesses(ref: string, harnesses: string[]): Promise<void> {
  await postJson<void>(`/agents/${ref}/set-harnesses`, { harnesses });
}
