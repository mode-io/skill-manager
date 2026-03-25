import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillsToolbar } from "../components/skills/SkillsToolbar";
import type { SkillsFilterState } from "../components/skills/model";

const filters: SkillsFilterState = {
  search: "",
  statusFilter: "all",
  harnessFilter: "all",
  sortBy: "default",
  showBuiltIns: false,
};

describe("SkillsToolbar", () => {
  it("updates search and filter controls", () => {
    const onSearchChange = vi.fn();
    const onStatusFilterChange = vi.fn();
    const onHarnessFilterChange = vi.fn();
    const onSortByChange = vi.fn();
    const onShowBuiltInsChange = vi.fn();
    const onResetFilters = vi.fn();

    render(
      <SkillsToolbar
        columns={[{ harness: "codex", label: "Codex" }]}
        filters={filters}
        hasActiveFilters={true}
        onSearchChange={onSearchChange}
        onStatusFilterChange={onStatusFilterChange}
        onHarnessFilterChange={onHarnessFilterChange}
        onSortByChange={onSortByChange}
        onShowBuiltInsChange={onShowBuiltInsChange}
        onResetFilters={onResetFilters}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search skills" }), { target: { value: "trace" } });
    fireEvent.click(screen.getByRole("button", { name: "Needs action" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tool filter" }), { target: { value: "codex" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Sort skills" }), { target: { value: "name" } });
    fireEvent.click(screen.getByRole("button", { name: "Show built-ins" }));
    fireEvent.click(screen.getByRole("button", { name: /Reset/i }));

    expect(onSearchChange).toHaveBeenCalledWith("trace");
    expect(onStatusFilterChange).toHaveBeenCalledWith("needsAttention");
    expect(onHarnessFilterChange).toHaveBeenCalledWith("codex");
    expect(onSortByChange).toHaveBeenCalledWith("name");
    expect(onShowBuiltInsChange).toHaveBeenCalledWith(true);
    expect(onResetFilters).toHaveBeenCalled();
  });
});
