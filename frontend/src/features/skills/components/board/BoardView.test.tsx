import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { BoardView } from "./BoardView";
import type { SkillListRow } from "../../model/types";

const rows: SkillListRow[] = [
  {
    skillRef: "shared:all-off",
    name: "All Off Skill",
    description: "Disabled everywhere",
    displayStatus: "Managed",
    actions: { canManage: false, canStopManaging: true, canDelete: false },
    cells: [
      { harness: "codex", label: "Codex", state: "disabled", interactive: true },
      { harness: "cursor", label: "Cursor", state: "disabled", interactive: true },
    ],
  },
  {
    skillRef: "shared:selective",
    name: "Selective Skill",
    description: "Mixed",
    displayStatus: "Managed",
    actions: { canManage: false, canStopManaging: true, canDelete: false },
    cells: [
      { harness: "codex", label: "Codex", state: "enabled", interactive: true },
      { harness: "cursor", label: "Cursor", state: "disabled", interactive: true },
    ],
  },
  {
    skillRef: "shared:all-on",
    name: "All On Skill",
    description: "Enabled everywhere",
    displayStatus: "Managed",
    actions: { canManage: false, canStopManaging: true, canDelete: false },
    cells: [
      { harness: "codex", label: "Codex", state: "enabled", interactive: true },
      { harness: "cursor", label: "Cursor", state: "enabled", interactive: true },
    ],
  },
] as unknown as SkillListRow[];

function renderBoard() {
  return render(
    <MemoryRouter>
      <BoardView
        rows={rows}
        checkedRefs={new Set()}
        pendingToggleKeys={new Set()}
        onOpenSkill={vi.fn()}
        onToggleChecked={vi.fn()}
        onClearMultiSelect={vi.fn()}
        onSetSkillAllHarnesses={vi.fn()}
        onSetManySkillsAllHarnesses={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("BoardView", () => {
  it("places each row in the bucket its cells imply", () => {
    renderBoard();

    const disabledColumn = screen.getByRole("region", { name: /disabled everywhere/i });
    const selectiveColumn = screen.getByRole("region", { name: /selective/i });
    const enabledColumn = screen.getByRole("region", { name: /enabled everywhere/i });

    expect(within(disabledColumn).getByText("All Off Skill")).toBeInTheDocument();
    expect(within(selectiveColumn).getByText("Selective Skill")).toBeInTheDocument();
    expect(within(enabledColumn).getByText("All On Skill")).toBeInTheDocument();

    expect(within(disabledColumn).queryByText("All On Skill")).toBeNull();
    expect(within(enabledColumn).queryByText("All Off Skill")).toBeNull();
  });

  it("shows the count pill for each column", () => {
    renderBoard();

    const disabledColumn = screen.getByRole("region", { name: /disabled everywhere/i });
    expect(within(disabledColumn).getByLabelText("1 skills")).toHaveTextContent("1");
  });
});
