import type { ReactNode } from "react";

interface McpDetailShellProps {
  chrome: ReactNode;
  body: ReactNode;
  footer?: ReactNode;
  bodyAriaLabelledBy?: string;
  bodyAriaHidden?: boolean;
}

export function McpDetailShell({
  chrome,
  body,
  footer,
  bodyAriaLabelledBy,
  bodyAriaHidden = false,
}: McpDetailShellProps) {
  return (
    <>
      <div className="mcp-detail-shell__chrome">{chrome}</div>
      <div
        className="mcp-detail-shell__body ui-scrollbar"
        aria-labelledby={bodyAriaHidden ? undefined : bodyAriaLabelledBy}
        aria-hidden={bodyAriaHidden || undefined}
      >
        <div className="detail-sheet__body">{body}</div>
      </div>
      {footer ? (
        <footer className="mcp-detail-shell__footer" aria-label="MCP actions">
          {footer}
        </footer>
      ) : null}
    </>
  );
}
