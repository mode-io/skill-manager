export type CellActionKey = string;
export type StructuralSkillAction = "manage" | "update" | "unmanage" | "delete";
export type BulkSkillsAction = "manage-all";

const CELL_ACTION_SEPARATOR = "\u0000";

export function cellActionKey(skillRef: string, harness: string): CellActionKey {
  return `${skillRef}${CELL_ACTION_SEPARATOR}${harness}`;
}

export function hasPendingToggleForCell(
  pendingToggleKeys: ReadonlySet<CellActionKey>,
  skillRef: string,
  harness: string,
): boolean {
  return pendingToggleKeys.has(cellActionKey(skillRef, harness));
}

export function pendingToggleHarnessesForSkill(
  pendingToggleKeys: ReadonlySet<CellActionKey>,
  skillRef: string,
): ReadonlySet<string> {
  const prefix = `${skillRef}${CELL_ACTION_SEPARATOR}`;
  const harnesses = new Set<string>();
  for (const key of pendingToggleKeys) {
    if (key.startsWith(prefix)) {
      harnesses.add(key.slice(prefix.length));
    }
  }
  return harnesses;
}

export function hasPendingToggleForSkill(
  pendingToggleKeys: ReadonlySet<CellActionKey>,
  skillRef: string,
): boolean {
  const prefix = `${skillRef}${CELL_ACTION_SEPARATOR}`;
  for (const key of pendingToggleKeys) {
    if (key.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}
