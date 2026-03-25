import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MarketplaceItem } from "../api/types";
import { MarketplaceCard } from "../components/MarketplaceCard";

const item: MarketplaceItem = {
  id: "github:github:mode-io/skills/mode-switch",
  name: "Mode Switch",
  description: "Switch between supported skill execution modes.",
  descriptionStatus: "resolved",
  sourceKind: "github",
  sourceLocator: "github:mode-io/skills/mode-switch",
  registry: "skillssh",
  github: {
    repo: "mode-io/skills",
    url: "https://github.com/mode-io/skills",
    ownerLogin: "mode-io",
    avatarPath: "/marketplace/avatar?repo=mode-io%2Fskills",
    stars: 512,
  },
};

describe("MarketplaceCard", () => {
  it("renders the avatar image, repo identity, and title-adjacent star signal", () => {
    render(<MarketplaceCard item={item} disabled={false} installing={false} onInstall={() => {}} />);

    expect(screen.getByAltText("Avatar for mode-io")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "mode-io/skills" })).toBeInTheDocument();
    expect(screen.getByText("512")).toBeInTheDocument();
    expect(screen.queryByText("Official")).not.toBeInTheDocument();
    expect(screen.queryByText(/installs/i)).not.toBeInTheDocument();
  });

  it("falls back to initials when the avatar image fails", () => {
    render(<MarketplaceCard item={item} disabled={false} installing={false} onInstall={() => {}} />);

    fireEvent.error(screen.getByAltText("Avatar for mode-io"));

    expect(screen.getByText("MO")).toBeInTheDocument();
  });

  it("shows a softer unavailable-description state instead of the old hard fallback copy", () => {
    render(
      <MarketplaceCard
        item={{ ...item, description: null, descriptionStatus: "unavailable" }}
        disabled={false}
        installing={false}
        onInstall={() => {}}
      />,
    );

    expect(screen.getByText("Description unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("No description provided.")).not.toBeInTheDocument();
  });
});
