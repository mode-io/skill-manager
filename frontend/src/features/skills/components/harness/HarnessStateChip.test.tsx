import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HarnessStateChip } from "./HarnessStateChip";

describe("HarnessStateChip", () => {
  it("renders interactive on-off switches for enabled and disabled states", () => {
    const onCheckedChange = vi.fn();

    const { rerender } = render(
      <HarnessStateChip
        state="disabled"
        interactive
        ariaLabel="Enable Shared Audit for Codex"
        onCheckedChange={onCheckedChange}
      />,
    );

    expect(screen.getByRole("switch", { name: "Enable Shared Audit for Codex" })).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Enable Shared Audit for Codex" }));
    expect(onCheckedChange).toHaveBeenCalled();

    rerender(
      <HarnessStateChip
        state="enabled"
        interactive
        ariaLabel="Disable Shared Audit for Codex"
        onCheckedChange={onCheckedChange}
      />,
    );

    expect(screen.getByRole("switch", { name: "Disable Shared Audit for Codex" })).toBeInTheDocument();
    expect(screen.getByText("On")).toBeInTheDocument();
  });

  it("renders passive found, not found, and built-in chips", () => {
    const { container, rerender } = render(<HarnessStateChip state="found" interactive={false} />);

    expect(screen.getByText("Found")).toBeInTheDocument();
    expect(container.querySelector(".harness-state-chip--found")).not.toBeNull();

    rerender(<HarnessStateChip state="empty" interactive={false} />);
    expect(screen.getByText("Not Found")).toBeInTheDocument();
    expect(container.querySelector(".harness-state-chip--empty")).not.toBeNull();

    rerender(<HarnessStateChip state="builtin" interactive={false} />);
    expect(screen.getByText("Built-in")).toBeInTheDocument();
    expect(container.querySelector(".harness-state-chip--builtin")).not.toBeNull();
  });
});
