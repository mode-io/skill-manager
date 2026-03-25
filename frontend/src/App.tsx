import { useState } from "react";
import { Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { SettingsPopover } from "./components/SettingsPopover";
import { MarketplacePage } from "./pages/MarketplacePage";
import { SkillsPage } from "./pages/SkillsPage";

export function App(): JSX.Element {
  const [refreshToken, setRefreshToken] = useState(0);

  function handleDataChanged(): void {
    setRefreshToken((value) => value + 1);
  }

  return (
    <AppShell settingsControl={<SettingsPopover refreshToken={refreshToken} onDataChanged={handleDataChanged} />}>
      <Routes>
        <Route index element={<SkillsPage refreshToken={refreshToken} onDataChanged={handleDataChanged} />} />
        <Route
          path="marketplace"
          element={<MarketplacePage refreshToken={refreshToken} onDataChanged={handleDataChanged} />}
        />
      </Routes>
    </AppShell>
  );
}
