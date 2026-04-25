import type { McpIdentityGroupDto } from "../api/management-types";
import { McpNeedsReviewServerRow } from "./McpNeedsReviewServerRow";

interface McpNeedsReviewServerListProps {
  groups: McpIdentityGroupDto[];
  pendingNames: ReadonlySet<string>;
  onOpenDetail: (name: string) => void;
  onAdoptIdentical: (name: string) => void;
  onChooseConfigToAdopt: (name: string) => void;
}

export function McpNeedsReviewServerList({
  groups,
  pendingNames,
  onOpenDetail,
  onAdoptIdentical,
  onChooseConfigToAdopt,
}: McpNeedsReviewServerListProps) {
  return (
    <div className="needs-review-rows" aria-label="MCP configs to review">
      {groups.map((group) => (
        <McpNeedsReviewServerRow
          key={group.name}
          group={group}
          pending={pendingNames.has(group.name)}
          onOpenDetail={onOpenDetail}
          onAdoptIdentical={onAdoptIdentical}
          onChooseConfigToAdopt={onChooseConfigToAdopt}
        />
      ))}
    </div>
  );
}
