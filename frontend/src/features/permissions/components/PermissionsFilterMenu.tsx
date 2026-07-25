import { SelectionMenu } from "../../../components/ui/SelectionMenu";
import type { InUsePillValue } from "../model/selectors";
import { usePermissionsCopy } from "../i18n";

const OPTIONS: InUsePillValue[] = ["all", "enabled", "all-harnesses", "unbound", "drifted"];

interface PermissionsFilterMenuProps {
  pill: InUsePillValue;
  counts: Record<InUsePillValue, number>;
  onChange: (next: InUsePillValue) => void;
}

export function PermissionsFilterMenu({ pill, counts, onChange }: PermissionsFilterMenuProps) {
  const copy = usePermissionsCopy();
  const options = OPTIONS.map((value) => ({
    value,
    label: pillLabel(copy, value),
    meta: counts[value],
  }));

  return (
    <SelectionMenu
      value={pill}
      options={options}
      active={pill !== "all"}
      ariaLabel={copy.inUse.filters.aria(pillLabel(copy, pill))}
      onChange={onChange}
    />
  );
}

function pillLabel(copy: ReturnType<typeof usePermissionsCopy>, value: InUsePillValue): string {
  if (value === "all") return copy.inUse.filters.all;
  if (value === "enabled") return copy.inUse.filters.enabled;
  if (value === "all-harnesses") return copy.inUse.filters.allHarnesses;
  if (value === "unbound") return copy.inUse.filters.unbound;
  return copy.inUse.filters.drifted;
}
