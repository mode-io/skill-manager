import type { SkillsSummary } from "../../api/types";
import { overviewMetricActive, type SkillsFilterState, type SkillsOverviewMetric } from "./model";

interface SkillsOverviewStripProps {
  summary: SkillsSummary;
  filters: SkillsFilterState;
  onSelectMetric: (metric: SkillsOverviewMetric) => void;
}

const METRICS: Array<{ key: SkillsOverviewMetric; label: string; countKey: keyof SkillsSummary; emphasize?: boolean }> = [
  { key: "needsAction", label: "Needs action", countKey: "needsAction", emphasize: true },
  { key: "managed", label: "Managed", countKey: "managed" },
  { key: "foundLocally", label: "Found locally", countKey: "foundLocally" },
  { key: "custom", label: "Custom", countKey: "custom" },
  { key: "builtIn", label: "Built-in", countKey: "builtIn" },
];

export function SkillsOverviewStrip({ summary, filters, onSelectMetric }: SkillsOverviewStripProps): JSX.Element {
  return (
    <div className="skills-overview" aria-label="Skills overview">
      {METRICS.map((metric) => (
        <button
          key={metric.key}
          type="button"
          className={`skills-overview__metric${overviewMetricActive(metric.key, filters) ? " is-active" : ""}${metric.emphasize ? " is-emphasis" : ""}`}
          onClick={() => onSelectMetric(metric.key)}
        >
          <span className="skills-overview__label">{metric.label}</span>
          <strong className="skills-overview__value">{summary[metric.countKey]}</strong>
        </button>
      ))}
    </div>
  );
}
