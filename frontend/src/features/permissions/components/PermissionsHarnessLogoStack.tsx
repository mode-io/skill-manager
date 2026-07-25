import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import type { PermissionBindingDto, PermissionInventoryColumnDto } from "../../permissions/api/management-types";
import { isPermissionsHarnessAddressable } from "../model/selectors";

interface PermissionsHarnessLogoStackProps {
  bindings: PermissionBindingDto[];
  columns: PermissionInventoryColumnDto[];
}

export function PermissionsHarnessLogoStack({ bindings, columns }: PermissionsHarnessLogoStackProps) {
  const labelByHarness = new Map(columns.map((c) => [c.harness, c.label]));
  const logoByHarness = new Map(columns.map((c) => [c.harness, c.logoKey ?? c.harness]));
  const addressable = new Set(columns.filter(isPermissionsHarnessAddressable).map((c) => c.harness));

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
