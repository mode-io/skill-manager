import { type ReactNode } from "react";
import { Loader2, Plus } from "lucide-react";

import { OverflowTooltipText } from "../ui/OverflowTooltipText";
import { UiTooltip } from "../ui/UiTooltip";
import { UiTooltipTriggerBoundary } from "../ui/UiTooltipTriggerBoundary";

interface NeedsReviewRowProps {
  name: string;
  /** Pre-rendered harness logo stack rendered inline next to the name. */
  logos: ReactNode;
  /** Primary meta line, e.g. "Found in 3 harnesses". */
  metaText: string;
  /** Optional inline chip(s) after the meta line (Identical / Differs / Match). */
  statusChip?: ReactNode;
  /** Optional long-form copy. Line-clamped to 2 lines. */
  description?: string;
  actionLabel: string;
  /** Shared tooltip copy for the action button. */
  actionTitle?: string;
  pending?: boolean;
  /** Disables the action button (does not gate the row click-to-detail). */
  actionDisabled?: boolean;
  onOpen: () => void;
  onAction: () => void;
}

export function NeedsReviewRow({
  name,
  logos,
  metaText,
  statusChip,
  description,
  actionLabel,
  actionTitle,
  pending = false,
  actionDisabled = false,
  onOpen,
  onAction,
}: NeedsReviewRowProps) {
  const isActionUnavailable = pending || actionDisabled;
  const actionButton = (
    <button
      type="button"
      className="action-pill"
      disabled={isActionUnavailable}
      onClick={(event) => {
        event.stopPropagation();
        onAction();
      }}
    >
      {pending ? (
        <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
      ) : (
        <Plus size={12} aria-hidden="true" />
      )}
      {actionLabel}
    </button>
  );

  const actionControl = !actionTitle
    ? actionButton
    : isActionUnavailable
      ? (
          <UiTooltipTriggerBoundary content={actionTitle}>
            {actionButton}
          </UiTooltipTriggerBoundary>
        )
      : (
          <UiTooltip content={actionTitle}>
            {actionButton}
          </UiTooltip>
        );

  return (
    <div
      className="needs-review-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open detail for ${name}`}
    >
      <div className="needs-review-row__body">
        <div className="needs-review-row__title">
          <h3 className="needs-review-row__name">{name}</h3>
          <span className="needs-review-row__logos">{logos}</span>
        </div>
        <p className="needs-review-row__meta">{metaText}</p>
        {description ? (
          <OverflowTooltipText as="p" className="needs-review-row__description">
            {description}
          </OverflowTooltipText>
        ) : null}
      </div>

      <div className="needs-review-row__trailing">
        {statusChip}
        {actionControl}
      </div>
    </div>
  );
}
