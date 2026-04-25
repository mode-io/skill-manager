import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SkillDetail } from "../../model/types";
import { SkillDetailContent } from "./SkillDetailContent";

const unmanagedDetail: SkillDetail = {
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
  documentMarkdown: "## Usage\n\nInspect traces.",
};

describe("SkillDetailContent", () => {
  it("renders source links, keeps SKILL.md folded by default, omits status pills, and places review actions in the footer rail", async () => {
    render(
      <SkillDetailContent
        detail={unmanagedDetail}
        actionErrorMessage=""
        queryErrorMessage=""
        pendingToggleHarnesses={new Set()}
        pendingStructuralAction={null}
        onClose={vi.fn()}
        onDismissActionError={vi.fn()}
        onManage={vi.fn()}
        onToggleHarness={vi.fn()}
        onUpdate={vi.fn()}
        onRequestRemove={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/source links for mode-io\/trace-lens/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /mode-io\/trace-lens/i })).toHaveAttribute(
      "href",
      unmanagedDetail.sourceLinks?.repoUrl,
    );
    expect(screen.getByRole("link", { name: "Open Skill Folder" })).toHaveAttribute(
      "href",
      unmanagedDetail.sourceLinks?.folderUrl,
    );
    expect(screen.getByRole("heading", { level: 3, name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Harnesses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SKILL.md" })).toBeInTheDocument();
    expect(screen.queryByText("Inspect traces.")).not.toBeInTheDocument();
    expect(screen.queryByText("Unmanaged")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "SKILL.md" }));
    expect(await screen.findByText("Inspect traces.")).toBeInTheDocument();

    const footer = screen.getByLabelText("Skill actions");
    expect(footer).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Skill Manager" })).toBeInTheDocument();
    expect(
      screen.queryByText(/Shared Store is the canonical physical package/i),
    ).not.toBeInTheDocument();
  });

  it("shows the shared-store note only for managed entries with a shared location and keeps passive source status in the footer", () => {
    render(
      <SkillDetailContent
        detail={{
          ...unmanagedDetail,
          skillRef: "shared:trace-lens",
          displayStatus: "Managed",
          actions: {
            ...unmanagedDetail.actions,
            canManage: false,
            updateStatus: "no_update_available",
          },
          locations: [
            {
              kind: "shared",
              harness: null,
              label: "Shared Store",
              scope: "shared",
              path: "/tmp/shared/trace-lens",
              revision: "abc123",
              sourceKind: "github",
              sourceLocator: "github:mode-io/trace-lens",
              detail: null,
            },
          ],
        }}
        actionErrorMessage=""
        queryErrorMessage=""
        pendingToggleHarnesses={new Set()}
        pendingStructuralAction={null}
        onClose={vi.fn()}
        onDismissActionError={vi.fn()}
        onManage={vi.fn()}
        onToggleHarness={vi.fn()}
        onUpdate={vi.fn()}
        onRequestRemove={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Skill Manager Store is the canonical physical package\. Tool locations are/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to Skill Manager" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Skill actions")).toBeInTheDocument();
    expect(screen.getByText("No Update Available")).toBeInTheDocument();
    expect(screen.queryByText("Managed")).not.toBeInTheDocument();
  });

  it("shows the local-changes warning in the body and hides local_changes_detected from the footer rail", () => {
    render(
      <SkillDetailContent
        detail={{
          ...unmanagedDetail,
          skillRef: "shared:trace-lens",
          displayStatus: "Managed",
          attentionMessage: "Local changes detected. Source updates are disabled.",
          actions: {
            ...unmanagedDetail.actions,
            canManage: false,
            updateStatus: "local_changes_detected" as unknown as SkillDetail["actions"]["updateStatus"],
          },
          locations: [
            {
              kind: "shared",
              harness: null,
              label: "Shared Store",
              scope: "shared",
              path: "/tmp/shared/trace-lens",
              revision: "abc123",
              sourceKind: "github",
              sourceLocator: "github:mode-io/trace-lens",
              detail: null,
            },
          ],
        }}
        actionErrorMessage=""
        queryErrorMessage=""
        pendingToggleHarnesses={new Set()}
        pendingStructuralAction={null}
        onClose={vi.fn()}
        onDismissActionError={vi.fn()}
        onManage={vi.fn()}
        onToggleHarness={vi.fn()}
        onUpdate={vi.fn()}
        onRequestRemove={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    const note = screen.getByText("Local changes detected. Source updates are disabled.");
    expect(note).toBeInTheDocument();
    expect(note.closest(".detail-note")).not.toBeNull();
    expect(screen.queryByLabelText("Skill actions")).not.toBeInTheDocument();
    expect(screen.queryByText("No Update Available")).not.toBeInTheDocument();
    expect(screen.queryByText("No Source Available")).not.toBeInTheDocument();
  });
});
