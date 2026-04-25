import type { ComponentType } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillInUseCard } from "./SkillInUseCard";

const SkillInUseCardSubject = SkillInUseCard as unknown as ComponentType<Record<string, unknown>>;

function renderCard(overrides?: Record<string, unknown>) {
  const onRequestRemove = vi.fn();
  const onRequestDelete = vi.fn();
  const props = {
    row: {
      skillRef: "shared:trace-lens",
      name: "Trace Lens",
      description: "Trace review workflow",
      displayStatus: "Managed",
      actions: { canManage: false, canStopManaging: true, canDelete: true },
      cells: [
        { harness: "codex", label: "Codex", state: "enabled", interactive: true },
        { harness: "cursor", label: "Cursor", state: "disabled", interactive: true },
      ],
    },
    pendingToggleKeys: new Set(),
    pendingStructuralAction: null,
    selected: false,
    checked: false,
    onOpenSkill: vi.fn(),
    onToggleChecked: vi.fn(),
    onSetAllHarnesses: vi.fn(),
    onRequestRemove,
    onRequestDelete,
    ...overrides,
  };

  return { ...render(<SkillInUseCardSubject {...props} />), onRequestRemove, onRequestDelete };
}

describe("SkillInUseCard", () => {
  it("shows only structural menu actions and omits update-from-source", () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "More actions for Trace Lens" }));

    expect(screen.getByRole("button", { name: "Remove from Skill Manager" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Update From Source/i })).not.toBeInTheDocument();
  });

  it("routes card-menu actions through request callbacks", () => {
    const { onRequestRemove, onRequestDelete } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "More actions for Trace Lens" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from Skill Manager" }));
    expect(onRequestRemove).toHaveBeenCalledWith(
      expect.objectContaining({ skillRef: "shared:trace-lens", name: "Trace Lens" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions for Trace Lens" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onRequestDelete).toHaveBeenCalledWith(
      expect.objectContaining({ skillRef: "shared:trace-lens", name: "Trace Lens" }),
    );
  });

  it("hides the menu trigger when no structural actions are available", () => {
    renderCard({
      row: {
        skillRef: "shared:trace-lens",
        name: "Trace Lens",
        description: "Trace review workflow",
        displayStatus: "Managed",
        actions: { canManage: false, canStopManaging: false, canDelete: false },
        cells: [
          { harness: "codex", label: "Codex", state: "enabled", interactive: true },
          { harness: "cursor", label: "Cursor", state: "disabled", interactive: true },
        ],
      },
    });

    expect(screen.queryByRole("button", { name: "More actions for Trace Lens" })).not.toBeInTheDocument();
  });
});
