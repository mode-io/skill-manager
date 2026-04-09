import type { MarketplacePageResult, SettingsData } from "./types";
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
