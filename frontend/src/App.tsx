import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { SettingsPopover } from "./components/SettingsPopover";
import { MarketplacePage } from "./pages/MarketplacePage";
import { FoundLocalSkillsPage } from "./pages/FoundLocalSkillsPage";
import { ManagedSkillsPage } from "./pages/ManagedSkillsPage";
import { SkillsWorkspacePage } from "./pages/SkillsWorkspacePage";

export function App(): JSX.Element {
  const [refreshToken, setRefreshToken] = useState(0);

  function handleDataChanged(): void {
    setRefreshToken((value) => value + 1);
  }

  return (
    <AppShell settingsControl={<SettingsPopover refreshToken={refreshToken} onDataChanged={handleDataChanged} />}>
      <Routes>
        <Route index element={<Navigate to="/skills/managed" replace />} />
        <Route path="skills" element={<SkillsWorkspacePage refreshToken={refreshToken} onDataChanged={handleDataChanged} />}>
          <Route index element={<Navigate to="managed" replace />} />
          <Route path="managed" element={<ManagedSkillsPage />} />
          <Route path="found-local" element={<FoundLocalSkillsPage />} />
        </Route>
        <Route
          path="marketplace"
          element={<MarketplacePage refreshToken={refreshToken} onDataChanged={handleDataChanged} />}
        />
      </Routes>
    </AppShell>
  );
}
