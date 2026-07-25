import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, X } from "lucide-react";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { McpNeedsReviewDetailSheet } from "../components/detail/McpNeedsReviewDetailSheet";
import {
  McpConfigChoiceDialog,
  type McpConfigChoiceOption,
} from "../components/edit/McpConfigChoiceDialog";
import { MatrixTable } from "../../../components/matrix";
import { McpNeedsReviewMatrixView } from "../components/McpNeedsReviewMatrixView";
import { useCommonCopy } from "../../../i18n";
import type { McpIdentityGroupDto } from "../api/management-types";
import { useMcpCopy } from "../i18n";
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
  const copy = useMcpCopy();
  const common = useCommonCopy();

  const groups = needsReviewByServer?.servers ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);
  const identicalCount = useMemo(() => filtered.filter((g) => g.identical).length, [filtered]);
  const totalServers = groups.length;
  const isReady = !isNeedsReviewByServerLoading && Boolean(needsReviewByServer);

  const [selectedNames, setSelectedNames] = useState<ReadonlySet<string>>(() => new Set());
  const [adoptingSelected, setAdoptingSelected] = useState(false);

  useEffect(() => {
    setSelectedNames((current) => {
      let changed = false;
      const next = new Set<string>();
      const adoptableNames = new Set(filtered.filter(g => g.identical).map(g => g.name));
      for (const name of current) {
        if (adoptableNames.has(name)) next.add(name);
        else changed = true;
      }
      return changed ? next : current;
    });
  }, [filtered]);

  const toggleSelected = (name: string) => {
    setSelectedNames((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const clearSelected = () => setSelectedNames(new Set());

  const handleAdoptSelected = async () => {
    const names = filtered.filter(g => selectedNames.has(g.name) && g.identical).map(g => g.name);
    if (names.length === 0) return;
    setAdoptingSelected(true);
    try {
      for (const name of names) {
        try {
          await handleAdoptConfig(name);
        } catch {
        }
      }
      setSelectedNames(new Set());
    } finally {
      setAdoptingSelected(false);
    }
  };

  const selectedCount = selectedNames.size;

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
          title={copy.review.title}
          subtitle={copy.review.subtitle(totalServers)}
          actions={
            identicalCount > 0 ? (
              <button
                type="button"
                className="action-pill action-pill--md action-pill--accent"
                onClick={() => {
                  void onAdoptIdenticalServers();
                }}
              >
                {copy.review.adoptIdentical(identicalCount)}
              </button>
            ) : null
          }
        />
        {totalServers > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={copy.review.searchPlaceholder}
            searchLabel={copy.review.searchLabel}
          />
        ) : null}
      </div>

      {actionErrorMessage ? (
        <ErrorBanner message={actionErrorMessage} onDismiss={dismissActionError} />
      ) : null}

      {isNeedsReviewByServerLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label={copy.review.loading} />
        </div>
      ) : isReady ? (
        filtered.length > 0 ? (
          <McpNeedsReviewMatrixView
            groups={filtered}
            harnesses={needsReviewByServer?.harnesses ?? []}
            pendingNames={pendingAdoptKeys}
            onOpenDetail={setDetailName}
            onAdoptIdentical={(name) => void handleAdoptConfig(name)}
            onChooseConfigToAdopt={setChooseConfigName}
            selectedNames={selectedNames}
            onToggleSelected={toggleSelected}
          />
        ) : totalServers > 0 ? (
          <div className="empty-panel">
            <h3 className="empty-panel__title">{common.status.noMatches}</h3>
            <p className="empty-panel__body">{copy.review.noMatchesBody}</p>
            <div className="empty-panel__actions">
              <button
                type="button"
                className="action-pill action-pill--md"
                onClick={() => setSearch("")}
              >
                {common.actions.clearSearch}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-panel">
            <h3 className="empty-panel__title">{copy.review.emptyTitle}</h3>
            <p className="empty-panel__body">
              {copy.review.emptyBody}
            </p>
            <div className="empty-panel__actions">
              <Link
                to="/marketplace/mcp"
                className="action-pill action-pill--md action-pill--accent"
              >
                {common.actions.openMarketplace}
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
              observedHarness: option.observedHarness,
              harnesses: chooseConfigGroup.sightings.map((sighting) => sighting.harness),
            });
            setChooseConfigName(null);
          }}
        />
      ) : null}

      {selectedCount > 0 ? (
        <div className="bulk-dock">
          <div className="bulk-dock__fade" />
          <div
            className="bulk-bar"
            data-state="open"
            role="toolbar"
            aria-label={common.bulk.ariaLabel}
          >
            <div className="bulk-bar__group">
              <span className="bulk-bar__count">{common.bulk.selected(selectedCount)}</span>
              <button
                type="button"
                className="bulk-bar__clear"
                onClick={clearSelected}
                disabled={adoptingSelected}
                aria-label={common.actions.clearSelection}
              >
                <X size={14} />
              </button>
            </div>

            <span className="bulk-bar__divider" aria-hidden="true" />

            <button
              type="button"
              className="bulk-bar__action"
              onClick={() => void handleAdoptSelected()}
              disabled={adoptingSelected}
            >
              {adoptingSelected ? (
                <LoadingSpinner size="sm" label={copy.review.adoptingSelected || "Adopting selected servers..."} />
              ) : (
                <Plus size={15} />
              )}
              {copy.review.adoptSelected || "Adopt selected"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function optionsForGroup(group: McpIdentityGroupDto): McpConfigChoiceOption[] {
  return group.sightings.map((sighting) => ({
    id: `harness:${sighting.harness}`,
    sourceKind: "harness",
    observedHarness: sighting.harness,
    label: sighting.label,
    logoKey: sighting.logoKey,
    configPath: sighting.configPath,
    payloadPreview: sighting.payloadPreview,
    spec: sighting.spec,
    env: sighting.env ?? [],
    recommended: sighting.recommended,
  }));
}
