import { useEffect, useState } from "react";
import { Check, CircleSlash2, Trash2, X } from "lucide-react";

import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { LoadingSpinner } from "./LoadingSpinner";
import { useCommonCopy } from "../i18n";

export type MultiSelectAction = "enable-all" | "disable-all" | "delete";

interface BulkActionBarProps {
  selectedCount: number;
  pending: MultiSelectAction | null;
  onClear: () => void;
  onEnableAll: () => Promise<void>;
  onDisableAll: () => Promise<void>;
  onDelete: () => Promise<void>;
  destructive: {
    /** Button aria-label + confirm button text (e.g. "Delete" / "Uninstall"). */
    actionLabel: string;
    /** Confirm dialog title (e.g. "Delete 3 skills?"). */
    confirmTitle: string;
    /** Confirm dialog body paragraph. */
    confirmDescription: string;
    /** Optional quieter secondary note below the main body. */
    confirmNote?: string;
  };
}

export function BulkActionBar({
  selectedCount,
  pending,
  onClear,
  onEnableAll,
  onDisableAll,
  onDelete,
  destructive,
}: BulkActionBarProps) {
  const [visible, setVisible] = useState(selectedCount > 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const common = useCommonCopy();

  useEffect(() => {
    if (selectedCount > 0) {
      setVisible(true);
    } else {
      const timer = window.setTimeout(() => setVisible(false), 220);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [selectedCount]);

  if (!visible) {
    return null;
  }

  const disabled = pending !== null;
  const active = selectedCount > 0;

  return (
    <>
      <div className="bulk-dock" aria-hidden={!active}>
        <div className="bulk-dock__fade" />
        <div
          className="bulk-bar"
          data-state={active ? "open" : "closed"}
          role="toolbar"
          aria-label={common.bulk.ariaLabel}
        >
          <div className="bulk-bar__group">
            <span className="bulk-bar__count">
              {common.bulk.selected(selectedCount)}
            </span>
            <button
              type="button"
              className="bulk-bar__clear"
              onClick={onClear}
              disabled={disabled}
              aria-label={common.actions.clearSelection}
            >
              <X size={14} />
            </button>
          </div>

          <span className="bulk-bar__divider" aria-hidden="true" />

          <div className="bulk-bar__group">
            <button
              type="button"
              className="bulk-bar__action"
              onClick={() => void onEnableAll()}
              disabled={disabled}
            >
              {pending === "enable-all" ? (
                <LoadingSpinner size="sm" label={common.actions.enabling} />
              ) : (
                <Check size={15} />
              )}
              {common.actions.enableAll}
            </button>
            <button
              type="button"
              className="bulk-bar__action"
              onClick={() => void onDisableAll()}
              disabled={disabled}
            >
              {pending === "disable-all" ? (
                <LoadingSpinner size="sm" label={common.actions.disabling} />
              ) : (
                <CircleSlash2 size={15} />
              )}
              {common.actions.disableAll}
            </button>
          </div>

          <span className="bulk-bar__divider" aria-hidden="true" />

          <button
            type="button"
            className="bulk-bar__danger"
            onClick={() => setConfirmOpen(true)}
            disabled={disabled}
            aria-label={common.bulk.selectedAction(destructive.actionLabel, selectedCount)}
          >
            {pending === "delete" ? (
              <LoadingSpinner size="sm" label={destructive.actionLabel} />
            ) : (
              <Trash2 size={15} />
            )}
          </button>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmOpen}
        title={destructive.confirmTitle}
        description={destructive.confirmDescription}
        note={destructive.confirmNote}
        confirmLabel={destructive.actionLabel}
        pendingLabel={destructive.actionLabel}
        isPending={false}
        onOpenChange={setConfirmOpen}
        onConfirm={async () => {
          setConfirmOpen(false);
          await onDelete();
        }}
      />
    </>
  );
}
