import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillDetailUpdateControl } from "./SkillDetailUpdateControl";

describe("SkillDetailUpdateControl", () => {
  it("renders a clickable update button when a source update is available", () => {
    const onUpdate = vi.fn();

    render(
      <SkillDetailUpdateControl
        updateStatus="update_available"
        pending={false}
        disabled={false}
        onUpdate={onUpdate}
      />,
    );

    const button = screen.getByRole("button", { name: "Update From Source" });
    expect(button).toHaveClass("action-pill--md");

    fireEvent.click(button);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("renders passive status controls for non-interactive source states", () => {
    const { rerender } = render(
      <SkillDetailUpdateControl
        updateStatus="no_update_available"
        pending={false}
        disabled={false}
        onUpdate={() => undefined}
      />,
    );

    const noUpdate = screen.getByText("No Update Available");
    expect(noUpdate).toBeInTheDocument();
    expect(noUpdate).toHaveClass("card-status-pill--md");
    expect(screen.queryByRole("button", { name: "No Update Available" })).not.toBeInTheDocument();

    rerender(
      <SkillDetailUpdateControl
        updateStatus="no_source_available"
        pending={false}
        disabled={false}
        onUpdate={() => undefined}
      />,
    );

    const noSource = screen.getByText("No Source Available");
    expect(noSource).toBeInTheDocument();
    expect(noSource).toHaveClass("card-status-pill--md");
    expect(screen.queryByRole("button", { name: "No Source Available" })).not.toBeInTheDocument();
  });

  it("renders nothing for local-changes-disabled state", () => {
    const { container } = render(
      <SkillDetailUpdateControl
        updateStatus={"local_changes_detected" as never}
        pending={false}
        disabled={false}
        onUpdate={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
