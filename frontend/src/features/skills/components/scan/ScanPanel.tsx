import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Cpu, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ScanResult, ScanFinding, LLMDetection } from "../../api/scan-types";
import { detectLLM } from "../../api/scan-client";
import { useSkillsCopy } from "../../i18n";

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "LOW"];

export interface ScanPanelLlmConfig {
  name: string;
  model: string;
  provider: string;
  baseUrl: string;
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className="scan-report__severity" data-severity={severity}>
      {severity}
    </span>
  );
}

function FindingRow({ finding, remediationLabel }: { finding: ScanFinding; remediationLabel: string }) {
  const [open, setOpen] = useState(false);
  const location = finding.filePath
    ? `${finding.filePath}${finding.lineNumber != null ? `:${finding.lineNumber}` : ""}`
    : null;

  return (
    <article className="scan-report-finding" data-open={open ? "true" : undefined}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="scan-report-finding__trigger"
      >
        <span className="scan-report-finding__chevron">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <SeverityBadge severity={finding.severity} />
        <span className="scan-report-finding__title">{finding.title}</span>
        {location ? (
          <span className="scan-report-finding__location">
            <FileText size={13} aria-hidden="true" />
            {location}
          </span>
        ) : null}
      </button>
      {open && (
        <div className="scan-report-finding__body">
          <div className="skill-detail__document-surface scan-report-finding__surface">
            <div className="skill-detail__markdown scan-report-finding__content">
              <p className="scan-report-finding__description">{finding.description}</p>
              {finding.remediation && (
                <p className="scan-report-finding__remediation">
                  <strong>{remediationLabel} </strong>{finding.remediation}
                </p>
              )}
              {finding.snippet && (
                <pre className="scan-report-finding__snippet">
                  {finding.snippet}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ScanPanel({
  result,
  llmConfig,
}: {
  result: ScanResult;
  llmConfig?: ScanPanelLlmConfig | null;
}) {
  const [llmDetection, setLlmDetection] = useState<LLMDetection | null>(null);
  const copy = useSkillsCopy().scan.result;

  useEffect(() => {
    if (llmConfig) {
      setLlmDetection(null);
      return;
    }
    detectLLM().then(setLlmDetection).catch(() => setLlmDetection(null));
  }, [llmConfig]);

  const grouped = useMemo(() => {
    return SEVERITY_ORDER.reduce<Record<string, ScanFinding[]>>((acc, sev) => {
      acc[sev] = result.findings.filter((f) => f.severity === sev);
      return acc;
    }, {});
  }, [result.findings]);
  const sortedFindings = useMemo(
    () => [...result.findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
    [result.findings],
  );
  const criticalCount = grouped.CRITICAL.length;
  const hasCriticalFindings = criticalCount > 0;
  const hasFindings = result.findingsCount > 0;
  const headline = hasCriticalFindings
    ? copy.serious
    : hasFindings
      ? copy.nonSerious
      : copy.noProblems;
  const findingsLabel = copy.findingsCount(result.findingsCount);

  return (
    <section className="scan-report" aria-label={copy.reportAria}>
      <header className="scan-report__hero" data-safe={hasCriticalFindings ? "false" : "true"}>
        <div className="scan-report__status-icon">
          {hasCriticalFindings ? <ShieldAlert size={26} aria-hidden="true" /> : <ShieldCheck size={26} aria-hidden="true" />}
        </div>
        <div className="scan-report__headline">
          <h3>{headline}</h3>
          <p>
            {result.skillName} - {result.durationSeconds.toFixed(1)}s - {findingsLabel}
          </p>
        </div>
      </header>

      {llmConfig ? (
        <div className="scan-report__llm">
          <div className="scan-report__llm-heading">
            <Cpu size={14} aria-hidden="true" />
            <span>{copy.llmModel}</span>
          </div>
          <div className="scan-report__llm-body">
            <div>{copy.configuredModel}: <strong>{llmConfig.model || copy.notConfigured}</strong> ({llmConfig.provider || copy.unknown})</div>
            <div>{copy.activeConfiguration}: {llmConfig.name || copy.unnamed} - {llmConfig.baseUrl || copy.noBaseUrl}</div>
          </div>
        </div>
      ) : llmDetection ? (
        <div className="scan-report__llm">
          <div className="scan-report__llm-heading">
            <Cpu size={14} aria-hidden="true" />
            <span>{copy.llmDetection}</span>
          </div>
          {llmDetection.hasAnyAvailable ? (
            <div className="scan-report__llm-body">
              <div>{copy.defaultModel}: <strong>{llmDetection.defaultModel || copy.notSpecified}</strong> ({llmDetection.defaultProvider || copy.unknown})</div>
              <div>
                {copy.availableProviders}: {llmDetection.providers.filter(p => p.isAvailable).map(p => `${p.provider}${p.model ? ` (${p.model})` : ""}`).join(", ") || copy.none}
              </div>
            </div>
          ) : (
            <div className="scan-report__llm-body scan-report__llm-body--error">
              {copy.noProviders}
            </div>
          )}
        </div>
      ) : null}

      <div className="scan-report__findings">
        {sortedFindings.map((f) => (
          <FindingRow key={f.id} finding={f} remediationLabel={copy.remediation} />
        ))}
      </div>
    </section>
  );
}

function severityRank(severity: string) {
  const rank = SEVERITY_ORDER.indexOf(severity);
  return rank === -1 ? SEVERITY_ORDER.length : rank;
}
