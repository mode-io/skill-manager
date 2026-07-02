import { useMemo } from "react";
import { Loader2, Power, Trash2 } from "lucide-react";

import { CardMenu, type CardMenuItem } from "../../../components/cards/CardMenu";
import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import type { HookInventoryColumnDto, HookInventoryEntryDto } from "../../hooks/api/management-types";
import { useHooksCopy } from "../../hooks/i18n";
import { isHooksHarnessAddressable } from "../model/selectors";
import { HooksHarnessLogoStack } from "./HooksHarnessLogoStack";
import { HooksStatusChip } from "./HooksStatusChip";

interface HookCardProps {
  entry: HookInventoryEntryDto;
  columns: HookInventoryColumnDto[];
  pending: boolean;
  checked: boolean;
  onOpenDetail: (id: string) => void;
  onToggleChecked: (id: string) => void;
  onSetHarnesses: (id: string, target: "enabled" | "disabled") => void;
  onRequestUninstall: (id: string) => void;
}

function managedCount(
  entry: HookInventoryEntryDto,
  addressable: ReadonlySet<string>,
): number {
  return entry.sightings.filter(
    (b) => addressable.has(b.harness) && b.state === "managed",
  ).length;
}

function hasDifferentConfig(
  entry: HookInventoryEntryDto,
  addressable: ReadonlySet<string>,
): boolean {
  return entry.sightings.some(
    (b) => addressable.has(b.harness) && b.state === "drifted",
  );
}

export function HookCard({
  entry,
  columns,
  pending,
  checked,
  onOpenDetail,
  onToggleChecked,
  onSetHarnesses,
  onRequestUninstall,
}: HookCardProps) {
  const copy = useHooksCopy();
  const addressableHarnesses = useMemo(
    () => new Set(columns.filter(isHooksHarnessAddressable).map((c) => c.harness)),
    [columns],
  );
  const enabled = managedCount(entry, addressableHarnesses);
  const total = addressableHarnesses.size;
  const differentConfig = hasDifferentConfig(entry, addressableHarnesses);
  const allEnabled = total > 0 && enabled === total;
  const target: "enabled" | "disabled" = allEnabled ? "disabled" : "enabled";

  const menuItems = useMemo<CardMenuItem[]>(
    () => [
      {
        key: "uninstall",
        label: copy.detail.uninstall,
        icon: <Trash2 size={13} aria-hidden="true" />,
        destructive: true,
        onSelect: () => onRequestUninstall(entry.id),
      },
    ],
    [copy.detail.uninstall, entry.id, onRequestUninstall],
  );

  return (
    <article
      className="skill-card hook-card"
      data-pending={pending || undefined}
      data-selected={checked || undefined}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(entry.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(entry.id);
        }
      }}
      aria-label={copy.detail.openDetail(entry.displayName)}
    >
      <div className="skill-card__head hook-card__head">
        <OverflowTooltipText as="h3" className="skill-card__name">
          {entry.displayName}
        </OverflowTooltipText>
        {entry.spec && <HooksStatusChip event={entry.spec.event} />}
        <div className="hook-card__actions">
          <CardMenu
            label={copy.detail.moreActions(entry.displayName)}
            items={menuItems}
            disabled={pending}
          />
          <CardSelectCheckbox
            checked={checked}
            onToggle={() => onToggleChecked(entry.id)}
            label={checked ? copy.detail.deselect(entry.displayName) : copy.detail.select(entry.displayName)}
            disabled={pending}
          />
        </div>
      </div>

      <p className="hook-card__command">
        <code>{entry.spec?.command ?? "—"}</code>
      </p>

      {entry.spec?.description ? (
        <OverflowTooltipText as="p" className="skill-card__description hook-card__detail">
          {entry.spec.description}
        </OverflowTooltipText>
      ) : null}

      <div className="skill-card__footer">
        <HooksHarnessLogoStack bindings={entry.sightings} columns={columns} />
        <button
          type="button"
          className="action-pill"
          disabled={pending || total === 0 || !entry.canEnable}
          onClick={(event) => {
            event.stopPropagation();
            if (differentConfig) {
              onOpenDetail(entry.id);
              return;
            }
            onSetHarnesses(entry.id, target);
          }}
        >
          {pending ? (
            <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
          ) : (
            <Power size={12} aria-hidden="true" />
          )}
          {differentConfig ? copy.detail.resolveConfig : target === "enabled" ? "Enable all" : "Disable everywhere"}
        </button>
      </div>
    </article>
  );
}
