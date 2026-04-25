import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CardMenu } from "./CardMenu";

describe("CardMenu", () => {
  it("renders shared menu-surface actions and closes after selection", async () => {
    const onDelete = vi.fn();

    render(
      <CardMenu
        label="More actions"
        items={[
          { key: "delete", label: "Delete", destructive: true, onSelect: onDelete },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton.closest(".ui-popup--menu")).not.toBeNull();
    expect(deleteButton).toHaveAttribute("data-destructive");

    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument(),
    );
  });
});
