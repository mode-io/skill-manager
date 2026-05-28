import { fetchJson, postJson } from "../../../api/http";

import type {
  AddMcpServerResponseDto,
  McpMarketplaceDetailDto,
  McpMarketplacePageResultDto,
} from "./mcp-types";

interface AddMcpServerRequestBody {
  qualifiedName: string;
}

interface McpPageParams {
  limit?: number;
  offset?: number;
}

export interface McpSearchParams extends McpPageParams {
  query?: string;
}

export async function fetchMcpMarketplacePopular(
  params: McpPageParams = {},
): Promise<McpMarketplacePageResultDto> {
  return fetchJson<McpMarketplacePageResultDto>(
    withQuery("/marketplace/mcp/popular", { limit: params.limit, offset: params.offset }),
  );
}

export async function searchMcpMarketplace(
  params: McpSearchParams = {},
): Promise<McpMarketplacePageResultDto> {
  const query = (params.query ?? "").trim();
  return fetchJson<McpMarketplacePageResultDto>(
    withQuery("/marketplace/mcp/search", {
      q: query || undefined,
      limit: params.limit,
      offset: params.offset,
    }),
  );
}

export async function fetchMcpMarketplaceDetail(
  qualifiedName: string,
): Promise<McpMarketplaceDetailDto> {
  const encoded = qualifiedName.split("/").map(encodeURIComponent).join("/");
  return fetchJson<McpMarketplaceDetailDto>(`/marketplace/mcp/items/${encoded}`);
}

export async function addMcpServer(
  body: AddMcpServerRequestBody,
): Promise<AddMcpServerResponseDto> {
  return postJson<AddMcpServerResponseDto>("/mcp/servers", body);
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
