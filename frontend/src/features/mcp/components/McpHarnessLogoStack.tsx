import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import type { McpBindingDto, McpInventoryColumnDto } from "../api/management-types";
import { isMcpHarnessAddressable } from "../model/selectors";

interface McpHarnessLogoStackProps {
  bindings: McpBindingDto[];
  columns: McpInventoryColumnDto[];
}

/**
 * Stack of harness logos for one MCP server.
 * - Shows logos for harnesses where state is `managed` or `drifted`,
 *   restricted to harnesses with verified MCP write capability
 *   (isMcpHarnessAddressable).
 * - Different-config entries get an orange dot overlay (CSS via data-drifted).
 * - Trailing "X/N" count = managed / addressable.
 */
export function McpHarnessLogoStack({ bindings, columns }: McpHarnessLogoStackProps) {
  const labelByHarness = new Map(columns.map((c) => [c.harness, c.label]));
  const logoByHarness = new Map(columns.map((c) => [c.harness, c.logoKey ?? c.harness]));
  const addressable = new Set(columns.filter(isMcpHarnessAddressable).map((c) => c.harness));

  const visible = bindings.filter(
    (b) => addressable.has(b.harness) && (b.state === "managed" || b.state === "drifted"),
  );
  const managedCount = bindings.filter(
    (b) => addressable.has(b.harness) && b.state === "managed",
  ).length;
  const totalCount = addressable.size;
  const ariaLabel = `Bound to ${managedCount} of ${totalCount} harnesses`;

  return (
    <div className="skill-card__harness-row">
      <div className="harness-stack" aria-label={ariaLabel}>
        {visible.map((binding, index) => {
          const presentation = getHarnessPresentation(logoByHarness.get(binding.harness) ?? null);
          const label = labelByHarness.get(binding.harness) ?? binding.harness;
          const title =
            binding.state === "drifted"
              ? `${label} — Different config${binding.driftDetail ? ` (${binding.driftDetail})` : ""}`
              : label;
          return (
            <UiTooltip key={binding.harness} content={title}>
              <span
                className="harness-stack__item"
                data-drifted={binding.state === "drifted" ? "true" : undefined}
                style={{ zIndex: visible.length - index }}
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
