import * as Dialog from "@radix-ui/react-dialog";

import type { McpMarketplaceItemDto } from "../api/mcp-types";
import { McpMarketplaceDetailView } from "./McpMarketplaceDetailView";

interface McpMarketplaceDetailSheetProps {
  qualifiedName: string | null;
  initialItem: McpMarketplaceItemDto | null;
  onClose: () => void;
}

export function McpMarketplaceDetailSheet({
  qualifiedName,
  initialItem,
  onClose,
}: McpMarketplaceDetailSheetProps) {
  if (!qualifiedName) {
    return null;
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="detail-sheet ui-scrollbar"
          aria-label="MCP server details"
        >
          <Dialog.Title className="u-visually-hidden">MCP server details</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            Preview capabilities and connection details for a marketplace MCP server.
          </Dialog.Description>
          <McpMarketplaceDetailView
            qualifiedName={qualifiedName}
            initialItem={initialItem}
            onClose={onClose}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
