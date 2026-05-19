import { ConfirmActionDialog } from "../../../../components/ConfirmActionDialog";
import { useSkillsCopy } from "../../i18n";

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
  const copy = useSkillsCopy();
  const content = action === "unmanage"
    ? {
        title: copy.confirm.removeTitle,
        description: copy.confirm.removeDescription(skillName),
        note:
          harnessLabels.length > 0 ? (
            <p>{copy.confirm.restoreTo(harnessLabels)}</p>
          ) : undefined,
        confirmLabel: copy.confirm.remove,
        pendingLabel: copy.confirm.removing,
        confirmTone: "primary" as const,
      }
    : {
        title: copy.confirm.deleteTitle,
        description: copy.confirm.deleteDescription(skillName),
        note: (
          <>
            <p>{copy.confirm.cannotUndo}</p>
            {harnessLabels.length > 0 ? (
              <p>{copy.confirm.affectedHarnesses(harnessLabels)}</p>
            ) : null}
          </>
        ),
        confirmLabel: copy.confirm.delete,
        pendingLabel: copy.confirm.deletingSkill,
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
