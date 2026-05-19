import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";

import type { ScanConfigItem } from "../../../api/scan";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { ScanConfigDetailModal } from "../components/scan/ScanConfigDetailModal";
import { useSkillScan } from "../model/use-skill-scan";

type EditorState =
  | { mode: "create"; config: null }
  | { mode: "edit"; config: ScanConfigItem }
  | null;

function providerLabel(config: ScanConfigItem): string {
  return config.provider || "unknown";
}

export default function ScanConfigPage() {
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

  async function deleteConfig(config: ScanConfigItem) {
    if (!window.confirm(`Delete scan config "${config.name}"?`)) {
      return;
    }
    setPendingConfigId(config.id);
    setErrorMessage(null);
    try {
      await removeConfig(config.id);
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
          title="Scan Config"
          subtitle="View and manage all saved LLM configurations for security scans."
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              onClick={() => setEditor({ mode: "create", config: null })}
            >
              <Plus size={14} />
              New configuration
            </button>
          }
        />
      </div>

      {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} /> : null}

      {!configLoaded ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label="Loading scan configs" />
        </div>
      ) : configs.length === 0 ? (
        <div className="empty-panel">
          <h3 className="empty-panel__title">No scan configs yet</h3>
          <p className="empty-panel__body">
            Add an LLM configuration before running semantic security scans.
          </p>
          <div className="empty-panel__actions">
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              onClick={() => setEditor({ mode: "create", config: null })}
            >
              <Plus size={14} />
              New configuration
            </button>
          </div>
        </div>
      ) : (
        <section className="scan-config-list" aria-label="LLM scan configurations">
          <div className="scan-config-table-wrapper">
            <table className="scan-config-table" aria-label="LLM scan configurations">
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
                  <th>Name</th>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Base URL</th>
                  <th>API Key</th>
                  <th aria-label="Actions" />
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
                      <td className="scan-config-table__mono">{config.apiKeyMasked || "Masked"}</td>
                      <td>
                        <div className="scan-config-table__actions">
                          {isActive ? (
                            <button
                              type="button"
                              className="action-pill scan-config-table__state-action scan-config-table__active-action"
                              disabled
                            >
                              Active
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="action-pill scan-config-table__state-action"
                              disabled={pending}
                              onClick={() => void makeActive(config)}
                            >
                              <CheckCircle2 size={12} />
                              Make active
                            </button>
                          )}
                          <button
                            type="button"
                            className="action-pill"
                            disabled={pending}
                            onClick={() => void editExisting(config)}
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-pill action-pill--danger"
                            disabled={pending}
                            onClick={() => void deleteConfig(config)}
                          >
                            <Trash2 size={12} />
                            Delete
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
    </>
  );
}
