import { useEffect, useState } from "react";

import { fetchControlPlaneSummary } from "./api/client";
import type { CheckIssue, ControlPlaneSummary } from "./api/types";

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

export function App(): JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchControlPlaneSummary()
      .then((nextState) => {
        if (!cancelled) {
          setState({ kind: "ready", ...nextState });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "unknown error";
          setState({ kind: "error", message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          <p className="eyebrow">Read-Only Bootstrap</p>
          <h1>Skill Manager Control Plane</h1>
          <p className="subtle">
            Unified read-only visibility across local harnesses, shared packages, and builtin skills.
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Ownership</th>
                <th>Source</th>
                <th>Bindings</th>
                <th>Conflicts</th>
              </tr>
            </thead>
            <tbody>
              {state.catalog.map((entry) => (
                <tr key={entry.skillRef}>
                  <td>
                    <strong>{entry.declaredName}</strong>
                  </td>
                  <td>{entry.ownership}</td>
                  <td>{entry.sourceKind}</td>
                  <td>
                    {entry.harnesses.map((binding) => binding.label).join(", ") ||
                      entry.builtinHarnesses.join(", ") ||
                      "Shared only"}
                  </td>
                  <td>{entry.conflicts.length}</td>
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
