import { type ReactNode, useId, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailSection } from "../../../../components/detail/DetailSection";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import type {
  McpConfigChoiceDto,
  McpInventoryColumnDto,
  McpServerSpecDto,
} from "../../api/management-types";
import { useMcpServerDetailQuery } from "../../api/management-queries";
import { useMcpCopy, type McpCopy } from "../../i18n";
import {
  McpConfigChoiceDialog,
  type McpConfigChoiceOption,
} from "../edit/McpConfigChoiceDialog";
import { McpBindingMatrix } from "./McpBindingMatrix";
import { McpDetailShell } from "./McpDetailShell";
import { McpEnvTable } from "./McpEnvTable";
import { McpMarketplaceLinkChip } from "./McpMarketplaceLinkChip";

interface McpServerDetailViewProps {
  name: string;
  columns: McpInventoryColumnDto[];
  pendingPerHarness: ReadonlySet<string>;
  isServerPending: boolean;
  isUninstalling: boolean;
  onClose: () => void;
  onEnableHarness: (harness: string) => void;
  onDisableHarness: (harness: string) => void;
  onResolveConfig: (
    args: {
      sourceKind: "managed" | "harness";
      sourceHarness?: string | null;
      harnesses?: string[];
    },
  ) => Promise<void>;
  onUninstall: () => void;
}

export function McpServerDetailView({
  name,
  columns,
  pendingPerHarness,
  isServerPending,
  isUninstalling,
  onClose,
  onEnableHarness,
  onDisableHarness,
  onResolveConfig,
  onUninstall,
}: McpServerDetailViewProps) {
  const headingId = useId();
  const copy = useMcpCopy();
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const detailQuery = useMcpServerDetailQuery(name);

  const detail = detailQuery.data ?? null;
  const errorMessage = detailQuery.error instanceof Error ? detailQuery.error.message : "";

  if (!detail && detailQuery.isPending) {
    return (
      <McpDetailShell
        chrome={(
          <DetailHeader
            title={<h2 id={headingId}>{name}</h2>}
            closeLabel={copy.detail.close}
            onClose={onClose}
          />
        )}
        body={(
          <div className="panel-state">
            <LoadingSpinner label={copy.detail.loadingServer} />
          </div>
        )}
        bodyAriaLabelledBy={headingId}
      />
    );
  }

  if (!detail) {
    return (
      <McpDetailShell
        chrome={(
          <div className="mcp-detail__chrome">
            <DetailHeader
              title={<h2 id={headingId}>{copy.detail.unableTitle}</h2>}
              closeLabel={copy.detail.close}
              onClose={onClose}
            />
            {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          </div>
        )}
        body={null}
        bodyAriaHidden
      />
    );
  }

  const spec = detail.spec ?? null;
  const envEntries = detail.env ?? [];
  const transport = spec?.transport ?? "—";
  const displayName = detail.displayName;
  const sourceKind = spec?.source.kind ?? "manual";
  const link = detail.marketplaceLink;
  const iconUrl = link?.iconUrl ?? null;
  const description = link?.description ?? "";
  const configChoices = (detail.configChoices ?? []).map((choice) => configChoiceToOption(choice, copy));
  const hasDifferentConfig = detail.sightings.some((binding) => binding.state === "drifted");
  const canResolveConfig = configChoices.length > 0;

  return (
    <>
      <McpDetailShell
        chrome={(
          <DetailHeader
            title={<h2 id={headingId}>{displayName}</h2>}
            meta={
              <div className="detail-sheet__meta">
                {iconUrl ? (
                  <img
                    className="mcp-detail__icon"
                    src={iconUrl}
                    alt=""
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : null}
                <code className="mcp-detail__qualified-name">{detail.name}</code>
                <span className="detail-sheet__divider" aria-hidden="true">·</span>
                <div className="chip-cluster">
                  <span className={`chip chip--${transport === "stdio" ? "local" : "remote"}`}>
                    {transport}
                  </span>
                  <span className="chip">{sourceKind}</span>
                  {link ? <McpMarketplaceLinkChip link={link} /> : null}
                </div>
              </div>
            }
            closeLabel={copy.detail.close}
            onClose={onClose}
          />
        )}
        body={(
          <>
            {description ? (
              <DetailSection heading={copy.detail.about}>
                <p className="mcp-detail__about">{description}</p>
              </DetailSection>
            ) : null}

            {hasDifferentConfig ? (
              <div className="mcp-detail__drift-banner">
                <div>
                  <strong>{copy.detail.differentConfigsTitle}</strong>
                  <p>{copy.detail.differentConfigsBody}</p>
                </div>
                <button
                  type="button"
                  className="action-pill"
                  onClick={() => setResolveDialogOpen(true)}
                  disabled={isServerPending || !canResolveConfig}
                >
                  {copy.detail.resolveConfig}
                </button>
              </div>
            ) : null}

            <DetailSection heading={copy.detail.connection}>
              <ConnectionBlock spec={spec} copy={copy} />
            </DetailSection>

            <DetailSection heading={copy.detail.bindings}>
              <McpBindingMatrix
                columns={columns}
                bindings={detail.sightings}
                canEnable={detail.canEnable}
                serverPending={isServerPending}
                pendingPerHarness={pendingPerHarness}
                onEnable={onEnableHarness}
                onDisable={onDisableHarness}
                onResolveConfigClick={() => setResolveDialogOpen(true)}
                canResolveConfig={canResolveConfig}
              />
            </DetailSection>

            <DetailSection heading={copy.detail.environment}>
              <McpEnvTable entries={envEntries} />
            </DetailSection>
          </>
        )}
        footer={(
          <button
            type="button"
            className="action-pill mcp-detail__uninstall"
            onClick={onUninstall}
            disabled={isUninstalling}
          >
            {isUninstalling ? (
              <Loader2
                size={12}
                className="card-action-spinner"
                aria-hidden="true"
              />
            ) : (
              <Trash2 size={12} aria-hidden="true" />
            )}
            {copy.detail.uninstall}
          </button>
        )}
        bodyAriaLabelledBy={headingId}
      />
      {resolveDialogOpen ? (
        <McpConfigChoiceDialog
          open
          mode="resolve"
          serverName={name}
          options={configChoices}
          pending={isServerPending}
          onClose={() => setResolveDialogOpen(false)}
          onConfirm={async (option) => {
            await onResolveConfig({
              sourceKind: option.sourceKind,
              sourceHarness: option.sourceHarness,
            });
            setResolveDialogOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function configChoiceToOption(choice: McpConfigChoiceDto, copy: McpCopy): McpConfigChoiceOption {
  return {
    id: choice.sourceKind === "managed" ? "managed" : (choice.sourceHarness ?? choice.label),
    sourceKind: choice.sourceKind,
    sourceHarness: choice.sourceHarness,
    label: choice.sourceKind === "managed" ? copy.detail.skillManagerConfig : choice.label,
    logoKey: choice.logoKey,
    configPath: choice.configPath,
    payloadPreview: choice.payloadPreview,
    spec: choice.spec,
    env: choice.env ?? [],
  };
}

function ConnectionBlock({ spec, copy }: { spec: McpServerSpecDto | null; copy: McpCopy }) {
  if (!spec) {
    return <p className="muted-text">{copy.detail.noConnectionData}</p>;
  }
  if (spec.transport === "stdio") {
    const args = Array.isArray(spec.args) ? spec.args.join(" ") : "";
    return (
      <div className="mcp-detail__connection-grid">
        <Field label={copy.detail.command}>
          <code>{spec.command || "—"}</code>
        </Field>
        <Field label={copy.detail.args}>
          <code>{args || "—"}</code>
        </Field>
      </div>
    );
  }
  return (
    <div className="mcp-detail__connection-grid">
      <Field label={copy.detail.url}>
        <code>{spec.url || "—"}</code>
      </Field>
      <Field label={copy.detail.transport}>
        <code>{spec.transport}</code>
      </Field>
      <Field label={copy.detail.headers}>
        <code>{spec.headers ? JSON.stringify(spec.headers) : "—"}</code>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mcp-detail__field">
      <span className="mcp-detail__field-label">{label}</span>
      <div className="mcp-detail__field-value">{children}</div>
    </div>
  );
}
