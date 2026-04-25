import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SelectionMenu } from "./SelectionMenu";

describe("SelectionMenu", () => {
  it("renders the shared selection menu surface and forwards changes", () => {
    const onChange = vi.fn();

    render(
      <SelectionMenu
        value="enabled"
        options={[
          { value: "all", label: "All", meta: 8 },
          { value: "enabled", label: "Enabled", meta: 3 },
        ]}
        active
        ariaLabel="Filter: Enabled"
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Filter: Enabled" });
    expect(trigger).toHaveTextContent("Enabled");

    fireEvent.click(trigger);

    expect(screen.getByText("All").closest(".ui-popup--menu")).not.toBeNull();
    expect(screen.getByText("3")).toBeInTheDocument();

    const allButton = screen.getByText("All").closest("button");
    expect(allButton).not.toBeNull();

    fireEvent.click(allButton!);
    expect(onChange).toHaveBeenCalledWith("all");
  });
});
