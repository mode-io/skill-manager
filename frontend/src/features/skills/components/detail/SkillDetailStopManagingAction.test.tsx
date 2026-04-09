import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillDetailStopManagingAction } from "./SkillDetailStopManagingAction";

describe("SkillDetailStopManagingAction", () => {
  it("shows help copy for an available stop-managing action and forwards clicks", async () => {
    const onRequestStopManaging = vi.fn();

    render(
      <SkillDetailStopManagingAction
        status="available"
        disabled={false}
        onRequestStopManaging={onRequestStopManaging}
      />,
    );

    const button = screen.getByRole("button", { name: "Stop Managing" });
    fireEvent.mouseEnter(button);

    await waitFor(() =>
      expect(screen.getByText("Moves this skill out of the shared managed store and restores local copies only for the harnesses that are currently enabled.")).toBeInTheDocument(),
    );

    fireEvent.click(button);
    expect(onRequestStopManaging).toHaveBeenCalledTimes(1);
  });

  it("shows disabled guidance when no harnesses are enabled", async () => {
    render(
      <SkillDetailStopManagingAction
        status="disabled_no_enabled"
        disabled={false}
        onRequestStopManaging={() => undefined}
      />,
    );

    const trigger = screen.getByText("Stop Managing").closest(".skill-detail__action-trigger");
    expect(trigger).not.toBeNull();

    fireEvent.focus(trigger!);

    await waitFor(() =>
      expect(screen.getByText("Turn on at least one harness before moving this skill back to unmanaged.")).toBeInTheDocument(),
    );

    expect(screen.getByRole("button", { name: "Stop Managing" })).toBeDisabled();
  });
});
