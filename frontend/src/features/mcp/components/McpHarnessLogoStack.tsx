import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import type { McpBindingDto, McpInventoryColumnDto } from "../api/management-types";
import { isMcpHarnessAddressable } from "../model/selectors";

interface McpHarnessLogoStackProps {
  bindings: McpBindingDto[];
  columns: McpInventoryColumnDto[];
  showAllWritable?: boolean;
}

/**
 * Stack of harness logos for one MCP server.
 * - By default, shows writable harnesses where state is `managed` or `drifted`.
 * - In MCP server cards, `showAllWritable` also shows writable missing
 *   harnesses as disabled so the card mirrors the Skills in-use coverage UI.
 * - Different-config entries get an orange dot overlay (CSS via data-drifted).
 * - Trailing "X/N" count = managed / addressable.
 */
export function McpHarnessLogoStack({ bindings, columns, showAllWritable = false }: McpHarnessLogoStackProps) {
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
          const title =
            state === "drifted"
              ? `${label} — Different config${binding?.driftDetail ? ` (${binding.driftDetail})` : ""}`
              : state === "enabled"
                ? label
                : `${label} — disabled`;
          return (
            <UiTooltip key={column.harness} content={title}>
              <span
                className="harness-stack__item"
                data-state={state}
                data-drifted={state === "drifted" ? "true" : undefined}
                style={{ zIndex: visibleColumns.length - index }}
              >
                {presentation ? (
                  <img src={presentation.logoSrc} alt="" aria-hidden="true" />
                ) : (
                  <span className="harness-stack__fallback">{label.slice(0, 1)}</span>
                )}
              </span>
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
