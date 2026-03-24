import type {
  MarketplaceItem,
  SettingsData,
  SkillDetail,
  SkillsPageData,
} from "./types";

interface OkResponse {
  ok: boolean;
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
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function fetchSkillsPage(): Promise<SkillsPageData> {
  return expectJson<SkillsPageData>(fetch("/skills"));
}

export async function fetchSkillDetail(skillRef: string): Promise<SkillDetail> {
  return expectJson<SkillDetail>(fetch(`/skills/${encodeURIComponent(skillRef)}`));
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

export async function manageAllSkills(): Promise<OkResponse> {
  return postJson<OkResponse>("/skills/manage-all");
}

export async function fetchMarketplacePopular(): Promise<MarketplaceItem[]> {
  return expectJson<MarketplaceItem[]>(fetch("/marketplace/popular"));
}

export async function searchMarketplace(query: string): Promise<MarketplaceItem[]> {
  return expectJson<MarketplaceItem[]>(fetch(`/marketplace/search?q=${encodeURIComponent(query)}`));
}

export async function installSkill(sourceKind: string, sourceLocator: string): Promise<OkResponse> {
  return postJson<OkResponse>("/marketplace/install", { sourceKind, sourceLocator });
}

export async function fetchSettings(): Promise<SettingsData> {
  return expectJson<SettingsData>(fetch("/settings"));
}
