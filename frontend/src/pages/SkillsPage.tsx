import { useEffect, useMemo, useState } from "react";

import { disableSkill, enableSkill, fetchSkillsPage, manageAllSkills, manageSkill } from "../api/client";
import type { SkillStatus, SkillTableRow, SkillsPageData } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { SkillDetailDrawer } from "../components/SkillDetailDrawer";

interface SkillsPageProps {
  refreshToken: number;
  onDataChanged: () => void;
}

type SortOption = "needsAction" | "name";
type StatusFilter = "All" | SkillStatus;

export function SkillsPage({ refreshToken, onDataChanged }: SkillsPageProps): JSX.Element {
  const [data, setData] = useState<SkillsPageData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [harnessFilter, setHarnessFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("needsAction");
  const [showBuiltIns, setShowBuiltIns] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedSkillRef, setSelectedSkillRef] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    void fetchSkillsPage()
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setErrorMessage(error.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const visibleRows = useMemo(() => {
    if (!data) {
      return [];
    }
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = data.rows.filter((row) => {
      if (!showBuiltIns && row.displayStatus === "Built-in") {
        return false;
      }
      if (statusFilter !== "All" && row.displayStatus !== statusFilter) {
        return false;
      }
      if (harnessFilter !== "all") {
        const cell = row.cells.find((item) => item.harness === harnessFilter);
        if (!cell || cell.state === "empty") {
          return false;
        }
      }
      if (!normalizedSearch) {
        return true;
      }
      return (
        row.name.toLowerCase().includes(normalizedSearch)
        || row.description.toLowerCase().includes(normalizedSearch)
      );
    });

    filtered.sort((left, right) => {
      if (sortBy === "name") {
        return left.name.localeCompare(right.name);
      }
      return statusRank(left.displayStatus) - statusRank(right.displayStatus) || left.name.localeCompare(right.name);
    });
    return filtered;
  }, [data, harnessFilter, search, showBuiltIns, sortBy, statusFilter]);

  async function runAction(actionId: string, task: () => Promise<unknown>): Promise<void> {
    try {
      setBusyId(actionId);
      await task();
      onDataChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete the action.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <section className="page-panel">
        <div className="page-header">
          <div>
            <p className="page-header__eyebrow">Primary workspace</p>
            <h2>Skills</h2>
            <p className="page-header__copy">
              Manage one shared skill inventory, enable it per tool, and bring local copies under management.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busyId !== null || !data?.summary.foundLocally}
            onClick={() => void runAction("manage-all", manageAllSkills)}
          >
            {busyId === "manage-all" ? <LoadingSpinner size="sm" label="Managing all skills" /> : null}
            Bring all eligible skills under management
          </button>
        </div>

        {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} />}

        {data ? (
          <div className="stats-grid">
            <div className="stat-box">
              <span>Managed</span>
              <strong>{data.summary.managed}</strong>
            </div>
            <div className="stat-box">
              <span>Found locally</span>
              <strong>{data.summary.foundLocally}</strong>
            </div>
            <div className="stat-box">
              <span>Custom</span>
              <strong>{data.summary.custom}</strong>
            </div>
            <div className="stat-box">
              <span>Needs action</span>
              <strong>{data.summary.needsAction}</strong>
            </div>
          </div>
        ) : null}

        <div className="toolbar">
          <label className="field">
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter skills" />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="All">All</option>
              <option value="Managed">Managed</option>
              <option value="Found locally">Found locally</option>
              <option value="Custom">Custom</option>
              <option value="Built-in">Built-in</option>
            </select>
          </label>
          <label className="field">
            <span>Tool</span>
            <select value={harnessFilter} onChange={(event) => setHarnessFilter(event.target.value)}>
              <option value="all">All tools</option>
              {data?.harnessColumns.map((column) => (
                <option key={column.harness} value={column.harness}>{column.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
              <option value="needsAction">Needs action first</option>
              <option value="name">Name</option>
            </select>
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={showBuiltIns} onChange={(event) => setShowBuiltIns(event.target.checked)} />
            <span>Show built-in skills</span>
          </label>
        </div>

        {status === "loading" ? (
          <div className="panel-state">
            <LoadingSpinner label="Loading skills" />
          </div>
        ) : null}

        {status === "ready" && data ? (
          <div className="table-wrap">
            <table className="skills-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Status</th>
                  {data.harnessColumns.map((column) => (
                    <th key={column.harness}>{column.label}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              {visibleRows.map((row) => (
                <tbody key={row.skillRef} className="skill-row-group">
                  <tr>
                    <td>
                      <button type="button" className="skill-name-button" onClick={() => setSelectedSkillRef(row.skillRef)}>
                        {row.name}
                      </button>
                    </td>
                    <td>
                      <div className="status-block">
                        <strong>{row.displayStatus}</strong>
                        {row.attentionMessage ? <span>{row.attentionMessage}</span> : null}
                      </div>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={`${row.skillRef}:${cell.harness}`} className="table-cell-center">
                        {cell.interactive ? (
                          <button
                            type="button"
                            className={`toggle-button${cell.state === "enabled" ? " is-enabled" : ""}`}
                            disabled={busyId !== null}
                            onClick={() => void runAction(
                              `${row.skillRef}:${cell.harness}`,
                              () => cell.state === "enabled"
                                ? disableSkill(row.skillRef, cell.harness)
                                : enableSkill(row.skillRef, cell.harness),
                            )}
                          >
                            {busyId === `${row.skillRef}:${cell.harness}`
                              ? <LoadingSpinner size="sm" label={`Updating ${cell.label}`} />
                              : cell.state === "enabled" ? "On" : "Off"}
                          </button>
                        ) : (
                          <span className={`cell-indicator cell-indicator--${cell.state}`}>{cellLabel(cell.state)}</span>
                        )}
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId !== null}
                        onClick={() => row.primaryAction.kind === "manage"
                          ? void runAction(`manage:${row.skillRef}`, () => manageSkill(row.skillRef))
                          : setSelectedSkillRef(row.skillRef)}
                      >
                        {busyId === `manage:${row.skillRef}`
                          ? <LoadingSpinner size="sm" label={`Managing ${row.name}`} />
                          : row.primaryAction.label}
                      </button>
                    </td>
                  </tr>
                  <tr className="skills-table__description-row">
                    <td colSpan={data.harnessColumns.length + 3}>
                      {row.description || "No description provided."}
                    </td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="panel-state">
            <p>Unable to load the skills inventory.</p>
          </div>
        ) : null}
      </section>

      <SkillDetailDrawer
        skillRef={selectedSkillRef}
        refreshToken={refreshToken}
        onClose={() => setSelectedSkillRef(null)}
        onDataChanged={onDataChanged}
      />
    </>
  );
}

function cellLabel(state: string): string {
  switch (state) {
    case "found":
      return "Found";
    case "builtin":
      return "Built-in";
    default:
      return "—";
  }
}

function statusRank(status: SkillStatus): number {
  switch (status) {
    case "Custom":
      return 0;
    case "Found locally":
      return 1;
    case "Managed":
      return 2;
    case "Built-in":
      return 3;
    default:
      return 9;
  }
}
