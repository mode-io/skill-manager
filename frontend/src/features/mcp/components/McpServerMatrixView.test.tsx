import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { McpInventoryColumnDto, McpInventoryEntryDto } from "../api/management-types";
import { McpServerMatrixView } from "./McpServerMatrixView";

function columns(): McpInventoryColumnDto[] {
  return [
    { harness: "codex", label: "Codex", logoKey: "codex", installed: true, configPresent: true, mcpWritable: true },
    { harness: "claude", label: "Claude", logoKey: "claude", installed: true, configPresent: true, mcpWritable: true },
    {
      harness: "openclaw",
      label: "OpenClaw",
      logoKey: "openclaw",
      installed: true,
      configPresent: false,
      mcpWritable: false,
      mcpUnavailableReason: "OpenClaw MCP writes are unavailable",
    },
  ];
}

function entries(): McpInventoryEntryDto[] {
  return [
    {
      name: "exa",
      displayName: "Exa Search",
      kind: "managed",
      canEnable: true,
      spec: {
        name: "exa",
        displayName: "Exa Search",
        source: { kind: "marketplace", locator: "exa" },
        transport: "http",
        url: "https://exa.run.tools",
        installedAt: "2026-04-21T00:00:00Z",
        revision: "abc",
      },
      sightings: [
        { harness: "codex", state: "managed" },
        { harness: "claude", state: "missing" },
        { harness: "openclaw", state: "missing" },
      ],
    },
    {
      name: "drift",
      displayName: "Drift Server",
      kind: "managed",
      canEnable: true,
      spec: {
        name: "drift",
        displayName: "Drift Server",
        source: { kind: "manual", locator: "drift" },
        transport: "stdio",
        command: "npx",
        args: ["drift"],
        installedAt: "2026-04-21T00:00:00Z",
        revision: "def",
      },
      sightings: [
        { harness: "codex", state: "missing" },
        { harness: "claude", state: "drifted", driftDetail: "changed=url" },
      ],
    },
  ];
}

function renderMatrix(overrides: Partial<Parameters<typeof McpServerMatrixView>[0]> = {}) {
  const props = {
    entries: entries(),
    columns: columns(),
    pendingServerKeys: new Set<string>(),
    pendingPerHarnessKeys: new Set<string>(),
    checkedNames: new Set<string>(),
    onOpenDetail: vi.fn(),
    onToggleChecked: vi.fn(),
    onEnableHarness: vi.fn(),
    onDisableHarness: vi.fn(),
    ...overrides,
  };
  render(<McpServerMatrixView {...props} />);
  return props;
}

describe("McpServerMatrixView", () => {
  it("locks header and body columns with matrix-specific structure", () => {
    renderMatrix();

    const table = screen.getByRole("table", { name: "MCP server harness matrix" });
    const cols = table.querySelectorAll("col");

    expect(table).toHaveClass("matrix-table");
    expect(table).not.toHaveClass("matrix-table--panel");
    expect(table.closest(".matrix-table-wrapper")).not.toHaveClass("matrix-table-wrapper--panel");
    expect(cols).toHaveLength(columns().length + 4);
    expect(cols[0]).toHaveClass("matrix-table__col-checkbox");
    expect(cols[1]).toHaveClass("matrix-table__col-identity");
    expect(cols[2]).toHaveClass("matrix-table__col-harness");
    expect(cols[cols.length - 2]).toHaveClass("matrix-table__col-compact");
    expect(cols[cols.length - 1]).toHaveClass("matrix-table__col-coverage");
    expect(screen.getByText("Server").closest("th")).toHaveClass("matrix-table__th--identity");
    expect(screen.getByText("Enabled").closest("th")).toHaveClass("matrix-table__th--end");
    expect(screen.getByLabelText("Codex")).toHaveClass("matrix-harness-target--header");
  });

  it("renders coverage and per-harness actions", () => {
    const { onEnableHarness, onDisableHarness } = renderMatrix();

    expect(screen.getByRole("table", { name: "MCP server harness matrix" })).toBeInTheDocument();
    expect(screen.getByLabelText("Enabled on 1 of 2 writable harnesses")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Disable Exa Search on Codex" }));
    expect(onDisableHarness).toHaveBeenCalledWith("exa", "codex");

    fireEvent.click(screen.getByRole("button", { name: "Enable Exa Search on Claude" }));
    expect(onEnableHarness).toHaveBeenCalledWith("exa", "claude");
  });

  it("exposes unavailable harness reasons without allowing mutation", () => {
    renderMatrix();

    const unavailable = screen.getByLabelText("Exa Search on OpenClaw is unavailable");
    expect(unavailable).toHaveAttribute("aria-disabled", "true");
    expect(unavailable).toHaveAttribute("title", "OpenClaw MCP writes are unavailable");
  });

  it("routes different configs to detail instead of mutating harness state", () => {
    const { onOpenDetail, onEnableHarness, onDisableHarness } = renderMatrix();

    fireEvent.click(screen.getByRole("button", { name: "Resolve config for Drift Server on Claude" }));
    expect(onOpenDetail).toHaveBeenCalledWith("drift");
    expect(onEnableHarness).not.toHaveBeenCalled();
    expect(onDisableHarness).not.toHaveBeenCalled();
  });

  it("disables pending cells", () => {
    renderMatrix({ pendingPerHarnessKeys: new Set(["exa:codex"]) });

    const pending = screen.getByRole("button", { name: "Disable Exa Search on Codex" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("data-pending", "true");
  });
});
