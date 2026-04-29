import { deleteJson, fetchJson, postJson, putJson } from "../../../api/http";
import type {
  SlashCommandDeleteResponse,
  SlashCommandImportRequest,
  SlashCommandListDto,
  SlashCommandMutationRequest,
  SlashCommandMutationResponse,
  SlashCommandResolveRequest,
  SlashCommandUpdateRequest,
  SlashSyncRequest,
} from "./types";

export async function fetchSlashCommands(): Promise<SlashCommandListDto> {
  return fetchJson<SlashCommandListDto>("/slash-commands");
}

export async function createSlashCommand(
  body: SlashCommandMutationRequest,
): Promise<SlashCommandMutationResponse> {
  return postJson<SlashCommandMutationResponse>("/slash-commands", body);
}

export async function updateSlashCommand(
  name: string,
  body: SlashCommandUpdateRequest,
): Promise<SlashCommandMutationResponse> {
  return putJson<SlashCommandMutationResponse>(
    `/slash-commands/${encodeURIComponent(name)}`,
    body,
  );
}

export async function syncSlashCommand(
  name: string,
  body: SlashSyncRequest,
): Promise<SlashCommandMutationResponse> {
  return postJson<SlashCommandMutationResponse>(
    `/slash-commands/${encodeURIComponent(name)}/sync`,
    body,
  );
}

export async function importSlashCommand(
  body: SlashCommandImportRequest,
): Promise<SlashCommandMutationResponse> {
  return postJson<SlashCommandMutationResponse>("/slash-commands/review/import", body);
}

export async function resolveSlashCommandReview(
  body: SlashCommandResolveRequest,
): Promise<SlashCommandMutationResponse> {
  return postJson<SlashCommandMutationResponse>("/slash-commands/review/resolve", body);
}

export async function deleteSlashCommand(name: string): Promise<SlashCommandDeleteResponse> {
  return deleteJson<SlashCommandDeleteResponse>(`/slash-commands/${encodeURIComponent(name)}`);
}
