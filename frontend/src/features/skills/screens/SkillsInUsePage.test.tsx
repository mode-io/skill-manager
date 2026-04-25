import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SkillsInUsePage from "./SkillsInUsePage";

const hooks = vi.hoisted(() => {
  return {
    onRemoveSkill: vi.fn(async () => undefined),
    onDeleteSkill: vi.fn(async () => undefined),
    updateFilters: vi.fn(),
    resetFilters: vi.fn(),
    toast: vi.fn(),
  };
});

vi.mock("../model/workspace-context", () => ({
  useSkillsWorkspace: () => ({
    data: {
      summary: { managed: 1, unmanaged: 0 },
      harnessColumns: [
        { harness: "codex", label: "Codex", installed: true },
        { harness: "cursor", label: "Cursor", installed: true },
      ],
      rows: [
        {
          skillRef: "shared:trace-lens",
          name: "Trace Lens",
          description: "Trace review workflow",
          displayStatus: "Managed",
          actions: { canManage: false, canStopManaging: true, canDelete: true },
          cells: [
            { harness: "codex", label: "Codex", state: "enabled", interactive: true },
            { harness: "cursor", label: "Cursor", state: "disabled", interactive: true },
          ],
        },
      ],
    },
    status: "ready",
    pendingToggleKeys: new Set(),
    pendingStructuralActions: new Map(),
    selectedSkillRef: null,
    multiSelectedRefs: new Set(),
    onOpenSkill: vi.fn(),
    onToggleCell: vi.fn(),
    onToggleMultiSelect: vi.fn(),
    onClearMultiSelect: vi.fn(),
    onSetSkillAllHarnesses: vi.fn(),
    onSetManySkillsAllHarnesses: vi.fn(),
    onRemoveSkill: hooks.onRemoveSkill,
    onDeleteSkill: hooks.onDeleteSkill,
    isInitialLoading: false,
  }),
}));

vi.mock("../model/session", () => ({
  useSkillsInUseSession: () => ({
    filters: { search: "" },
    updateFilters: hooks.updateFilters,
    resetFilters: hooks.resetFilters,
  }),
}));

vi.mock("../model/useInUseViewMode", () => ({
  useInUseViewMode: () => ["grid", vi.fn()] as const,
}));

vi.mock("../../../components/Toast", async () => {
  const actual = await vi.importActual<typeof import("../../../components/Toast")>(
    "../../../components/Toast",
  );
  return {
    ...actual,
    useToast: () => ({ toast: hooks.toast }),
  };
});

describe("SkillsInUsePage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    hooks.onRemoveSkill.mockClear();
    hooks.onDeleteSkill.mockClear();
    hooks.updateFilters.mockClear();
    hooks.resetFilters.mockClear();
    hooks.toast.mockClear();
  });

  it("opens a remove confirm popup from the skill card menu", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/skills/use"]}>
          <SkillsInUsePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions for Trace Lens" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from Skill Manager" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /remove skill from skill manager/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/will restore to: codex/i)).toBeInTheDocument();
    expect(hooks.onRemoveSkill).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(hooks.onRemoveSkill).toHaveBeenCalledWith("shared:trace-lens"),
    );
  });

  it("labels the harness coverage view as Matrix", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/skills/use"]}>
          <SkillsInUsePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Matrix" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Table" })).not.toBeInTheDocument();
  });

  it("opens a delete confirm popup from the skill card menu", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/skills/use"]}>
          <SkillsInUsePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions for Trace Lens" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /delete skill from skill manager/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/affected harnesses: codex/i)).toBeInTheDocument();
    expect(hooks.onDeleteSkill).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await waitFor(() =>
      expect(hooks.onDeleteSkill).toHaveBeenCalledWith("shared:trace-lens"),
    );
  });
});
