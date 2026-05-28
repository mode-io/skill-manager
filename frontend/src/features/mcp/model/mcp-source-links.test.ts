import { describe, expect, it } from "vitest";

import { mcpCopy } from "../i18n";
import { mcpServerSourceLinks, resolveMcpRegistryName } from "./mcp-source-links";

describe("resolveMcpRegistryName", () => {
  it("prefers the linked registry qualified name", () => {
    expect(
      resolveMcpRegistryName({
        fallbackName: "local-name",
        sourceKind: "marketplace",
        sourceLocator: "registry/source",
        linkedQualifiedName: "linked/name",
      }),
    ).toBe("linked/name");
  });

  it("uses the marketplace locator before the managed local name", () => {
    expect(
      resolveMcpRegistryName({
        fallbackName: "ai.31st-mcp",
        sourceKind: "marketplace",
        sourceLocator: "ai.31st/mcp",
        linkedQualifiedName: null,
      }),
    ).toBe("ai.31st/mcp");
  });

  it("falls back to the local name for non-marketplace servers", () => {
    expect(
      resolveMcpRegistryName({
        fallbackName: "node_repl",
        sourceKind: "manual",
        sourceLocator: "local",
        linkedQualifiedName: null,
      }),
    ).toBe("node_repl");
  });
});

describe("mcpServerSourceLinks", () => {
  it("falls back to registry search when externalUrl is blank but a registry identity exists", () => {
    const [registry] = mcpServerSourceLinks({
      registryExternalUrl: "",
      registryName: "ai.31st/mcp",
      hasRegistryIdentity: true,
      githubUrl: null,
      websiteUrl: null,
      copy: mcpCopy.en.detail,
    });

    expect(registry.href).toBe("https://registry.modelcontextprotocol.io/?q=ai.31st%2Fmcp");
  });

  it("disables the registry link when there is no registry identity", () => {
    const [registry] = mcpServerSourceLinks({
      registryExternalUrl: null,
      registryName: "node_repl",
      hasRegistryIdentity: false,
      githubUrl: null,
      websiteUrl: null,
      copy: mcpCopy.en.detail,
    });

    expect(registry.href).toBeNull();
    expect(registry.disabledReason).toBe("This MCP server is not linked to an MCP Registry entry.");
  });
});
