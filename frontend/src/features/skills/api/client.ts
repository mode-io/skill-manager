import type { BulkManageResult, SkillDetailDto, SkillsPageDto, SkillSourceStatusDto } from "./types";
import { fetchJson, postJson } from "../../../api/http";

interface OkResponse {
  ok: boolean;
}

export async function fetchSkillsPage(): Promise<SkillsPageDto> {
  return fetchJson<SkillsPageDto>("/skills");
}

export async function fetchSkillDetail(skillRef: string): Promise<SkillDetailDto> {
  return fetchJson<SkillDetailDto>(`/skills/${encodeURIComponent(skillRef)}`);
}

export async function fetchSkillSourceStatus(skillRef: string): Promise<SkillSourceStatusDto> {
  return fetchJson<SkillSourceStatusDto>(`/skills/${encodeURIComponent(skillRef)}/source-status`);
}

export async function enableSkill(skillRef: string, harness: string): Promise<OkResponse> {
  return postJson<OkResponse>(`/skills/${encodeURIComponent(skillRef)}/enable`, { harness });
}

export async function disableSkill(skillRef: string, harness: string): Promise<OkResponse> {
  return postJson<OkResponse>(`/skills/${encodeURIComponent(skillRef)}/disable`, { harness });
}

export async function manageSkill(skillRef: string): Promise<OkResponse> {
  return postJson<OkResponse>(`/skills/${encodeURIComponent(skillRef)}/manage`);
}

export async function updateSkill(skillRef: string): Promise<OkResponse> {
  return postJson<OkResponse>(`/skills/${encodeURIComponent(skillRef)}/update`);
}

export async function unmanageSkill(skillRef: string): Promise<OkResponse> {
  return postJson<OkResponse>(`/skills/${encodeURIComponent(skillRef)}/unmanage`);
}

export async function deleteSkill(skillRef: string): Promise<OkResponse> {
  return postJson<OkResponse>(`/skills/${encodeURIComponent(skillRef)}/delete`);
}

export async function manageAllSkills(): Promise<BulkManageResult> {
  const result = await postJson<BulkManageResult>("/skills/manage-all");
  if (!result.ok) {
    const firstFailure = result.failures[0];
    throw new Error(firstFailure?.error ?? "Unable to manage all eligible skills.");
  }
  return result;
}
