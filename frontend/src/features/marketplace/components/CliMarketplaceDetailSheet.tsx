import * as Dialog from "@radix-ui/react-dialog";

import type { CliMarketplaceItemDto } from "../api/cli-types";
import { CliMarketplaceDetailView } from "./CliMarketplaceDetailView";

interface CliMarketplaceDetailSheetProps {
  itemId: string | null;
  initialItem: CliMarketplaceItemDto | null;
  onClose: () => void;
}

export function CliMarketplaceDetailSheet({
  itemId,
  initialItem,
  onClose,
}: CliMarketplaceDetailSheetProps) {
  if (!itemId) {
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
        <Dialog.Content className="detail-sheet ui-scrollbar" aria-label="CLI details">
          <Dialog.Title className="u-visually-hidden">CLI details</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            Preview CLI marketplace metadata and links. Skill Manager does not install or
            manage CLIs.
          </Dialog.Description>
          <CliMarketplaceDetailView
            key={itemId}
            itemId={itemId}
            initialItem={initialItem}
            onClose={onClose}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
