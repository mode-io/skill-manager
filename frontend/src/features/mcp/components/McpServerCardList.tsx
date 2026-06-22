import type { McpInventoryColumnDto, McpInventoryEntryDto } from "../api/management-types";
import { useMcpCopy } from "../i18n";
import type { McpInstallConfigValues } from "../model/install-config";
import { McpServerCard } from "./McpServerCard";

interface McpServerCardListProps {
  entries: McpInventoryEntryDto[];
  columns: McpInventoryColumnDto[];
  pendingServerKeys: ReadonlySet<string>;
  pendingPerHarnessKeys: ReadonlySet<string>;
  checkedNames: ReadonlySet<string>;
  onOpenDetail: (name: string) => void;
  onToggleChecked: (name: string) => void;
  onEnableHarness: (name: string, harness: string) => void;
  onDisableHarness: (name: string, harness: string) => void;
  onSetHarnesses: (name: string, target: "enabled" | "disabled", config?: McpInstallConfigValues) => void;
  onRequestUninstall: (name: string) => void;
  ariaLabel?: string;
}

export function McpServerCardList({
  entries,
  columns,
  pendingServerKeys,
  pendingPerHarnessKeys,
  checkedNames,
  onOpenDetail,
  onToggleChecked,
  onEnableHarness,
  onDisableHarness,
  onSetHarnesses,
  onRequestUninstall,
  ariaLabel,
}: McpServerCardListProps) {
  const copy = useMcpCopy();
  return (
    <section className="skill-grid" aria-label={ariaLabel ?? copy.detail.list.serversAriaLabel}>
      {entries.map((entry) => (
        <McpServerCard
          key={entry.name}
          entry={entry}
          columns={columns}
          pending={pendingServerKeys.has(entry.name)}
          pendingPerHarnessKeys={pendingPerHarnessKeys}
          checked={checkedNames.has(entry.name)}
          onOpenDetail={onOpenDetail}
          onToggleChecked={onToggleChecked}
          onEnableHarness={onEnableHarness}
          onDisableHarness={onDisableHarness}
          onSetHarnesses={onSetHarnesses}
          onRequestUninstall={onRequestUninstall}
        />
      ))}
    </section>
  );
}
