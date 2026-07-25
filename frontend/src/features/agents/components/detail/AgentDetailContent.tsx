import "../../agents.css";
import { lazy, Suspense, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { DetailDisclosure } from "../../../../components/detail/DetailDisclosure";
import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailSection } from "../../../../components/detail/DetailSection";
import { DetailNote } from "../../../../components/detail/DetailNote";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { ConfirmActionDialog } from "../../../../components/ConfirmActionDialog";
import { useFormatPath } from "../../../../lib/paths";
import { DetailBindingIdentity, type DetailBindingTone } from "../../../../components/detail/DetailBindingIdentity";
import { UiTooltip } from "../../../../components/ui/UiTooltip";
import { useDeleteAgentMutation } from "../../api/queries";
import type { AgentDetailDto } from "../../api/types";

const MarkdownDocument = lazy(() => import("../../../../components/MarkdownDocument"));

interface AgentDetailContentProps {
  detail: AgentDetailDto;
  pendingPerHarnessKeys: ReadonlySet<string>;
  onToggleHarness: (ref: string, harness: string, disable: boolean) => Promise<void>;
  actionErrorMessage: string | null;
  onClose: () => void;
  onDismissActionError: () => void;
  onEdit: () => void;
}

export function AgentDetailContent({
  detail,
  pendingPerHarnessKeys,
  onToggleHarness,
  actionErrorMessage,
  onClose,
  onDismissActionError,
  onEdit,
}: AgentDetailContentProps) {
  const headingId = useId();
  const formatPath = useFormatPath();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const deleteMutation = useDeleteAgentMutation();
  
  const [localActionError, setLocalActionError] = useState<string | null>(null);
  const errorMessage = actionErrorMessage || localActionError;
  const dismissError = () => {
    onDismissActionError();
    setLocalActionError(null);
  };

  const handleToggleHarness = async (harness: string, currentState: "enabled" | "disabled" | "unsupported") => {
    if (currentState === "unsupported") return;
    setLocalActionError(null);
    try {
      await onToggleHarness(detail.ref, harness, currentState === "enabled");
    } catch (err: any) {
      setLocalActionError(err.error || "Failed to toggle harness");
    }
  };

  const handleDelete = async () => {
    setLocalActionError(null);
    try {
      const promise = deleteMutation.mutateAsync(detail.ref);
      setDeleteDialogOpen(false);
      onClose(); // Close modal immediately to avoid 404 on refetch
      await promise;
    } catch (err: any) {
      // The modal is closed, but this is a best-effort catch.
      setLocalActionError(err.error || "Failed to delete agent");
      setDeleteDialogOpen(false);
    }
  };

  const isDeleting = deleteMutation.isPending;

  return (
    <>
      <div className="skill-detail-shell__chrome">
        <div className="skill-detail__chrome">
          <DetailHeader
            title={<h2 id={headingId}>{detail.name}</h2>}
            closeLabel="Close"
            onClose={onClose}
          />
          {errorMessage ? (
            <ErrorBanner message={errorMessage} onDismiss={dismissError} />
          ) : null}
        </div>
      </div>
      
      <div
        className="skill-detail-shell__body ui-scrollbar"
        aria-labelledby={headingId}
      >
        <div className="detail-sheet__body">
          <DetailSection heading="About">
            <p className="skill-detail__copy">
              {detail.description || "No description provided."}
            </p>
          </DetailSection>

          <DetailDisclosure
            title="System prompt"
            defaultOpen={false}
            className="skill-detail__disclosure skill-detail__disclosure--document"
          >
            <div className="skill-detail__document-surface">
              <Suspense fallback={<LoadingSpinner size="sm" label="Loading document" />}>
                <MarkdownDocument markdown={detail.prompt} />
              </Suspense>
            </div>
          </DetailDisclosure>

          {detail.configuration.length > 0 ? (
            <DetailSection heading="Configuration">
              {/* Frontmatter Skill Manager does not interpret, shown verbatim so a
                  harness's own settings are visible rather than invisible-and-fragile. */}
              <dl className="agent-detail__config">
                {detail.configuration.map(({ key, value }) => (
                  <div key={key} className="agent-detail__config-row">
                    <dt className="agent-detail__config-key">{key}</dt>
                    <dd className="agent-detail__config-value">
                      {value === "" ? <span className="agent-detail__config-empty">—</span> : value}
                    </dd>
                  </div>
                ))}
              </dl>
            </DetailSection>
          ) : null}

          <DetailSection heading="Harnesses">
            <div className="detail-sheet__bindings" aria-label={`Harness access for ${detail.name}`}>
              {detail.harnesses.map(h => {
                const pending = pendingPerHarnessKeys.has(`${detail.ref}:${h.harness}`);
                const isUnsupported = h.state === "unsupported";
                let tone: DetailBindingTone = "disabled";
                let statusLabel = "Disabled";
                if (h.state === "enabled") {
                  tone = "enabled";
                  statusLabel = "Enabled";
                } else if (isUnsupported) {
                  tone = "disabled";
                  statusLabel = "Unsupported";
                }

                return (
                  <div
                    key={h.harness}
                    className="detail-sheet__binding-row"
                    data-state={h.state}
                    data-pending={pending || undefined}
                  >
                    <DetailBindingIdentity
                      harness={h.harness}
                      label={h.label}
                      logoKey={h.logoKey}
                      statusLabel={statusLabel}
                      tone={tone}
                    />
                    <div className="detail-sheet__binding-actions">
                      {isUnsupported ? (
                        <UiTooltip content={h.detail || "Not supported"}>
                          <span className="action-pill agent-detail__unsupported-pill">
                            Enable
                          </span>
                        </UiTooltip>
                      ) : (
                        <button
                          type="button"
                          className={`action-pill ${h.state === "enabled" ? "action-pill--danger" : "action-pill--accent"}`}
                          disabled={pending || isDeleting}
                          onClick={() => handleToggleHarness(h.harness, h.state)}
                        >
                          {pending ? <Loader2 size={12} className="card-action-spinner" aria-hidden="true" /> : null}
                          {h.state === "enabled" ? "Disable" : "Enable"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DetailSection>

          <DetailSection heading="Locations">
            <div className="skill-detail__locations">
              <article className="skill-detail__location">
                <div className="skill-detail__location-header">
                  <strong>Skill Manager's copy</strong>
                </div>
                <p className="skill-detail__location-path">{formatPath(detail.storePath)}</p>
              </article>
              {detail.harnesses.filter(h => h.state !== "disabled" && h.state !== "unsupported").map(h => (
                <article key={h.harness} className="skill-detail__location">
                  <div className="skill-detail__location-header">
                    <strong>{h.label}</strong>
                  </div>
                  <p className="skill-detail__location-path">{formatPath(h.path)}</p>
                  {h.installMethod === "rendered" ? (
                    <p className="skill-detail__location-note agent-detail__rendered-note">
                      This agent is rendered as a TOML file. Local edits to it will be overwritten on re-enable.
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </DetailSection>
        </div>
      </div>

      <footer className="skill-detail-shell__footer" aria-label="Agent actions">
        <button
          type="button"
          className="action-pill action-pill--md"
          disabled={isDeleting}
          onClick={onEdit}
        >
          Edit
        </button>
        {detail.canDelete ? (
          <button
            type="button"
            className="action-pill action-pill--md action-pill--danger"
            disabled={isDeleting}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin agent-action-spinner" /> : null}
            Delete
          </button>
        ) : null}
      </footer>

      {detail.canDelete ? (
        <ConfirmActionDialog
          open={deleteDialogOpen}
          title="Delete Agent"
          description={<>Are you sure you want to delete <strong>{detail.name}</strong>? This action cannot be undone.</>}
          confirmLabel="Delete Agent"
          pendingLabel="Deleting"
          isPending={isDeleting}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDelete}
        />
      ) : null}
    </>
  );
}
