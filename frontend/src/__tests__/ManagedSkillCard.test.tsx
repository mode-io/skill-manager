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
  primaryAction: { kind: "open", label: "Open" },
  cells: [{ harness: "codex", label: "Codex", state: "disabled", interactive: true }],
};

const customRow: SkillTableRow = {
  ...row,
  skillRef: "shared:custom-audit",
  name: "Custom Audit",
  displayStatus: "Custom",
  attentionMessage: "Modified locally; source updates are disabled.",
};

describe("ManagedSkillCard", () => {
  it("renders the managed card and opens details from the name and card body", () => {
    const onOpenSkill = vi.fn();
    const onManageSkill = vi.fn(async () => undefined);
    const onToggleCell = vi.fn();

    render(
      <ManagedSkillCard
        row={row}
        columns={columns}
        busyId={null}
        selected={false}
        onOpenSkill={onOpenSkill}
        onManageSkill={onManageSkill}
        onToggleCell={onToggleCell}
      />,
    );

    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
    expect(screen.getByText("Shared audit workflow")).toBeInTheDocument();
    expect(screen.queryByText(/Ready in|Enabled in/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open details for Shared Audit" }));
    expect(onOpenSkill).toHaveBeenCalledWith(row.skillRef);

    fireEvent.click(screen.getByText("Shared audit workflow"));
    expect(onOpenSkill).toHaveBeenCalledTimes(2);

    expect(screen.queryByRole("button", { name: "Details" })).not.toBeInTheDocument();
    expect(onManageSkill).not.toHaveBeenCalled();
    expect(onToggleCell).not.toHaveBeenCalled();
  });

  it("uses the custom badge as the explainer trigger instead of rendering an inline attention line", () => {
    render(
      <ManagedSkillCard
        row={customRow}
        columns={columns}
        busyId={null}
        selected={false}
        onOpenSkill={vi.fn()}
        onManageSkill={vi.fn(async () => undefined)}
        onToggleCell={vi.fn()}
      />,
    );

    const card = screen.getByText("Custom Audit").closest("article");
    expect(card).toHaveClass("skill-card");
    expect(card).not.toHaveClass("is-attention");
    expect(
      screen.queryByText("Modified locally; source updates are disabled."),
    ).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Custom status details" }));

    expect(screen.getByText("Custom skill")).toBeInTheDocument();
    expect(screen.getByText("Modified locally; source updates are disabled.")).toBeInTheDocument();
  });
});
