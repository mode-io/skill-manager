import type { SkillTableRow } from "../../api/types";
import { UnmanagedSkillCard } from "./UnmanagedSkillCard";

interface UnmanagedSkillsListProps {
  rows: SkillTableRow[];
  busyId: string | null;
  selectedSkillRef: string | null;
  onOpenSkill: (skillRef: string) => void;
  onManageSkill: (skillRef: string) => Promise<void>;
}

export function UnmanagedSkillsList({
  rows,
  busyId,
  selectedSkillRef,
  onOpenSkill,
  onManageSkill,
}: UnmanagedSkillsListProps) {
  return (
    <section className="unmanaged-skills-list" aria-label="Unmanaged skills list">
      {rows.map((row) => (
        <UnmanagedSkillCard
          key={row.skillRef}
          row={row}
          busyId={busyId}
          selected={selectedSkillRef === row.skillRef}
          onOpenSkill={onOpenSkill}
          onManageSkill={onManageSkill}
        />
      ))}
    </section>
  );
}
