import { Archive, Database } from "lucide-react";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { SettingsHarnessCard } from "../components/SettingsHarnessCard";
import { useSettingsPageController } from "../model/use-settings-page-controller";

export default function SettingsPage() {
  const controller = useSettingsPageController();

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Settings"
          subtitle="Local paths and per-harness discovery."
        />
      </div>

      {controller.errorMessage ? (
        <ErrorBanner message={controller.errorMessage} onDismiss={() => controller.setErrorMessage("")} />
      ) : null}

      {controller.isPending ? (
        <div className="panel-state">
          <LoadingSpinner label="Loading settings" />
        </div>
      ) : !controller.data ? (
        <div className="panel-state">
          <p className="muted-text">Unable to load settings.</p>
        </div>
      ) : (
        <>
          <section className="settings-section">
            <h2 className="settings-section__heading">Local storage</h2>
            <div className="settings-row">
              <span className="settings-row__icon">
                <Database size={15} />
              </span>
              <div className="settings-row__body">
                <p className="settings-row__title">Skill Manager store</p>
                <p className="settings-row__sub">Canonical copies of skills in use live here.</p>
              </div>
              <span className="settings-path">{controller.data.storePath}</span>
            </div>
            <div className="settings-row">
              <span className="settings-row__icon">
                <Archive size={15} />
              </span>
              <div className="settings-row__body">
                <p className="settings-row__title">Marketplace cache</p>
                <p className="settings-row__sub">Downloaded previews and install bundles.</p>
              </div>
              <span className="settings-path">{controller.data.marketplacePath}</span>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section__heading">Harness roots</h2>
            {controller.data.harnesses.map((harness) => (
              <SettingsHarnessCard
                key={harness.harness}
                harness={harness}
                pending={controller.isHarnessPending(harness.harness)}
                onToggle={controller.handleSupportToggle}
              />
            ))}
          </section>
        </>
      )}
    </>
  );
}
