import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UiTooltipProvider } from "../../../../components/ui/UiTooltipProvider";
import { SkillDetailRemoveAction } from "./SkillDetailRemoveAction";

describe("SkillDetailRemoveAction", () => {
  it("shows help copy for an available remove action and forwards clicks", async () => {
    const onRequestRemove = vi.fn();

    render(
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <SkillDetailRemoveAction
          status="available"
          disabled={false}
          onRequestRemove={onRequestRemove}
        />
      </UiTooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Remove from Skill Manager" });
    fireEvent.focus(button);

    await waitFor(() => {
      const bubble = document.querySelector(".ui-popup--tooltip");
      expect(bubble).not.toBeNull();
      expect(bubble).toHaveTextContent("Removes this skill from the Skill Manager store and restores local copies only for the harnesses that are currently enabled.");
    });

    fireEvent.click(button);
    expect(onRequestRemove).toHaveBeenCalledTimes(1);
  });

  it("shows disabled guidance when no harnesses are enabled", async () => {
    render(
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <SkillDetailRemoveAction
          status="disabled_no_enabled"
          disabled={false}
          onRequestRemove={() => undefined}
        />
      </UiTooltipProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Remove from Skill Manager" }).closest(".ui-tooltip-trigger");
    expect(trigger).not.toBeNull();

    fireEvent.focus(trigger!);

    await waitFor(() => {
      const bubble = document.querySelector(".ui-popup--tooltip");
      expect(bubble).not.toBeNull();
      expect(bubble).toHaveTextContent("Enable at least one harness before removing this skill from Skill Manager.");
    });

    expect(screen.getByRole("button", { name: "Remove from Skill Manager" })).toBeDisabled();
  });
});
