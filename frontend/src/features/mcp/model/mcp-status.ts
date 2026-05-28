import type { McpStatusDto } from "../api/management-types";
import type { McpCopy } from "../i18n";

interface McpStatusReasonOptions {
  documentationLinks?: "available" | "missing" | "unknown";
}

export function mcpStatusReason(
  status: McpStatusDto,
  copy: McpCopy,
  options: McpStatusReasonOptions = {},
): string | null {
  if (status.kind === "connection_issue" && status.reason) {
    return connectionIssueReason(status.reason, copy, options);
  }
  return copy.detail.mcpStatusReason[status.kind];
}

function connectionIssueReason(
  reason: string,
  copy: McpCopy,
  options: McpStatusReasonOptions,
): string {
  const httpStatus = /^HTTP\s+(\d{3})\b/i.exec(reason.trim())?.[1] ?? null;
  if (httpStatus === "401") {
    if (options.documentationLinks === "available") {
      return copy.detail.mcpStatusReason.httpUnauthorizedWithDocs();
    }
    if (options.documentationLinks === "missing") {
      return copy.detail.mcpStatusReason.httpUnauthorizedNoDocs();
    }
    return copy.detail.mcpStatusReason.httpUnauthorized();
  }
  if (httpStatus === "403") {
    return copy.detail.mcpStatusReason.httpForbidden();
  }
  if (httpStatus === "404") {
    return copy.detail.mcpStatusReason.httpNotFound();
  }
  if (httpStatus === "429") {
    return copy.detail.mcpStatusReason.httpRateLimited();
  }
  if (httpStatus && Number(httpStatus) >= 500) {
    return copy.detail.mcpStatusReason.httpServerError();
  }
  return reason;
}
