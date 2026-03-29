import type { BulkManageResult, MarketplacePageResult, SettingsData, SkillDetail, SkillsPageData } from "./types";
import { apiPath } from "./paths";

interface OkResponse {
  ok: boolean;
}

interface MarketplacePageParams {
  limit?: number;
  offset?: number;
}

async function expectJson<T>(responsePromise: Promise<Response>): Promise<T> {
  const response = await responsePromise;
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
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

export async function fetchSkillsPage(): Promise<SkillsPageData> {
  return expectJson<SkillsPageData>(fetch(apiPath("/skills")));
}

export async function fetchSkillDetail(skillRef: string): Promise<SkillDetail> {
  return expectJson<SkillDetail>(fetch(apiPath(`/skills/${encodeURIComponent(skillRef)}`)));
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

export async function manageAllSkills(): Promise<BulkManageResult> {
  const result = await postJson<BulkManageResult>("/skills/manage-all");
  if (!result.ok) {
    const firstFailure = result.failures[0];
    throw new Error(firstFailure?.error ?? "Unable to manage all eligible skills.");
  }
  return result;
}

export async function fetchMarketplacePopular(params: MarketplacePageParams = {}): Promise<MarketplacePageResult> {
  return expectJson<MarketplacePageResult>(
    fetch(apiPath(withQuery("/marketplace/popular", { limit: params.limit, offset: params.offset }))),
  );
}

export async function searchMarketplace(query: string, params: MarketplacePageParams = {}): Promise<MarketplacePageResult> {
  return expectJson<MarketplacePageResult>(
    fetch(apiPath(withQuery("/marketplace/search", { limit: params.limit, offset: params.offset, q: query }))),
  );
}

export async function installSkill(installToken: string): Promise<OkResponse> {
  return postJson<OkResponse>("/marketplace/install", { installToken });
}

export async function fetchSettings(): Promise<SettingsData> {
  return expectJson<SettingsData>(fetch(apiPath("/settings")));
}

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
