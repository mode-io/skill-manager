import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkillsWorkspaceTabs } from "./SkillsWorkspaceTabs";

describe("SkillsWorkspaceTabs", () => {
  it("renders managed and unmanaged tabs with counts", () => {
    render(
      <MemoryRouter initialEntries={["/skills/managed"]}>
        <SkillsWorkspaceTabs summary={{ managed: 2, unmanaged: 3, custom: 1, builtIn: 0 }} />
      </MemoryRouter>,
    );

    const managedTab = screen.getByRole("link", { name: /^Managed/i });
    const unmanagedTab = screen.getByRole("link", { name: /^Unmanaged/i });

    expect(managedTab).toBeInTheDocument();
    expect(unmanagedTab).toBeInTheDocument();
    expect(within(managedTab).getByText("3")).toBeInTheDocument();
    expect(within(unmanagedTab).getByText("3")).toBeInTheDocument();
  });
});
