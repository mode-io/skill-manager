import { useCallback, useState } from "react";
import { ShoppingBag, Download } from "lucide-react";
import { useCatalog } from "../hooks/useCatalog";
import { useMutation } from "../hooks/useMutation";
import { SearchInput } from "../components/SearchInput";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import type { SkillListing } from "../api/types";
import "../styles/marketplace.css";

export function MarketplacePage(): JSX.Element {
  const { searchSources, installSkill } = useCatalog();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SkillListing[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [installingLocator, setInstallingLocator] = useState<string | null>(null);
  const install = useMutation(installSkill);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await searchSources(query.trim());
      setResults(r);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [query, searchSources]);

  const handleInstall = useCallback(async (listing: SkillListing) => {
    setInstallingLocator(listing.sourceLocator);
    try {
      await install.execute(listing.sourceKind, listing.sourceLocator);
      setResults((prev) => prev.filter((r) => r.sourceLocator !== listing.sourceLocator));
    } finally {
      setInstallingLocator(null);
    }
  }, [install]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Marketplace</h1>
          <p className="subtitle">Search skills.sh and agentskill.sh registries</p>
        </div>
      </div>

      {install.error && <ErrorBanner message={install.error} onDismiss={install.clearError} />}

      <SearchInput
        value={query}
        onChange={setQuery}
        onSubmit={handleSearch}
        placeholder="Search for skills..."
        loading={searching}
      />

      {!searched ? (
        <EmptyState icon={ShoppingBag} title="Search for skills" description="Enter a query to search community skill registries." />
      ) : results.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No results" description={`No skills found for "${query}".`} />
      ) : (
        <div className="skill-grid">
          {results.map((listing) => (
            <div key={listing.sourceLocator} className="skill-card">
              <div className="skill-card-header">
                <span className="skill-card-name">{listing.name}</span>
                <StatusBadge variant={listing.sourceKind === "github" ? "shared" : "unmanaged"} label={listing.registry} />
              </div>
              {listing.description && <p className="skill-card-desc">{listing.description}</p>}
              <div className="skill-card-meta">
                {listing.installs > 0 && (
                  <span className="badge badge-ok">{listing.installs.toLocaleString()} installs</span>
                )}
                <span className="badge badge-shared">{listing.sourceKind}</span>
              </div>
              <div className="skill-card-actions">
                <button
                  className="btn btn-primary btn-sm"
                  disabled={installingLocator !== null}
                  onClick={() => handleInstall(listing)}
                >
                  {installingLocator === listing.sourceLocator ? <span className="spinner spinner-sm" /> : <Download size={14} />}
                  Install
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
