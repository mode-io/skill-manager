import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  inventoryQuery: vi.fn(),
  needsReviewQuery: vi.fn(),
  setHarnessesMutate: vi.fn(),
  enableMutate: vi.fn(),
  availabilityMutate: vi.fn(),
}));

vi.mock("../api/management-queries", () => ({
  useMcpInventoryQuery: hoisted.inventoryQuery,
  useMcpNeedsReviewByServerQuery: hoisted.needsReviewQuery,
  useSetMcpServerHarnessesMutation: () => ({
    mutateAsync: hoisted.setHarnessesMutate,
  }),
  useEnableMcpServerMutation: () => ({
    mutateAsync: hoisted.enableMutate,
  }),
  useCheckMcpServerAvailabilityMutation: () => ({
    mutateAsync: hoisted.availabilityMutate,
  }),
  useDisableMcpServerMutation: () => ({ mutateAsync: vi.fn() }),
  useUninstallMcpServerMutation: () => ({ mutateAsync: vi.fn() }),
  useAdoptMcpServerMutation: () => ({ mutateAsync: vi.fn() }),
  useReconcileMcpServerMutation: () => ({ mutateAsync: vi.fn() }),
}));

import { useMcpManagementController } from "./use-mcp-management-controller";
import type { McpInventoryEntryDto } from "../api/management-types";

describe("useMcpManagementController availability refresh", () => {
  beforeEach(() => {
    hoisted.inventoryQuery.mockReset();
    hoisted.needsReviewQuery.mockReset();
    hoisted.setHarnessesMutate.mockReset();
    hoisted.enableMutate.mockReset();
    hoisted.availabilityMutate.mockReset();
    hoisted.inventoryQuery.mockReturnValue({
      data: { columns: [], entries: [] },
      isPending: false,
      error: null,
    });
    hoisted.needsReviewQuery.mockReturnValue({
      data: { harnesses: [], servers: [], issues: [] },
      isPending: false,
      error: null,
    });
    hoisted.setHarnessesMutate.mockResolvedValue({ ok: true, succeeded: ["cursor"], failed: [] });
    hoisted.enableMutate.mockResolvedValue({ ok: true });
    hoisted.availabilityMutate.mockReturnValue(new Promise(() => undefined));
  });

  it("disables needs-review query for inventory-only pages", () => {
    renderHook(() => useMcpManagementController({ queries: "inventory" }));

    expect(hoisted.inventoryQuery).toHaveBeenCalledWith({ enabled: true });
    expect(hoisted.needsReviewQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("disables inventory query for needs-review-only pages", () => {
    renderHook(() => useMcpManagementController({ queries: "needs-review" }));

    expect(hoisted.inventoryQuery).toHaveBeenCalledWith({ enabled: false });
    expect(hoisted.needsReviewQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("does not keep enable-all pending while availability check is still running", async () => {
    const { result } = renderHook(() => useMcpManagementController());
    let settled = false;

    await act(async () => {
      void result.current.handleSetServerHarnesses("exa", "enabled").then(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(hoisted.setHarnessesMutate).toHaveBeenCalledWith({ name: "exa", target: "enabled" });
    expect(hoisted.availabilityMutate).toHaveBeenCalledWith("exa");
    expect(settled).toBe(true);
  });

  it("does not keep single-harness enable pending while availability check is still running", async () => {
    const { result } = renderHook(() => useMcpManagementController());
    let settled = false;

    await act(async () => {
      void result.current.handleEnableInHarness("exa", "cursor").then(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(hoisted.enableMutate).toHaveBeenCalledWith({ name: "exa", harness: "cursor" });
    expect(hoisted.availabilityMutate).toHaveBeenCalledWith("exa");
    expect(settled).toBe(true);
  });

  it("auto-checks availability only for managed entries", async () => {
    hoisted.inventoryQuery.mockReturnValue({
      data: {
        columns: [],
        entries: [
          mcpEntry({ name: "unmanaged", kind: "unmanaged" }),
          mcpEntry({ name: "managed", kind: "managed" }),
        ],
      },
      isPending: false,
      error: null,
    });

    renderHook(() => useMcpManagementController());
    await act(async () => {
      await Promise.resolve();
    });

    expect(hoisted.availabilityMutate).toHaveBeenCalledTimes(1);
    expect(hoisted.availabilityMutate).toHaveBeenCalledWith("managed");
  });

  it("retries automatic availability checks after a failed check", async () => {
    const firstInventory = {
      columns: [],
      entries: [mcpEntry({ name: "managed", kind: "managed" })],
    };
    const secondInventory = {
      columns: [],
      entries: [mcpEntry({ name: "managed", kind: "managed" })],
    };
    hoisted.inventoryQuery.mockReturnValueOnce({
      data: firstInventory,
      isPending: false,
      error: null,
    }).mockReturnValue({
      data: secondInventory,
      isPending: false,
      error: null,
    });
    hoisted.availabilityMutate.mockRejectedValue(new Error("probe failed"));

    const { rerender } = renderHook(() => useMcpManagementController());
    await act(async () => {
      await Promise.resolve();
    });
    rerender();
    await act(async () => {
      await Promise.resolve();
    });

    expect(hoisted.availabilityMutate).toHaveBeenCalledTimes(2);
    expect(hoisted.availabilityMutate).toHaveBeenNthCalledWith(1, "managed");
    expect(hoisted.availabilityMutate).toHaveBeenNthCalledWith(2, "managed");
  });
});

function mcpEntry(
  overrides: Pick<McpInventoryEntryDto, "name" | "kind">,
): McpInventoryEntryDto {
  return {
    availabilityStatus: "unavailable",
    availabilityReason: null,
    canEnable: true,
    displayName: overrides.name,
    enabledStatus: "disabled",
    installConfigStatus: { hasFields: false, missingRequired: [], configured: true },
    kind: overrides.kind,
    mcpStatus: { kind: "unchecked", reason: null },
    name: overrides.name,
    sightings: [],
    spec: {
      args: null,
      command: "npx",
      displayName: overrides.name,
      env: null,
      headers: null,
      installedAt: "2026-01-01T00:00:00Z",
      name: overrides.name,
      revision: `${overrides.name}-rev`,
      source: { kind: "manual", locator: overrides.name },
      transport: "stdio",
      url: null,
    },
  };
}
