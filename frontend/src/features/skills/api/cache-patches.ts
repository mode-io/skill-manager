import type { HarnessCell, SkillDetailDto, SkillsPageDto } from "./types";
import type { HarnessCellState } from "../model/types";

export function patchSkillsListToggle(
  data: SkillsPageDto,
  skillRef: string,
  harness: string,
  nextState: HarnessCellState,
): SkillsPageDto {
  return {
    ...data,
    rows: data.rows.map((row) =>
      row.skillRef !== skillRef
        ? row
        : {
            ...row,
            cells: row.cells.map((cell) =>
              cell.harness !== harness ? cell : { ...cell, state: nextState },
            ),
          },
    ),
  };
}

export function patchSkillDetailToggle(
  data: SkillDetailDto,
  harness: string,
  nextState: HarnessCellState,
): SkillDetailDto {
  return {
    ...data,
    harnessCells: data.harnessCells.map((cell) =>
      cell.harness !== harness ? cell : { ...cell, state: nextState },
    ),
  };
}

export function getListCellState(
  data: SkillsPageDto | undefined,
  skillRef: string,
  harness: string,
): HarnessCellState | null {
  return findHarnessCell(
    data?.rows.find((row) => row.skillRef === skillRef)?.cells,
    harness,
  )?.state ?? null;
}

export function getDetailCellState(
  data: SkillDetailDto | undefined,
  harness: string,
): HarnessCellState | null {
  return findHarnessCell(data?.harnessCells, harness)?.state ?? null;
}

export function removeSkillFromList(data: SkillsPageDto, skillRef: string): SkillsPageDto {
  const removedRow = data.rows.find((row) => row.skillRef === skillRef);
  if (!removedRow) {
    return data;
  }

  return {
    ...data,
    summary: {
      ...data.summary,
      managed: removedRow.displayStatus === "Managed" ? Math.max(0, data.summary.managed - 1) : data.summary.managed,
      unmanaged: removedRow.displayStatus === "Unmanaged" ? Math.max(0, data.summary.unmanaged - 1) : data.summary.unmanaged,
    },
    rows: data.rows.filter((row) => row.skillRef !== skillRef),
  };
}

function findHarnessCell(
  cells: HarnessCell[] | undefined,
  harness: string,
): HarnessCell | undefined {
  return cells?.find((cell) => cell.harness === harness);
}
