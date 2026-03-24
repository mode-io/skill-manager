import { useState } from "react";
import { ScanLine, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useCatalog } from "../hooks/useCatalog";
import { useMutation } from "../hooks/useMutation";
import { SkillCard } from "../components/SkillCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import "../styles/setup.css";

export function SetupPage(): JSX.Element {
  const { catalog, harnesses, centralizeSkill, centralizeAll } = useCatalog();
  const centralize = useMutation(centralizeSkill);
  const batchCentralize = useMutation(async () => {
    const result = await centralizeAll();
    setSummary(`Centralized ${result.centralized} skill${result.centralized !== 1 ? "s" : ""}${result.skipped > 0 ? `, skipped ${result.skipped}` : ""}`);
  });
  const [summary, setSummary] = useState<string | null>(null);

  const unmanaged = catalog.filter((e) => e.ownership === "unmanaged");
  const eligible = unmanaged.filter((e) => e.conflicts.length === 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Setup</h1>
          <p className="subtitle">Scan harnesses and centralize unmanaged skills</p>
        </div>
        {eligible.length > 0 && (
          <button className="btn btn-primary" onClick={batchCentralize.execute} disabled={batchCentralize.loading}>
            {batchCentralize.loading ? <span className="spinner spinner-sm" /> : <ScanLine size={16} />}
            Centralize All ({eligible.length})
          </button>
        )}
      </div>

      {(centralize.error || batchCentralize.error) && (
        <ErrorBanner message={(centralize.error || batchCentralize.error)!} onDismiss={() => { centralize.clearError(); batchCentralize.clearError(); }} />
      )}

      {summary && (
        <div className="conflict-banner" style={{ borderColor: "rgba(34,197,94,0.4)" }}>
          <CheckCircle2 size={16} /> {summary}
        </div>
      )}

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header"><h2>Detected Harnesses</h2></div>
        <table className="data-table">
          <thead>
            <tr><th>Harness</th><th>Status</th><th>Discovery</th><th>Details</th></tr>
          </thead>
          <tbody>
            {harnesses.map((h) => (
              <tr key={h.harness}>
                <td style={{ fontWeight: 500 }}>{h.label}</td>
                <td>
                  {h.detected ? (
                    <span style={{ color: "var(--color-ok)", display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={16} /> Detected</span>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><XCircle size={16} /> Not detected</span>
                  )}
                </td>
                <td style={{ color: "var(--color-text-secondary)" }}>{h.detected ? h.discoveryMode : "\u2014"}</td>
                <td style={{ color: "var(--color-text-muted)", fontSize: 11, fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
                  {(h.detectionDetails.length > 0 || h.issues.length > 0)
                    ? [...h.detectionDetails, ...h.issues].map((d, i) => <div key={i}>{d}</div>)
                    : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Unmanaged Skills</h2>
        {unmanaged.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="All clear" description="No unmanaged skills found. All skills are centralized in the shared store." />
        ) : (
          <div className="skill-grid">
            {unmanaged.map((entry) => (
              <div key={entry.skillRef}>
                {entry.conflicts.length > 0 && (
                  <div className="conflict-banner"><AlertTriangle size={14} /> Conflicting revisions — resolve before centralizing</div>
                )}
                <SkillCard entry={entry} harnesses={harnesses} onToggle={async () => {}} onCentralize={centralize.execute} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
