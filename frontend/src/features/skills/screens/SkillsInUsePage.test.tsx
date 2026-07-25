import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SkillsInUsePage from "./SkillsInUsePage";

const hooks = vi.hoisted(() => {
  return {
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
    selectedSkillRef: null,
    multiSelectedRefs: new Set(),
    onOpenSkill: vi.fn(),
    onToggleCell: vi.fn(),
    onToggleMultiSelect: vi.fn(),
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

vi.mock("../../../components/Toast", async () => {
  const actual = await vi.importActual<typeof import("../../../components/Toast")>(
    "../../../components/Toast",
  );
  return {
    ...actual,
    useToast: () => ({ toast: hooks.toast }),
  };
});

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/skills/use"]}>
        <SkillsInUsePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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
    hooks.updateFilters.mockClear();
    hooks.resetFilters.mockClear();
    hooks.toast.mockClear();
  });

  it("renders the harness matrix as the sole view", () => {
    renderPage();

    expect(screen.getByRole("table", { name: "Skills harness matrix" })).toBeInTheDocument();
    expect(screen.getByText("Trace Lens")).toBeInTheDocument();
    // The coverage search/filter chrome is preserved.
    expect(screen.getByLabelText("Search skills in use")).toBeInTheDocument();
  });

  it("no longer offers the removed view-mode toggles", () => {
    renderPage();

    for (const name of ["Grid", "Board", "Matrix", "Scan", "Table"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});
