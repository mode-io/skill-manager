import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HarnessColumn, SkillTableRow } from "../api/types";
import { SkillsRow } from "../components/skills/SkillsRow";

const columns: HarnessColumn[] = [{ harness: "codex", label: "Codex" }];

const row: SkillTableRow = {
  skillRef: "shared:shared-audit",
  name: "Shared Audit",
  description: "Shared audit workflow",
  displayStatus: "Managed",
  attentionMessage: null,
  needsAttention: false,
  defaultSortRank: 2,
  primaryAction: { kind: "open", label: "Open" },
  cells: [{ harness: "codex", label: "Codex", state: "disabled", interactive: true }],
};

describe("SkillsRow", () => {
  it("renders a single-row skill with inline description and switch control", () => {
    const onOpenSkill = vi.fn();
    const onToggleCell = vi.fn();
    const onRunPrimaryAction = vi.fn();

    render(
      <table>
        <tbody>
          <SkillsRow
            row={row}
            columns={columns}
            busyId={null}
            onOpenSkill={onOpenSkill}
            onToggleCell={onToggleCell}
            onRunPrimaryAction={onRunPrimaryAction}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
    expect(screen.getByText("Shared audit workflow")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Enable Shared Audit for Codex" }));
    expect(onToggleCell).toHaveBeenCalledWith(row, row.cells[0]);
  });
});
