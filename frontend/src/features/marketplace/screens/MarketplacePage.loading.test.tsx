import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useMarketplaceController } from "../model/use-marketplace-controller";
import { MarketplacePage } from "./MarketplacePage";

vi.mock("../model/use-marketplace-controller", () => ({
  useMarketplaceController: vi.fn(),
}));

const useMarketplaceControllerMock = vi.mocked(useMarketplaceController);

describe("MarketplacePage loading ownership", () => {
  it("keeps the search button idle during generic feed refetches", () => {
    useMarketplaceControllerMock.mockReturnValue({
      query: "",
      submittedQuery: "",
      errorMessage: "",
      selectedItemId: null,
      selectedItem: null,
      items: [
        {
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
          installation: {
            status: "installable",
            installedSkillRef: null,
          },
        },
      ],
      feedQuery: {
        isFetching: true,
        fetchNextPage: vi.fn(async () => undefined),
        refetch: vi.fn(async () => undefined),
      },
      mode: "popular",
      status: "ready",
      hasMore: false,
      loadingMore: false,
      searchSubmitPending: false,
      resultLabel: "All-time leaderboard",
      setQuery: vi.fn(),
      submitSearch: vi.fn(async () => undefined),
      openItem: vi.fn(),
      closeItem: vi.fn(),
      installItem: vi.fn(async () => undefined),
      isInstallPending: vi.fn(() => false),
      openInstalledSkill: vi.fn(),
      dismissError: vi.fn(),
      hasLoadingSummaries: false,
    } as unknown as ReturnType<typeof useMarketplaceController>);

    render(
      <MemoryRouter initialEntries={["/marketplace"]}>
        <MarketplacePage />
      </MemoryRouter>,
    );

    const searchButton = screen.getByRole("button", { name: "Search" });
    expect(searchButton).not.toBeDisabled();
    expect(searchButton).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByRole("status", { name: "Searching marketplace" })).not.toBeInTheDocument();
  });
});
