import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { McpNeedsReviewDetailSheet } from "../components/detail/McpNeedsReviewDetailSheet";
import {
  McpConfigChoiceDialog,
  type McpConfigChoiceOption,
} from "../components/edit/McpConfigChoiceDialog";
import { McpNeedsReviewServerList } from "../components/McpNeedsReviewServerList";
import type { McpIdentityGroupDto } from "../api/management-types";
import { useMcpManagementController } from "../model/use-mcp-management-controller";

const DETAIL_PARAM = "server";

export default function McpNeedsReviewPage() {
  const {
    needsReviewByServer,
    isNeedsReviewByServerLoading,
    pendingAdoptKeys,
    actionErrorMessage,
    dismissActionError,
    handleAdoptConfig,
  } = useMcpManagementController();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedName = searchParams.get(DETAIL_PARAM);
  const [search, setSearch] = useState("");
  const [chooseConfigName, setChooseConfigName] = useState<string | null>(null);

  const groups = needsReviewByServer?.servers ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);
  const identicalCount = useMemo(() => filtered.filter((g) => g.identical).length, [filtered]);
  const totalServers = groups.length;
  const isReady = !isNeedsReviewByServerLoading && Boolean(needsReviewByServer);
  const isAdoptPending = useCallback(
    (name: string) =>
      pendingAdoptKeys.has(name) ||
      Array.from(pendingAdoptKeys).some((key) => key.startsWith(`${name}:`)),
    [pendingAdoptKeys],
  );

  const setDetailName = useCallback(
    (name: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (name) next.set(DETAIL_PARAM, name);
      else next.delete(DETAIL_PARAM);
      setSearchParams(next, { replace: !name });
    },
    [searchParams, setSearchParams],
  );

  const selectedGroup = useMemo(
    () => groups.find((g) => g.name === selectedName) ?? null,
    [groups, selectedName],
  );
  const chooseConfigGroup = useMemo(
    () => (chooseConfigName ? groups.find((g) => g.name === chooseConfigName) ?? null : null),
    [groups, chooseConfigName],
  );

  const onAdoptIdenticalServers = useCallback(async () => {
    for (const group of filtered.filter((g) => g.identical)) {
      await handleAdoptConfig(group.name);
    }
  }, [filtered, handleAdoptConfig]);

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="MCP configs to review"
          subtitle={
            totalServers > 0
              ? `${totalServers} unique server${totalServers === 1 ? "" : "s"} across your harness configs.`
              : "No local MCP config entries need review across your harnesses."
          }
          actions={
            identicalCount > 0 ? (
              <button
                type="button"
                className="action-pill action-pill--md action-pill--accent"
                onClick={() => {
                  void onAdoptIdenticalServers();
                }}
              >
                Adopt identical servers ({identicalCount})
              </button>
            ) : null
          }
        />
        {totalServers > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by server name..."
            searchLabel="Search MCP configs to review"
          />
        ) : null}
      </div>

      {actionErrorMessage ? (
        <ErrorBanner message={actionErrorMessage} onDismiss={dismissActionError} />
      ) : null}

      {isNeedsReviewByServerLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label="Loading MCP configs to review" />
        </div>
      ) : isReady ? (
        filtered.length > 0 ? (
          <McpNeedsReviewServerList
            groups={filtered}
            pendingNames={pendingAdoptKeys}
            onOpenDetail={setDetailName}
            onAdoptIdentical={(name) => void handleAdoptConfig(name)}
            onChooseConfigToAdopt={setChooseConfigName}
          />
        ) : totalServers > 0 ? (
          <div className="empty-panel">
            <h3 className="empty-panel__title">No matches</h3>
            <p className="empty-panel__body">Clear the search to see all MCP configs that need review.</p>
            <div className="empty-panel__actions">
              <button
                type="button"
                className="action-pill action-pill--md"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-panel">
            <h3 className="empty-panel__title">No local MCP configs need review</h3>
            <p className="empty-panel__body">
              Your harness configs only reference MCP servers that skill-manager already tracks. Install a new server
              from the marketplace to add more.
            </p>
            <div className="empty-panel__actions">
              <Link
                to="/marketplace/mcp"
                className="action-pill action-pill--md action-pill--accent"
              >
                Open Marketplace
              </Link>
            </div>
          </div>
        )
      ) : null}

      <McpNeedsReviewDetailSheet
        name={selectedName}
        group={selectedGroup}
        isLoading={isNeedsReviewByServerLoading && !selectedGroup}
        errorMessage=""
        pending={selectedName !== null && pendingAdoptKeys.has(selectedName)}
        onClose={() => setDetailName(null)}
        onAdopt={() => {
          if (selectedName) {
            void handleAdoptConfig(selectedName).then(() => setDetailName(null));
          }
        }}
        onChooseConfigToAdopt={() => {
          if (selectedName) {
            setDetailName(null);
            setChooseConfigName(selectedName);
          }
        }}
      />

      {chooseConfigGroup ? (
        <McpConfigChoiceDialog
          open
          mode="adopt"
          serverName={chooseConfigGroup.name}
          options={optionsForGroup(chooseConfigGroup)}
          pending={isAdoptPending(chooseConfigGroup.name)}
          onClose={() => setChooseConfigName(null)}
          onConfirm={async (option) => {
            await handleAdoptConfig(chooseConfigGroup.name, {
              sourceHarness: option.sourceHarness,
              harnesses: chooseConfigGroup.sightings.map((sighting) => sighting.harness),
            });
            setChooseConfigName(null);
          }}
        />
      ) : null}
    </>
  );
}

function optionsForGroup(group: McpIdentityGroupDto): McpConfigChoiceOption[] {
  return group.sightings.map((sighting) => ({
    id: sighting.harness,
    sourceKind: "harness",
    sourceHarness: sighting.harness,
    label: sighting.label,
    logoKey: sighting.logoKey,
    configPath: sighting.configPath,
    payloadPreview: sighting.payloadPreview,
    spec: sighting.spec,
    env: sighting.env ?? [],
  }));
}
