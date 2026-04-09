import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HarnessColumn, SkillListRow } from "../../model/types";
import { ManagedSkillHarnessCluster } from "./ManagedSkillHarnessCluster";

const columns: HarnessColumn[] = [
  { harness: "codex", label: "Codex" },
  { harness: "cursor", label: "Cursor" },
  { harness: "gemini", label: "Gemini" },
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
    { harness: "gemini", label: "Gemini", state: "disabled", interactive: true },
  ],
};

describe("ManagedSkillHarnessCluster", () => {
  it("renders grouped harness controls and forwards toggle events", () => {
    const onToggleCell = vi.fn();

    const { container } = render(
      <ManagedSkillHarnessCluster
        row={row}
        columns={columns}
        busyId={null}
        onToggleCell={onToggleCell}
      />,
    );

    expect(screen.getByText("Built-in")).toBeInTheDocument();
    expect(screen.getByText("Not Found")).toBeInTheDocument();
    expect(container.querySelectorAll(".skill-harness-mark__logo")).toHaveLength(3);
    expect(container.querySelector(".skill-harness-mark--codex .skill-harness-mark__logo")).not.toBeNull();
    expect(screen.getByText("Gemini")).toBeInTheDocument();
    expect(container.querySelectorAll(".harness-state-chip")).toHaveLength(4);
    expect(screen.getAllByText("Off")).toHaveLength(2);

    fireEvent.click(screen.getByRole("switch", { name: "Enable Trace Lens for Codex" }));
    expect(onToggleCell).toHaveBeenCalledWith(row, row.cells[0]);
  });
});
