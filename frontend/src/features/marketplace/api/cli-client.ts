import { fetchJson } from "../../../api/http";

import type {
  CliMarketplaceDetailDto,
  CliMarketplacePageResultDto,
} from "./cli-types";

interface CliPageParams {
  limit?: number;
  offset?: number;
}

export interface CliSearchParams extends CliPageParams {
  query?: string;
}

export async function fetchCliMarketplacePopular(
  params: CliPageParams = {},
): Promise<CliMarketplacePageResultDto> {
  return fetchJson<CliMarketplacePageResultDto>(
    withQuery("/marketplace/clis/popular", {
      limit: params.limit,
      offset: params.offset,
    }),
  );
}

export async function searchCliMarketplace(
  params: CliSearchParams = {},
): Promise<CliMarketplacePageResultDto> {
  return fetchJson<CliMarketplacePageResultDto>(
    withQuery("/marketplace/clis/search", {
      q: params.query?.trim(),
      limit: params.limit,
      offset: params.offset,
    }),
  );
}

export async function fetchCliMarketplaceDetail(
  idOrSlug: string,
): Promise<CliMarketplaceDetailDto> {
  const slug = idOrSlug.startsWith("clisdev:")
    ? idOrSlug.slice("clisdev:".length)
    : idOrSlug;
  return fetchJson<CliMarketplaceDetailDto>(
    `/marketplace/clis/items/${encodeURIComponent(slug)}`,
  );
}

function withQuery(
  path: string,
  params: Record<string, string | number | undefined>,
): string {
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
