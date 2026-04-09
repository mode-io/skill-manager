import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SkillListRow } from "../../model/types";
import { UnmanagedSkillCard } from "./UnmanagedSkillCard";

const row: SkillListRow = {
  skillRef: "unmanaged:trace-lens",
  name: "Trace Lens",
  description: "Trace review workflow",
  displayStatus: "Unmanaged",
  attentionMessage: null,
  canManage: true,
  cells: [
    { harness: "codex", label: "Codex", state: "found", interactive: false },
    { harness: "claude", label: "Claude", state: "found", interactive: false },
  ],
};

describe("UnmanagedSkillCard", () => {
  it("renders intake details, manages explicitly, and opens details from the card surface", () => {
    const onOpenSkill = vi.fn();
    const onManageSkill = vi.fn(async () => undefined);

    render(
      <UnmanagedSkillCard
        row={row}
        busyId={null}
        selected={false}
        onOpenSkill={onOpenSkill}
        onManageSkill={onManageSkill}
      />,
    );

    expect(screen.getByText("Trace Lens")).toBeInTheDocument();
    const card = screen.getByText("Trace Lens").closest("article");
    expect(card).toHaveClass("skill-card", "skill-card--unmanaged");
    expect(card?.querySelector(".skill-card__content")).not.toBeNull();
    expect(card?.querySelector(".skill-card__aside")).not.toBeNull();

    expect(screen.getByRole("button", { name: "Manage" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(onManageSkill).toHaveBeenCalledWith(row.skillRef);

    fireEvent.click(screen.getByText("Trace review workflow"));
    expect(onOpenSkill).toHaveBeenCalledWith(row.skillRef);
    expect(screen.queryByRole("button", { name: "Details" })).not.toBeInTheDocument();
  });
});
