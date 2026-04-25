import { ErrorBanner } from "../../../components/ErrorBanner";
import { MarketplaceFeedPane } from "../components/MarketplaceFeedPane";
import { McpMarketplaceCard } from "../components/McpMarketplaceCard";
import { McpMarketplaceDetailSheet } from "../components/McpMarketplaceDetailSheet";
import { useMcpMarketplaceController } from "../model/use-mcp-marketplace-controller";

export interface MarketplaceMcpPageProps {
  isActive: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onItemCountChange: (count: number) => void;
}

export default function MarketplaceMcpPage({
  isActive,
  query,
  onQueryChange,
  onItemCountChange,
}: MarketplaceMcpPageProps) {
  const {
    submittedQuery,
    items,
    feedQuery,
    status,
    errorMessage,
    hasMore,
    loadingMore,
    selectedName,
    selectedItem,
    openItem,
    closeItem,
  } = useMcpMarketplaceController({ query, onQueryChange });
  const feedErrorMessage =
    feedQuery.error instanceof Error
      ? feedQuery.error.message
      : "Unable to load MCP marketplace.";

  // Skills and CLIs have explicit marketplace namespaces; MCP owns Smithery ids.
  const ownsItemId = Boolean(
    selectedName &&
      !selectedName.startsWith("skillssh:") &&
      !selectedName.startsWith("clisdev:"),
  );
  const resolvedName = isActive && ownsItemId ? selectedName : null;

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
        loadingLabel="Loading MCP marketplace"
        errorMessage={feedErrorMessage}
        onItemCountChange={onItemCountChange}
        onLoadMore={() => feedQuery.fetchNextPage()}
        emptyState={
          <div className="panel-state">
            <p className="muted-text">
              {submittedQuery
                ? `No MCP servers match “${submittedQuery}”.`
                : "No MCP servers found."}
            </p>
          </div>
        }
      >
          <>
            <div className="market-grid">
              {items.map((item) => (
                <McpMarketplaceCard
                  key={item.qualifiedName}
                  item={item}
                  selected={item.qualifiedName === selectedName}
                  onOpenDetail={() => openItem(item.qualifiedName)}
                />
              ))}
            </div>
          </>
      </MarketplaceFeedPane>

      <McpMarketplaceDetailSheet
        qualifiedName={resolvedName}
        initialItem={selectedItem}
        onClose={closeItem}
      />
    </>
  );
}
