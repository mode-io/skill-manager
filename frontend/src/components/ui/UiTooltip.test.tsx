import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UiTooltip } from "./UiTooltip";
import { UiTooltipProvider } from "./UiTooltipProvider";

describe("UiTooltip", () => {
  it("renders the shared tooltip bubble on hover", async () => {
    render(
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <UiTooltip content="Codex CLI">
          <button type="button">Harness</button>
        </UiTooltip>
      </UiTooltipProvider>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Harness" }));

    await waitFor(() => {
      const bubble = document.querySelector(".ui-popup--tooltip");
      expect(bubble).not.toBeNull();
      expect(bubble).toHaveTextContent("Codex CLI");
    });
  });

  it("applies custom tooltip content classes when provided", async () => {
    render(
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <UiTooltip content="Codex CLI" contentClassName="ui-popup--tooltip--hint">
          <button type="button">Harness</button>
        </UiTooltip>
      </UiTooltipProvider>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Harness" }));

    await waitFor(() => {
      const bubble = document.querySelector(".ui-popup--tooltip--hint");
      expect(bubble).not.toBeNull();
      expect(bubble).toHaveTextContent("Codex CLI");
    });
  });

  it("does not render when disabled", () => {
    render(
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <UiTooltip content="Codex CLI" disabled>
          <button type="button">Harness</button>
        </UiTooltip>
      </UiTooltipProvider>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Harness" }));
    expect(screen.queryByText("Codex CLI")).not.toBeInTheDocument();
  });
});
