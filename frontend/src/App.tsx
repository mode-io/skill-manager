import { useState } from "react";
import { Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { MarketplacePage } from "./pages/MarketplacePage";
import { SkillsPage } from "./pages/SkillsPage";

export function App(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  function handleDataChanged(): void {
    setRefreshToken((value) => value + 1);
  }

  return (
    <AppShell onOpenSettings={() => setSettingsOpen(true)}>
      <Routes>
        <Route index element={<SkillsPage refreshToken={refreshToken} onDataChanged={handleDataChanged} />} />
        <Route
          path="marketplace"
          element={<MarketplacePage refreshToken={refreshToken} onDataChanged={handleDataChanged} />}
        />
      </Routes>
      <SettingsDrawer
        open={settingsOpen}
        refreshToken={refreshToken}
        onClose={() => setSettingsOpen(false)}
        onDataChanged={handleDataChanged}
      />
    </AppShell>
  );
}
