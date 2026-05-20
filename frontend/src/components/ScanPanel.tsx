import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Cpu, FileText, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ScanResult, ScanFinding, LLMDetection } from "../api/scan";
import { detectLLM } from "../api/scan";

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "LOW"];
const SERIOUS_REPORT_MESSAGE = "These are serious issues; please delete them immediately!";
const NON_SERIOUS_REPORT_MESSAGE = "These problems are not serious, you can use it with confidence.";

export interface ScanPanelLlmConfig {
  name: string;
  model: string;
  provider: string;
  baseUrl: string;
}

export interface ScanPanelCopy {
  securityReportLabel: string;
  seriousReportMessage: string;
  nonSeriousReportMessage: string;
  findingsCount: (count: number) => string;
  remediation: string;
  llmModel: string;
  configuredModel: string;
  activeConfiguration: string;
  notConfigured: string;
  unknown: string;
  unnamed: string;
  noBaseUrl: string;
  llmModelDetection: string;
  defaultModel: string;
  notSpecified: string;
  availableProviders: string;
  none: string;
  noAvailableProviders: string;
  severityLabel: (severity: string) => string;
}

const DEFAULT_COPY: ScanPanelCopy = {
  securityReportLabel: "Security report",
  seriousReportMessage: SERIOUS_REPORT_MESSAGE,
  nonSeriousReportMessage: NON_SERIOUS_REPORT_MESSAGE,
  findingsCount: (count) => `${count} ${count === 1 ? "Finding" : "Findings"}`,
  remediation: "Remediation",
  llmModel: "LLM model",
  configuredModel: "Configured model",
  activeConfiguration: "Active configuration",
  notConfigured: "Not configured",
  unknown: "unknown",
  unnamed: "Unnamed",
  noBaseUrl: "No base URL",
  llmModelDetection: "LLM model detection",
  defaultModel: "Default model",
  notSpecified: "Not specified",
  availableProviders: "Available providers",
  none: "None",
  noAvailableProviders:
    "No available LLM providers detected. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or another supported environment variable.",
  severityLabel: (severity) => severity,
};

function SeverityBadge({ severity, copy }: { severity: string; copy: ScanPanelCopy }) {
  return (
    <span className="scan-report__severity" data-severity={severity}>
      {copy.severityLabel(severity)}
    </span>
  );
}

function FindingRow({ finding, copy }: { finding: ScanFinding; copy: ScanPanelCopy }) {
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
        <SeverityBadge severity={finding.severity} copy={copy} />
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
                  <strong>{copy.remediation}: </strong>{finding.remediation}
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
  copy = DEFAULT_COPY,
}: {
  result: ScanResult;
  llmConfig?: ScanPanelLlmConfig | null;
  copy?: ScanPanelCopy;
}) {
  const [llmDetection, setLlmDetection] = useState<LLMDetection | null>(null);

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
  const findingsLabel = copy.findingsCount(result.findingsCount);

  return (
    <section className="scan-report" aria-label={copy.securityReportLabel}>
      <header className="scan-report__hero" data-safe={hasCriticalFindings ? "false" : "true"}>
        <div className="scan-report__status-icon">
          {hasCriticalFindings ? <ShieldAlert size={26} aria-hidden="true" /> : <ShieldCheck size={26} aria-hidden="true" />}
        </div>
        <div className="scan-report__headline">
          <h3>{hasCriticalFindings ? copy.seriousReportMessage : copy.nonSeriousReportMessage}</h3>
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
            <div>
              {copy.configuredModel}: <strong>{llmConfig.model || copy.notConfigured}</strong> ({llmConfig.provider || copy.unknown})
            </div>
            <div>{copy.activeConfiguration}: {llmConfig.name || copy.unnamed} - {llmConfig.baseUrl || copy.noBaseUrl}</div>
          </div>
        </div>
      ) : llmDetection ? (
        <div className="scan-report__llm">
          <div className="scan-report__llm-heading">
            <Cpu size={14} aria-hidden="true" />
            <span>{copy.llmModelDetection}</span>
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
              {copy.noAvailableProviders}
            </div>
          )}
        </div>
      ) : null}

      <div className="scan-report__findings">
        {sortedFindings.map((f) => (
          <FindingRow key={f.id} finding={f} copy={copy} />
        ))}
      </div>
    </section>
  );
}

export function ScanStatusIcon({
  result,
  onClick,
}: {
  result: ScanResult | null;
  onClick?: () => void;
}) {
  if (!result) {
    return (
      <button type="button" onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <Shield size={18} color="#9ca3af" />
      </button>
    );
  }
  if (result.isSafe) {
    return (
      <button type="button" onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <ShieldCheck size={18} color="#16a34a" />
      </button>
    );
  }
  const criticalCount = result.findings.filter((finding) => finding.severity === "CRITICAL").length;
  if (criticalCount === 0) {
    return (
      <button type="button" onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <ShieldCheck size={18} color="#16a34a" />
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, position: "relative" }}>
      <ShieldAlert size={18} color="#dc2626" />
      <span
        style={{
          position: "absolute",
          top: -2,
          right: -2,
          background: "#dc2626",
          color: "#fff",
          borderRadius: "50%",
          fontSize: 10,
          width: 14,
          height: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {criticalCount}
      </span>
    </button>
  );
}

function severityRank(severity: string) {
  const rank = SEVERITY_ORDER.indexOf(severity);
  return rank === -1 ? SEVERITY_ORDER.length : rank;
}
