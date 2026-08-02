import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";

import type { ScanConfigItem } from "../api/scan-types";
import { ConfirmActionDialog } from "../../../components/ConfirmActionDialog";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { ScanConfigDetailModal } from "../components/scan/ScanConfigDetailModal";
import { useCommonCopy } from "../../../i18n";
import { useSkillsCopy } from "../i18n";
import { useSkillScan } from "../model/use-skill-scan";

type EditorState =
  | { mode: "create"; config: null }
  | { mode: "edit"; config: ScanConfigItem }
  | null;

function providerLabel(config: ScanConfigItem): string {
  return config.provider || "unknown";
}

export default function ScanConfigPage() {
  const copy = useSkillsCopy().scan;
  const common = useCommonCopy();
  const {
    configs,
    activeConfigId,
    addConfig,
    editConfig,
    removeConfig,
    selectConfig,
    validateConfig,
    revealConfigApiKey,
    configLoaded,
  } = useSkillScan();
  const [editor, setEditor] = useState<EditorState>(null);
  const [pendingDeleteConfig, setPendingDeleteConfig] = useState<ScanConfigItem | null>(null);
  const [pendingConfigId, setPendingConfigId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedConfigs = useMemo(
    () => configs
      .map((config, index) => ({ config, index }))
      .sort((a, b) => {
        const aActive = a.config.id === activeConfigId || a.config.isActive;
        const bActive = b.config.id === activeConfigId || b.config.isActive;
        if (aActive !== bActive) {
          return aActive ? -1 : 1;
        }
        return a.index - b.index;
      })
      .map(({ config }) => config),
    [activeConfigId, configs],
  );

  async function makeActive(config: ScanConfigItem) {
    setPendingConfigId(config.id);
    setErrorMessage(null);
    try {
      await selectConfig(config.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingConfigId(null);
    }
  }

  async function editExisting(config: ScanConfigItem) {
    setErrorMessage(null);
    setEditor({ mode: "edit", config });
  }

  async function executeDeleteConfig() {
    if (!pendingDeleteConfig) {
      return;
    }
    setPendingConfigId(pendingDeleteConfig.id);
    setErrorMessage(null);
    try {
      await removeConfig(pendingDeleteConfig.id);
      setPendingDeleteConfig(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingConfigId(null);
    }
  }

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title={copy.configTitle}
          subtitle={copy.configSubtitle}
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              onClick={() => setEditor({ mode: "create", config: null })}
            >
              <Plus size={14} />
              {copy.newConfiguration}
            </button>
          }
        />
      </div>

      {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} /> : null}

      {!configLoaded ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label={copy.loadingConfigs} />
        </div>
      ) : configs.length === 0 ? (
        <div className="empty-panel">
          <h3 className="empty-panel__title">{copy.noConfigsTitle}</h3>
          <p className="empty-panel__body">
            {copy.noConfigsBody}
          </p>
          <div className="empty-panel__actions">
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              onClick={() => setEditor({ mode: "create", config: null })}
            >
              <Plus size={14} />
              {copy.newConfiguration}
            </button>
          </div>
        </div>
      ) : (
        <section className="scan-config-list" aria-label={copy.configsAria}>
          <div className="scan-config-table-wrapper">
            <table className="scan-config-table" aria-label={copy.configsAria}>
              <colgroup>
                <col className="scan-config-table__col-name" />
                <col className="scan-config-table__col-model" />
                <col className="scan-config-table__col-provider" />
                <col className="scan-config-table__col-base-url" />
                <col className="scan-config-table__col-api-key" />
                <col className="scan-config-table__col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>{copy.table.name}</th>
                  <th>{copy.table.model}</th>
                  <th>{copy.table.provider}</th>
                  <th>{copy.table.baseUrl}</th>
                  <th>{copy.table.apiKey}</th>
                  <th aria-label={copy.table.actions} />
                </tr>
              </thead>
              <tbody>
                {sortedConfigs.map((config) => {
                  const isActive = config.id === activeConfigId || config.isActive;
                  const pending = pendingConfigId === config.id;
                  return (
                    <tr key={config.id} data-active={isActive ? "true" : undefined}>
                      <td>
                        <div className="scan-config-table__name">
                          <span>{config.name}</span>
                        </div>
                      </td>
                      <td className="scan-config-table__mono">{config.model}</td>
                      <td>{providerLabel(config)}</td>
                      <td className="scan-config-table__mono" title={config.baseUrl}>{config.baseUrl}</td>
                      <td className="scan-config-table__mono">{config.apiKeyMasked || copy.table.masked}</td>
                      <td>
                        <div className="scan-config-table__actions">
                          {isActive ? (
                            <button
                              type="button"
                              className="action-pill scan-config-table__state-action scan-config-table__active-action"
                              disabled
                            >
                              {copy.table.active}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="action-pill scan-config-table__state-action"
                              disabled={pending}
                              onClick={() => void makeActive(config)}
                            >
                              <CheckCircle2 size={12} />
                              {copy.table.makeActive}
                            </button>
                          )}
                          <button
                            type="button"
                            className="action-pill"
                            disabled={pending}
                            onClick={() => void editExisting(config)}
                          >
                            <Pencil size={12} />
                            {copy.table.edit}
                          </button>
                          <button
                            type="button"
                            className="action-pill action-pill--danger"
                            disabled={pending}
                            onClick={() => setPendingDeleteConfig(config)}
                          >
                            <Trash2 size={12} />
                            {copy.table.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ScanConfigDetailModal
        open={editor !== null}
        mode={editor?.mode ?? "create"}
        config={editor?.config ?? null}
        onClose={() => setEditor(null)}
        onAddConfig={addConfig}
        onEditConfig={editConfig}
        onValidateConfig={validateConfig}
        onRevealApiKey={revealConfigApiKey}
      />

      <ConfirmActionDialog
        open={pendingDeleteConfig !== null}
        title={copy.deleteConfigTitle(pendingDeleteConfig?.name ?? "scan config")}
        description={copy.deleteConfigDescription}
        confirmLabel={common.actions.delete}
        pendingLabel={copy.deletingConfig}
        isPending={pendingDeleteConfig !== null && pendingConfigId === pendingDeleteConfig.id}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteConfig(null);
        }}
        onConfirm={executeDeleteConfig}
      />
    </>
  );
}
