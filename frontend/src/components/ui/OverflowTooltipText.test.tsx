import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OverflowTooltipText } from "./OverflowTooltipText";
import { UiTooltipProvider } from "./UiTooltipProvider";

const sizeState = {
  clientWidth: 80,
  scrollWidth: 240,
  clientHeight: 20,
  scrollHeight: 20,
};

const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");

describe("OverflowTooltipText", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => sizeState.clientWidth,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => sizeState.scrollWidth,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => sizeState.clientHeight,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => sizeState.scrollHeight,
    });
  });

  beforeEach(() => {
    sizeState.clientWidth = 80;
    sizeState.scrollWidth = 240;
    sizeState.clientHeight = 20;
    sizeState.scrollHeight = 20;
  });

  afterAll(() => {
    vi.unstubAllGlobals();

    restoreDescriptor("clientWidth", originalClientWidth);
    restoreDescriptor("scrollWidth", originalScrollWidth);
    restoreDescriptor("clientHeight", originalClientHeight);
    restoreDescriptor("scrollHeight", originalScrollHeight);
  });

  it("reveals clipped text through the shared tooltip surface", async () => {
    render(
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <OverflowTooltipText as="span" className="skill-card__name" tabIndex={0}>
          A very long skill name
        </OverflowTooltipText>
      </UiTooltipProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("A very long skill name")).toHaveAttribute("data-state", "closed");
    });

    const text = screen.getByText("A very long skill name");
    fireEvent.focus(text);

    await waitFor(() => {
      const bubble = document.querySelector(".ui-popup--tooltip");
      expect(bubble).not.toBeNull();
      expect(bubble).toHaveTextContent("A very long skill name");
    });
  });

  it("stays silent when the text fits", async () => {
    sizeState.clientWidth = 240;
    sizeState.scrollWidth = 240;

    render(
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <OverflowTooltipText as="span" className="skill-card__name" tabIndex={0}>
          Short name
        </OverflowTooltipText>
      </UiTooltipProvider>,
    );

    const text = screen.getByText("Short name");
    fireEvent.focus(text);

    await waitFor(() => {
      expect(screen.queryByText("Short name", { selector: ".ui-popup--tooltip" })).toBeNull();
    });
  });
});

function restoreDescriptor(
  key: "clientWidth" | "scrollWidth" | "clientHeight" | "scrollHeight",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(HTMLElement.prototype, key, descriptor);
    return;
  }
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
}
