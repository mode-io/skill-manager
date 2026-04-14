import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MarketplaceItemDto } from "../api/types";
import { MarketplaceCard } from "./MarketplaceCard";

const baseItem: MarketplaceItemDto = {
  id: "skillssh:mode-io/skills:mode-switch",
  name: "Mode Switch",
  description: "Switch between supported skill execution modes.",
  installs: 128,
  stars: 512,
  repoLabel: "mode-io/skills",
  repoUrl: "https://github.com/mode-io/skills",
  repoImageUrl: "https://avatars.githubusercontent.com/u/424242?v=4",
  skillsDetailUrl: "https://skills.sh/mode-io/skills/mode-switch",
  installToken: "token-mode-switch",
  installation: {
    status: "installable",
    installedSkillRef: null,
  },
};

describe("MarketplaceCard", () => {
  it("renders repo identity, installs, and stars", () => {
    render(
      <MarketplaceCard
        item={baseItem}
        selected={false}
        installing={false}
        onOpenDetail={() => {}}
        onInstall={() => {}}
        onOpenInstalledSkill={() => {}}
      />,
    );

    expect(screen.getByAltText("Avatar for mode-io/skills")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "mode-io/skills" })).toHaveAttribute("href", baseItem.repoUrl);
    expect(screen.getByText("512")).toBeInTheDocument();
    expect(screen.getByText("128 installs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on skills.sh" })).toHaveAttribute("href", baseItem.skillsDetailUrl);
  });

  it("opens marketplace detail from the preview surface", () => {
    const onOpenDetail = vi.fn();

    render(
      <MarketplaceCard
        item={baseItem}
        selected={false}
        installing={false}
        onOpenDetail={onOpenDetail}
        onInstall={() => {}}
        onOpenInstalledSkill={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /open marketplace detail for mode switch/i }));

    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });

  it("always keeps the repo and skills.sh links stable", () => {
    render(
      <MarketplaceCard
        item={baseItem}
        selected={false}
        installing={false}
        onOpenDetail={() => {}}
        onInstall={() => {}}
        onOpenInstalledSkill={() => {}}
      />,
    );

    expect(screen.getByRole("link", { name: "mode-io/skills" })).toHaveAttribute("href", baseItem.repoUrl);
    expect(screen.getByRole("link", { name: "View on skills.sh" })).toHaveAttribute("href", baseItem.skillsDetailUrl);
  });

  it("switches the action to Open in Skills when the item is already installed", () => {
    const onOpenInstalledSkill = vi.fn();

    render(
      <MarketplaceCard
        item={{
          ...baseItem,
          installation: {
            status: "installed",
            installedSkillRef: "shared:mode-switch",
          },
        }}
        selected={false}
        installing={false}
        onOpenDetail={() => {}}
        onInstall={() => {}}
        onOpenInstalledSkill={onOpenInstalledSkill}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open in Skills" }));

    expect(onOpenInstalledSkill).toHaveBeenCalledWith("shared:mode-switch");
  });
});
