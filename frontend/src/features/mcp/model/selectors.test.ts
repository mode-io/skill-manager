import { describe, expect, it } from "vitest";

import type {
  McpIdentitySightingDto,
  McpInventoryDto,
  McpInventoryEntryDto,
} from "../api/management-types";
import {
  envChipLabel,
  filterMcpServersInUse,
  formatEnvKeyPreview,
  isMcpHarnessAddressable,
  pickRecommendedSighting,
  pillCounts,
  summarizeSighting,
  urlHasEmbeddedCredential,
} from "./selectors";

function makeEntry(
  name: string,
  states: ("managed" | "drifted" | "missing")[],
  options: { transport?: "stdio" | "http" | "sse" } = {},
): McpInventoryEntryDto {
  return {
    name,
    displayName: name,
    kind: "managed",
    canEnable: true,
    spec: options.transport
      ? {
          name,
          displayName: name,
          source: { kind: "marketplace", locator: name },
          transport: options.transport,
          installedAt: "2026-04-21T00:00:00Z",
          revision: "abc",
        }
      : null,
    sightings: states.map((state, i) => ({
      harness: `h${i}`,
      state,
    })),
  };
}

function makeInventory(entries: McpInventoryEntryDto[]): McpInventoryDto {
  return {
    columns: [
      { harness: "h0", label: "H0", logoKey: null, installed: true, configPresent: true, mcpWritable: true },
      { harness: "h1", label: "H1", logoKey: null, installed: true, configPresent: true, mcpWritable: true },
      { harness: "h2", label: "H2", logoKey: null, installed: true, configPresent: true, mcpWritable: true },
    ],
    entries,
  };
}

describe("filterMcpServersInUse", () => {
  it("returns only in-use entries when pill is 'all'", () => {
    const inventory = makeInventory([
      makeEntry("exa", ["managed", "managed", "missing"]),
      makeEntry("ctx", ["missing", "missing", "missing"]),
    ]);
    const out = filterMcpServersInUse(inventory, { search: "", pill: "all" });
    expect(out.map((e) => e.name)).toEqual(["exa", "ctx"]);
  });

  it("filters by search across name/displayName/transport", () => {
    const inventory = makeInventory([
      makeEntry("exa", ["managed"], { transport: "http" }),
      makeEntry("ctx", ["managed"], { transport: "stdio" }),
    ]);
    expect(filterMcpServersInUse(inventory, { search: "EXA", pill: "all" }).map((e) => e.name)).toEqual([
      "exa",
    ]);
    expect(filterMcpServersInUse(inventory, { search: "stdio", pill: "all" }).map((e) => e.name)).toEqual([
      "ctx",
    ]);
  });

  it("pill 'enabled' keeps entries with at least 1 managed binding", () => {
    const inventory = makeInventory([
      makeEntry("exa", ["managed", "missing", "missing"]),
      makeEntry("ctx", ["missing", "missing", "missing"]),
    ]);
    expect(filterMcpServersInUse(inventory, { search: "", pill: "enabled" }).map((e) => e.name)).toEqual([
      "exa",
    ]);
  });

  it("pill 'all-harnesses' requires every harness to be managed", () => {
    const inventory = makeInventory([
      makeEntry("exa", ["managed", "managed", "managed"]),
      makeEntry("ctx", ["managed", "managed", "missing"]),
    ]);
    expect(
      filterMcpServersInUse(inventory, { search: "", pill: "all-harnesses" }).map((e) => e.name),
    ).toEqual(["exa"]);
  });

  it("pill 'unbound' selects entries with 0 managed and no drift", () => {
    const inventory = makeInventory([
      makeEntry("exa", ["managed", "missing", "missing"]),
      makeEntry("ctx", ["missing", "missing", "missing"]),
      makeEntry("dft", ["drifted", "missing", "missing"]),
    ]);
    expect(filterMcpServersInUse(inventory, { search: "", pill: "unbound" }).map((e) => e.name)).toEqual([
      "ctx",
    ]);
  });

  it("pill 'drifted' selects entries with at least 1 drifted binding", () => {
    const inventory = makeInventory([
      makeEntry("exa", ["managed", "missing", "missing"]),
      makeEntry("ctx", ["managed", "drifted", "missing"]),
    ]);
    expect(filterMcpServersInUse(inventory, { search: "", pill: "drifted" }).map((e) => e.name)).toEqual([
      "ctx",
    ]);
  });

  it("returns [] when inventory is null", () => {
    expect(filterMcpServersInUse(null, { search: "", pill: "all" })).toEqual([]);
  });
});

describe("pillCounts", () => {
  it("computes counts across all pill values", () => {
    const inventory = makeInventory([
      makeEntry("exa", ["managed", "managed", "managed"]),
      makeEntry("ctx", ["managed", "missing", "missing"]),
      makeEntry("none", ["missing", "missing", "missing"]),
      makeEntry("dft", ["drifted", "missing", "missing"]),
    ]);
    expect(pillCounts(inventory)).toEqual({
      all: 4,
      enabled: 2,
      "all-harnesses": 1,
      unbound: 1,
      drifted: 1,
    });
  });

  it("returns zero counts when inventory is null", () => {
    expect(pillCounts(null)).toEqual({
      all: 0,
      enabled: 0,
      "all-harnesses": 0,
      unbound: 0,
      drifted: 0,
    });
  });
});

// Choose-version dialog helpers -------------------------------------------

function makeSighting(
  harness: string,
  spec: Partial<McpIdentitySightingDto["spec"]> & { transport: "stdio" | "http" | "sse" },
  env: McpIdentitySightingDto["env"] = [],
): McpIdentitySightingDto {
  return {
    harness,
    label: harness.charAt(0).toUpperCase() + harness.slice(1),
    logoKey: harness,
    configPath: `/mock/${harness}.json`,
    payloadPreview: {},
    spec: {
      name: "server",
      displayName: "server",
      source: { kind: "adopted", locator: `${harness}:server` },
      installedAt: "2026-04-21T00:00:00Z",
      revision: "r",
      ...spec,
    },
    env,
  };
}

describe("envChipLabel", () => {
  it("singular for 1", () => {
    expect(envChipLabel(1)).toBe("1 env var");
  });
  it("plural for 0 or 2+", () => {
    expect(envChipLabel(0)).toBe("0 env vars");
    expect(envChipLabel(2)).toBe("2 env vars");
    expect(envChipLabel(10)).toBe("10 env vars");
  });
});

describe("formatEnvKeyPreview", () => {
  it("empty for no keys", () => {
    expect(formatEnvKeyPreview([])).toBe("");
  });
  it("joins 1-2 keys directly", () => {
    expect(formatEnvKeyPreview(["A"])).toBe("A");
    expect(formatEnvKeyPreview(["A", "B"])).toBe("A, B");
  });
  it("collapses 3+ to two-and-more", () => {
    expect(formatEnvKeyPreview(["A", "B", "C"])).toBe("A, B, +1 more");
    expect(formatEnvKeyPreview(["A", "B", "C", "D"])).toBe("A, B, +2 more");
  });
});

describe("urlHasEmbeddedCredential", () => {
  it("flags common credential params", () => {
    expect(urlHasEmbeddedCredential("https://x.example/m?api_key=foo")).toBe(true);
    expect(urlHasEmbeddedCredential("https://x.example/m?apiKey=foo")).toBe(true);
    expect(urlHasEmbeddedCredential("https://x.example/m?token=bar&baz=1")).toBe(true);
    expect(urlHasEmbeddedCredential("https://x.example/m?auth=Bearer")).toBe(true);
  });

  it("ignores non-credential params and nullish input", () => {
    expect(urlHasEmbeddedCredential("https://x.example/m?limit=10")).toBe(false);
    expect(urlHasEmbeddedCredential("")).toBe(false);
    expect(urlHasEmbeddedCredential(null)).toBe(false);
    expect(urlHasEmbeddedCredential(undefined)).toBe(false);
  });
});

describe("summarizeSighting", () => {
  it("renders stdio with command basename + env count/keys", () => {
    const s = makeSighting(
      "codex",
      { transport: "stdio", command: "/Users/me/.codex/bin/browserbase-mcp", args: [] },
      [{ key: "K", value: "v", isEnvRef: false }],
    );
    const result = summarizeSighting(s);
    expect(result.primary).toBe("Local · browserbase-mcp");
    expect(result.envCount).toBe(1);
    expect(result.envKeys).toEqual(["K"]);
    expect(result.credentialInUrl).toBe(false);
  });

  it("renders remote HTTP with host", () => {
    const s = makeSighting("cursor", {
      transport: "http",
      url: "https://mcp.example.com/path",
    });
    expect(summarizeSighting(s).primary).toBe("Remote HTTP · mcp.example.com");
  });

  it("renders remote SSE with label", () => {
    const s = makeSighting("claude", {
      transport: "sse",
      url: "https://sse.example.com/stream",
    });
    expect(summarizeSighting(s).primary).toBe("Remote SSE · sse.example.com");
  });

  it("flags embedded credentials in URL", () => {
    const s = makeSighting("claude", {
      transport: "http",
      url: "https://mcp.example.com/m?api_key=secret",
    });
    expect(summarizeSighting(s).credentialInUrl).toBe(true);
  });
});

describe("pickRecommendedSighting", () => {
  it("returns null for empty input", () => {
    expect(pickRecommendedSighting([])).toBeNull();
  });

  it("prefers stdio with env-var refs over stdio with literal", () => {
    const envRef = makeSighting(
      "cursor",
      { transport: "stdio", command: "npx" },
      [{ key: "K", value: "${env:K}", isEnvRef: true }],
    );
    const envLiteral = makeSighting(
      "codex",
      { transport: "stdio", command: "npx" },
      [{ key: "K", value: "literal", isEnvRef: false }],
    );
    expect(pickRecommendedSighting([envLiteral, envRef])).toBe("cursor");
  });

  it("prefers any stdio over http", () => {
    const stdio = makeSighting("codex", { transport: "stdio", command: "npx" });
    const http = makeSighting("claude", {
      transport: "http",
      url: "https://mcp.example.com",
    });
    expect(pickRecommendedSighting([http, stdio])).toBe("codex");
  });

  it("prefers http without URL credential over http with URL credential", () => {
    const dirty = makeSighting("claude", {
      transport: "http",
      url: "https://a.example?api_key=xyz",
    });
    const clean = makeSighting("cursor", { transport: "http", url: "https://b.example" });
    expect(pickRecommendedSighting([dirty, clean])).toBe("cursor");
  });

  it("returns null when all options embed credentials in URL", () => {
    const a = makeSighting("claude", {
      transport: "http",
      url: "https://a.example?api_key=xyz",
    });
    const b = makeSighting("cursor", {
      transport: "http",
      url: "https://b.example?token=xyz",
    });
    expect(pickRecommendedSighting([a, b])).toBeNull();
  });
});

describe("isMcpHarnessAddressable", () => {
  it("returns true when the CLI is installed", () => {
    expect(
      isMcpHarnessAddressable({
        harness: "codex",
        label: "Codex",
        logoKey: "codex",
        installed: true,
        configPresent: false,
        mcpWritable: true,
      }),
    ).toBe(true);
  });

  it("returns true when an MCP config file is present even without the CLI", () => {
    expect(
      isMcpHarnessAddressable({
        harness: "claude",
        label: "Claude",
        logoKey: "claude",
        installed: false,
        configPresent: true,
        mcpWritable: true,
      }),
    ).toBe(true);
  });

  it("returns false when neither the CLI nor a config file is present", () => {
    expect(
      isMcpHarnessAddressable({
        harness: "cursor",
        label: "Cursor",
        logoKey: "cursor",
        installed: false,
        configPresent: false,
        mcpWritable: true,
      }),
    ).toBe(false);
  });

  it("returns false when the harness is present but not MCP-writable", () => {
    expect(
      isMcpHarnessAddressable({
        harness: "openclaw",
        label: "OpenClaw",
        logoKey: "openclaw",
        installed: true,
        configPresent: true,
        mcpWritable: false,
        mcpUnavailableReason: "Installed OpenClaw does not expose MCP config support",
      }),
    ).toBe(false);
  });
});
