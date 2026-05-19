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
import { useSlashCommandsCopy, type SlashCommandsCopy } from "../../i18n";
import {
  primaryReviewAction,
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
  const copy = useSlashCommandsCopy();
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
          closeLabel={copy.detail.close}
          onClose={onClose}
        />
      </div>

      <div className="slash-review-detail-shell__body ui-scrollbar" aria-labelledby={headingId}>
        <div className="detail-sheet__body">
          {actionError ? <ErrorBanner message={actionError} /> : null}
          {row.error ? <ErrorBanner message={row.error} /> : null}

          {isConflict ? (
            <Notice tone="warning">
              {copy.detail.review.conflictNotice}
            </Notice>
          ) : null}

          {row.kind === "drifted" ? (
            <Notice tone="warning">
              {copy.detail.review.driftedNotice}
            </Notice>
          ) : null}

          {hasCanonicalGap ? (
            <Notice tone="warning">
              {copy.detail.review.canonicalGapNotice}
            </Notice>
          ) : null}

          <ReviewContent row={row} canonicalCommand={canonicalCommand} isConflict={isConflict} copy={copy} />
          <ReviewHarnessesSection row={row} targets={targets} copy={copy} />
          <ReviewLocationSection row={row} copy={copy} />
        </div>
      </div>

      <footer className="slash-review-detail-shell__footer" aria-label={copy.detail.review.actionsAria}>
        {orderedActions.map((action, index) => {
          const pending = pendingAction === action;
          return (
            <button
              key={action}
              type="button"
              className={`action-pill${index === 0 ? " action-pill--accent" : ""}`}
              title={copy.review.actionTitle(action)}
              disabled={Boolean(pendingAction)}
              onClick={() => {
                void runAction(action);
              }}
            >
              {pending ? <Loader2 size={12} className="card-action-spinner" aria-hidden="true" /> : null}
              {copy.review.actionLabel(action)}
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
  copy,
}: {
  row: SlashCommandReviewDto;
  targets: SlashTargetDto[];
  copy: SlashCommandsCopy;
}) {
  const harnesses = reviewHarnessRows(row, targets, copy);
  return (
    <DetailSection heading={copy.detail.harnesses}>
      <div className="detail-sheet__bindings" aria-label={copy.detail.review.harnessContext(row.name)}>
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
  copy,
}: {
  row: SlashCommandReviewDto;
  canonicalCommand: SlashCommandDto | null;
  isConflict: boolean;
  copy: SlashCommandsCopy;
}) {
  if (row.kind === "missing") {
    return <MissingContent canonicalCommand={canonicalCommand} copy={copy} />;
  }
  if (isConflict || row.kind === "drifted") {
    return <ComparisonContent row={row} canonicalCommand={canonicalCommand} copy={copy} />;
  }
  return (
    <SlashCommandContentSections
      description={row.description}
      prompt={row.prompt}
      descriptionEmptyText={copy.detail.review.noDescriptionParsed}
      promptEmptyText={copy.detail.review.noPromptParsed}
    />
  );
}

function MissingContent({ canonicalCommand, copy }: { canonicalCommand: SlashCommandDto | null; copy: SlashCommandsCopy }) {
  return (
    <DetailSection heading={copy.detail.review.skillManagerSource}>
      {canonicalCommand ? (
        <SlashCommandSourcePreview
          description={canonicalCommand.description}
          prompt={canonicalCommand.prompt}
        />
      ) : (
        <p className="slash-review-detail__empty">{copy.detail.review.noCanonicalContent}</p>
      )}
    </DetailSection>
  );
}

function ComparisonContent({
  row,
  canonicalCommand,
  copy,
}: {
  row: SlashCommandReviewDto;
  canonicalCommand: SlashCommandDto | null;
  copy: SlashCommandsCopy;
}) {
  return (
    <div className="slash-review-detail__comparison">
      <DetailSection heading={copy.detail.review.skillManagerSource}>
        {canonicalCommand ? (
          <SlashCommandSourcePreview
            description={canonicalCommand.description}
            prompt={canonicalCommand.prompt}
          />
        ) : (
          <p className="slash-review-detail__empty">{copy.detail.review.noCanonicalContent}</p>
        )}
      </DetailSection>
      <DetailSection heading={copy.detail.review.harnessCommand}>
        <SlashCommandSourcePreview
          description={row.description}
          prompt={row.prompt}
          descriptionEmptyText={copy.detail.review.noDescriptionParsed}
          promptEmptyText={copy.detail.review.noPromptParsed}
        />
      </DetailSection>
    </div>
  );
}

function ReviewLocationSection({ row, copy }: { row: SlashCommandReviewDto; copy: SlashCommandsCopy }) {
  return (
    <DetailSection heading={copy.detail.locations}>
      <TargetPathBlock path={row.path} copy={copy} />
    </DetailSection>
  );
}

function TargetPathBlock({ path, copy }: { path: string; copy: SlashCommandsCopy }) {
  return (
    <div className="slash-review-detail__target-path">
      <span>{copy.detail.review.path}</span>
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

function reviewHarnessRows(row: SlashCommandReviewDto, targets: SlashTargetDto[], copy: SlashCommandsCopy): ReviewHarnessRow[] {
  const hasReviewedTarget = targets.some((target) => target.id === row.target);
  const rows = targets.map((target) => reviewHarnessRow(row, target.id, target.label, target.id === row.target, copy));
  if (!hasReviewedTarget) {
    rows.push(reviewHarnessRow(row, row.target, row.targetLabel, true, copy));
  }
  return rows;
}

function reviewHarnessRow(
  row: SlashCommandReviewDto,
  id: string,
  label: string,
  reviewed: boolean,
  copy: SlashCommandsCopy,
): ReviewHarnessRow {
  if (!reviewed) {
    return {
      id,
      label,
      logoKey: logoKeyForHarness(id),
      reviewed,
      statusLabel: copy.detail.review.notPresent,
      visibleStatus: null,
      tone: "disabled",
      hint: null,
    };
  }
  const statusLabel = reviewHarnessStatusLabel(row, copy);
  return {
    id,
    label,
    logoKey: logoKeyForHarness(id),
    reviewed,
    statusLabel,
    visibleStatus: statusLabel,
    tone: "warning",
    hint: row.actions.includes("import") ? copy.detail.review.adoptHint : copy.detail.review.resolveHint,
  };
}

function reviewHarnessStatusLabel(row: SlashCommandReviewDto, copy: SlashCommandsCopy): string {
  if (row.kind === "drifted") return copy.detail.review.changedInHarness;
  if (row.kind === "missing") return copy.detail.review.missingFromHarness;
  return copy.detail.review.foundInHarness;
}

function logoKeyForHarness(id: string): string {
  return id === "claude" ? "claude" : id;
}
