import { describe, expect, it } from "vitest";

import { mcpCopy } from "../i18n";
import { mcpStatusReason } from "./mcp-status";

describe("mcpStatusReason", () => {
  it("explains HTTP 403 connection errors with likely causes", () => {
    const reason = mcpStatusReason(
      {
        kind: "connection_issue",
        reason: "HTTP 403 Forbidden",
      },
      mcpCopy.en,
    );

    expect(reason).toBe("Access refused. Check credentials, permissions, or quota.");
    expect(reason).not.toContain("HTTP 403 Forbidden");
  });

  it("explains HTTP 401 with documentation links when available", () => {
    const reason = mcpStatusReason(
      {
        kind: "connection_issue",
        reason: "HTTP 401 Unauthorized",
      },
      mcpCopy.en,
      { documentationLinks: "available" },
    );

    expect(reason).toBe("Authentication required. Check the website or GitHub docs.");
    expect(reason).not.toContain("HTTP 401 Unauthorized");
  });

  it("explains HTTP 401 as not completable when no documentation links are available", () => {
    const reason = mcpStatusReason(
      {
        kind: "connection_issue",
        reason: "HTTP 401 Unauthorized",
      },
      mcpCopy.en,
      { documentationLinks: "missing" },
    );

    expect(reason).toBe("Authentication required, but no auth link or docs are listed.");
    expect(reason).not.toContain("HTTP 401 Unauthorized");
  });
});
