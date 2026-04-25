import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillsWorkspaceSessionProvider, useSkillsTabScroll } from "./session";

function ScrollProbe({ tab }: { tab: "inUse" | "needsReview" }) {
  const elementRef = useRef<HTMLDivElement>(null);
  useSkillsTabScroll(tab, true, elementRef);

  return (
    <div
      ref={elementRef}
      data-testid={`${tab}-scroll`}
    />
  );
}

function SessionHarness({ tab }: { tab: "inUse" | "needsReview" }) {
  return (
    <SkillsWorkspaceSessionProvider>
      <ScrollProbe key={tab} tab={tab} />
    </SkillsWorkspaceSessionProvider>
  );
}

describe("useSkillsTabScroll", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value(this: HTMLElement, options: ScrollToOptions) {
        if (typeof options.top === "number") {
          this.scrollTop = options.top;
        }
      },
    });
  });

  it("stores and restores per-tab pane scroll positions without using window scroll", () => {
    const { rerender } = render(<SessionHarness tab="inUse" />);

    const inUseScroll = screen.getByTestId("inUse-scroll") as HTMLDivElement;
    inUseScroll.scrollTop = 180;

    rerender(<SessionHarness tab="needsReview" />);

    const needsReviewScroll = screen.getByTestId("needsReview-scroll") as HTMLDivElement;
    needsReviewScroll.scrollTop = 48;

    rerender(<SessionHarness tab="inUse" />);

    expect((screen.getByTestId("inUse-scroll") as HTMLDivElement).scrollTop).toBe(180);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
