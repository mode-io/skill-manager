import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HarnessCell } from "../../model/types";
import { SkillDetailHarnessMatrix } from "./SkillDetailHarnessMatrix";

const cells: HarnessCell[] = [
  { harness: "codex", label: "Codex", state: "disabled", interactive: true },
  { harness: "claude", label: "Claude", state: "enabled", interactive: true },
  { harness: "cursor", label: "Cursor", state: "found", interactive: false },
  { harness: "opencode", label: "OpenCode", state: "empty", interactive: false },
  { harness: "openclaw", label: "OpenClaw", state: "empty", interactive: false },
];

describe("SkillDetailHarnessMatrix", () => {
  it("renders toggle controls for interactive cells and guidance for found cells", () => {
    const onToggleCell = vi.fn();
    render(
      <SkillDetailHarnessMatrix
        skillName="Shared Audit"
        cells={cells}
        pendingToggleHarnesses={new Set()}
        pendingStructuralAction={null}
        onToggleCell={onToggleCell}
      />,
    );

    const enableButton = screen.getByRole("button", { name: "Enable Shared Audit for Codex" });
    const disableButton = screen.getByRole("button", { name: "Disable Shared Audit for Claude" });
    expect(enableButton).toBeInTheDocument();
    expect(enableButton).toHaveClass("action-pill--accent");
    expect(disableButton).toBeInTheDocument();
    expect(disableButton).toHaveClass("action-pill--danger");
    expect(screen.getByRole("group", { name: "Codex, Disabled" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Claude, Enabled" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cursor, Found in harness" })).toBeInTheDocument();
    expect(screen.getByText("Adopt this skill to manage it")).toBeInTheDocument();
    expect(screen.getByText("Found in harness")).toBeInTheDocument();
    expect(screen.queryByText(/^Enabled$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Disabled$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Not present$/)).not.toBeInTheDocument();

    fireEvent.click(enableButton);
    expect(onToggleCell).toHaveBeenCalledWith(cells[0]);
  });
});
