import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { PageHeader } from "../../../components/PageHeader";
import { useCommonCopy } from "../../../i18n";
import {
  invalidateOverviewData,
  useOverviewData,
} from "../../../app/capability-registry";
import { ExtensionPortfolio } from "../components/ExtensionPortfolio";
import { HarnessCoverageMap } from "../components/HarnessCoverageMap";
import { MarketplacePanel } from "../components/MarketplacePanel";
import { ReviewQueue } from "../components/ReviewQueue";
import { StatisticsBand } from "../components/StatisticsBand";
import { useOverviewCopy } from "../i18n";

export default function OverviewPage() {
  const queryClient = useQueryClient();
  const { skillsQuery, slashCommandsQuery, mcpQuery, model } = useOverviewData();
  const [refreshing, setRefreshing] = useState(false);
  const copy = useOverviewCopy();
  const common = useCommonCopy();

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
        <PageHeader title={copy.screen.title} />
      </div>

      {bothFailed ? (
        <div className="panel-state overview-error-state">
          <span>{copy.screen.unableToLoadOverview}</span>
          <button
            type="button"
            className="action-pill action-pill--md action-pill--accent"
            onClick={() => void refreshOverview()}
            disabled={refreshing}
          >
            {refreshing ? `${common.actions.refreshing}...` : common.actions.refresh}
          </button>
        </div>
      ) : (
        <div className="overview-page">
          {skillsQuery.isError && !skillsQuery.data ? (
            <ErrorBanner message={copy.screen.unableToLoadSkills(errorMessage(skillsQuery.error))} />
          ) : null}
          {slashCommandsQuery.isError && !slashCommandsQuery.data ? (
            <ErrorBanner message={copy.screen.unableToLoadSlashCommands(errorMessage(slashCommandsQuery.error))} />
          ) : null}
          {mcpQuery.isError && !mcpQuery.data ? (
            <ErrorBanner message={copy.screen.unableToLoadMcpServers(errorMessage(mcpQuery.error))} />
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
