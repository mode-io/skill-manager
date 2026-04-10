import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HarnessColumn, SkillListRow } from "../../model/types";
import { ManagedSkillCard } from "./ManagedSkillCard";

const columns: HarnessColumn[] = [{ harness: "codex", label: "Codex" }];

const row: SkillListRow = {
  skillRef: "shared:shared-audit",
  name: "Shared Audit",
  description: "Shared audit workflow",
  displayStatus: "Managed",
  attentionMessage: null,
  canManage: false,
  cells: [{ harness: "codex", label: "Codex", state: "disabled", interactive: true }],
};

const customRow: SkillListRow = {
  ...row,
  skillRef: "shared:custom-audit",
  name: "Custom Audit",
  displayStatus: "Custom",
  attentionMessage: "Modified locally; source updates are disabled.",
};

describe("ManagedSkillCard", () => {
  it("renders the managed card and opens details from the name and card body", () => {
    const onOpenSkill = vi.fn();
    const onToggleCell = vi.fn();

    render(
      <ManagedSkillCard
        row={row}
        columns={columns}
        pendingToggleKeys={new Set()}
        pendingStructuralAction={null}
        selected={false}
        onOpenSkill={onOpenSkill}
        onToggleCell={onToggleCell}
      />,
    );

    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
    expect(screen.getByText("Shared audit workflow")).toBeInTheDocument();
    expect(screen.queryByText(/Ready in|Enabled in/)).not.toBeInTheDocument();
    const card = screen.getByText("Shared Audit").closest("article");
    expect(card).toHaveClass("skill-card", "skill-card--managed");
    expect(card?.querySelector(".skill-card__content")).not.toBeNull();
    expect(card?.querySelector(".skill-card__aside")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open details for Shared Audit" }));
    expect(onOpenSkill).toHaveBeenCalledWith(row.skillRef);

    fireEvent.click(screen.getByText("Shared audit workflow"));
    expect(onOpenSkill).toHaveBeenCalledTimes(2);

    expect(screen.queryByRole("button", { name: "Details" })).not.toBeInTheDocument();
    expect(onToggleCell).not.toHaveBeenCalled();
  });

  it("uses the custom badge as the explainer trigger instead of rendering an inline attention line", () => {
    render(
      <ManagedSkillCard
        row={customRow}
        columns={columns}
        pendingToggleKeys={new Set()}
        pendingStructuralAction={null}
        selected={false}
        onOpenSkill={vi.fn()}
        onToggleCell={vi.fn()}
      />,
    );

    const card = screen.getByText("Custom Audit").closest("article");
    expect(card).toHaveClass("skill-card");
    expect(card).toHaveClass("skill-card--managed");
    expect(card).not.toHaveClass("is-attention");
    expect(
      screen.queryByText("Modified locally; source updates are disabled."),
    ).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Custom status details" }));

    expect(screen.getByText("Custom skill")).toBeInTheDocument();
    expect(screen.getByText("Modified locally; source updates are disabled.")).toBeInTheDocument();
  });
});
