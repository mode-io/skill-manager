import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  setHarnessesMutate: vi.fn(),
  enableMutate: vi.fn(),
  availabilityMutate: vi.fn(),
}));

vi.mock("../api/management-queries", () => ({
  useMcpInventoryQuery: () => ({
    data: { columns: [], entries: [] },
    isPending: false,
    error: null,
  }),
  useMcpNeedsReviewByServerQuery: () => ({
    data: { harnesses: [], servers: [], issues: [] },
    isPending: false,
    error: null,
  }),
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

describe("useMcpManagementController availability refresh", () => {
  beforeEach(() => {
    hoisted.setHarnessesMutate.mockReset();
    hoisted.enableMutate.mockReset();
    hoisted.availabilityMutate.mockReset();
    hoisted.setHarnessesMutate.mockResolvedValue({ ok: true, succeeded: ["cursor"], failed: [] });
    hoisted.enableMutate.mockResolvedValue({ ok: true });
    hoisted.availabilityMutate.mockReturnValue(new Promise(() => undefined));
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
});
