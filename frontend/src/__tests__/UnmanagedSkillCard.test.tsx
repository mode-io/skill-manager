import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SkillTableRow } from "../api/types";
import { UnmanagedSkillCard } from "../components/skills/UnmanagedSkillCard";

const row: SkillTableRow = {
  skillRef: "unmanaged:trace-lens",
  name: "Trace Lens",
  description: "Trace review workflow",
  displayStatus: "Unmanaged",
  attentionMessage: null,
  primaryAction: { kind: "manage", label: "Bring under management" },
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
    expect(screen.getByText("Codex, Claude")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bring under management" }));
    expect(onManageSkill).toHaveBeenCalledWith(row.skillRef);

    fireEvent.click(screen.getByText("Trace review workflow"));
    expect(onOpenSkill).toHaveBeenCalledWith(row.skillRef);
    expect(screen.queryByRole("button", { name: "Details" })).not.toBeInTheDocument();
  });
});
