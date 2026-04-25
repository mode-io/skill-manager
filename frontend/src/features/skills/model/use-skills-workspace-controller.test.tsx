import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SkillsWorkspaceData } from "./types";

const hoisted = vi.hoisted(() => {
  const setHarnessesCalls: Array<{ skillRef: string; target: "enabled" | "disabled" }> = [];
  const failFor = new Set<string>();
  let nextResponse: { succeeded: string[]; failed: Array<{ harness: string; error: string }> } | null = null;
  return {
    setHarnessesCalls,
    failFor,
    setNextResponse(value: typeof nextResponse) {
      nextResponse = value;
    },
    takeNextResponse() {
      const value = nextResponse;
      nextResponse = null;
      return value;
    },
  };
});

const testData: SkillsWorkspaceData = {
  summary: { managed: 1, unmanaged: 0 },
  harnessColumns: [
    { harness: "codex", label: "Codex", installed: true },
    { harness: "cursor", label: "Cursor", installed: true },
    { harness: "claude", label: "Claude", installed: true },
  ],
  rows: [
    {
      skillRef: "shared:test-skill",
      name: "Test Skill",
      description: "",
      displayStatus: "Managed",
      actions: { canManage: false, canStopManaging: true, canDelete: false },
      cells: [
        { harness: "codex", label: "Codex", state: "enabled", interactive: true },
        { harness: "cursor", label: "Cursor", state: "disabled", interactive: true },
        { harness: "claude", label: "Claude", state: "empty", interactive: false },
      ],
    },
  ],
} as unknown as SkillsWorkspaceData;

vi.mock("../api/queries", () => ({
  useSkillsListQuery: () => ({
    data: testData,
    isPending: false,
    error: null,
  }),
  useToggleSkillMutation: () => ({
    mutateAsync: vi.fn(),
  }),
  useSetSkillHarnessesMutation: () => ({
    mutateAsync: async (vars: { skillRef: string; target: "enabled" | "disabled" }) => {
      hoisted.setHarnessesCalls.push(vars);
      const override = hoisted.takeNextResponse();
      if (override) {
        return { ok: override.failed.length === 0, ...override };
      }
      // Default behavior: mirror the current row's cells to derive who would flip.
      const row = testData.rows.find((r) => r.skillRef === vars.skillRef)!;
      const succeeded: string[] = [];
      const failed: Array<{ harness: string; error: string }> = [];
      for (const cell of row.cells) {
        if (!cell.interactive || cell.state === vars.target) continue;
        if (hoisted.failFor.has(cell.harness)) {
          failed.push({ harness: cell.harness, error: `${cell.harness} toggle failed` });
        } else {
          succeeded.push(cell.harness);
        }
      }
      return { ok: failed.length === 0, succeeded, failed };
    },
  }),
  useManageSkillMutation: () => ({ mutateAsync: vi.fn() }),
  useManageAllSkillsMutation: () => ({ mutateAsync: vi.fn() }),
  useUpdateSkillMutation: () => ({ mutateAsync: vi.fn() }),
  useUnmanageSkillMutation: () => ({ mutateAsync: vi.fn() }),
  useDeleteSkillMutation: () => ({ mutateAsync: vi.fn() }),
}));

import { useSkillsWorkspaceController } from "./use-skills-workspace-controller";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/skills/use"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("useSkillsWorkspaceController > onSetSkillAllHarnesses", () => {
  beforeEach(() => {
    hoisted.setHarnessesCalls.length = 0;
    hoisted.failFor.clear();
    hoisted.setNextResponse(null);
  });

  it("dispatches a single bulk request with the target and returns the server's succeeded list", async () => {
    const { result } = renderHook(() => useSkillsWorkspaceController(), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.context.onSetSkillAllHarnesses>> | undefined;
    await act(async () => {
      outcome = await result.current.context.onSetSkillAllHarnesses("shared:test-skill", "enabled");
    });

    expect(hoisted.setHarnessesCalls).toEqual([
      { skillRef: "shared:test-skill", target: "enabled" },
    ]);
    expect(outcome?.succeeded).toEqual(["cursor"]);
    expect(outcome?.failed).toEqual([]);
    expect(result.current.actionErrorMessage).toBe("");
  });

  it("surfaces partial failures from the server and sets an error message", async () => {
    hoisted.failFor.add("cursor");
    const { result } = renderHook(() => useSkillsWorkspaceController(), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.context.onSetSkillAllHarnesses>> | undefined;
    await act(async () => {
      outcome = await result.current.context.onSetSkillAllHarnesses("shared:test-skill", "enabled");
    });

    expect(outcome?.succeeded).toEqual([]);
    expect(outcome?.failed).toHaveLength(1);
    expect(outcome?.failed[0]?.harness).toBe("cursor");
    expect(result.current.actionErrorMessage).toContain("cursor");
  });

  it("issues the bulk call for the opposite direction too", async () => {
    const { result } = renderHook(() => useSkillsWorkspaceController(), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.context.onSetSkillAllHarnesses>> | undefined;
    await act(async () => {
      outcome = await result.current.context.onSetSkillAllHarnesses("shared:test-skill", "disabled");
    });

    expect(hoisted.setHarnessesCalls).toEqual([
      { skillRef: "shared:test-skill", target: "disabled" },
    ]);
    expect(outcome?.succeeded).toEqual(["codex"]);
  });
});
