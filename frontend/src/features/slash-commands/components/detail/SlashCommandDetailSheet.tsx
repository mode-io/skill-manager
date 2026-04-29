import * as Dialog from "@radix-ui/react-dialog";

import type { SlashCommandDto, SlashTargetDto } from "../../api/types";
import { SlashCommandDetailView } from "./SlashCommandDetailView";

interface SlashCommandDetailSheetProps {
  command: SlashCommandDto | null;
  targets: SlashTargetDto[];
  pendingName: string | null;
  pendingTarget: string | null;
  onClose: () => void;
  onEdit: (command: SlashCommandDto) => void;
  onDelete: (command: SlashCommandDto) => void;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
}

export function SlashCommandDetailSheet({
  command,
  targets,
  pendingName,
  pendingTarget,
  onClose,
  onEdit,
  onDelete,
  onToggleTarget,
}: SlashCommandDetailSheetProps) {
  if (!command) {
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
          className="detail-sheet slash-command-detail-modal"
          aria-label={`Slash command details ${command.name}`}
        >
          <Dialog.Title className="u-visually-hidden">Slash command details {command.name}</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            Review a managed slash command, its content, harness availability, and written locations.
          </Dialog.Description>
          <SlashCommandDetailView
            command={command}
            targets={targets}
            pendingName={pendingName}
            pendingTarget={pendingTarget}
            onClose={onClose}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleTarget={onToggleTarget}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
