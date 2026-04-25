import type { OverviewStats } from "../../../app/capability-registry";

interface StatisticsBandProps {
  stats: OverviewStats;
  loading: boolean;
}

const STAT_LABELS: Array<{
  key: keyof OverviewStats;
  label: string;
}> = [
  { key: "inUse", label: "In use" },
  { key: "needsReview", label: "Needs review" },
  { key: "harnesses", label: "Harnesses" },
];

export function StatisticsBand({ stats, loading }: StatisticsBandProps) {
  return (
    <section className="overview-stats-band" aria-label="Inventory statistics">
      {STAT_LABELS.map((item) => (
        <article
          className="overview-stat-tile"
          key={item.key}
          data-loading={loading && stats[item.key].value == null}
        >
          <span className="overview-stat-tile__value">
            {loading && stats[item.key].value == null ? "..." : formatCount(stats[item.key].value)}
          </span>
          <span className="overview-stat-tile__label">{item.label}</span>
          <span className="overview-stat-tile__detail">{stats[item.key].detail}</span>
        </article>
      ))}
    </section>
  );
}

function formatCount(value: number | null): string {
  return value == null ? "-" : value.toLocaleString();
}
