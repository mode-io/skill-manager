import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { cellActionKey } from "../../model/pending";
import type { HarnessColumn, SkillListRow } from "../../model/types";
import { ManagedSkillHarnessCluster } from "./ManagedSkillHarnessCluster";

const columns: HarnessColumn[] = [
  { harness: "codex", label: "Codex" },
  { harness: "cursor", label: "Cursor" },
  { harness: "openclaw", label: "OpenClaw" },
  { harness: "opencode", label: "OpenCode" },
];

const row: SkillListRow = {
  skillRef: "shared:trace-lens",
  name: "Trace Lens",
  description: "Trace review workflow",
  displayStatus: "Managed",
  attentionMessage: null,
  canManage: false,
  cells: [
    { harness: "codex", label: "Codex", state: "disabled", interactive: true },
    { harness: "cursor", label: "Cursor", state: "builtin", interactive: false },
    { harness: "openclaw", label: "OpenClaw", state: "enabled", interactive: true },
    { harness: "opencode", label: "OpenCode", state: "disabled", interactive: true },
  ],
};

describe("ManagedSkillHarnessCluster", () => {
  it("renders grouped harness controls and forwards toggle events", () => {
    const onToggleCell = vi.fn();

    const { container } = render(
      <ManagedSkillHarnessCluster
        row={row}
        columns={columns}
        pendingToggleKeys={new Set()}
        structuralLocked={false}
        onToggleCell={onToggleCell}
      />,
    );

    expect(screen.getByText("Built-in")).toBeInTheDocument();
    expect(container.querySelectorAll(".skill-harness-mark__logo")).toHaveLength(4);
    expect(container.querySelector(".skill-harness-mark--codex .skill-harness-mark__logo")).not.toBeNull();
    expect(container.querySelector(".skill-harness-mark--openclaw .skill-harness-mark__logo")).not.toBeNull();
    expect(container.querySelectorAll(".harness-state-chip")).toHaveLength(4);
    expect(screen.getAllByText("Off")).toHaveLength(2);

    fireEvent.click(screen.getByRole("switch", { name: "Enable Trace Lens for Codex" }));
    expect(onToggleCell).toHaveBeenCalledWith(row, row.cells[0]);
  });

  it("only disables the active harness switch while leaving sibling toggles usable", () => {
    render(
      <ManagedSkillHarnessCluster
        row={row}
        columns={columns}
        pendingToggleKeys={new Set([cellActionKey(row.skillRef, "codex")])}
        structuralLocked={false}
        onToggleCell={vi.fn()}
      />,
    );

    expect(screen.getByRole("switch", { name: "Enable Trace Lens for Codex" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Disable Trace Lens for OpenClaw" })).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Enable Trace Lens for OpenCode" })).toBeEnabled();
  });
});
