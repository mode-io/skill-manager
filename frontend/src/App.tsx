import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { MySkillsPage } from "./pages/MySkillsPage";
import { SetupPage } from "./pages/SetupPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { HealthPage } from "./pages/HealthPage";

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MySkillsPage />} />
        <Route path="setup" element={<SetupPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="system" element={<HealthPage />} />
      </Route>
    </Routes>
  );
}
