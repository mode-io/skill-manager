import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { LoadingSpinner } from "./LoadingSpinner";

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  note?: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  isPending: boolean;
  confirmTone?: "primary" | "danger";
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  note,
  confirmLabel,
  pendingLabel,
  isPending,
  confirmTone = "danger",
  onOpenChange,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content confirm-dialog"
          onEscapeKeyDown={(event) => {
            if (isPending) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (isPending) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (isPending) {
              event.preventDefault();
            }
          }}
        >
          <div className="dialog-header confirm-dialog__header">
            <Dialog.Title className="dialog-title confirm-dialog__title">{title}</Dialog.Title>
          </div>
          <Dialog.Description className="dialog-description confirm-dialog__description">
            {description}
          </Dialog.Description>
          {note ? <div className="confirm-dialog__note">{note}</div> : null}
          <div className="dialog-actions confirm-dialog__actions">
            <button
              type="button"
              className="btn confirm-dialog__button confirm-dialog__button--cancel"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn confirm-dialog__button confirm-dialog__button--${confirmTone}`}
              disabled={isPending}
              onClick={() => {
                void onConfirm();
              }}
            >
              {isPending ? <LoadingSpinner size="sm" label={pendingLabel} /> : null}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
