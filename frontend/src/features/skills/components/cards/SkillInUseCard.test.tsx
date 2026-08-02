import type { ComponentType } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LOCALE_STORAGE_KEY, LocaleProvider } from "../../../../i18n";
import { SkillInUseCard } from "./SkillInUseCard";

const SkillInUseCardSubject = SkillInUseCard as unknown as ComponentType<Record<string, unknown>>;

function renderCard(overrides?: Record<string, unknown>) {
  const onRequestRemove = vi.fn();
  const onRequestDelete = vi.fn();
  const onOpenSkill = vi.fn();
  const onToggleHarness = vi.fn();
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
    onOpenSkill,
    onToggleChecked: vi.fn(),
    onToggleHarness,
    onSetAllHarnesses: vi.fn(),
    onRequestRemove,
    onRequestDelete,
    ...overrides,
  };

  return {
    ...render(
      <LocaleProvider>
        <SkillInUseCardSubject {...props} />
      </LocaleProvider>,
    ),
    onOpenSkill,
    onToggleHarness,
    onRequestRemove,
    onRequestDelete,
  };
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

  it("renders every interactive harness as a card toggle", () => {
    const { onOpenSkill, onToggleHarness } = renderCard();

    const enabledHarness = screen.getByRole("button", { name: "Disable Trace Lens on Codex" });
    const disabledHarness = screen.getByRole("button", { name: "Enable Trace Lens on Cursor" });

    expect(enabledHarness).toHaveAttribute("aria-pressed", "true");
    expect(disabledHarness).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(disabledHarness);

    expect(onToggleHarness).toHaveBeenCalledWith(
      expect.objectContaining({ skillRef: "shared:trace-lens" }),
      expect.objectContaining({ harness: "cursor", state: "disabled" }),
    );
    expect(onOpenSkill).not.toHaveBeenCalled();
  });

  it("localizes harness toggle labels", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");

    renderCard();

    expect(screen.getByRole("button", { name: "在 Codex 上禁用 Trace Lens" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "在 Cursor 上启用 Trace Lens" })).toBeInTheDocument();
  });
});
