import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MarketplaceItem } from "../api/types";
import { MarketplaceCard } from "../components/MarketplaceCard";

const item: MarketplaceItem = {
  id: "skillssh:mode-io/skills:mode-switch",
  name: "Mode Switch",
  description: "Switch between supported skill execution modes.",
  installs: 128,
  stars: 512,
  repoLabel: "mode-io/skills",
  repoImageUrl: "https://avatars.githubusercontent.com/u/424242?v=4",
  githubFolderUrl: "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
  skillsDetailUrl: "https://skills.sh/mode-io/skills/mode-switch",
  installToken: "token-mode-switch",
};

describe("MarketplaceCard", () => {
  it("renders the repo avatar, repo link, installs, and stars", () => {
    render(<MarketplaceCard item={item} disabled={false} installing={false} onInstall={() => {}} />);

    expect(screen.getByAltText("Avatar for mode-io/skills")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "mode-io/skills" })).toHaveAttribute("href", item.githubFolderUrl);
    expect(screen.getByText("512")).toBeInTheDocument();
    expect(screen.getByText("128 installs")).toBeInTheDocument();
    expect(screen.queryByText("View on skills.sh")).not.toBeInTheDocument();
  });

  it("falls back to initials when the avatar image fails", () => {
    render(<MarketplaceCard item={item} disabled={false} installing={false} onInstall={() => {}} />);

    fireEvent.error(screen.getByAltText("Avatar for mode-io/skills"));

    expect(screen.getByText("MO")).toBeInTheDocument();
  });

  it("shows the skills.sh fallback link when an exact github folder url is not available", () => {
    render(
      <MarketplaceCard
        item={{ ...item, githubFolderUrl: null }}
        disabled={false}
        installing={false}
        onInstall={() => {}}
      />,
    );

    expect(screen.getByText("mode-io/skills")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on skills.sh" })).toHaveAttribute("href", item.skillsDetailUrl);
  });
});
