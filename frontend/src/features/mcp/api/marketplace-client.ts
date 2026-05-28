import { fetchJson } from "../../../api/http";
import type { components } from "../../../api/generated";

export type McpMarketplaceDetailDto = components["schemas"]["McpMarketplaceDetailResponse"];

export async function fetchMcpMarketplaceDetail(
  qualifiedName: string,
): Promise<McpMarketplaceDetailDto> {
  const encoded = qualifiedName.split("/").map(encodeURIComponent).join("/");
  return fetchJson<McpMarketplaceDetailDto>(`/marketplace/mcp/items/${encoded}`);
}
