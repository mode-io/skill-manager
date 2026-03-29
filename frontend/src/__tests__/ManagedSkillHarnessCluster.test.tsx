import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HarnessColumn, SkillTableRow } from "../api/types";
import { ManagedSkillHarnessCluster } from "../components/skills/ManagedSkillHarnessCluster";

const columns: HarnessColumn[] = [
  { harness: "codex", label: "Codex" },
  { harness: "cursor", label: "Cursor" },
];

const row: SkillTableRow = {
  skillRef: "shared:trace-lens",
  name: "Trace Lens",
  description: "Trace review workflow",
  displayStatus: "Managed",
  attentionMessage: null,
  primaryAction: { kind: "open", label: "Open" },
  cells: [
    { harness: "codex", label: "Codex", state: "disabled", interactive: true },
    { harness: "cursor", label: "Cursor", state: "builtin", interactive: false },
  ],
};

describe("ManagedSkillHarnessCluster", () => {
  it("renders grouped harness controls and forwards toggle events", () => {
    const onToggleCell = vi.fn();

    render(
      <ManagedSkillHarnessCluster
        row={row}
        columns={columns}
        busyId={null}
        onToggleCell={onToggleCell}
      />,
    );

    expect(screen.getByText("Built-in")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Enable Trace Lens for Codex" }));
    expect(onToggleCell).toHaveBeenCalledWith(row, row.cells[0]);
  });
});
