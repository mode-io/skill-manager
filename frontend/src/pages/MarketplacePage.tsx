import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMarketplacePopular, installSkill, searchMarketplace } from "../api/client";
import type { MarketplaceItem } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { SearchInput } from "../components/SearchInput";

interface MarketplacePageProps {
  refreshToken: number;
  onDataChanged: () => void;
}

export function MarketplacePage({ refreshToken, onDataChanged }: MarketplacePageProps): JSX.Element {
  const navigate = useNavigate();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"popular" | "search">("popular");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    void fetchMarketplacePopular()
      .then((payload) => {
        if (cancelled) return;
        setItems(payload);
        setMode("popular");
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setErrorMessage(error.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  async function handleSearch(): Promise<void> {
    try {
      setStatus("loading");
      setErrorMessage("");
      const payload = await searchMarketplace(query);
      setItems(payload);
      setMode(query.trim() ? "search" : "popular");
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to search the marketplace.");
      setStatus("error");
    }
  }

  async function handleInstall(item: MarketplaceItem): Promise<void> {
    try {
      setBusyId(item.id);
      await installSkill(item.sourceKind, item.sourceLocator);
      onDataChanged();
      navigate("/");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to install the skill.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <p className="page-header__eyebrow">Acquisition</p>
          <h2>Marketplace</h2>
          <p className="page-header__copy">
            Browse popular skills across the selected registries and install them into the managed store.
          </p>
        </div>
      </div>

      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} />}

      <div className="marketplace-toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          onSubmit={() => void handleSearch()}
          placeholder="Search by skill name or topic"
          loading={status === "loading"}
        />
      </div>

      <div className="marketplace-header">
        <h3>{mode === "popular" ? "Popular skills" : "Search results"}</h3>
        <span>{items.length}</span>
      </div>

      {status === "loading" ? (
        <div className="panel-state">
          <LoadingSpinner label="Loading marketplace" />
        </div>
      ) : null}

      {status === "ready" ? (
        <div className="marketplace-grid">
          {items.map((item) => (
            <article key={item.id} className="marketplace-card">
              <div className="marketplace-card__header">
                <div>
                  <h4>{item.name}</h4>
                  <p>{item.description || "No description provided."}</p>
                </div>
                <span className="marketplace-card__badge">{item.badge}</span>
              </div>
              <dl className="definition-grid">
                <div>
                  <dt>Registry</dt>
                  <dd>{item.registry}</dd>
                </div>
                <div>
                  <dt>GitHub stars</dt>
                  <dd>{item.githubStars || "N/A"}</dd>
                </div>
                <div>
                  <dt>Installs</dt>
                  <dd>{item.installs}</dd>
                </div>
                <div>
                  <dt>Repository</dt>
                  <dd>{item.githubRepo ?? "Not available"}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyId !== null}
                onClick={() => void handleInstall(item)}
              >
                {busyId === item.id ? <LoadingSpinner size="sm" label={`Installing ${item.name}`} /> : null}
                Install
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
