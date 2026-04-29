import { BookOpen, Command, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { OverviewExtensionKind } from "../../../app/capability-registry";

interface ExtensionPortfolioProps {
  extensions: OverviewExtensionKind[];
  loading: boolean;
}

export function ExtensionPortfolio({ extensions, loading }: ExtensionPortfolioProps) {
  return (
    <section className="overview-section" aria-labelledby="overview-extensions-title">
      <div className="overview-section__head">
        <h2 id="overview-extensions-title">Extensions</h2>
      </div>
      <div className="overview-row-panel">
        {extensions.map((extension) => (
          <ExtensionRow key={extension.key} extension={extension} loading={loading} />
        ))}
      </div>
    </section>
  );
}

function ExtensionRow({
  extension,
  loading,
}: {
  extension: OverviewExtensionKind;
  loading: boolean;
}) {
  return (
    <article className="overview-row" data-kind={extension.key} data-tone="normal">
      <span className="overview-row__icon" aria-hidden="true">
        {extensionIcon(extension.iconKey)}
      </span>
      <div className="overview-row__main">
        <div className="overview-row__title">
          <h3>{extension.label}</h3>
        </div>
        {extension.facts.length > 0 ? (
          <dl className="overview-row__facts">
            {extension.facts.map((fact) => (
              <div key={fact.label} data-tone={fact.tone ?? "normal"}>
                <dt className="u-visually-hidden">{fact.label}</dt>
                <dd>{loading && fact.value == null ? "..." : formatFact(fact.value, fact.label)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <div className="overview-row__actions">
        {extension.actions.map((action) => (
          <Link
            key={`${extension.key}:${action.label}`}
            to={action.to}
            className={`overview-route-chip${action.primary ? " overview-route-chip--primary" : ""}`}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </article>
  );
}

function extensionIcon(key: OverviewExtensionKind["iconKey"]): ReactNode {
  if (key === "skills") return <BookOpen size={18} />;
  if (key === "slash-commands") return <Command size={18} />;
  return <Terminal size={18} />;
}

function formatFact(value: number | null, label: string): string {
  return `${value == null ? "-" : value.toLocaleString()} ${label}`;
}
