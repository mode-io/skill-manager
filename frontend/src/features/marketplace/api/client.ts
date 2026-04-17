import { fetchJson, postJson } from "../../../api/http";

import type {
  InstallMarketplaceSkillRequest,
  MarketplaceDetailDto,
  MarketplaceDocumentDto,
  MarketplacePageResultDto,
} from "./types";

interface OkResponse {
  ok: boolean;
}

interface MarketplacePageParams {
  limit?: number;
  offset?: number;
}

export async function fetchMarketplacePopular(params: MarketplacePageParams = {}): Promise<MarketplacePageResultDto> {
  return fetchJson<MarketplacePageResultDto>(withQuery("/marketplace/popular", { limit: params.limit, offset: params.offset }));
}

export async function searchMarketplace(query: string, params: MarketplacePageParams = {}): Promise<MarketplacePageResultDto> {
  return fetchJson<MarketplacePageResultDto>(withQuery("/marketplace/search", { limit: params.limit, offset: params.offset, q: query }));
}

export async function fetchMarketplaceDetail(itemId: string): Promise<MarketplaceDetailDto> {
  return fetchJson<MarketplaceDetailDto>(`/marketplace/items/${encodeURIComponent(itemId)}`);
}

export async function fetchMarketplaceDocument(itemId: string): Promise<MarketplaceDocumentDto> {
  return fetchJson<MarketplaceDocumentDto>(`/marketplace/items/${encodeURIComponent(itemId)}/document`);
}

export async function installMarketplaceSkill(installToken: string): Promise<OkResponse> {
  const body: InstallMarketplaceSkillRequest = { installToken };
  return postJson<OkResponse>("/marketplace/install", body);
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
