import { Activity, CheckCircle2, AlertTriangle, XOctagon } from "lucide-react";
import { useCatalog } from "../hooks/useCatalog";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import "../styles/health.css";

export function HealthPage(): JSX.Element {
  const { harnesses, catalog, check } = useCatalog();

  const detected = harnesses.filter((h) => h.detected).length;
  const shared = catalog.filter((e) => e.ownership === "shared").length;
  const conflicts = catalog.filter((e) => e.conflicts.length > 0).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Health</h1>
          <p className="subtitle">System status and integrity checks</p>
        </div>
        <StatusBadge variant={check.status} label={check.status.toUpperCase()} />
      </div>

      <div className="stat-grid">
        <StatCard label="Detected Harnesses" value={`${detected} / ${harnesses.length}`} />
        <StatCard label="Shared Skills" value={shared} />
        <StatCard label="Conflicts" value={conflicts} status={conflicts > 0 ? "warning" : "ok"} />
        <StatCard label="Errors" value={check.counts.errors ?? 0} status={(check.counts.errors ?? 0) > 0 ? "error" : "ok"} />
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header"><h2>Harness Summary</h2></div>
        <table className="data-table">
          <thead>
            <tr><th>Harness</th><th>Status</th><th>Discovery</th><th>Skills</th><th>Issues</th></tr>
          </thead>
          <tbody>
            {harnesses.map((h) => {
              const skillCount = catalog.filter((e) => e.harnesses.some((b) => b.harness === h.harness)).length;
              return (
                <tr key={h.harness}>
                  <td style={{ fontWeight: 600 }}>{h.label}</td>
                  <td>{h.detected ? <CheckCircle2 size={16} style={{ color: "var(--color-ok)" }} /> : <XOctagon size={16} style={{ color: "var(--color-text-muted)" }} />}</td>
                  <td style={{ color: "var(--color-text-secondary)" }}>{h.detected ? h.discoveryMode : "\u2014"}</td>
                  <td>{skillCount}</td>
                  <td style={{ color: "var(--color-text-muted)", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h.issues.join(", ")}>{h.issues.join(", ") || "\u2014"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {check.issues.length > 0 && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header"><h2>Errors</h2></div>
          {check.issues.map((issue) => (
            <div key={`${issue.code}:${issue.message}`} className="error-banner" style={{ marginBottom: 8 }}>
              <XOctagon size={16} /> {issue.message}
            </div>
          ))}
        </section>
      )}

      {check.warnings.length > 0 && (
        <section className="panel">
          <div className="panel-header"><h2>Warnings</h2></div>
          {check.warnings.map((issue) => (
            <div key={`${issue.code}:${issue.message}`} className="conflict-banner" style={{ marginBottom: 8, maxHeight: 60, overflow: "hidden", fontSize: 12, lineHeight: 1.5 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{issue.message}</span>
            </div>
          ))}
        </section>
      )}

      {check.issues.length === 0 && check.warnings.length === 0 && (
        <section className="panel">
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <CheckCircle2 style={{ color: "var(--color-ok)", width: 32, height: 32, marginBottom: 8 }} />
            <h3>All clear</h3>
            <p>No integrity issues detected.</p>
          </div>
        </section>
      )}
    </>
  );
}
