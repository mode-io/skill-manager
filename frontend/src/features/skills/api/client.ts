import type { BulkManageResult, SkillDetailDto, SkillsPageDto, SkillSourceStatusDto } from "./types";
import { apiPath } from "../../../api/paths";

interface OkResponse {
  ok: boolean;
}

async function expectJson<T>(responsePromise: Promise<Response>): Promise<T> {
  const response = await responsePromise;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (
      payload
      && typeof payload === "object"
      && "error" in payload
      && typeof payload.error === "string"
    )
      ? payload.error
      : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return payload as T;
}

async function postJson<T>(path: string, body?: object): Promise<T> {
  return expectJson<T>(
    fetch(apiPath(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function fetchSkillsPage(): Promise<SkillsPageDto> {
  return expectJson<SkillsPageDto>(fetch(apiPath("/skills")));
}

export async function fetchSkillDetail(skillRef: string): Promise<SkillDetailDto> {
  return expectJson<SkillDetailDto>(fetch(apiPath(`/skills/${encodeURIComponent(skillRef)}`)));
}

export async function fetchSkillSourceStatus(skillRef: string): Promise<SkillSourceStatusDto> {
  return expectJson<SkillSourceStatusDto>(fetch(apiPath(`/skills/${encodeURIComponent(skillRef)}/source-status`)));
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
