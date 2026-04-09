import type { StatusBadgeTone } from "../../../components/ui/StatusBadge";
import type { SkillStatus } from "./types";

export function skillStatusTone(status: SkillStatus): StatusBadgeTone {
  switch (status) {
    case "Managed":
      return "success";
    case "Custom":
      return "warning";
    case "Unmanaged":
      return "neutral";
    case "Built-in":
      return "muted";
    default:
      return "neutral";
  }
}
