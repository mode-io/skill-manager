import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { McpNeedsReviewDetailView } from "./McpNeedsReviewDetailView";
import type { McpIdentityGroupDto } from "../../api/management-types";

function makeGroup(overrides: Partial<McpIdentityGroupDto> = {}): McpIdentityGroupDto {
  return {
    name: "context7",
    identical: true,
    canonicalSpec: {
      name: "context7",
      displayName: "context7",
      source: { kind: "adopted", locator: "cursor:context7" },
      transport: "stdio",
      command: "uvx",
      args: ["context7-mcp"],
      installedAt: "2026-04-21T00:00:00Z",
      revision: "abc",
    },
    marketplaceLink: null,
    sightings: [
      {
        harness: "cursor",
        label: "Cursor",
        logoKey: "cursor",
        configPath: "/c/.cursor/mcp.json",
        payloadPreview: { command: "uvx", args: ["context7-mcp"] },
        spec: {
          name: "context7",
          displayName: "context7",
          source: { kind: "adopted", locator: "cursor:context7" },
          transport: "stdio",
          command: "uvx",
          args: ["context7-mcp"],
          installedAt: "2026-04-21T00:00:00Z",
          revision: "abc",
        },
        env: [],
      },
      {
        harness: "claude",
        label: "Claude",
        logoKey: "claude",
        configPath: "/c/.claude.json",
        payloadPreview: { command: "uvx", args: ["context7-mcp"] },
        spec: {
          name: "context7",
          displayName: "context7",
          source: { kind: "adopted", locator: "claude:context7" },
          transport: "stdio",
          command: "uvx",
          args: ["context7-mcp"],
          installedAt: "2026-04-21T00:00:00Z",
          revision: "abc",
        },
        env: [],
      },
    ],
    ...overrides,
  };
}

describe("McpNeedsReviewDetailView", () => {
  it("shows Adopt in the fixed footer for identical groups", () => {
    render(
      <McpNeedsReviewDetailView
        group={makeGroup()}
        isLoading={false}
        errorMessage=""
        pending={false}
        onClose={vi.fn()}
        onAdopt={vi.fn()}
        onChooseConfigToAdopt={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Config to adopt" })).toBeInTheDocument();
    const adoptButton = screen.getByRole("button", { name: "Adopt" });
    expect(adoptButton.closest(".mcp-detail-shell__footer")).not.toBeNull();
    expect(screen.queryByText(/Configurations differ across harnesses/i)).toBeNull();
  });

  it("shows Choose config to adopt without extra differing-payload copy", () => {
    render(
      <McpNeedsReviewDetailView
        group={makeGroup({ identical: false, canonicalSpec: null })}
        isLoading={false}
        errorMessage=""
        pending={false}
        onClose={vi.fn()}
        onAdopt={vi.fn()}
        onChooseConfigToAdopt={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Configurations differ across harnesses/i)).toBeNull();
    const chooseButton = screen.getByRole("button", { name: "Choose config to adopt" });
    expect(chooseButton.closest(".mcp-detail-shell__footer")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Config to adopt" })).toBeNull();
  });
});
