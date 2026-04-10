import type { CellActionKey, StructuralSkillAction } from "../../model/pending";
import type { HarnessCell, HarnessColumn, SkillListRow } from "../../model/types";
import { skillStatusTone } from "../../model/status-mappings";
import { ManagedSkillCardBody } from "./ManagedSkillCardBody";
import { ManagedSkillHarnessCluster } from "../harness/ManagedSkillHarnessCluster";
import { SkillCardFrame } from "./SkillCardFrame";
import { SkillCardHeader } from "./SkillCardHeader";
import { SkillStatusIndicator } from "./SkillStatusIndicator";

interface ManagedSkillCardProps {
  row: SkillListRow;
  columns: HarnessColumn[];
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  pendingStructuralAction: StructuralSkillAction | null;
  selected: boolean;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

export function ManagedSkillCard({
  row,
  columns,
  pendingToggleKeys,
  pendingStructuralAction,
  selected,
  onOpenSkill,
  onToggleCell,
}: ManagedSkillCardProps) {
  return (
    <SkillCardFrame
      variant="managed"
      selected={selected}
      onOpenSkill={() => onOpenSkill(row.skillRef)}
      content={(
        <>
          <SkillCardHeader
            name={row.name}
            skillRef={row.skillRef}
            onOpenSkill={onOpenSkill}
            statusSlot={row.displayStatus !== "Managed" ? (
              <SkillStatusIndicator
                status={row.displayStatus}
                tone={skillStatusTone(row.displayStatus)}
                attentionMessage={row.attentionMessage}
              />
            ) : null}
          />
          <ManagedSkillCardBody row={row} />
        </>
      )}
      aside={(
        <>
          <ManagedSkillHarnessCluster
            row={row}
            columns={columns}
            pendingToggleKeys={pendingToggleKeys}
            structuralLocked={pendingStructuralAction !== null}
            onToggleCell={onToggleCell}
          />
        </>
      )}
    />
  );
}
