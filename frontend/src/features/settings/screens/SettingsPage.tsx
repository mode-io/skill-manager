import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { SettingsHarnessCard } from "../components/SettingsHarnessCard";
import { useSettingsPageController } from "../model/use-settings-page-controller";

export function SettingsPage() {
  const controller = useSettingsPageController();

  return (
    <div className="settings-page">
      <section className="page-panel settings-page__hero">
            <div className="page-header">
              <div>
                <p className="page-header__eyebrow">System Configuration</p>
                <h2>Settings</h2>
                <p className="page-header__copy">
                  Configure supported harnesses for skill discovery and management on this computer.
                </p>
              </div>
            </div>
      </section>

      {controller.errorMessage ? (
        <ErrorBanner message={controller.errorMessage} onDismiss={() => controller.setErrorMessage("")} />
      ) : null}

      {controller.isPending ? (
        <section className="page-panel panel-state">
          <LoadingSpinner label="Loading settings" />
        </section>
      ) : !controller.data ? (
        <section className="page-panel panel-state">
          <p className="muted-text">Unable to load settings.</p>
        </section>
      ) : (
        <>
          <section className="page-panel">
            <div className="settings-section__header">
              <div>
                <p className="page-header__eyebrow">Harnesses</p>
                <h3>Harnesses</h3>
              </div>
              <p className="muted-text">
                Support toggles are non-destructive. Disabled harnesses stay visible here, but skill-manager
                stops scanning and mutating them until re-enabled.
              </p>
            </div>
            <div className="settings-harness-grid">
              {controller.data.harnesses.map((harness) => (
                <SettingsHarnessCard
                  key={harness.harness}
                  harness={harness}
                  pending={controller.pendingHarness === harness.harness}
                  onToggle={controller.handleSupportToggle}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
