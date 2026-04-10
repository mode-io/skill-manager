import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillDetailSkeleton } from "./SkillDetailSkeleton";

describe("SkillDetailSkeleton", () => {
  it("renders the shared detail header shell while loading", () => {
    render(<SkillDetailSkeleton onClose={vi.fn()} />);

    expect(document.querySelector(".skill-detail__header-top")).not.toBeNull();
    expect(document.querySelector(".skill-detail__utility-rail")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close skill details" })).toHaveClass("skill-detail__close-button");
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });
});
