import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ManagedSkillsToolbar } from "../components/skills/ManagedSkillsToolbar";
import type { ManagedSkillsFilterState } from "../components/skills/model";

const filters: ManagedSkillsFilterState = {
  search: "",
  statusFilter: "all",
  harnessFilter: "all",
  sortBy: "default",
  showBuiltIns: false,
};

describe("ManagedSkillsToolbar", () => {
  it("updates managed search and filter controls", () => {
    const onSearchChange = vi.fn();
    const onStatusFilterChange = vi.fn();
    const onHarnessFilterChange = vi.fn();
    const onSortByChange = vi.fn();
    const onShowBuiltInsChange = vi.fn();
    const onResetFilters = vi.fn();

    render(
      <ManagedSkillsToolbar
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

    fireEvent.change(screen.getByRole("textbox", { name: "Search managed skills" }), { target: { value: "trace" } });
    fireEvent.click(screen.getByRole("button", { name: "Needs action" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Managed tool filter" }), { target: { value: "codex" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Managed sort order" }), { target: { value: "name" } });
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
