import type { McpStatusDto } from "../api/management-types";
import { useMcpCopy } from "../i18n";
import { mcpStatusReason } from "../model/mcp-status";

interface McpStatusChipProps {
  status: McpStatusDto;
}

export function McpStatusChip({ status }: McpStatusChipProps) {
  const copy = useMcpCopy();
  const label = copy.detail.mcpStatus[status.kind];
  const reason = mcpStatusReason(status, copy);

  return (
    <span
      className="chip mcp-status-chip"
      data-kind={status.kind}
      aria-label={copy.detail.mcpStatusAria(label)}
      title={reason ?? undefined}
    >
      <span className="mcp-status-chip__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
