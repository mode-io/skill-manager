import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MarketplaceItem } from "../api/types";
import { MarketplaceCard } from "../components/MarketplaceCard";

const item: MarketplaceItem = {
  id: "github:github:mode-io/skills/mode-switch",
  name: "Mode Switch",
  description: "Switch between supported skill execution modes.",
  sourceKind: "github",
  sourceLocator: "github:mode-io/skills/mode-switch",
  registry: "skillssh",
  installs: 128,
  badge: "Official",
  github: {
    repo: "mode-io/skills",
    url: "https://github.com/mode-io/skills",
    ownerLogin: "mode-io",
    avatarPath: "/marketplace/avatar?repo=mode-io%2Fskills",
    stars: 512,
  },
};

describe("MarketplaceCard", () => {
  it("renders the avatar image and repo identity in the header", () => {
    render(<MarketplaceCard item={item} disabled={false} installing={false} onInstall={() => {}} />);

    expect(screen.getByAltText("Avatar for mode-io")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "mode-io/skills" })).toBeInTheDocument();
    expect(screen.getByText("512")).toBeInTheDocument();
    expect(screen.queryByText("Repository")).not.toBeInTheDocument();
  });

  it("falls back to initials when the avatar image fails", () => {
    render(<MarketplaceCard item={item} disabled={false} installing={false} onInstall={() => {}} />);

    fireEvent.error(screen.getByAltText("Avatar for mode-io"));

    expect(screen.getByText("MO")).toBeInTheDocument();
  });
});
