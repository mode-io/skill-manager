import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { PageHeader } from "../../../components/PageHeader";
import {
  invalidateOverviewData,
  useOverviewData,
} from "../../../app/capability-registry";
import { ExtensionPortfolio } from "../components/ExtensionPortfolio";
import { HarnessCoverageMap } from "../components/HarnessCoverageMap";
import { MarketplacePanel } from "../components/MarketplacePanel";
import { ReviewQueue } from "../components/ReviewQueue";
import { StatisticsBand } from "../components/StatisticsBand";

export default function OverviewPage() {
  const queryClient = useQueryClient();
  const { skillsQuery, slashCommandsQuery, mcpQuery, model } = useOverviewData();
  const [refreshing, setRefreshing] = useState(false);

  const skillsLoading = skillsQuery.isPending && !skillsQuery.data;
  const slashCommandsLoading = slashCommandsQuery.isPending && !slashCommandsQuery.data;
  const mcpLoading = mcpQuery.isPending && !mcpQuery.data;
  const loading = skillsLoading || slashCommandsLoading || mcpLoading;
  const bothFailed =
    skillsQuery.isError &&
    slashCommandsQuery.isError &&
    mcpQuery.isError &&
    !skillsQuery.data &&
    !slashCommandsQuery.data &&
    !mcpQuery.data;

  async function refreshOverview() {
    setRefreshing(true);
    try {
      await invalidateOverviewData(queryClient);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <div className="page-chrome">
        <PageHeader title="Overview" />
      </div>

      {bothFailed ? (
        <div className="panel-state overview-error-state">
          <span>Unable to load overview data.</span>
          <button
            type="button"
            className="action-pill action-pill--md action-pill--accent"
            onClick={() => void refreshOverview()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      ) : (
        <div className="overview-page">
          {skillsQuery.isError && !skillsQuery.data ? (
            <ErrorBanner message={`Unable to load skills: ${errorMessage(skillsQuery.error)}`} />
          ) : null}
          {slashCommandsQuery.isError && !slashCommandsQuery.data ? (
            <ErrorBanner message={`Unable to load slash commands: ${errorMessage(slashCommandsQuery.error)}`} />
          ) : null}
          {mcpQuery.isError && !mcpQuery.data ? (
            <ErrorBanner message={`Unable to load MCP servers: ${errorMessage(mcpQuery.error)}`} />
          ) : null}

          <StatisticsBand stats={model.stats} loading={loading} />
          <div className="overview-dashboard-grid">
            <div className="overview-dashboard-column overview-dashboard-column--primary">
              <ExtensionPortfolio extensions={model.extensions} loading={loading} />
              <HarnessCoverageMap rows={model.harnessRows} loading={loading} />
            </div>
            <div className="overview-dashboard-column overview-dashboard-column--secondary">
              <MarketplacePanel entries={model.marketplaceEntries} />
              <ReviewQueue items={model.reviewItems} loading={loading} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
