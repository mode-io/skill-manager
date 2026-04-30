import type {
  SlashCommandDto,
  SlashCommandReviewDto,
  SlashReviewAction,
  SlashTargetDto,
} from "../api/types";

export type SlashBucket = "disabled" | "selective" | "enabled";
export type SlashTerminalBucket = "disabled" | "enabled";
export type SlashCommandBuckets = Record<SlashBucket, SlashCommandDto[]>;
export type SlashMatrixSortKey = "name" | "coverage" | { target: string };
export type SlashMatrixSortDirection = "asc" | "desc";

export interface SlashMatrixSortState {
  key: SlashMatrixSortKey;
  direction: SlashMatrixSortDirection;
}

export const EMPTY_BUCKETS: SlashCommandBuckets = {
  disabled: [],
  selective: [],
  enabled: [],
};

export function syncedTargetIds(command: SlashCommandDto): Set<string> {
  return new Set(
    command.syncTargets
      .filter((entry) => entry.status === "synced")
      .map((entry) => entry.target),
  );
}

export function countSyncedTargets(command: SlashCommandDto): number {
  return syncedTargetIds(command).size;
}

export function filterSlashCommands(
  commands: SlashCommandDto[],
  search: string,
): SlashCommandDto[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return commands;
  return commands.filter((command) =>
    `${command.name} ${command.description}`.toLowerCase().includes(needle),
  );
}

export function bucketForSlashCommand(
  command: SlashCommandDto,
  targetCount: number,
): SlashBucket {
  const enabledCount = countSyncedTargets(command);
  if (enabledCount === 0 || targetCount === 0) return "disabled";
  if (enabledCount === targetCount) return "enabled";
  return "selective";
}

export function bucketSlashCommands(
  commands: SlashCommandDto[],
  targetCount: number,
): SlashCommandBuckets {
  return commands.reduce<SlashCommandBuckets>(
    (acc, command) => {
      acc[bucketForSlashCommand(command, targetCount)].push(command);
      return acc;
    },
    { disabled: [], selective: [], enabled: [] },
  );
}

export function enabledTargetsForCommand(
  command: SlashCommandDto,
  targets: SlashTargetDto[],
): SlashTargetDto[] {
  const synced = syncedTargetIds(command);
  return targets.filter((target) => synced.has(target.id));
}

export function sortSlashCommands(
  commands: SlashCommandDto[],
  sort: SlashMatrixSortState,
): SlashCommandDto[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...commands].sort((left, right) => {
    const comparison = compareBySortKey(left, right, sort.key);
    if (comparison !== 0) return comparison * direction;
    return left.name.localeCompare(right.name);
  });
}

export function slashSortKeysEqual(
  left: SlashMatrixSortKey,
  right: SlashMatrixSortKey,
): boolean {
  if (typeof left === "string" || typeof right === "string") {
    return left === right;
  }
  return left.target === right.target;
}

export function filterSlashReviewRows(
  rows: SlashCommandReviewDto[],
  search: string,
): SlashCommandReviewDto[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    `${row.name} ${row.description} ${row.targetLabel} ${row.path} ${row.kind}`
      .toLowerCase()
      .includes(needle),
  );
}

export function primaryReviewAction(row: SlashCommandReviewDto): SlashReviewAction | null {
  if (row.actions.includes("import")) return "import";
  if (row.actions.includes("restore_managed")) return "restore_managed";
  if (row.actions.includes("adopt_target")) return "adopt_target";
  if (row.actions.includes("remove_binding")) return "remove_binding";
  return null;
}

export function reviewActionLabel(action: SlashReviewAction | null): string {
  if (action === "restore_managed") return "Restore";
  if (action === "adopt_target") return "Adopt";
  if (action === "remove_binding") return "Remove binding";
  if (action === "import") return "Adopt";
  return "Review";
}

export function reviewActionTitle(action: SlashReviewAction): string {
  if (action === "restore_managed") return "Restore the managed command content to this harness";
  if (action === "adopt_target") return "Use this harness command as the managed command content";
  if (action === "remove_binding") return "Stop tracking this harness command without deleting it";
  return "Adopt this command into Skill Manager";
}

export function reviewMetaText(row: SlashCommandReviewDto): string {
  if (row.kind === "drifted") return `Changed in ${row.targetLabel}`;
  if (row.kind === "missing") return `Missing from ${row.targetLabel}`;
  return `Found in ${row.targetLabel}`;
}

function compareBySortKey(
  left: SlashCommandDto,
  right: SlashCommandDto,
  key: SlashMatrixSortKey,
): number {
  if (key === "name") return left.name.localeCompare(right.name);
  if (key === "coverage") return countSyncedTargets(left) - countSyncedTargets(right);
  const leftEnabled = syncedTargetIds(left).has(key.target) ? 1 : 0;
  const rightEnabled = syncedTargetIds(right).has(key.target) ? 1 : 0;
  return leftEnabled - rightEnabled;
}
