import { BookOpen, Boxes, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { OverviewMarketplaceEntry } from "../../../app/capability-registry";

interface MarketplacePanelProps {
  entries: OverviewMarketplaceEntry[];
}

export function MarketplacePanel({ entries }: MarketplacePanelProps) {
  return (
    <section className="overview-section" aria-labelledby="overview-marketplace-title">
      <div className="overview-section__head">
        <h2 id="overview-marketplace-title">Discover</h2>
      </div>
      <div className="overview-row-panel overview-row-panel--compact">
        {entries.map((entry) => (
          <article className="overview-row" key={entry.key} data-kind={entry.key} data-tone={entry.tone ?? "normal"}>
            <span className="overview-row__icon" aria-hidden="true">
              {marketplaceIcon(entry.iconKey)}
            </span>
            <div className="overview-row__main">
              <div className="overview-row__title">
                <h3>{entry.label}</h3>
                <span className="overview-row__source">{entry.sourceLabel}</span>
                {entry.badge ? <span className="overview-row__badge">{entry.badge}</span> : null}
              </div>
            </div>
            <div className="overview-row__actions">
              <Link
                to={entry.action.to}
                className={`overview-route-chip${entry.action.primary ? " overview-route-chip--primary" : ""}`}
              >
                {entry.action.label}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function marketplaceIcon(key: OverviewMarketplaceEntry["iconKey"]): ReactNode {
  if (key === "skills") return <BookOpen size={18} />;
  if (key === "mcp") return <Terminal size={18} />;
  return <Boxes size={18} />;
}
