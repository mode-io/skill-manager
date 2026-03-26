import type { ManagedSkillsOverviewModel } from "./model";

interface ManagedSkillsOverviewProps {
  overview: ManagedSkillsOverviewModel;
}

const METRICS: Array<{ key: keyof ManagedSkillsOverviewModel; label: string }> = [
  { key: "managed", label: "Managed" },
  { key: "custom", label: "Custom" },
  { key: "builtIn", label: "Built-in" },
];

export function ManagedSkillsOverview({ overview }: ManagedSkillsOverviewProps): JSX.Element {
  return (
    <div className="skills-overview" aria-label="Managed skills overview">
      {METRICS.map((metric) => (
        <div
          key={metric.key}
          className="skills-overview__metric"
        >
          <span className="skills-overview__label">{metric.label}</span>
          <strong className="skills-overview__value">{overview[metric.key]}</strong>
        </div>
      ))}
    </div>
  );
}
