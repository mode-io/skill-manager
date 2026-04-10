import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMarketplaceDetailQuery, useMarketplaceDocumentQuery } from "../api/queries";
import { MarketplaceDetailView } from "./MarketplaceDetailView";

vi.mock("../api/queries", () => ({
  useMarketplaceDetailQuery: vi.fn(),
  useMarketplaceDocumentQuery: vi.fn(),
}));

const useMarketplaceDetailQueryMock = vi.mocked(useMarketplaceDetailQuery);
const useMarketplaceDocumentQueryMock = vi.mocked(useMarketplaceDocumentQuery);

describe("MarketplaceDetailView", () => {
  it("does not render a refresh spinner for background detail refetches", () => {
    useMarketplaceDetailQueryMock.mockReturnValue({
      data: {
        id: "skillssh:mode-io/skills:mode-switch",
        name: "Mode Switch",
        description: "Switch between supported skill execution modes.",
        installs: 128,
        stars: 512,
        repoLabel: "mode-io/skills",
        repoImageUrl: "https://avatars.githubusercontent.com/u/424242?v=4",
        sourceLinks: {
          repoLabel: "mode-io/skills",
          repoUrl: "https://github.com/mode-io/skills",
          folderUrl: "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
          skillsDetailUrl: "https://skills.sh/mode-io/skills/mode-switch",
        },
        installation: {
          status: "installable",
          installedSkillRef: null,
        },
        installToken: "token-mode-switch",
      },
      isPending: false,
      isFetching: true,
      error: null,
    } as ReturnType<typeof useMarketplaceDetailQuery>);
    useMarketplaceDocumentQueryMock.mockReturnValue({
      data: {
        status: "ready",
        documentMarkdown: "# Mode Switch",
      },
      isPending: false,
    } as ReturnType<typeof useMarketplaceDocumentQuery>);

    render(
      <MarketplaceDetailView
        itemId="skillssh:mode-io/skills:mode-switch"
        initialItem={null}
        installPending={false}
        actionErrorMessage=""
        onDismissActionError={vi.fn()}
        onClose={vi.fn()}
        onInstall={vi.fn(async () => undefined)}
        onOpenInstalledSkill={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("heading", { name: "Mode Switch" })).not.toHaveLength(0);
    expect(screen.queryByLabelText("Refreshing preview")).not.toBeInTheDocument();
  });
});
