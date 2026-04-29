import { useId } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  DetailBindingIdentity,
  type DetailBindingTone,
} from "../../../../components/detail/DetailBindingIdentity";
import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailSection } from "../../../../components/detail/DetailSection";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import type { SlashCommandDto, SlashCommandReviewDto, SlashReviewAction, SlashTargetDto } from "../../api/types";
import {
  primaryReviewAction,
  reviewActionLabel,
  reviewActionTitle,
} from "../../model/selectors";
import { reviewKey } from "../../model/useSlashCommandsReviewController";
import {
  SlashCommandContentSections,
  SlashCommandSourcePreview,
} from "./SlashCommandContentBlocks";

interface SlashCommandReviewDetailViewProps {
  row: SlashCommandReviewDto;
  canonicalCommand: SlashCommandDto | null;
  targets: SlashTargetDto[];
  pendingKey: string | null;
  actionError: string;
  onClose: () => void;
  onAction: (row: SlashCommandReviewDto, action?: SlashReviewAction | null) => Promise<boolean>;
}

export function SlashCommandReviewDetailView({
  row,
  canonicalCommand,
  targets,
  pendingKey,
  actionError,
  onClose,
  onAction,
}: SlashCommandReviewDetailViewProps) {
  const headingId = useId();
  const primaryAction = primaryReviewAction(row);
  const orderedActions = primaryAction
    ? [primaryAction, ...row.actions.filter((action) => action !== primaryAction)]
    : row.actions;
  const pendingAction = orderedActions.find((action) => pendingKey === reviewKey(row.target, row.name, action));
  const hasCanonicalGap = row.commandExists && !canonicalCommand;
  const isConflict = row.kind === "unmanaged" && row.commandExists;

  async function runAction(action: SlashReviewAction): Promise<void> {
    const ok = await onAction(row, action);
    if (ok) onClose();
  }

  return (
    <>
      <div className="slash-review-detail-shell__chrome">
        <DetailHeader
          title={<h2 id={headingId}>{row.name}</h2>}
          closeLabel="Close slash command detail"
          onClose={onClose}
        />
      </div>

      <div className="slash-review-detail-shell__body ui-scrollbar" aria-labelledby={headingId}>
        <div className="detail-sheet__body">
          {actionError ? <ErrorBanner message={actionError} /> : null}
          {row.error ? <ErrorBanner message={row.error} /> : null}

          {isConflict ? (
            <Notice tone="warning">
              A managed slash command already uses this name. Adopting the harness command will replace the Skill
              Manager source.
            </Notice>
          ) : null}

          {row.kind === "drifted" ? (
            <Notice tone="warning">
              The harness command changed after Skill Manager last synced it. Restore writes the Skill Manager source
              back to the harness; Adopt updates Skill Manager from this harness command.
            </Notice>
          ) : null}

          {hasCanonicalGap ? (
            <Notice tone="warning">
              The review entry says this command is managed, but the canonical command is not present in the current
              slash command list.
            </Notice>
          ) : null}

          <ReviewContent row={row} canonicalCommand={canonicalCommand} isConflict={isConflict} />
          <ReviewHarnessesSection row={row} targets={targets} />
          <ReviewLocationSection row={row} />
        </div>
      </div>

      <footer className="slash-review-detail-shell__footer" aria-label="Slash command review actions">
        {orderedActions.map((action, index) => {
          const pending = pendingAction === action;
          return (
            <button
              key={action}
              type="button"
              className={`action-pill${index === 0 ? " action-pill--accent" : ""}`}
              title={reviewActionTitle(action)}
              disabled={Boolean(pendingAction)}
              onClick={() => {
                void runAction(action);
              }}
            >
              {pending ? <Loader2 size={12} className="card-action-spinner" aria-hidden="true" /> : null}
              {reviewActionLabel(action)}
            </button>
          );
        })}
      </footer>
    </>
  );
}

function ReviewHarnessesSection({
  row,
  targets,
}: {
  row: SlashCommandReviewDto;
  targets: SlashTargetDto[];
}) {
  const harnesses = reviewHarnessRows(row, targets);
  return (
    <DetailSection heading="Harnesses">
      <div className="detail-sheet__bindings" aria-label={`Harness review context for ${row.name}`}>
        {harnesses.map((harness) => (
          <div
            key={harness.id}
            className="detail-sheet__binding-row"
            data-state={harness.reviewed ? row.kind : "empty"}
          >
            <DetailBindingIdentity
              harness={harness.id}
              label={harness.label}
              logoKey={harness.logoKey}
              statusLabel={harness.statusLabel}
              tone={harness.tone}
              visibleStatus={harness.visibleStatus}
            />
            <div className="detail-sheet__binding-actions">
              {harness.hint ? (
                <span className="detail-sheet__binding-hint">{harness.hint}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </DetailSection>
  );
}

function ReviewContent({
  row,
  canonicalCommand,
  isConflict,
}: {
  row: SlashCommandReviewDto;
  canonicalCommand: SlashCommandDto | null;
  isConflict: boolean;
}) {
  if (row.kind === "missing") {
    return <MissingContent canonicalCommand={canonicalCommand} />;
  }
  if (isConflict || row.kind === "drifted") {
    return <ComparisonContent row={row} canonicalCommand={canonicalCommand} />;
  }
  return (
    <SlashCommandContentSections
      description={row.description}
      prompt={row.prompt}
      descriptionEmptyText="No description parsed."
      promptEmptyText="No prompt content parsed."
    />
  );
}

function MissingContent({ canonicalCommand }: { canonicalCommand: SlashCommandDto | null }) {
  return (
    <DetailSection heading="Skill Manager source">
      {canonicalCommand ? (
        <SlashCommandSourcePreview
          description={canonicalCommand.description}
          prompt={canonicalCommand.prompt}
        />
      ) : (
        <p className="slash-review-detail__empty">No canonical command content is available.</p>
      )}
    </DetailSection>
  );
}

function ComparisonContent({
  row,
  canonicalCommand,
}: {
  row: SlashCommandReviewDto;
  canonicalCommand: SlashCommandDto | null;
}) {
  return (
    <div className="slash-review-detail__comparison">
      <DetailSection heading="Skill Manager source">
        {canonicalCommand ? (
          <SlashCommandSourcePreview
            description={canonicalCommand.description}
            prompt={canonicalCommand.prompt}
          />
        ) : (
          <p className="slash-review-detail__empty">No canonical command content is available.</p>
        )}
      </DetailSection>
      <DetailSection heading="Harness command">
        <SlashCommandSourcePreview
          description={row.description}
          prompt={row.prompt}
          descriptionEmptyText="No description parsed."
          promptEmptyText="No prompt content parsed."
        />
      </DetailSection>
    </div>
  );
}

function ReviewLocationSection({ row }: { row: SlashCommandReviewDto }) {
  return (
    <DetailSection heading="Locations">
      <TargetPathBlock path={row.path} />
    </DetailSection>
  );
}

function TargetPathBlock({ path }: { path: string }) {
  return (
    <div className="slash-review-detail__target-path">
      <span>Path</span>
      <code>{path}</code>
    </div>
  );
}

function Notice({ tone, children }: { tone: "warning"; children: string }) {
  return (
    <div className="slash-review-detail__notice" data-tone={tone}>
      <AlertTriangle size={15} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

interface ReviewHarnessRow {
  id: string;
  label: string;
  logoKey: string;
  reviewed: boolean;
  statusLabel: string;
  visibleStatus: string | null;
  tone: DetailBindingTone;
  hint: string | null;
}

function reviewHarnessRows(row: SlashCommandReviewDto, targets: SlashTargetDto[]): ReviewHarnessRow[] {
  const hasReviewedTarget = targets.some((target) => target.id === row.target);
  const rows = targets.map((target) => reviewHarnessRow(row, target.id, target.label, target.id === row.target));
  if (!hasReviewedTarget) {
    rows.push(reviewHarnessRow(row, row.target, row.targetLabel, true));
  }
  return rows;
}

function reviewHarnessRow(
  row: SlashCommandReviewDto,
  id: string,
  label: string,
  reviewed: boolean,
): ReviewHarnessRow {
  if (!reviewed) {
    return {
      id,
      label,
      logoKey: logoKeyForHarness(id),
      reviewed,
      statusLabel: "Not present",
      visibleStatus: null,
      tone: "disabled",
      hint: null,
    };
  }
  const statusLabel = reviewHarnessStatusLabel(row);
  return {
    id,
    label,
    logoKey: logoKeyForHarness(id),
    reviewed,
    statusLabel,
    visibleStatus: statusLabel,
    tone: "warning",
    hint: row.actions.includes("import") ? "Adopt this command to manage it" : "Resolve from footer",
  };
}

function reviewHarnessStatusLabel(row: SlashCommandReviewDto): string {
  if (row.kind === "drifted") return "Changed in harness";
  if (row.kind === "missing") return "Missing from harness";
  return "Found in harness";
}

function logoKeyForHarness(id: string): string {
  return id === "claude" ? "claude" : id;
}
