import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillCardFrame } from "./SkillCardFrame";

describe("SkillCardFrame", () => {
  it("renders the shared card shell with content and aside slots", () => {
    const onOpenSkill = vi.fn();

    render(
      <SkillCardFrame
        variant="unmanaged"
        selected={false}
        onOpenSkill={onOpenSkill}
        content={<div>Content</div>}
        aside={<div>Aside</div>}
      />,
    );

    const card = screen.getByText("Content").closest("article");
    expect(card).toHaveClass("skill-card", "skill-card--unmanaged");
    expect(card?.querySelector(".skill-card__content")).not.toBeNull();
    expect(card?.querySelector(".skill-card__aside")).not.toBeNull();

    fireEvent.click(card!);
    expect(onOpenSkill).toHaveBeenCalledTimes(1);
  });
});
