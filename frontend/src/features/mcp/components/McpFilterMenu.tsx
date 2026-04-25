import { SelectionMenu } from "../../../components/ui/SelectionMenu";
import type { InUsePillValue } from "../model/selectors";

const PILL_LABELS: Record<InUsePillValue, string> = {
  all: "All",
  enabled: "Enabled",
  "all-harnesses": "Enabled on all",
  unbound: "Unbound",
  drifted: "Different config",
};

const OPTIONS: InUsePillValue[] = ["all", "enabled", "all-harnesses", "unbound", "drifted"];

interface McpFilterMenuProps {
  pill: InUsePillValue;
  counts: Record<InUsePillValue, number>;
  onChange: (next: InUsePillValue) => void;
}

export function McpFilterMenu({ pill, counts, onChange }: McpFilterMenuProps) {
  const options = OPTIONS.map((value) => ({
    value,
    label: PILL_LABELS[value],
    meta: counts[value],
  }));

  return (
    <SelectionMenu
      value={pill}
      options={options}
      active={pill !== "all"}
      ariaLabel={`Filter: ${PILL_LABELS[pill]}`}
      onChange={onChange}
    />
  );
}
