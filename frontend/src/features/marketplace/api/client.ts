import { apiPath } from "../../../api/paths";

import type { MarketplaceDetailDto, MarketplaceDocumentDto, MarketplacePageResultDto } from "./types";

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

export async function fetchMarketplacePopular(params: MarketplacePageParams = {}): Promise<MarketplacePageResultDto> {
  return expectJson<MarketplacePageResultDto>(
    fetch(apiPath(withQuery("/marketplace/popular", { limit: params.limit, offset: params.offset }))),
  );
}

export async function searchMarketplace(query: string, params: MarketplacePageParams = {}): Promise<MarketplacePageResultDto> {
  return expectJson<MarketplacePageResultDto>(
    fetch(apiPath(withQuery("/marketplace/search", { limit: params.limit, offset: params.offset, q: query }))),
  );
}

export async function fetchMarketplaceDetail(itemId: string): Promise<MarketplaceDetailDto> {
  return expectJson<MarketplaceDetailDto>(
    fetch(apiPath(`/marketplace/items/${encodeURIComponent(itemId)}`)),
  );
}

export async function fetchMarketplaceDocument(itemId: string): Promise<MarketplaceDocumentDto> {
  return expectJson<MarketplaceDocumentDto>(
    fetch(apiPath(`/marketplace/items/${encodeURIComponent(itemId)}/document`)),
  );
}

export async function installMarketplaceSkill(installToken: string): Promise<OkResponse> {
  return postJson<OkResponse>("/marketplace/install", { installToken });
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
