import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { SettingsPopover } from "./components/SettingsPopover";
import { SkillsWorkspaceSessionProvider } from "./features/skills/model/session";
import { ManagedSkillsPage } from "./features/skills/screens/ManagedSkillsPage";
import { SkillsWorkspacePage } from "./features/skills/screens/SkillsWorkspacePage";
import { UnmanagedSkillsPage } from "./features/skills/screens/UnmanagedSkillsPage";
import { MarketplacePage } from "./pages/MarketplacePage";

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
