import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { LoadingSpinner } from "../../../../components/LoadingSpinner";

interface SkillActionDialogProps {
  open: boolean;
  eyebrow: string;
  title: string;
  description: ReactNode;
  note?: ReactNode;
  tone?: "neutral" | "danger";
  confirmLabel: string;
  confirmClassName: string;
  pendingLabel: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function SkillActionDialog({
  open,
  eyebrow,
  title,
  description,
  note,
  tone = "neutral",
  confirmLabel,
  confirmClassName,
  pendingLabel,
  isPending,
  onOpenChange,
  onConfirm,
}: SkillActionDialogProps) {
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
          className={`dialog-content dialog-content--${tone}`}
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
          <div className="dialog-header">
            <p className={`dialog-eyebrow dialog-eyebrow--${tone}`}>{eyebrow}</p>
            <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          </div>
          <Dialog.Description className="dialog-description">
            {description}
          </Dialog.Description>
          {note ? <p className={`dialog-note dialog-note--${tone}`}>{note}</p> : null}
          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={confirmClassName}
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
