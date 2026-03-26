import type { FoundLocalSkillsOverviewModel } from "./model";

interface FoundLocalSkillsOverviewProps {
  overview: FoundLocalSkillsOverviewModel;
}

const METRICS: Array<{ key: keyof FoundLocalSkillsOverviewModel; label: string }> = [
  { key: "foundLocally", label: "Found locally" },
  { key: "eligibleNow", label: "Eligible now" },
];

export function FoundLocalSkillsOverview({ overview }: FoundLocalSkillsOverviewProps): JSX.Element {
  return (
    <div className="skills-overview" aria-label="Found local skills overview">
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
