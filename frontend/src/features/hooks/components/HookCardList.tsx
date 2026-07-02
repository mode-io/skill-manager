import type { HookInventoryColumnDto, HookInventoryEntryDto } from "../api/management-types";
import { HookCard } from "./HookCard";

interface HookCardListProps {
  entries: HookInventoryEntryDto[];
  columns: HookInventoryColumnDto[];
  pendingHookKeys: ReadonlySet<string>;
  checkedIds: ReadonlySet<string>;
  onOpenDetail: (id: string) => void;
  onToggleChecked: (id: string) => void;
  onSetHarnesses: (id: string, target: "enabled" | "disabled") => void;
  onRequestUninstall: (id: string) => void;
  ariaLabel?: string;
}

export function HookCardList({
  entries,
  columns,
  pendingHookKeys,
  checkedIds,
  onOpenDetail,
  onToggleChecked,
  onSetHarnesses,
  onRequestUninstall,
  ariaLabel,
}: HookCardListProps) {
  return (
    <section className="skill-grid" aria-label={ariaLabel ?? "Hooks list"}>
      {entries.map((entry) => (
        <HookCard
          key={entry.id}
          entry={entry}
          columns={columns}
          pending={pendingHookKeys.has(entry.id)}
          checked={checkedIds.has(entry.id)}
          onOpenDetail={onOpenDetail}
          onToggleChecked={onToggleChecked}
          onSetHarnesses={onSetHarnesses}
          onRequestUninstall={onRequestUninstall}
        />
      ))}
    </section>
  );
}
