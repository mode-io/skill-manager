import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FoundLocalSkillsToolbar } from "../components/skills/FoundLocalSkillsToolbar";
import type { FoundLocalSkillsFilterState } from "../components/skills/model";

const filters: FoundLocalSkillsFilterState = {
  search: "",
  harnessFilter: "all",
  sortBy: "default",
};

describe("FoundLocalSkillsToolbar", () => {
  it("updates intake search and filter controls", () => {
    const onSearchChange = vi.fn();
    const onHarnessFilterChange = vi.fn();
    const onSortByChange = vi.fn();
    const onResetFilters = vi.fn();

    render(
      <FoundLocalSkillsToolbar
        columns={[{ harness: "codex", label: "Codex" }]}
        filters={filters}
        hasActiveFilters={true}
        onSearchChange={onSearchChange}
        onHarnessFilterChange={onHarnessFilterChange}
        onSortByChange={onSortByChange}
        onResetFilters={onResetFilters}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search found local skills" }), { target: { value: "trace" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Found local tool filter" }), { target: { value: "codex" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Found local sort order" }), { target: { value: "name" } });
    fireEvent.click(screen.getByRole("button", { name: /Reset/i }));

    expect(onSearchChange).toHaveBeenCalledWith("trace");
    expect(onHarnessFilterChange).toHaveBeenCalledWith("codex");
    expect(onSortByChange).toHaveBeenCalledWith("name");
    expect(onResetFilters).toHaveBeenCalled();
  });
});
