import { SkillActionDialog } from "./SkillActionDialog";

interface SkillDeleteDialogProps {
  open: boolean;
  skillName: string;
  harnessLabels: string[];
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function SkillDeleteDialog({
  open,
  skillName,
  harnessLabels,
  isDeleting,
  onOpenChange,
  onConfirm,
}: SkillDeleteDialogProps) {
  return (
    <SkillActionDialog
      open={open}
      eyebrow="Destructive action"
      title="Delete managed skill?"
      description={(
        <>
          This will remove <strong>{skillName}</strong> from the shared store and delete its links from all harnesses.
          This action cannot be undone.
        </>
      )}
      note={harnessLabels.length > 0 ? `Affected harnesses: ${harnessLabels.join(", ")}` : undefined}
      tone="danger"
      confirmLabel="Still Delete"
      confirmClassName="btn btn-danger"
      pendingLabel="Deleting skill"
      isPending={isDeleting}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
