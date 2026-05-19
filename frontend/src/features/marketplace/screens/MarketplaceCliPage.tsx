import { ErrorBanner } from "../../../components/ErrorBanner";
import { CliMarketplaceCard } from "../components/CliMarketplaceCard";
import { CliMarketplaceDetailSheet } from "../components/CliMarketplaceDetailSheet";
import { MarketplaceFeedPane } from "../components/MarketplaceFeedPane";
import { useMarketplaceCopy } from "../i18n";
import { useCliMarketplaceController } from "../model/use-cli-marketplace-controller";

export interface MarketplaceCliPageProps {
  isActive: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onItemCountChange: (count: number) => void;
}

export default function MarketplaceCliPage({
  isActive,
  query,
  onQueryChange,
  onItemCountChange,
}: MarketplaceCliPageProps) {
  const copy = useMarketplaceCopy();
  const {
    submittedQuery,
    items,
    feedQuery,
    status,
    errorMessage,
    hasMore,
    loadingMore,
    selectedId,
    selectedItem,
    openItem,
    closeItem,
  } = useCliMarketplaceController({ query, onQueryChange });
  const feedErrorMessage =
    feedQuery.error instanceof Error
      ? feedQuery.error.message
      : copy.errors.cli;

  const ownsItemId = Boolean(selectedId?.startsWith("clisdev:"));
  const resolvedItemId = isActive && ownsItemId ? selectedId : null;

  return (
    <>
      {errorMessage ? (
        <div className="page-chrome page-chrome--floating">
          <ErrorBanner message={errorMessage} />
        </div>
      ) : null}

      <MarketplaceFeedPane
        isActive={isActive}
        status={status}
        itemCount={items.length}
        hasMore={hasMore}
        loadingMore={loadingMore}
        loadingLabel={copy.loading.cli}
        loadingMoreLabel={copy.loading.more}
        errorMessage={feedErrorMessage}
        onItemCountChange={onItemCountChange}
        onLoadMore={() => feedQuery.fetchNextPage()}
        emptyState={
          <div className="panel-state">
            <p className="muted-text">
              {submittedQuery
                ? copy.empty.cliQuery(submittedQuery)
                : copy.empty.cli}
            </p>
          </div>
        }
      >
          <>
            <div className="market-grid">
              {items.map((item) => (
                <CliMarketplaceCard
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  onOpenDetail={() => openItem(item.id)}
                />
              ))}
            </div>
          </>
      </MarketplaceFeedPane>

      <CliMarketplaceDetailSheet
        itemId={resolvedItemId}
        initialItem={selectedItem}
        onClose={closeItem}
      />
    </>
  );
}
