import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSkillDetailController } from "../../model/use-skill-detail-controller";
import { SkillDetailView } from "./SkillDetailView";

vi.mock("../../model/use-skill-detail-controller", () => ({
  useSkillDetailController: vi.fn(),
}));

const useSkillDetailControllerMock = vi.mocked(useSkillDetailController);

function renderSubject() {
  return render(
    <SkillDetailView
      skillRef="shared:trace-lens"
      pendingToggleHarnesses={new Set()}
      pendingStructuralAction={null}
      onClose={vi.fn()}
      onManageSkill={vi.fn(async () => undefined)}
      onToggleSkill={vi.fn(async () => undefined)}
      onUpdateSkill={vi.fn(async () => undefined)}
      onRemoveSkill={vi.fn(async () => undefined)}
      onDeleteSkill={vi.fn(async () => undefined)}
    />,
  );
}

describe("SkillDetailView", () => {
  it("shows a loading shell without skill actions while the detail query is pending", () => {
    useSkillDetailControllerMock.mockReturnValue({
      detail: null,
      isInitialLoading: true,
      queryErrorMessage: "",
      actionErrorMessage: "",
      isRemoveDialogOpen: false,
      isDeleteDialogOpen: false,
      dismissActionError: vi.fn(),
      onManage: vi.fn(),
      onToggleHarness: vi.fn(),
      onUpdate: vi.fn(),
      requestRemove: vi.fn(),
      requestDelete: vi.fn(),
      setRemoveDialogOpen: vi.fn(),
      setDeleteDialogOpen: vi.fn(),
      handleConfirmDelete: vi.fn(),
      handleConfirmRemove: vi.fn(),
    });

    renderSubject();

    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close skill details" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Skill actions")).not.toBeInTheDocument();
  });

  it("shows an error fallback without a skill action rail when loading fails", () => {
    useSkillDetailControllerMock.mockReturnValue({
      detail: null,
      isInitialLoading: false,
      queryErrorMessage: "boom",
      actionErrorMessage: "",
      isRemoveDialogOpen: false,
      isDeleteDialogOpen: false,
      dismissActionError: vi.fn(),
      onManage: vi.fn(),
      onToggleHarness: vi.fn(),
      onUpdate: vi.fn(),
      requestRemove: vi.fn(),
      requestDelete: vi.fn(),
      setRemoveDialogOpen: vi.fn(),
      setDeleteDialogOpen: vi.fn(),
      handleConfirmDelete: vi.fn(),
      handleConfirmRemove: vi.fn(),
    });

    renderSubject();

    expect(screen.getByText("Unable to load skill")).toBeInTheDocument();
    expect(screen.getByText("Try selecting the skill again, or return to the list and reopen it.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Skill actions")).not.toBeInTheDocument();
  });
});
