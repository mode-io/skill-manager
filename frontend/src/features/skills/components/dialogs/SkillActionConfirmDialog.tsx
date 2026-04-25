import { ConfirmActionDialog } from "../../../../components/ConfirmActionDialog";

type SkillActionConfirmKind = "unmanage" | "delete";

interface SkillActionConfirmDialogProps {
  open: boolean;
  action: SkillActionConfirmKind;
  skillName: string;
  harnessLabels: readonly string[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function SkillActionConfirmDialog({
  open,
  action,
  skillName,
  harnessLabels,
  isPending,
  onOpenChange,
  onConfirm,
}: SkillActionConfirmDialogProps) {
  const content = action === "unmanage"
    ? {
        title: "Remove skill from Skill Manager?",
        description: (
          <>
            This removes <strong>{skillName}</strong> from the Skill Manager store and restores local copies only
            for the harnesses that are currently enabled.
          </>
        ),
        note:
          harnessLabels.length > 0 ? (
            <p>Will restore to: {harnessLabels.join(", ")}</p>
          ) : undefined,
        confirmLabel: "Remove",
        pendingLabel: "Removing",
        confirmTone: "primary" as const,
      }
    : {
        title: "Delete skill from Skill Manager?",
        description: (
          <>
            This will remove <strong>{skillName}</strong> from the shared store and delete its
            links from all harnesses.
          </>
        ),
        note: (
          <>
            <p>This action cannot be undone.</p>
            {harnessLabels.length > 0 ? (
              <p>Affected harnesses: {harnessLabels.join(", ")}</p>
            ) : null}
          </>
        ),
        confirmLabel: "Delete",
        pendingLabel: "Deleting skill",
        confirmTone: "danger" as const,
      };

  return (
    <ConfirmActionDialog
      open={open}
      title={content.title}
      description={content.description}
      note={content.note}
      confirmLabel={content.confirmLabel}
      pendingLabel={content.pendingLabel}
      isPending={isPending}
      confirmTone={content.confirmTone}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
