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

    fireEvent.click(screen.getByRole("button", { name: "Update From Source" }));
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

    expect(screen.getByText("No Update Available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "No Update Available" })).not.toBeInTheDocument();

    rerender(
      <SkillDetailUpdateControl
        updateStatus="no_source_available"
        pending={false}
        disabled={false}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByText("No Source Available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "No Source Available" })).not.toBeInTheDocument();
  });
});
