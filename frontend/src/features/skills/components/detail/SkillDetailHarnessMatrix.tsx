import type { StructuralSkillAction } from "../../model/pending";
import type { HarnessCell } from "../../model/types";
import { HarnessMark } from "../harness/HarnessMark";
import { HarnessStateChip } from "../harness/HarnessStateChip";

interface SkillDetailHarnessMatrixProps {
  skillName: string;
  cells: HarnessCell[];
  pendingToggleHarnesses: ReadonlySet<string>;
  pendingStructuralAction: StructuralSkillAction | null;
  onToggleCell: (cell: HarnessCell) => void;
}

export function SkillDetailHarnessMatrix({
  skillName,
  cells,
  pendingToggleHarnesses,
  pendingStructuralAction,
  onToggleCell,
}: SkillDetailHarnessMatrixProps) {
  if (cells.length === 0) {
    return null;
  }

  return (
    <section className="skill-detail__harness-section" aria-label={`Harness access for ${skillName}`}>
      <p className="skill-detail__harness-eyebrow">Harness access</p>
      <div className="skill-detail__harness-grid">
        {cells.map((cell) => (
          <article key={cell.harness} className="skill-detail__harness-card">
            <p className="skill-detail__harness-label">{cell.label}</p>
            <HarnessMark
              harness={cell.harness}
              label={cell.label}
              logoKey={cell.logoKey}
              className="skill-detail__harness-mark"
            />
            <div className="skill-detail__harness-control">
              <HarnessCellControl
                skillName={skillName}
                cell={cell}
                pendingToggleHarnesses={pendingToggleHarnesses}
                structuralLocked={pendingStructuralAction !== null}
                onToggleCell={onToggleCell}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

interface HarnessCellControlProps {
  skillName: string;
  cell: HarnessCell;
  pendingToggleHarnesses: ReadonlySet<string>;
  structuralLocked: boolean;
  onToggleCell: (cell: HarnessCell) => void;
}

function HarnessCellControl({
  skillName,
  cell,
  pendingToggleHarnesses,
  structuralLocked,
  onToggleCell,
}: HarnessCellControlProps) {
  const pending = pendingToggleHarnesses.has(cell.harness);

  return (
    <HarnessStateChip
      state={cell.state}
      interactive={cell.interactive}
      disabled={structuralLocked}
      pending={pending}
      ariaLabel={`${cell.state === "enabled" ? "Disable" : "Enable"} ${skillName} for ${cell.label}`}
      onCheckedChange={() => onToggleCell(cell)}
    />
  );
}
