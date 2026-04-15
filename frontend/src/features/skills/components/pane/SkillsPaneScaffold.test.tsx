import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkillsPaneScaffold } from "./SkillsPaneScaffold";

describe("SkillsPaneScaffold", () => {
  it("renders fixed chrome and a dedicated list scroller when ready", () => {
    const scrollRef = createRef<HTMLDivElement>();

    const { container } = render(
      <SkillsPaneScaffold
        title="Managed skills"
        searchValue=""
        hasActiveFilters={false}
        onSearchChange={() => {}}
        onReset={() => {}}
        searchLabel="Managed skills filters"
        searchInputLabel="Search managed skills"
        searchPlaceholder="Search managed skills by name, description, or state"
        scrollRef={scrollRef}
        isReady={true}
        isInitialLoading={false}
        hasError={false}
        loadingLabel="Loading managed skills"
        errorMessage="Unable to load managed skills."
      >
        <div aria-label="Managed skills list">List body</div>
      </SkillsPaneScaffold>,
    );

    expect(screen.getByRole("heading", { name: "Managed skills" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Managed skills filters" })).toBeInTheDocument();
    expect(screen.getByLabelText("Managed skills list")).toBeInTheDocument();
    expect(container.querySelector(".skills-pane__scroll")).toBe(scrollRef.current);
  });

  it("renders loading and error states outside the ready pane content", () => {
    render(
      <SkillsPaneScaffold
        title="Unmanaged skills"
        searchValue=""
        hasActiveFilters={false}
        onSearchChange={() => {}}
        onReset={() => {}}
        searchLabel="Unmanaged skills filters"
        searchInputLabel="Search unmanaged skills"
        searchPlaceholder="Search unmanaged skills by name, description, or tool"
        scrollRef={createRef<HTMLDivElement>()}
        isReady={false}
        isInitialLoading={true}
        hasError={true}
        loadingLabel="Loading unmanaged skills"
        errorMessage="Unable to load unmanaged skills."
      >
        <div>Unused</div>
      </SkillsPaneScaffold>,
    );

    expect(screen.getByRole("status", { name: "Loading unmanaged skills" })).toBeInTheDocument();
    expect(screen.getByText("Unable to load unmanaged skills.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Unmanaged skills" })).not.toBeInTheDocument();
  });
});
