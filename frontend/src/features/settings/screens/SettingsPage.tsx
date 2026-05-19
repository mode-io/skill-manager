import { Archive, Database } from "lucide-react";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { SettingsHarnessCard } from "../components/SettingsHarnessCard";
import { useSettingsCopy } from "../i18n";
import { useSettingsPageController } from "../model/use-settings-page-controller";

export default function SettingsPage() {
  const copy = useSettingsCopy();
  const controller = useSettingsPageController({
    unableToUpdateHarnessSupport: copy.errors.unableToUpdateHarnessSupport,
  });

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title={copy.title}
          subtitle={copy.subtitle}
        />
      </div>

      {controller.errorMessage ? (
        <ErrorBanner message={controller.errorMessage} onDismiss={() => controller.setErrorMessage("")} />
      ) : null}

      {controller.isPending ? (
        <div className="panel-state">
          <LoadingSpinner label={copy.loading} />
        </div>
      ) : !controller.data ? (
        <div className="panel-state">
          <p className="muted-text">{copy.errors.unableToLoad}</p>
        </div>
      ) : (
        <>
          <section className="settings-section">
            <h2 className="settings-section__heading">{copy.storage.heading}</h2>
            <div className="settings-row">
              <span className="settings-row__icon">
                <Database size={15} />
              </span>
              <div className="settings-row__body">
                <p className="settings-row__title">{copy.storage.storeTitle}</p>
                <p className="settings-row__sub">{copy.storage.storeSubtitle}</p>
              </div>
              <span className="settings-path">{controller.data.storage.skillsStorePath}</span>
            </div>
            <div className="settings-row">
              <span className="settings-row__icon">
                <Archive size={15} />
              </span>
              <div className="settings-row__body">
                <p className="settings-row__title">{copy.storage.cacheTitle}</p>
                <p className="settings-row__sub">{copy.storage.cacheSubtitle}</p>
              </div>
              <span className="settings-path">{controller.data.storage.marketplaceCachePath}</span>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section__heading">{copy.harnesses.heading}</h2>
            {controller.data.harnesses.map((harness) => (
              <SettingsHarnessCard
                key={harness.harness}
                harness={harness}
                pending={controller.isHarnessPending(harness.harness)}
                copy={copy.harnesses}
                onToggle={controller.handleSupportToggle}
              />
            ))}
          </section>
        </>
      )}
    </>
  );
}
