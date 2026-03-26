import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkillsWorkspaceTabs } from "../components/skills/SkillsWorkspaceTabs";

describe("SkillsWorkspaceTabs", () => {
  it("renders managed and found-local tabs with counts", () => {
    render(
      <MemoryRouter initialEntries={["/skills/managed"]}>
        <SkillsWorkspaceTabs summary={{ managed: 2, foundLocally: 3, custom: 1, builtIn: 0 }} />
      </MemoryRouter>,
    );

    const managedTab = screen.getByRole("link", { name: /Managed/i });
    const foundLocalTab = screen.getByRole("link", { name: /Found locally/i });

    expect(managedTab).toBeInTheDocument();
    expect(foundLocalTab).toBeInTheDocument();
    expect(within(managedTab).getByText("3")).toBeInTheDocument();
    expect(within(foundLocalTab).getByText("3")).toBeInTheDocument();
  });
});
