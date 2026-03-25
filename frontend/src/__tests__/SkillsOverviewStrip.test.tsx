import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillsOverviewStrip } from "../components/skills/SkillsOverviewStrip";
import type { SkillsFilterState } from "../components/skills/model";

const filters: SkillsFilterState = {
  search: "",
  statusFilter: "all",
  harnessFilter: "all",
  sortBy: "default",
  showBuiltIns: false,
};

describe("SkillsOverviewStrip", () => {
  it("renders summary metrics and routes metric clicks", () => {
    const onSelectMetric = vi.fn();

    render(
      <SkillsOverviewStrip
        summary={{ managed: 2, foundLocally: 1, custom: 1, builtIn: 3, needsAction: 2 }}
        filters={filters}
        onSelectMetric={onSelectMetric}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Needs action/i }));
    fireEvent.click(screen.getByRole("button", { name: /Built-in/i }));

    expect(onSelectMetric).toHaveBeenNthCalledWith(1, "needsAction");
    expect(onSelectMetric).toHaveBeenNthCalledWith(2, "builtIn");
  });
});
