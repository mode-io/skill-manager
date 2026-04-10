import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSkillDetailController } from "../../model/use-skill-detail-controller";
import { SkillDetailView } from "./SkillDetailView";

vi.mock("../../model/use-skill-detail-controller", () => ({
  useSkillDetailController: vi.fn(),
}));

const useSkillDetailControllerMock = vi.mocked(useSkillDetailController);

describe("SkillDetailView", () => {
  it("renders the shared detail header shell for the error fallback", () => {
    useSkillDetailControllerMock.mockReturnValue({
      detail: null,
      isInitialLoading: false,
      queryErrorMessage: "boom",
      actionErrorMessage: "",
      isStopManagingDialogOpen: false,
      isDeleteDialogOpen: false,
      dismissActionError: vi.fn(),
      onManage: vi.fn(),
      onToggleHarness: vi.fn(),
      onUpdate: vi.fn(),
      requestStopManaging: vi.fn(),
      requestDelete: vi.fn(),
      setStopManagingDialogOpen: vi.fn(),
      setDeleteDialogOpen: vi.fn(),
      handleConfirmDelete: vi.fn(),
      handleConfirmStopManaging: vi.fn(),
    });

    render(
      <SkillDetailView
        skillRef="shared:trace-lens"
        pendingToggleHarnesses={new Set()}
        pendingStructuralAction={null}
        onClose={vi.fn()}
        onManageSkill={vi.fn(async () => undefined)}
        onToggleSkill={vi.fn(async () => undefined)}
        onUpdateSkill={vi.fn(async () => undefined)}
        onUnmanageSkill={vi.fn(async () => undefined)}
        onDeleteSkill={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("Unable to load skill")).toBeInTheDocument();
    expect(document.querySelector(".skill-detail__header-top")).not.toBeNull();
    expect(document.querySelector(".skill-detail__utility-rail")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close skill details" })).toHaveClass("skill-detail__close-button");
  });
});
