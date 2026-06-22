import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import type { McpBindingDto, McpInventoryColumnDto } from "../api/management-types";
import { useMcpCopy } from "../i18n";
import { isMcpHarnessAddressable } from "../model/selectors";

interface McpHarnessLogoStackProps {
  bindings: McpBindingDto[];
  columns: McpInventoryColumnDto[];
  showAllWritable?: boolean;
  serverName?: string;
  serverDisplayName?: string;
  disabled?: boolean;
  pendingPerHarnessKeys?: ReadonlySet<string>;
  onEnableHarness?: (harness: string) => void;
  onDisableHarness?: (harness: string) => void;
  onResolveConfig?: (harness: string) => void;
}

/**
 * Stack of harness logos for one MCP server.
 * - By default, shows writable harnesses where state is `managed` or `drifted`.
 * - In MCP server cards, `showAllWritable` also shows writable missing
 *   harnesses as disabled so the card mirrors the Skills in-use coverage UI.
 * - Different-config entries get an orange dot overlay (CSS via data-drifted).
 * - Trailing "X/N" count = managed / addressable.
 */
export function McpHarnessLogoStack({
  bindings,
  columns,
  showAllWritable = false,
  serverName,
  serverDisplayName,
  disabled = false,
  pendingPerHarnessKeys,
  onEnableHarness,
  onDisableHarness,
  onResolveConfig,
}: McpHarnessLogoStackProps) {
  const copy = useMcpCopy();
  const bindingByHarness = new Map(bindings.map((binding) => [binding.harness, binding]));
  const labelByHarness = new Map(columns.map((c) => [c.harness, c.label]));
  const logoByHarness = new Map(columns.map((c) => [c.harness, c.logoKey ?? c.harness]));
  const addressableColumns = columns.filter(isMcpHarnessAddressable);
  const addressable = new Set(addressableColumns.map((c) => c.harness));
  const visibleColumns = showAllWritable
    ? addressableColumns
    : addressableColumns.filter((column) => {
        const state = bindingByHarness.get(column.harness)?.state;
        return state === "managed" || state === "drifted";
      });

  const managedCount = bindings.filter(
    (b) => addressable.has(b.harness) && b.state === "managed",
  ).length;
  const totalCount = addressable.size;
  const ariaLabel = `Bound to ${managedCount} of ${totalCount} harnesses`;

  return (
    <div className="skill-card__harness-row">
      <div className="harness-stack" aria-label={ariaLabel}>
        {visibleColumns.map((column, index) => {
          const binding = bindingByHarness.get(column.harness);
          const state = binding?.state === "managed" ? "enabled" : binding?.state === "drifted" ? "drifted" : "disabled";
          const presentation = getHarnessPresentation(logoByHarness.get(column.harness) ?? null);
          const label = labelByHarness.get(column.harness) ?? column.harness;
          const pending =
            serverName !== undefined
            && (pendingPerHarnessKeys?.has(`${serverName}:${column.harness}`) ?? false);
          const title =
            state === "drifted"
              ? `${label} — Different config${binding?.driftDetail ? ` (${binding.driftDetail})` : ""}`
              : state === "enabled"
                ? label
                : `${label} — disabled`;
          const logo = presentation ? (
            <img src={presentation.logoSrc} alt="" aria-hidden="true" />
          ) : (
            <span className="harness-stack__fallback">{label.slice(0, 1)}</span>
          );
          const displayName = serverDisplayName ?? serverName;
          const baseLabel = displayName
            ? copy.detail.matrix.baseLabel(displayName, label)
            : label;
          const ariaLabel =
            state === "drifted"
              ? copy.detail.matrix.resolveConfigFor(baseLabel)
              : state === "enabled"
                ? copy.detail.matrix.disable(baseLabel)
                : copy.detail.matrix.enable(baseLabel);
          const onClick =
            state === "drifted"
              ? onResolveConfig
              : state === "enabled"
                ? onDisableHarness
                : onEnableHarness;
          const interactive = Boolean(onClick && displayName);
          return (
            <UiTooltip key={column.harness} content={title}>
              {interactive ? (
                <button
                  type="button"
                  className="harness-stack__item skill-card__harness-toggle"
                  data-state={state}
                  data-drifted={state === "drifted" ? "true" : undefined}
                  data-pending={pending ? "true" : undefined}
                  style={{ zIndex: visibleColumns.length - index }}
                  disabled={disabled || pending}
                  aria-label={ariaLabel}
                  aria-pressed={state === "drifted" ? undefined : state === "enabled"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClick?.(column.harness);
                  }}
                >
                  {logo}
                </button>
              ) : (
                <span
                  className="harness-stack__item"
                  data-state={state}
                  data-drifted={state === "drifted" ? "true" : undefined}
                  style={{ zIndex: visibleColumns.length - index }}
                >
                  {logo}
                </span>
              )}
            </UiTooltip>
          );
        })}
      </div>
      <span className="skill-card__harness-count">
        {managedCount}/{totalCount}
      </span>
    </div>
  );
}
