import { ErrorBanner } from "../../../components/ErrorBanner";
import { MarketplaceCard } from "../components/MarketplaceCard";
import { MarketplaceFeedPane } from "../components/MarketplaceFeedPane";
import { MarketplaceDetailSheet } from "../components/MarketplaceDetailSheet";
import { useMarketplaceController } from "../model/use-marketplace-controller";

export interface MarketplacePageProps {
  isActive: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onItemCountChange: (count: number) => void;
}

export default function MarketplacePage({
  isActive,
  query,
  onQueryChange,
  onItemCountChange,
}: MarketplacePageProps) {
  const {
    errorMessage,
    selectedItemId,
    selectedItem,
    items,
    feedQuery,
    status,
    hasMore,
    loadingMore,
    openItem,
    closeItem,
    installItem,
    isInstallPending,
    openInstalledSkill,
    dismissError,
  } = useMarketplaceController({ query, onQueryChange });
  const feedErrorMessage =
    feedQuery.error instanceof Error
      ? feedQuery.error.message
      : "Unable to load the marketplace.";

  // Only open the detail modal if this tab is active AND the URL item id
  // is in our namespace (skills.sh items are prefixed `skillssh:`).
  const ownsItemId = Boolean(selectedItemId?.startsWith("skillssh:"));
  const resolvedItemId = isActive && ownsItemId ? selectedItemId : null;

  return (
    <>
      {errorMessage && !selectedItemId ? (
        <div className="page-chrome page-chrome--floating">
          <ErrorBanner message={errorMessage} onDismiss={dismissError} />
        </div>
      ) : null}

      <MarketplaceFeedPane
        isActive={isActive}
        status={status}
        itemCount={items.length}
        hasMore={hasMore}
        loadingMore={loadingMore}
        loadingLabel="Loading marketplace"
        errorMessage={feedErrorMessage}
        onItemCountChange={onItemCountChange}
        onLoadMore={() => feedQuery.fetchNextPage()}
      >
        <>
          <div className="market-grid">
            {items.map((item) => (
              <MarketplaceCard
                key={item.id}
                item={item}
                selected={item.id === selectedItemId}
                installing={isInstallPending(item.id)}
                onOpenDetail={() => openItem(item.id)}
                onInstall={() => void installItem(item)}
                onOpenInstalledSkill={openInstalledSkill}
              />
            ))}
          </div>
        </>
      </MarketplaceFeedPane>

      <MarketplaceDetailSheet
        itemId={resolvedItemId}
        initialItem={selectedItem}
        installPending={resolvedItemId ? isInstallPending(resolvedItemId) : false}
        actionErrorMessage={resolvedItemId ? errorMessage : ""}
        onDismissActionError={dismissError}
        onClose={closeItem}
        onInstall={installItem}
        onOpenInstalledSkill={openInstalledSkill}
      />
    </>
  );
}
