import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SkillTableRow } from "../api/types";
import { FoundLocalSkillCard } from "../components/skills/FoundLocalSkillCard";

const row: SkillTableRow = {
  skillRef: "local:trace-lens",
  name: "Trace Lens",
  description: "Trace review workflow",
  displayStatus: "Found locally",
  attentionMessage: null,
  needsAttention: false,
  defaultSortRank: 1,
  primaryAction: { kind: "manage", label: "Bring under management" },
  cells: [
    { harness: "codex", label: "Codex", state: "found", interactive: false },
    { harness: "claude", label: "Claude", state: "found", interactive: false },
  ],
};

describe("FoundLocalSkillCard", () => {
  it("renders intake details and exposes manage plus details actions", () => {
    const onOpenSkill = vi.fn();
    const onRunPrimaryAction = vi.fn();

    render(
      <FoundLocalSkillCard
        row={row}
        busyId={null}
        onOpenSkill={onOpenSkill}
        onRunPrimaryAction={onRunPrimaryAction}
      />,
    );

    expect(screen.getByText("Trace Lens")).toBeInTheDocument();
    expect(screen.getByText("Found in 2 tools")).toBeInTheDocument();
    expect(screen.getByText("Codex, Claude")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bring under management" }));
    expect(onRunPrimaryAction).toHaveBeenCalledWith(row);

    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0]);
    expect(onOpenSkill).toHaveBeenCalledWith(row.skillRef);
  });
});
