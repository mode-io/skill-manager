import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMarketplaceDetailQuery, useMarketplaceDocumentQuery } from "../api/queries";
import { createMarketplaceDetail } from "../test-fixtures";
import { MarketplaceDetailView } from "./MarketplaceDetailView";

vi.mock("../api/queries", () => ({
  useMarketplaceDetailQuery: vi.fn(),
  useMarketplaceDocumentQuery: vi.fn(),
}));

const useMarketplaceDetailQueryMock = vi.mocked(useMarketplaceDetailQuery);
const useMarketplaceDocumentQueryMock = vi.mocked(useMarketplaceDocumentQuery);

describe("MarketplaceDetailView", () => {
  it("shows the backend refresh error message when detail loading fails", () => {
    useMarketplaceDetailQueryMock.mockReturnValue({
      data: createMarketplaceDetail({
        description: "Mode Switch description",
      }),
      isPending: false,
      isFetching: false,
      error: new Error("Marketplace is temporarily unavailable. Check your network connection or reinstall skill-manager if the problem persists."),
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

    expect(screen.getByText("Marketplace is temporarily unavailable. Check your network connection or reinstall skill-manager if the problem persists.")).toBeInTheDocument();
    expect(screen.queryByText("Open Skill Folder")).not.toBeInTheDocument();
  });

  it("does not render a refresh spinner for background detail refetches", () => {
    useMarketplaceDetailQueryMock.mockReturnValue({
      data: createMarketplaceDetail({
        sourceLinks: {
          repoLabel: "mode-io/skills",
          repoUrl: "https://github.com/mode-io/skills",
          folderUrl: "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
          skillsDetailUrl: "https://skills.sh/mode-io/skills/mode-switch",
        },
      }),
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
