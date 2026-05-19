import { AlertTriangle } from "lucide-react";

import { HarnessAvatar } from "../../../components/harness/HarnessAvatar";
import type { OverviewHarnessRow } from "../../../app/capability-registry";
import { useOverviewCopy } from "../i18n";

interface HarnessCoverageMapProps {
  rows: OverviewHarnessRow[];
  loading: boolean;
}

export function HarnessCoverageMap({ rows, loading }: HarnessCoverageMapProps) {
  const copy = useOverviewCopy();

  return (
    <section className="overview-coverage-map" aria-labelledby="overview-coverage-title">
      <div className="overview-section__head">
        <h2 id="overview-coverage-title">{copy.sections.activeHarnesses}</h2>
      </div>
      {loading && rows.length === 0 ? (
        <div className="overview-coverage-table" aria-hidden="true">
          <div className="overview-coverage-row overview-coverage-row--skeleton" />
          <div className="overview-coverage-row overview-coverage-row--skeleton" />
          <div className="overview-coverage-row overview-coverage-row--skeleton" />
        </div>
      ) : rows.length > 0 ? (
        <div className="overview-coverage-table">
          <div className="overview-coverage-row overview-coverage-row--head">
            <span>{copy.sections.harness}</span>
            <span>{copy.sections.skills}</span>
            <span>{copy.sections.mcp}</span>
            <span>{copy.sections.needsReview}</span>
          </div>
          {rows.map((row) => (
            <CoverageRow key={row.harness} row={row} />
          ))}
        </div>
      ) : (
        <p className="overview-empty-note">{copy.sections.noHarnesses}</p>
      )}
    </section>
  );
}

function CoverageRow({ row }: { row: OverviewHarnessRow }) {
  const copy = useOverviewCopy();
  const reviewTotal = row.foundSkills + row.unmanagedMcpServers + row.differentConfigMcpServers;
  const unavailableReason = row.mcpWritable === false ? row.mcpUnavailableReason ?? copy.sections.mcpUnavailable : null;

  return (
    <div className="overview-coverage-row">
      <span className="overview-coverage-row__identity">
        <HarnessAvatar harness={row.harness} label={row.label} logoKey={row.logoKey} />
        <span>
          <strong>
            {row.label}
            {unavailableReason ? (
              <span
                className="overview-coverage-warning"
                title={unavailableReason}
                aria-label={unavailableReason}
              >
                <AlertTriangle size={13} />
              </span>
            ) : null}
          </strong>
        </span>
      </span>
      <CoverageCell value={row.enabledSkills} />
      <CoverageCell
        value={row.managedMcpServers}
        detail={differentConfigDetail(row.differentConfigMcpServers, copy.sections.different)}
      />
      <CoverageCell value={reviewTotal} />
    </div>
  );
}

function CoverageCell({
  value,
  detail,
  tone = "normal",
}: {
  value: number;
  detail?: string | null;
  tone?: "normal" | "warning";
}) {
  return (
    <span className="overview-coverage-cell" data-tone={tone} data-active={value > 0}>
      <span className="overview-coverage-cell__dot" aria-hidden="true" />
      <span>{value.toLocaleString()}</span>
      {detail ? <span className="overview-coverage-cell__detail">{detail}</span> : null}
    </span>
  );
}

function differentConfigDetail(value: number, formatter: (count: number) => string): string | null {
  if (value <= 0) return null;
  return formatter(value);
}
