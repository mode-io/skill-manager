import type { SkillsPageDto } from "../../features/skills/api/types";

export function skillsPayload({
  managed = 0,
  unmanaged = 0,
  harnessColumns = [],
  rows = [],
}: Partial<SkillsPageDto> & {
  managed?: number;
  unmanaged?: number;
} = {}): SkillsPageDto {
  return {
    summary: { managed, unmanaged },
    harnessColumns,
    rows,
  };
}
