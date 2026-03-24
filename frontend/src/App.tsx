import { useCallback, useEffect, useState } from "react";

import { centralizeSkill, fetchControlPlaneSummary, installSkill, searchSources, toggleBinding, updateSkill } from "./api/client";
import type { CatalogEntrySummary, CheckIssue, ControlPlaneSummary, HarnessSummary, SkillListing } from "./api/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | ({ kind: "ready" } & ControlPlaneSummary);

function renderIssueList(items: CheckIssue[]): JSX.Element {
  if (items.length === 0) {
    return <p className="subtle">No issues reported.</p>;
  }
  return (
    <ul className="issue-list">
      {items.map((issue) => (
        <li key={`${issue.code}:${issue.message}`}>
          <span>{issue.message}</span>
          <strong className={`status-${issue.severity}`}>{issue.severity}</strong>
        </li>
      ))}
    </ul>
  );
}

function CatalogTable({
  entries,
  allHarnesses,
  mutating,
  onToggle,
  onCentralize,
  onUpdate,
}: {
  entries: CatalogEntrySummary[];
  allHarnesses: HarnessSummary[];
  mutating: string | null;
  onToggle: (entry: CatalogEntrySummary, action: "enable" | "disable", harness: string) => void;
  onCentralize: (entry: CatalogEntrySummary) => void;
  onUpdate: (entry: CatalogEntrySummary) => void;
}): JSX.Element {
  const manageable = allHarnesses.filter((h) => h.detected && h.manageable);

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Ownership</th>
          <th>Source</th>
          <th>Bindings</th>
          <th>Conflicts</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const boundSet = new Set(entry.harnesses.map((b) => b.harness));
          const canEnable = entry.ownership === "shared" ? manageable.filter((h) => !boundSet.has(h.harness)) : [];
          const canDisable = entry.ownership === "shared" ? manageable.filter((h) => boundSet.has(h.harness)) : [];

          return (
            <tr key={entry.skillRef}>
              <td>
                <strong>{entry.declaredName}</strong>
              </td>
              <td>{entry.ownership}</td>
              <td>{entry.sourceKind}</td>
              <td>
                {entry.harnesses.map((binding) => binding.label).join(", ") ||
                  entry.builtinHarnesses.join(", ") ||
                  (entry.ownership === "shared" ? "Shared only" : "\u2014")}
              </td>
              <td>{entry.conflicts.length}</td>
              <td className="actions-cell">
                {canEnable.map((h) => {
                  const key = `${entry.skillRef}:enable:${h.harness}`;
                  return (
                    <button
                      key={key}
                      className="action-btn enable-btn"
                      disabled={mutating !== null}
                      onClick={() => onToggle(entry, "enable", h.harness)}
                    >
                      {mutating === key ? "..." : `+ ${h.label}`}
                    </button>
                  );
                })}
                {canDisable.map((h) => {
                  const key = `${entry.skillRef}:disable:${h.harness}`;
                  return (
                    <button
                      key={key}
                      className="action-btn disable-btn"
                      disabled={mutating !== null}
                      onClick={() => onToggle(entry, "disable", h.harness)}
                    >
                      {mutating === key ? "..." : `\u2212 ${h.label}`}
                    </button>
                  );
                })}
                {entry.ownership === "unmanaged" && entry.conflicts.length === 0 && (
                  <button
                    className="action-btn centralize-btn"
                    disabled={mutating !== null}
                    onClick={() => onCentralize(entry)}
                  >
                    {mutating === `${entry.skillRef}:centralize` ? "..." : "Centralize"}
                  </button>
                )}
                {entry.ownership === "shared" && entry.sourceKind !== "shared-store" && entry.sourceKind !== "centralized" && (
                  <button
                    className="action-btn update-btn"
                    disabled={mutating !== null}
                    onClick={() => onUpdate(entry)}
                  >
                    {mutating === `${entry.skillRef}:update` ? "..." : "Update"}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function App(): JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [mutating, setMutating] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchControlPlaneSummary()
      .then((nextState) => setState({ kind: "ready", ...nextState }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "unknown error";
        setState({ kind: "error", message });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = useCallback(
    (entry: CatalogEntrySummary, action: "enable" | "disable", harness: string) => {
      const key = `${entry.skillRef}:${action}:${harness}`;
      setMutating(key);
      toggleBinding(entry.skillRef, action, harness)
        .then(() => load())
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "mutation failed";
          alert(message);
        })
        .finally(() => setMutating(null));
    },
    [load],
  );

  const handleCentralize = useCallback(
    (entry: CatalogEntrySummary) => {
      setMutating(`${entry.skillRef}:centralize`);
      centralizeSkill(entry.skillRef)
        .then(() => load())
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "centralize failed";
          alert(message);
        })
        .finally(() => setMutating(null));
    },
    [load],
  );

  const handleUpdate = useCallback(
    (entry: CatalogEntrySummary) => {
      setMutating(`${entry.skillRef}:update`);
      updateSkill(entry.skillRef)
        .then(() => load())
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "update failed";
          alert(message);
        })
        .finally(() => setMutating(null));
    },
    [load],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SkillListing[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    searchSources(searchQuery.trim())
      .then(setSearchResults)
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [searchQuery]);

  const handleInstall = useCallback(
    (listing: SkillListing) => {
      setMutating(`install:${listing.sourceLocator}`);
      installSkill(listing.sourceKind, listing.sourceLocator)
        .then(() => {
          load();
          setSearchResults((prev) => prev.filter((r) => r.sourceLocator !== listing.sourceLocator));
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "install failed";
          alert(message);
        })
        .finally(() => setMutating(null));
    },
    [load],
  );

  if (state.kind === "loading") {
    return (
      <main className="page-shell">
        <section className="hero">
          <p className="eyebrow">Bootstrap Status</p>
          <h1>Skill Manager Control Plane</h1>
          <p className="subtle">Loading read-only control-plane state.</p>
        </section>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="page-shell">
        <section className="hero">
          <p className="eyebrow">Bootstrap Status</p>
          <h1>Skill Manager Control Plane</h1>
          <div className="panel error-panel">
            <h2>Unable to load control plane</h2>
            <p>{state.message}</p>
          </div>
        </section>
      </main>
    );
  }

  const detectedHarnesses = state.harnesses.filter((item) => item.detected).length;
  const conflictingEntries = state.catalog.filter((entry) => entry.conflicts.length > 0).length;

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Control Plane</p>
          <h1>Skill Manager Control Plane</h1>
          <p className="subtle">
            Unified visibility and management across local harnesses, shared packages, and builtin skills.
          </p>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-label">Detected Harnesses</span>
            <strong>{detectedHarnesses}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Catalog Entries</span>
            <strong>{state.catalog.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Conflicted Entries</span>
            <strong>{conflictingEntries}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Check Status</span>
            <strong className={`status-${state.check.status}`}>{state.check.status}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Harnesses</h2>
          <span className="mono">{state.harnesses.length} configured</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Harness</th>
              <th>Discovery</th>
              <th>Signals</th>
            </tr>
          </thead>
          <tbody>
            {state.harnesses.map((harness) => (
              <tr key={harness.harness}>
                <td>
                  <strong>{harness.label}</strong>
                </td>
                <td>{harness.detected ? harness.discoveryMode : "not detected"}</td>
                <td>{harness.detectionDetails.join(" · ") || harness.issues.join(" · ") || "No signals"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Catalog</h2>
          <span className="mono">GET /catalog</span>
        </div>
        {state.catalog.length === 0 ? (
          <div className="empty-state">
            <p>No skills discovered in the current fake-home environment.</p>
          </div>
        ) : (
          <CatalogTable
            entries={state.catalog}
            allHarnesses={state.harnesses}
            mutating={mutating}
            onToggle={handleToggle}
            onCentralize={handleCentralize}
            onUpdate={handleUpdate}
          />
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Install from Source</h2>
          <span className="mono">skills.sh + agentskill.sh</span>
        </div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="action-btn enable-btn" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
            {searching ? "..." : "Search"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Source</th>
                <th>Registry</th>
                <th>Installs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((listing) => (
                <tr key={listing.sourceLocator}>
                  <td>
                    <strong>{listing.name}</strong>
                    {listing.description && <p className="subtle">{listing.description}</p>}
                  </td>
                  <td className="mono">{listing.sourceKind}</td>
                  <td>{listing.registry}</td>
                  <td>{listing.installs > 0 ? listing.installs.toLocaleString() : "\u2014"}</td>
                  <td>
                    <button
                      className="action-btn enable-btn"
                      disabled={mutating !== null}
                      onClick={() => handleInstall(listing)}
                    >
                      {mutating === `install:${listing.sourceLocator}` ? "..." : "Install"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Checks</h2>
          <strong className={`status-${state.check.status}`}>{state.check.status}</strong>
        </div>
        <div className="check-grid">
          <div>
            <h3>Errors</h3>
            {renderIssueList(state.check.issues)}
          </div>
          <div>
            <h3>Warnings</h3>
            {renderIssueList(state.check.warnings)}
          </div>
        </div>
      </section>
    </main>
  );
}
