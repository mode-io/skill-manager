import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SkillDetail } from "../../model/types";
import { SkillDetailContent } from "./SkillDetailContent";

const detail: SkillDetail = {
  skillRef: "unmanaged:trace-lens",
  name: "Trace Lens",
  description: "Trace review workflow",
  displayStatus: "Unmanaged",
  attentionMessage: null,
  actions: {
    canManage: true,
    updateStatus: null,
    stopManagingStatus: null,
    stopManagingHarnessLabels: [],
    canDelete: false,
    deleteHarnessLabels: [],
  },
  harnessCells: [
    { harness: "codex", label: "Codex", state: "found", interactive: false },
    { harness: "claude", label: "Claude", state: "empty", interactive: false },
    { harness: "cursor", label: "Cursor", state: "empty", interactive: false },
    { harness: "opencode", label: "OpenCode", state: "empty", interactive: false },
    { harness: "openclaw", label: "OpenClaw", state: "empty", interactive: false },
  ],
  locations: [],
  sourceLinks: {
    repoLabel: "mode-io/trace-lens",
    repoUrl: "https://github.com/mode-io/trace-lens",
    folderUrl: "https://github.com/mode-io/trace-lens/tree/main/trace-lens",
  },
  documentMarkdown: "# Trace Lens",
};

describe("SkillDetailContent", () => {
  it("renders the manage action in the title row and uses the detail close control", () => {
    const { container } = render(
      <SkillDetailContent
        detail={detail}
        actionErrorMessage=""
        queryErrorMessage=""
        pendingToggleHarnesses={new Set()}
        pendingStructuralAction={null}
        onClose={vi.fn()}
        onDismissActionError={vi.fn()}
        onManage={vi.fn()}
        onToggleHarness={vi.fn()}
        onUpdate={vi.fn()}
        onRequestStopManaging={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    const titleRow = document.querySelector(".skill-detail__title-row");
    const titleAction = document.querySelector(".skill-detail__title-action");
    const closeButton = screen.getByRole("button", { name: "Close skill details" });

    expect(titleRow).not.toBeNull();
    expect(titleAction).not.toBeNull();
    expect(titleAction?.querySelector(".skill-detail__manage-button")).not.toBeNull();
    expect(titleRow?.querySelector(".skill-detail__manage-button")).not.toBeNull();
    expect(closeButton).toHaveClass("skill-detail__close-button");
    expect(closeButton).not.toHaveClass("icon-button");
    expect(screen.getByRole("link", { name: /mode-io\/trace-lens/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Refreshing skill details")).not.toBeInTheDocument();
    expect(container.querySelector(".skill-harness-mark--openclaw .skill-harness-mark__logo")).not.toBeNull();
  });
});
