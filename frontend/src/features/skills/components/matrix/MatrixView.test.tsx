import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HarnessColumn, SkillListRow } from "../../model/types";
import { MatrixView } from "./MatrixView";

const harnessColumns: HarnessColumn[] = [
  { harness: "codex", label: "Codex", logoKey: "codex", installed: true },
  { harness: "cursor", label: "Cursor", logoKey: "cursor", installed: true },
];

const rows: SkillListRow[] = [
  {
    skillRef: "shared:alpha",
    name: "Alpha",
    description: "First skill",
    displayStatus: "Managed",
    actions: { canManage: false, canStopManaging: true, canDelete: true },
    cells: [
      { harness: "codex", label: "Codex", logoKey: "codex", state: "enabled", interactive: true },
      { harness: "cursor", label: "Cursor", logoKey: "cursor", state: "disabled", interactive: true },
    ],
  },
  {
    skillRef: "shared:zeta",
    name: "Zeta",
    description: "Last skill",
    displayStatus: "Managed",
    actions: { canManage: false, canStopManaging: true, canDelete: true },
    cells: [
      { harness: "codex", label: "Codex", logoKey: "codex", state: "disabled", interactive: true },
      { harness: "cursor", label: "Cursor", logoKey: "cursor", state: "disabled", interactive: true },
    ],
  },
];

function renderMatrix() {
  const props = {
    rows,
    harnessColumns,
    checkedRefs: new Set<string>(),
    selectedSkillRef: null,
    pendingToggleKeys: new Set<string>(),
    onOpenSkill: vi.fn(),
    onToggleChecked: vi.fn(),
    onToggleCell: vi.fn(),
  };
  render(<MatrixView {...props} />);
  return props;
}

describe("Skills MatrixView", () => {
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
  });

  it("renders a harness matrix with sortable rows", () => {
    renderMatrix();

    const table = screen.getByRole("table", { name: "Skills harness matrix" });
    expect(table.querySelectorAll("col")).toHaveLength(harnessColumns.length + 4);
    expect(rowNames()).toEqual(["Alpha", "Zeta"]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name" }));
    expect(rowNames()).toEqual(["Zeta", "Alpha"]);
  });

  it("toggles harness cells", () => {
    const { onToggleCell } = renderMatrix();

    fireEvent.click(screen.getByRole("button", { name: "Disable Alpha on Codex" }));

    expect(onToggleCell).toHaveBeenCalledWith(rows[0], rows[0].cells[0]);
  });
});

function rowNames(): string[] {
  const table = screen.getByRole("table", { name: "Skills harness matrix" });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByText(/Alpha|Zeta/)[0].textContent ?? "");
}
