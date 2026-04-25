import * as Dialog from "@radix-ui/react-dialog";

import type { HarnessCellState } from "../../model/types";
import type { StructuralSkillAction } from "../../model/pending";
import { SkillDetailView } from "./SkillDetailView";

interface SkillDetailModalProps {
  open: boolean;
  skillRef: string | null;
  pendingToggleHarnesses: ReadonlySet<string>;
  pendingStructuralAction: StructuralSkillAction | null;
  onClose: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onToggleSkill: (skillRef: string, harness: string, currentState: HarnessCellState) => Promise<void>;
  onUpdateSkill: (skillRef: string) => Promise<void>;
  onRemoveSkill: (skillRef: string) => Promise<void>;
  onDeleteSkill: (skillRef: string) => Promise<void>;
}

export function SkillDetailModal({
  open,
  skillRef,
  pendingToggleHarnesses,
  pendingStructuralAction,
  onClose,
  onManageSkill,
  onToggleSkill,
  onUpdateSkill,
  onRemoveSkill,
  onDeleteSkill,
}: SkillDetailModalProps) {
  return (
    <Dialog.Root open={open && Boolean(skillRef)} onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="detail-sheet skill-detail-modal">
          <Dialog.Title className="u-visually-hidden">Skill details</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            Inspect and manage this skill across harnesses.
          </Dialog.Description>
          {skillRef ? (
            <SkillDetailView
              skillRef={skillRef}
              pendingToggleHarnesses={pendingToggleHarnesses}
              pendingStructuralAction={pendingStructuralAction}
              onClose={onClose}
              onManageSkill={onManageSkill}
              onToggleSkill={onToggleSkill}
              onUpdateSkill={onUpdateSkill}
              onRemoveSkill={onRemoveSkill}
              onDeleteSkill={onDeleteSkill}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
