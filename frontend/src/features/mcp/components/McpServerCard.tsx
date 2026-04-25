import { useMemo } from "react";
import { Loader2, Power, Trash2 } from "lucide-react";

import { CardMenu, type CardMenuItem } from "../../../components/cards/CardMenu";
import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import type { McpInventoryColumnDto, McpInventoryEntryDto } from "../api/management-types";
import { isMcpHarnessAddressable } from "../model/selectors";
import { McpHarnessLogoStack } from "./McpHarnessLogoStack";

interface McpServerCardProps {
  entry: McpInventoryEntryDto;
  columns: McpInventoryColumnDto[];
  pending: boolean;
  checked: boolean;
  onOpenDetail: (name: string) => void;
  onToggleChecked: (name: string) => void;
  onSetHarnesses: (name: string, target: "enabled" | "disabled") => void;
  onRequestUninstall: (name: string) => void;
}

function managedCount(
  entry: McpInventoryEntryDto,
  addressable: ReadonlySet<string>,
): number {
  return entry.sightings.filter(
    (b) => addressable.has(b.harness) && b.state === "managed",
  ).length;
}

function hasDifferentConfig(
  entry: McpInventoryEntryDto,
  addressable: ReadonlySet<string>,
): boolean {
  return entry.sightings.some(
    (b) => addressable.has(b.harness) && b.state === "drifted",
  );
}

export function McpServerCard({
  entry,
  columns,
  pending,
  checked,
  onOpenDetail,
  onToggleChecked,
  onSetHarnesses,
  onRequestUninstall,
}: McpServerCardProps) {
  const addressableHarnesses = useMemo(
    () => new Set(columns.filter(isMcpHarnessAddressable).map((c) => c.harness)),
    [columns],
  );
  const enabled = managedCount(entry, addressableHarnesses);
  const total = addressableHarnesses.size;
  const differentConfig = hasDifferentConfig(entry, addressableHarnesses);
  const allEnabled = total > 0 && enabled === total;
  const target: "enabled" | "disabled" = allEnabled ? "disabled" : "enabled";
  const transport = entry.spec?.transport ?? "—";
  const description = entry.spec?.url
    ? entry.spec.url
    : entry.spec?.command
      ? `${entry.spec.command} ${(entry.spec.args ?? []).join(" ")}`.trim()
      : "Installed via skill-manager";

  const menuItems = useMemo<CardMenuItem[]>(
    () => [
      {
        key: "uninstall",
        label: "Uninstall",
        icon: <Trash2 size={13} aria-hidden="true" />,
        destructive: true,
        onSelect: () => onRequestUninstall(entry.name),
      },
    ],
    [entry.name, onRequestUninstall],
  );

  return (
    <article
      className="skill-card mcp-server-card"
      data-pending={pending || undefined}
      data-selected={checked || undefined}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(entry.name)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(entry.name);
        }
      }}
      aria-label={`Open detail for ${entry.displayName}`}
    >
      <div className="skill-card__head">
        <OverflowTooltipText as="h3" className="skill-card__name">
          {entry.displayName}
        </OverflowTooltipText>
        <span aria-hidden="true" />
        <CardMenu
          label={`More actions for ${entry.displayName}`}
          items={menuItems}
          disabled={pending}
        />
        <CardSelectCheckbox
          checked={checked}
          onToggle={() => onToggleChecked(entry.name)}
          label={checked ? `Deselect ${entry.displayName}` : `Select ${entry.displayName}`}
          disabled={pending}
        />
      </div>

      <p className="mcp-server-card__transport">
        <code>{entry.name}</code> · {transport}
      </p>

      {description ? (
        <OverflowTooltipText
          as="p"
          className="skill-card__description mcp-server-card__detail"
        >
          {description}
        </OverflowTooltipText>
      ) : null}

      <div className="skill-card__footer">
        <McpHarnessLogoStack bindings={entry.sightings} columns={columns} />
        <button
          type="button"
          className="action-pill"
          disabled={pending || total === 0 || !entry.canEnable}
          onClick={(event) => {
            event.stopPropagation();
            if (differentConfig) {
              onOpenDetail(entry.name);
              return;
            }
            onSetHarnesses(entry.name, target);
          }}
          aria-label={
            differentConfig
              ? "Resolve config"
              : target === "enabled"
              ? "Enable on all harnesses"
              : "Disable everywhere"
          }
        >
          {pending ? (
            <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
          ) : (
            <Power size={12} aria-hidden="true" />
          )}
          {differentConfig ? "Resolve config" : target === "enabled" ? "Enable on all" : "Disable everywhere"}
        </button>
      </div>
    </article>
  );
}
