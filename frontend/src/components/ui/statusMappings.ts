import type { HarnessCellState, SkillStatus } from "../../api/types";
import type { StatusBadgeTone } from "./StatusBadge";

export function skillStatusTone(status: SkillStatus): StatusBadgeTone {
  switch (status) {
    case "Managed":
      return "success";
    case "Custom":
      return "warning";
    case "Found locally":
      return "neutral";
    case "Built-in":
      return "muted";
    default:
      return "neutral";
  }
}

export function passiveHarnessStateBadge(state: HarnessCellState): { label: string; tone: StatusBadgeTone } | null {
  switch (state) {
    case "found":
      return { label: "Found", tone: "neutral" };
    case "builtin":
      return { label: "Built-in", tone: "muted" };
    default:
      return null;
  }
}
