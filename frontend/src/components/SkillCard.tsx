import { useState } from "react";
import { RefreshCw, ArrowUpCircle } from "lucide-react";
import type { CatalogEntrySummary, HarnessSummary } from "../api/types";
import { StatusBadge } from "./StatusBadge";
import { ToggleSwitch } from "./ToggleSwitch";

interface SkillCardProps {
  entry: CatalogEntrySummary;
  harnesses: HarnessSummary[];
  onToggle: (skillRef: string, action: "enable" | "disable", harness: string) => Promise<void>;
  onUpdate?: (skillRef: string) => Promise<void>;
  onCentralize?: (skillRef: string) => Promise<void>;
}

export function SkillCard({ entry, harnesses, onToggle, onUpdate, onCentralize }: SkillCardProps): JSX.Element {
  const [togglingHarness, setTogglingHarness] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const manageable = harnesses.filter((h) => h.detected && h.manageable);
  const boundSet = new Set(entry.harnesses.map((b) => b.harness));
  const isSourceBacked = entry.sourceKind !== "shared-store" && entry.sourceKind !== "centralized" && entry.sourceKind !== "unmanaged-local" && entry.sourceKind !== "harness-local";

  const handleToggle = async (harness: string, enabled: boolean) => {
    setTogglingHarness(harness);
    try {
      await onToggle(entry.skillRef, enabled ? "disable" : "enable", harness);
    } finally {
      setTogglingHarness(null);
    }
  };

  const handleAction = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    try { await fn(); } finally { setActionLoading(null); }
  };

  return (
    <div className="skill-card">
      <div className="skill-card-header">
        <span className="skill-card-name">{entry.declaredName}</span>
        <StatusBadge variant={entry.ownership} />
      </div>
      {entry.description && <p className="skill-card-desc">{entry.description}</p>}
      <div className="skill-card-meta">
        {entry.sourceKind && entry.sourceKind !== "shared-store" && (
          <span className="badge badge-shared">{entry.sourceKind}</span>
        )}
      </div>
      {entry.ownership === "shared" && manageable.length > 0 && (
        <div className="skill-card-toggles">
          {manageable.map((h) => (
            <ToggleSwitch
              key={h.harness}
              harnessLabel={h.label}
              enabled={boundSet.has(h.harness)}
              loading={togglingHarness === h.harness}
              disabled={togglingHarness !== null && togglingHarness !== h.harness}
              onToggle={() => handleToggle(h.harness, boundSet.has(h.harness))}
            />
          ))}
        </div>
      )}
      <div className="skill-card-actions">
        {entry.ownership === "shared" && isSourceBacked && onUpdate && (
          <button
            className="btn btn-secondary btn-sm"
            disabled={actionLoading !== null}
            onClick={() => handleAction("update", () => onUpdate(entry.skillRef))}
          >
            {actionLoading === "update" ? <span className="spinner spinner-sm" /> : <RefreshCw size={14} />}
            Update
          </button>
        )}
        {entry.ownership === "unmanaged" && entry.conflicts.length === 0 && onCentralize && (
          <button
            className="btn btn-primary btn-sm"
            disabled={actionLoading !== null}
            onClick={() => handleAction("centralize", () => onCentralize(entry.skillRef))}
          >
            {actionLoading === "centralize" ? <span className="spinner spinner-sm" /> : <ArrowUpCircle size={14} />}
            Centralize
          </button>
        )}
      </div>
    </div>
  );
}
