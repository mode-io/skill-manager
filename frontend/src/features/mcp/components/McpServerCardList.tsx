import type { McpInventoryColumnDto, McpInventoryEntryDto } from "../api/management-types";
import { McpServerCard } from "./McpServerCard";

interface McpServerCardListProps {
  entries: McpInventoryEntryDto[];
  columns: McpInventoryColumnDto[];
  pendingServerKeys: ReadonlySet<string>;
  checkedNames: ReadonlySet<string>;
  onOpenDetail: (name: string) => void;
  onToggleChecked: (name: string) => void;
  onSetHarnesses: (name: string, target: "enabled" | "disabled") => void;
  onRequestUninstall: (name: string) => void;
  ariaLabel?: string;
}

export function McpServerCardList({
  entries,
  columns,
  pendingServerKeys,
  checkedNames,
  onOpenDetail,
  onToggleChecked,
  onSetHarnesses,
  onRequestUninstall,
  ariaLabel = "MCP servers list",
}: McpServerCardListProps) {
  return (
    <section className="skill-grid" aria-label={ariaLabel}>
      {entries.map((entry) => (
        <McpServerCard
          key={entry.name}
          entry={entry}
          columns={columns}
          pending={pendingServerKeys.has(entry.name)}
          checked={checkedNames.has(entry.name)}
          onOpenDetail={onOpenDetail}
          onToggleChecked={onToggleChecked}
          onSetHarnesses={onSetHarnesses}
          onRequestUninstall={onRequestUninstall}
        />
      ))}
    </section>
  );
}
