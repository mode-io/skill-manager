import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { SettingsPopover } from "./components/SettingsPopover";
import { SkillsWorkspaceSessionProvider } from "./features/skills/session";
import { MarketplacePage } from "./pages/MarketplacePage";
import { ManagedSkillsPage } from "./pages/ManagedSkillsPage";
import { SkillsWorkspacePage } from "./pages/SkillsWorkspacePage";
import { UnmanagedSkillsPage } from "./pages/UnmanagedSkillsPage";

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
      <SkillsWorkspaceSessionProvider>
        <AppShell settingsControl={<SettingsPopover />}>
          <Routes>
            <Route index element={<Navigate to="/skills/managed" replace />} />
            <Route path="skills" element={<SkillsWorkspacePage />}>
              <Route index element={<Navigate to="managed" replace />} />
              <Route path="managed" element={<ManagedSkillsPage />} />
              <Route path="unmanaged" element={<UnmanagedSkillsPage />} />
            </Route>
            <Route path="marketplace" element={<MarketplacePage />} />
          </Routes>
        </AppShell>
      </SkillsWorkspaceSessionProvider>
    </QueryClientProvider>
  );
}
