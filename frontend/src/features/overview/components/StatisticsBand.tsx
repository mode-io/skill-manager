import type { OverviewStats } from "../../../app/capability-registry";
import { useOverviewCopy } from "../i18n";

interface StatisticsBandProps {
  stats: OverviewStats;
  loading: boolean;
}

export function StatisticsBand({ stats, loading }: StatisticsBandProps) {
  const copy = useOverviewCopy();
  const statLabels: Array<{
    key: keyof OverviewStats;
    label: string;
  }> = [
    { key: "inUse", label: copy.stats.inUse },
    { key: "needsReview", label: copy.stats.needsReview },
    { key: "harnesses", label: copy.stats.harnesses },
  ];

  return (
    <section className="overview-stats-band" aria-label={copy.sections.inventoryStatistics}>
      {statLabels.map((item) => (
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
