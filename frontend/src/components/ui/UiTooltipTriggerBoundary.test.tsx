import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UiTooltipProvider } from "./UiTooltipProvider";
import { UiTooltipTriggerBoundary } from "./UiTooltipTriggerBoundary";

describe("UiTooltipTriggerBoundary", () => {
  it("keeps disabled controls focusable for tooltip triggers", async () => {
    render(
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <UiTooltipTriggerBoundary content="Blocked for testing">
          <button type="button" disabled>
            Remove from Skill Manager
          </button>
        </UiTooltipTriggerBoundary>
      </UiTooltipProvider>,
    );

    const trigger = screen.getByText("Remove from Skill Manager").closest(".ui-tooltip-trigger");
    expect(trigger).not.toBeNull();

    fireEvent.focus(trigger!);

    await waitFor(() => {
      const bubble = document.querySelector(".ui-popup--tooltip");
      expect(bubble).not.toBeNull();
      expect(bubble).toHaveTextContent("Blocked for testing");
    });
  });

  it("blocks activation from bubbling to parent rows or cards", () => {
    const onParentActivate = vi.fn();

    render(
      <div
        role="button"
        tabIndex={0}
        onClick={onParentActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onParentActivate();
          }
        }}
      >
        <UiTooltipTriggerBoundary content="Blocked for testing">
          <button type="button" disabled>
            Install
          </button>
        </UiTooltipTriggerBoundary>
      </div>,
    );

    const trigger = screen.getByText("Install").closest(".ui-tooltip-trigger");
    expect(trigger).not.toBeNull();

    fireEvent.click(trigger!);
    fireEvent.keyDown(trigger!, { key: "Enter" });
    fireEvent.keyDown(trigger!, { key: " " });

    expect(onParentActivate).not.toHaveBeenCalled();
  });
});
