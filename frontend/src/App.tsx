import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import RouteLoadingPanel from "./components/RouteLoadingPanel";
import { invalidateMarketplaceQueries } from "./features/marketplace/api/queries";
import { invalidateSettingsQueries } from "./features/settings/queries";
import { SkillsWorkspaceSessionProvider } from "./features/skills/model/session";
import { invalidateSkillsQueries } from "./features/skills/api/queries";
import ManagedSkillsPage from "./features/skills/screens/ManagedSkillsPage";
import SkillsWorkspacePage from "./features/skills/screens/SkillsWorkspacePage";
import UnmanagedSkillsPage from "./features/skills/screens/UnmanagedSkillsPage";

const MarketplacePage = lazy(() => import("./features/marketplace/screens/MarketplacePage"));
const SettingsPage = lazy(() => import("./features/settings/screens/SettingsPage"));

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
      <AppContent />
    </QueryClientProvider>
  );
}

function AppContent() {
  const queryClient = useQueryClient();
  const [refreshPending, setRefreshPending] = useState(false);

  async function handleRefreshData() {
    setRefreshPending(true);
    try {
      await Promise.all([
        invalidateSkillsQueries(queryClient),
        invalidateSettingsQueries(queryClient),
        invalidateMarketplaceQueries(queryClient),
      ]);
    } finally {
      setRefreshPending(false);
    }
  }

  return (
    <SkillsWorkspaceSessionProvider>
      <AppShell onRefreshData={handleRefreshData} refreshPending={refreshPending}>
        <Routes>
          <Route index element={<Navigate to="/skills/managed" replace />} />
          <Route path="skills" element={<SkillsWorkspacePage />}>
            <Route index element={<Navigate to="managed" replace />} />
            <Route path="managed" element={<ManagedSkillsPage />} />
            <Route path="unmanaged" element={<UnmanagedSkillsPage />} />
          </Route>
          <Route
            path="marketplace"
            element={
              <Suspense fallback={<RouteLoadingPanel label="Loading marketplace" />}>
                <MarketplacePage />
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
        </Routes>
      </AppShell>
    </SkillsWorkspaceSessionProvider>
  );
}
