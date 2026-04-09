import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HarnessCell } from "../../model/types";
import { SkillDetailHarnessMatrix } from "./SkillDetailHarnessMatrix";

const cells: HarnessCell[] = [
  { harness: "codex", label: "Codex", state: "disabled", interactive: true },
  { harness: "claude", label: "Claude", state: "found", interactive: false },
  { harness: "cursor", label: "Cursor", state: "builtin", interactive: false },
  { harness: "opencode", label: "OpenCode", state: "empty", interactive: false },
];

describe("SkillDetailHarnessMatrix", () => {
  it("renders logo-backed harness controls and forwards toggle events", () => {
    const onToggleCell = vi.fn();
    const { container } = render(
      <SkillDetailHarnessMatrix
        skillName="Shared Audit"
        cells={cells}
        disabled={false}
        onToggleCell={onToggleCell}
      />,
    );

    expect(screen.getByText("Harness access")).toBeInTheDocument();
    expect(container.querySelectorAll(".skill-harness-mark__logo")).toHaveLength(4);
    expect(screen.getByText("Found")).toBeInTheDocument();
    expect(screen.getByText("Built-in")).toBeInTheDocument();
    expect(screen.getByText("Not Found")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable Shared Audit for Codex" })).toBeInTheDocument();
    expect(container.querySelectorAll(".harness-state-chip")).toHaveLength(4);

    fireEvent.click(screen.getByRole("switch", { name: "Enable Shared Audit for Codex" }));
    expect(onToggleCell).toHaveBeenCalledWith(cells[0]);
  });
});
