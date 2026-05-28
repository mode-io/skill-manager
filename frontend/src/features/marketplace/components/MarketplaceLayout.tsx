import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  NavLink,
  useLocation,
  useSearchParams,
} from "react-router-dom";

import { FilterBar } from "../../../components/FilterBar";
import { PageHeader } from "../../../components/PageHeader";
import RouteLoadingPanel from "../../../components/RouteLoadingPanel";
import { useMarketplaceCopy, type MarketplaceCopy } from "../i18n";
import { marketplaceRoutes } from "../public";
import { InstallingProvider } from "../model/installing-context";
import {
  LazyMarketplaceMcpPage,
  LazyMarketplacePage,
  LazyMarketplaceCliPage,
  prefetchMarketplaceCliFeed,
  prefetchMarketplaceCliPage,
  prefetchMarketplaceMcpFeed,
  prefetchMarketplaceMcpPage,
  prefetchMarketplacePage,
  prefetchMarketplacePopularFeed,
} from "../lazy";

type ActiveTab = "skills" | "mcp" | "clis";

interface MarketplaceTabDefinition {
  key: ActiveTab;
  label: string;
  to: string;
  searchPlaceholder: string;
  searchLabel: string;
  prefetchPage: () => void;
  prefetchFeed: typeof prefetchMarketplacePopularFeed;
}

export default function MarketplaceLayout() {
  const copy = useMarketplaceCopy();
  const [query, setQuery] = useState("");
  const [skillsCount, setSkillsCount] = useState<number | null>(null);
  const [mcpCount, setMcpCount] = useState<number | null>(null);
  const [cliCount, setCliCount] = useState<number | null>(null);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const activeTab: ActiveTab = location.pathname.endsWith("/mcp")
    ? "mcp"
    : location.pathname.endsWith("/clis")
      ? "clis"
      : "skills";
  const tabs = useMarketplaceTabs(copy);
  const activeTabDefinition = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const isCli = activeTab === "clis";

  const [hasVisitedSkills, setHasVisitedSkills] = useState(activeTab === "skills");
  const [hasVisitedMcp, setHasVisitedMcp] = useState(activeTab === "mcp");
  const [hasVisitedClis, setHasVisitedClis] = useState(activeTab === "clis");

  useEffect(() => {
    if (activeTab === "skills" && !hasVisitedSkills) setHasVisitedSkills(true);
    if (activeTab === "mcp" && !hasVisitedMcp) setHasVisitedMcp(true);
    if (activeTab === "clis" && !hasVisitedClis) setHasVisitedClis(true);
  }, [activeTab, hasVisitedSkills, hasVisitedMcp, hasVisitedClis]);

  // Clear any stale `?item=` when the tab changes — each pane's detail modal
  // only recognises ids of its own format, so leaving a foreign id in the URL
  // would just render an "unable to load" state in the hidden pane.
  const previousTabRef = usePrevious(activeTab);
  useEffect(() => {
    if (previousTabRef && previousTabRef !== activeTab && searchParams.has("item")) {
      const next = new URLSearchParams(searchParams);
      next.delete("item");
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, previousTabRef, searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.has("filter")) {
      const next = new URLSearchParams(searchParams);
      next.delete("filter");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const prefetchTab = useCallback(
    (tab: MarketplaceTabDefinition) => {
      tab.prefetchPage();
      tab.prefetchFeed(queryClient);
    },
    [queryClient],
  );

  const pageProps = useMemo(
    () => ({
      query,
      onQueryChange: setQuery,
    }),
    [query],
  );

  return (
    <InstallingProvider>
      <div className="page-chrome">
        <PageHeader
          title={copy.title}
          actions={isCli ? (
            <p className="marketplace-preview-note">
              {copy.previewOnlyNote}
            </p>
          ) : undefined}
        />

        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder={activeTabDefinition.searchPlaceholder}
          searchLabel={activeTabDefinition.searchLabel}
          trailing={
            <>
              <div className="pill-group" role="group" aria-label={copy.typeAria}>
                {tabs.map((tab) => {
                  const count = tab.key === "skills" ? skillsCount : tab.key === "mcp" ? mcpCount : cliCount;
                  return (
                    <NavLink
                      key={tab.key}
                      to={tab.to}
                      end={tab.key === "skills"}
                      onMouseEnter={() => prefetchTab(tab)}
                      onFocus={() => prefetchTab(tab)}
                      className={({ isActive }) =>
                        `pill-group__pill${isActive ? " is-active" : ""}`
                      }
                    >
                      <span>{tab.label}</span>
                      {count != null && count > 0 ? (
                        <span className="pill-group__count">{count}</span>
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            </>
          }
        />
      </div>

      <div className="marketplace-panes">
        <div
          className="marketplace-pane"
          data-tab-state={activeTab === "skills" ? "visible" : "hidden"}
        >
          {hasVisitedSkills ? (
            <Suspense fallback={<RouteLoadingPanel label={copy.loading.marketplace} />}>
              <LazyMarketplacePage
                {...pageProps}
                isActive={activeTab === "skills"}
                onItemCountChange={setSkillsCount}
              />
            </Suspense>
          ) : null}
        </div>
        <div
          className="marketplace-pane"
          data-tab-state={activeTab === "mcp" ? "visible" : "hidden"}
        >
          {hasVisitedMcp ? (
            <Suspense fallback={<RouteLoadingPanel label={copy.loading.marketplace} />}>
              <LazyMarketplaceMcpPage
                {...pageProps}
                isActive={activeTab === "mcp"}
                onItemCountChange={setMcpCount}
              />
            </Suspense>
          ) : null}
        </div>
        <div
          className="marketplace-pane"
          data-tab-state={activeTab === "clis" ? "visible" : "hidden"}
        >
          {hasVisitedClis ? (
            <Suspense fallback={<RouteLoadingPanel label={copy.loading.marketplace} />}>
              <LazyMarketplaceCliPage
                {...pageProps}
                isActive={activeTab === "clis"}
                onItemCountChange={setCliCount}
              />
            </Suspense>
          ) : null}
        </div>
      </div>
    </InstallingProvider>
  );
}

function useMarketplaceTabs(copy: MarketplaceCopy): readonly MarketplaceTabDefinition[] {
  return useMemo(
    () => [
      {
        key: "skills",
        label: copy.tabs.skills,
        to: marketplaceRoutes.skills,
        searchPlaceholder: copy.search.skillsPlaceholder,
        searchLabel: copy.search.skillsLabel,
        prefetchPage: prefetchMarketplacePage,
        prefetchFeed: prefetchMarketplacePopularFeed,
      },
      {
        key: "mcp",
        label: copy.tabs.mcp,
        to: marketplaceRoutes.mcp,
        searchPlaceholder: copy.search.mcpPlaceholder,
        searchLabel: copy.search.mcpLabel,
        prefetchPage: prefetchMarketplaceMcpPage,
        prefetchFeed: prefetchMarketplaceMcpFeed,
      },
      {
        key: "clis",
        label: copy.tabs.clis,
        to: marketplaceRoutes.clis,
        searchPlaceholder: copy.search.cliPlaceholder,
        searchLabel: copy.search.cliLabel,
        prefetchPage: prefetchMarketplaceCliPage,
        prefetchFeed: prefetchMarketplaceCliFeed,
      },
    ],
    [copy],
  );
}

function usePrevious<T>(value: T): T | null {
  const [prev, setPrev] = useState<T | null>(null);
  useEffect(() => {
    setPrev(value);
  }, [value]);
  return prev;
}
