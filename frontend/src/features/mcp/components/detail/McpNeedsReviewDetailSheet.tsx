import * as Dialog from "@radix-ui/react-dialog";

import type { McpIdentityGroupDto } from "../../api/management-types";
import { McpNeedsReviewDetailView } from "./McpNeedsReviewDetailView";

interface McpNeedsReviewDetailSheetProps {
  name: string | null;
  group: McpIdentityGroupDto | null;
  isLoading: boolean;
  errorMessage: string;
  pending: boolean;
  onClose: () => void;
  onAdopt: () => void;
  onChooseConfigToAdopt: () => void;
}

export function McpNeedsReviewDetailSheet({
  name,
  onClose,
  ...rest
}: McpNeedsReviewDetailSheetProps) {
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
          aria-label={`MCP config to review ${name}`}
        >
          <Dialog.Title className="u-visually-hidden">MCP config to review {name}</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            Inspect an MCP server found across harnesses and adopt it, or choose a config to adopt.
          </Dialog.Description>
          <McpNeedsReviewDetailView onClose={onClose} {...rest} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
