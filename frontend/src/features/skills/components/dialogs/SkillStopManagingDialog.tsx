import { SkillActionDialog } from "./SkillActionDialog";

interface SkillStopManagingDialogProps {
  open: boolean;
  skillName: string;
  harnessLabels: string[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function SkillStopManagingDialog({
  open,
  skillName,
  harnessLabels,
  isPending,
  onOpenChange,
  onConfirm,
}: SkillStopManagingDialogProps) {
  return (
    <SkillActionDialog
      open={open}
      eyebrow="State transition"
      title="Move skill back to unmanaged?"
      description={(
        <>
          This removes <strong>{skillName}</strong> from the shared managed store and restores local copies only for
          the harnesses that are currently enabled.
        </>
      )}
      note={harnessLabels.length > 0 ? `Will restore to: ${harnessLabels.join(", ")}` : undefined}
      tone="neutral"
      confirmLabel="Stop Managing"
      confirmClassName="btn btn-primary"
      pendingLabel="Stopping management"
      isPending={isPending}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
