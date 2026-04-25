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
import { marketplaceRoutes } from "../public";
import type { McpMarketplaceFilter } from "../api/mcp-types";
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

const FILTER_OPTIONS: { value: McpMarketplaceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "remote", label: "Remote" },
  { value: "local", label: "Local" },
  { value: "verified", label: "Verified" },
];

function isFilterValue(value: string): value is McpMarketplaceFilter {
  return (["all", "remote", "local", "verified"] as const).includes(
    value as McpMarketplaceFilter,
  );
}

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

const MARKETPLACE_TABS: readonly MarketplaceTabDefinition[] = [
  {
    key: "skills",
    label: "Skills",
    to: marketplaceRoutes.skills,
    searchPlaceholder: "Search skills.sh by name or topic",
    searchLabel: "Search marketplace",
    prefetchPage: prefetchMarketplacePage,
    prefetchFeed: prefetchMarketplacePopularFeed,
  },
  {
    key: "mcp",
    label: "MCP",
    to: marketplaceRoutes.mcp,
    searchPlaceholder: "Search MCP servers",
    searchLabel: "Search MCP marketplace",
    prefetchPage: prefetchMarketplaceMcpPage,
    prefetchFeed: prefetchMarketplaceMcpFeed,
  },
  {
    key: "clis",
    label: "CLIs",
    to: marketplaceRoutes.clis,
    searchPlaceholder: "Search CLIs",
    searchLabel: "Search CLI marketplace",
    prefetchPage: prefetchMarketplaceCliPage,
    prefetchFeed: prefetchMarketplaceCliFeed,
  },
];

export default function MarketplaceLayout() {
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
  const activeTabDefinition = MARKETPLACE_TABS.find((tab) => tab.key === activeTab) ?? MARKETPLACE_TABS[0];
  const isMcp = activeTab === "mcp";
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

  const filterParam = searchParams.get("filter") ?? "all";
  const mcpFilter: McpMarketplaceFilter = isFilterValue(filterParam) ? filterParam : "all";

  const setMcpFilter = useCallback(
    (value: McpMarketplaceFilter) => {
      if (value === mcpFilter) return;
      const next = new URLSearchParams(searchParams);
      if (value === "all") {
        next.delete("filter");
      } else {
        next.set("filter", value);
      }
      setSearchParams(next, { replace: false });
    },
    [mcpFilter, searchParams, setSearchParams],
  );

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
          title="Marketplace"
          actions={isCli ? (
            <p className="marketplace-preview-note">
              Preview only · Skill Manager does not install or manage CLIs
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
              <div className="pill-group" role="group" aria-label="Marketplace type">
                {MARKETPLACE_TABS.map((tab) => {
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
              <div
                className="pill-group mcp-filter-group"
                data-state={isMcp ? "visible" : "hidden"}
                role="group"
                aria-label="Filter MCP servers"
                aria-hidden={!isMcp}
              >
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="pill-group__pill"
                    data-active={mcpFilter === option.value}
                    tabIndex={isMcp ? 0 : -1}
                    onClick={() => setMcpFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
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
            <Suspense fallback={<RouteLoadingPanel label="Loading marketplace" />}>
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
            <Suspense fallback={<RouteLoadingPanel label="Loading marketplace" />}>
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
            <Suspense fallback={<RouteLoadingPanel label="Loading marketplace" />}>
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

function usePrevious<T>(value: T): T | null {
  const [prev, setPrev] = useState<T | null>(null);
  useEffect(() => {
    setPrev(value);
  }, [value]);
  return prev;
}
