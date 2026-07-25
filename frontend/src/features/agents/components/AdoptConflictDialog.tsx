import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useCommonCopy } from "../../../i18n";

interface AdoptConflictDialogProps {
  open: boolean;
  slug: string;
  storePath: string;
  harnessPath: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (onConflict: "keep_store" | "replace_store") => void | Promise<void>;
}

export function AdoptConflictDialog({
  open,
  slug,
  storePath,
  harnessPath,
  isPending,
  onOpenChange,
  onConfirm,
}: AdoptConflictDialogProps) {
  const common = useCommonCopy();

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
            if (isPending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isPending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (isPending) event.preventDefault();
          }}
        >
          <div className="dialog-header confirm-dialog__header">
            <Dialog.Title className="dialog-title confirm-dialog__title">
              Name Collision: {slug}
            </Dialog.Title>
          </div>
          <Dialog.Description className="dialog-description confirm-dialog__description">
            <p className="confirm-dialog__lede">
              An agent with the name <strong>{slug}</strong> already exists in Skill Manager.
            </p>
            <p className="confirm-dialog__path">
              <strong>Project version:</strong> <code>{storePath}</code>
            </p>
            <p className="confirm-dialog__path">
              <strong>Harness version:</strong> <code>{harnessPath}</code>
            </p>
          </Dialog.Description>
          <div className="dialog-actions confirm-dialog__actions confirm-dialog__actions--stacked">
            <button
              type="button"
              className="btn confirm-dialog__button confirm-dialog__button--primary"
              disabled={isPending}
              onClick={() => void onConfirm("keep_store")}
            >
              Keep the project version
            </button>
            <button
              type="button"
              className="btn confirm-dialog__button confirm-dialog__button--danger"
              disabled={isPending}
              onClick={() => void onConfirm("replace_store")}
            >
              Use the harness version
            </button>
            <button
              type="button"
              className="btn confirm-dialog__button confirm-dialog__button--cancel"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              {common.actions.cancel}
            </button>
            {isPending ? (
              <div className="confirm-dialog__pending">
                <LoadingSpinner size="sm" label="Resolving conflict..." />
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
