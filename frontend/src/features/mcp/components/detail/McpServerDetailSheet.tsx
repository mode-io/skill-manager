import * as Dialog from "@radix-ui/react-dialog";

import type { McpInventoryColumnDto } from "../../api/management-types";
import { McpServerDetailView } from "./McpServerDetailView";

interface McpServerDetailSheetProps {
  name: string | null;
  columns: McpInventoryColumnDto[];
  pendingPerHarness: ReadonlySet<string>;
  isServerPending: boolean;
  isUninstalling: boolean;
  onClose: () => void;
  onEnableHarness: (harness: string) => void;
  onDisableHarness: (harness: string) => void;
  onResolveConfig: (
    args: {
      sourceKind: "managed" | "harness";
      sourceHarness?: string | null;
      harnesses?: string[];
    },
  ) => Promise<void>;
  onUninstall: () => void;
}

export function McpServerDetailSheet({ name, onClose, ...rest }: McpServerDetailSheetProps) {
  if (!name) {
    return null;
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="detail-sheet mcp-detail-modal"
          aria-label={`MCP server ${name}`}
        >
          <Dialog.Title className="u-visually-hidden">MCP server {name}</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            Inspect and manage an installed MCP server.
          </Dialog.Description>
          <McpServerDetailView name={name} onClose={onClose} {...rest} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
