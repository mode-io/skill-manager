import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillsPaneChrome } from "../components/skills/SkillsPaneChrome";

describe("SkillsPaneChrome", () => {
  it("updates search and shows a trailing reset action only when active", () => {
    const onSearchChange = vi.fn();
    const onReset = vi.fn();

    const { rerender } = render(
      <SkillsPaneChrome
        title="Managed skills"
        searchValue=""
        hasActiveFilters={false}
        onSearchChange={onSearchChange}
        onReset={onReset}
        searchLabel="Managed skills filters"
        searchInputLabel="Search managed skills"
        searchPlaceholder="Search managed skills by name, description, or state"
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search managed skills" }), {
      target: { value: "trace" },
    });

    expect(onSearchChange).toHaveBeenCalledWith("trace");
    expect(screen.queryByRole("button", { name: /Reset/i })).not.toBeInTheDocument();

    rerender(
      <SkillsPaneChrome
        title="Managed skills"
        searchValue="trace"
        hasActiveFilters={true}
        onSearchChange={onSearchChange}
        onReset={onReset}
        searchLabel="Managed skills filters"
        searchInputLabel="Search managed skills"
        searchPlaceholder="Search managed skills by name, description, or state"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Reset/i }));

    expect(onReset).toHaveBeenCalled();
  });

  it("renders optional header actions beside the title", () => {
    render(
      <SkillsPaneChrome
        title="Unmanaged skills"
        actions={
          <>
            <button type="button">Bring all eligible skills under management</button>
            <button type="button">What happens?</button>
          </>
        }
        searchValue=""
        hasActiveFilters={false}
        onSearchChange={() => {}}
        onReset={() => {}}
        searchLabel="Unmanaged skills filters"
        searchInputLabel="Search unmanaged skills"
        searchPlaceholder="Search unmanaged skills by name, description, or tool"
      />,
    );

    expect(screen.getByRole("heading", { name: "Unmanaged skills" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bring all eligible skills under management" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What happens?" })).toBeInTheDocument();
  });
});
