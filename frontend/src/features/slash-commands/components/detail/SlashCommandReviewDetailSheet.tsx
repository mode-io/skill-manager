import * as Dialog from "@radix-ui/react-dialog";

import type { SlashCommandDto, SlashCommandReviewDto, SlashReviewAction, SlashTargetDto } from "../../api/types";
import { SlashCommandReviewDetailView } from "./SlashCommandReviewDetailView";

interface SlashCommandReviewDetailSheetProps {
  row: SlashCommandReviewDto | null;
  canonicalCommand: SlashCommandDto | null;
  targets: SlashTargetDto[];
  pendingKey: string | null;
  actionError: string;
  onClose: () => void;
  onAction: (row: SlashCommandReviewDto, action?: SlashReviewAction | null) => Promise<boolean>;
}

export function SlashCommandReviewDetailSheet({
  row,
  canonicalCommand,
  targets,
  pendingKey,
  actionError,
  onClose,
  onAction,
}: SlashCommandReviewDetailSheetProps) {
  if (!row) {
    return null;
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="detail-sheet slash-review-detail-modal"
          aria-label={`Slash command to review ${row.name}`}
        >
          <Dialog.Title className="u-visually-hidden">Slash command to review {row.name}</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            Inspect a slash command file found in a harness and choose how Skill Manager should reconcile it.
          </Dialog.Description>
          <SlashCommandReviewDetailView
            row={row}
            canonicalCommand={canonicalCommand}
            targets={targets}
            pendingKey={pendingKey}
            actionError={actionError}
            onClose={onClose}
            onAction={onAction}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
