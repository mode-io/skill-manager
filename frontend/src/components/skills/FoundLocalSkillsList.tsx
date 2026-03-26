import type { SkillTableRow } from "../../api/types";
import { FoundLocalSkillCard } from "./FoundLocalSkillCard";

interface FoundLocalSkillsListProps {
  rows: SkillTableRow[];
  busyId: string | null;
  onOpenSkill: (skillRef: string) => void;
  onRunPrimaryAction: (row: SkillTableRow) => void;
}

export function FoundLocalSkillsList({
  rows,
  busyId,
  onOpenSkill,
  onRunPrimaryAction,
}: FoundLocalSkillsListProps): JSX.Element {
  return (
    <section className="found-skills-list" aria-label="Found local skills list">
      {rows.map((row) => (
        <FoundLocalSkillCard
          key={row.skillRef}
          row={row}
          busyId={busyId}
          onOpenSkill={onOpenSkill}
          onRunPrimaryAction={onRunPrimaryAction}
        />
      ))}
    </section>
  );
}
