import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import RouteLoadingPanel from "./components/RouteLoadingPanel";
import { Shell } from "./components/Shell";
import { ToastProvider } from "./components/Toast";
import { UiTooltipProvider } from "./components/ui/UiTooltipProvider";
import { invalidateCapabilityQueries } from "./app/capability-registry";
import { SkillsWorkspaceSessionProvider } from "./features/skills/model/session";
import SkillsNeedsReviewPage from "./features/skills/screens/SkillsNeedsReviewPage";
import SkillsInUsePage from "./features/skills/screens/SkillsInUsePage";
import SkillsWorkspacePage from "./features/skills/screens/SkillsWorkspacePage";

const MarketplaceLayout = lazy(() => import("./features/marketplace/components/MarketplaceLayout"));
const OverviewPage = lazy(() => import("./features/overview/screens/OverviewPage"));
const SettingsPage = lazy(() => import("./features/settings/screens/SettingsPage"));
const SlashCommandsPage = lazy(() => import("./features/slash-commands/screens/SlashCommandsPage"));
const SlashCommandsReviewPage = lazy(() => import("./features/slash-commands/screens/SlashCommandsReviewPage"));
const McpNeedsReviewPage = lazy(() => import("./features/mcp/screens/McpNeedsReviewPage"));
const McpInUsePage = lazy(() => import("./features/mcp/screens/McpInUsePage"));

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <UiTooltipProvider>
          <AppContent />
        </UiTooltipProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const queryClient = useQueryClient();
  const [refreshPending, setRefreshPending] = useState(false);

  async function handleRefreshData() {
    setRefreshPending(true);
    try {
      await invalidateCapabilityQueries(queryClient);
    } finally {
      setRefreshPending(false);
    }
  }

  return (
    <SkillsWorkspaceSessionProvider>
      <Shell onRefresh={handleRefreshData} refreshPending={refreshPending}>
        <Routes>
          <Route index element={<Navigate to="/overview" replace />} />

          <Route
            path="overview"
            element={
              <Suspense fallback={<RouteLoadingPanel label="Loading overview" />}>
                <OverviewPage />
              </Suspense>
            }
          />

          <Route path="skills" element={<SkillsWorkspacePage />}>
            <Route index element={<Navigate to="use" replace />} />
            <Route path="use" element={<SkillsInUsePage />} />
            <Route path="review" element={<SkillsNeedsReviewPage />} />
            <Route path="managed" element={<Navigate to="/skills/use" replace />} />
            <Route path="unmanaged" element={<Navigate to="/skills/review" replace />} />
          </Route>

          <Route path="mcp" element={<Navigate to="/mcp/use" replace />} />
          <Route
            path="mcp/use"
            element={
              <Suspense fallback={<RouteLoadingPanel label="Loading MCP" />}>
                <McpInUsePage />
              </Suspense>
            }
          />
          <Route
            path="mcp/review"
            element={
              <Suspense fallback={<RouteLoadingPanel label="Loading MCP" />}>
                <McpNeedsReviewPage />
              </Suspense>
            }
          />
          <Route path="mcp/managed" element={<Navigate to="/mcp/use" replace />} />
          <Route path="mcp/unmanaged" element={<Navigate to="/mcp/review" replace />} />

          <Route
            path="marketplace"
            element={
              <Suspense fallback={<RouteLoadingPanel label="Loading marketplace" />}>
                <MarketplaceLayout />
              </Suspense>
            }
          >
            <Route index element={<Navigate to="skills" replace />} />
            {/* Child routes exist only so /marketplace/skills, /marketplace/mcp,
                and /marketplace/clis
                are valid URLs and NavLink active matching works.
                MarketplaceLayout renders the panes itself — no Outlet. */}
            <Route path="skills" element={null} />
            <Route path="mcp" element={null} />
            <Route path="clis" element={null} />
          </Route>

          <Route path="slash-commands" element={<Navigate to="/slash-commands/use" replace />} />
          <Route
            path="slash-commands/use"
            element={
              <Suspense fallback={<RouteLoadingPanel label="Loading slash commands" />}>
                <SlashCommandsPage />
              </Suspense>
            }
          />
          <Route
            path="slash-commands/review"
            element={
              <Suspense fallback={<RouteLoadingPanel label="Loading slash commands" />}>
                <SlashCommandsReviewPage />
              </Suspense>
            }
          />

          <Route
            path="settings"
            element={
              <Suspense fallback={<RouteLoadingPanel label="Loading settings" />}>
                <SettingsPage />
              </Suspense>
            }
          />

          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Shell>
    </SkillsWorkspaceSessionProvider>
  );
}
