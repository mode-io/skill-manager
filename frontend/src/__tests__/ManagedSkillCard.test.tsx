import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HarnessColumn, SkillTableRow } from "../api/types";
import { ManagedSkillCard } from "../components/skills/ManagedSkillCard";

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

describe("ManagedSkillCard", () => {
  it("renders the managed card, opens details from the name, and triggers the primary action", () => {
    const onOpenSkill = vi.fn();
    const onToggleCell = vi.fn();
    const onRunPrimaryAction = vi.fn();

    render(
      <ManagedSkillCard
        row={row}
        columns={columns}
        busyId={null}
        onOpenSkill={onOpenSkill}
        onToggleCell={onToggleCell}
        onRunPrimaryAction={onRunPrimaryAction}
      />,
    );

    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
    expect(screen.getByText("Shared audit workflow")).toBeInTheDocument();
    expect(screen.getByText("Ready in 1 tool")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open details for Shared Audit" }));
    expect(onOpenSkill).toHaveBeenCalledWith(row.skillRef);

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onRunPrimaryAction).toHaveBeenCalledWith(row);
    expect(onToggleCell).not.toHaveBeenCalled();
  });
});
