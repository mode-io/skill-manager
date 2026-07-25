import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SkillsNeedsReviewPage from "./SkillsNeedsReviewPage";

const hooks = vi.hoisted(() => {
  return {
    onManageSkill: vi.fn(async () => undefined),
    onManageAll: vi.fn(async () => undefined),
    onOpenSkill: vi.fn(),
    updateFilters: vi.fn(),
    resetFilters: vi.fn(),
  };
});

vi.mock("../model/workspace-context", () => ({
  useSkillsWorkspace: () => ({
    data: {
      summary: { managed: 0, unmanaged: 1 },
      harnessColumns: [
        { harness: "codex", label: "Codex", installed: true },
        { harness: "cursor", label: "Cursor", installed: true },
      ],
      rows: [
        {
          skillRef: "local:trace-lens",
          name: "Trace Lens",
          description: "Trace review workflow",
          displayStatus: "Unmanaged",
          actions: { canManage: true, canStopManaging: false, canDelete: false },
          cells: [
            { harness: "codex", label: "Codex", state: "found", interactive: false },
            { harness: "cursor", label: "Cursor", state: "empty", interactive: false },
          ],
        },
      ],
    },
    status: "ready",
    pendingStructuralActions: new Map(),
    pendingBulkAction: null,
    selectedSkillRef: null,
    onManageAll: hooks.onManageAll,
    onManageSkill: hooks.onManageSkill,
    onOpenSkill: hooks.onOpenSkill,
    isInitialLoading: false,
  }),
}));

vi.mock("../model/session", () => ({
  useSkillsNeedsReviewSession: () => ({
    filters: { search: "" },
    updateFilters: hooks.updateFilters,
    resetFilters: hooks.resetFilters,
  }),
}));

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/skills/review"]}>
        <SkillsNeedsReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SkillsNeedsReviewPage", () => {
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
    hooks.onManageSkill.mockClear();
    hooks.onManageAll.mockClear();
    hooks.onOpenSkill.mockClear();
  });

  it("renders unmanaged skills as an adopt matrix with harness discovery columns", () => {
    renderPage();

    expect(screen.getByRole("table", { name: "Skills to adopt" })).toBeInTheDocument();
    expect(screen.getByText("Trace Lens")).toBeInTheDocument();
    // Discovered in Codex, not in Cursor.
    expect(screen.getByLabelText("Discovered in Codex")).toBeInTheDocument();
    expect(screen.getByLabelText("Not found in Cursor")).toBeInTheDocument();
  });

  it("adopts a skill via the row Adopt button", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    await waitFor(() => expect(hooks.onManageSkill).toHaveBeenCalledWith("local:trace-lens"));
  });

  it("adopts selected skills from the bulk action bar", async () => {
    renderPage();

    // No bulk bar until a row is selected.
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Trace Lens" }));

    const toolbar = screen.getByRole("toolbar", { name: "Bulk actions" });
    expect(within(toolbar).getByText("1 selected")).toBeInTheDocument();

    fireEvent.click(within(toolbar).getByRole("button", { name: "Adopt" }));
    await waitFor(() => expect(hooks.onManageSkill).toHaveBeenCalledWith("local:trace-lens"));
  });
});
