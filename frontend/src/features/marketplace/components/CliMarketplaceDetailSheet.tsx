import * as Dialog from "@radix-ui/react-dialog";

import type { CliMarketplaceItemDto } from "../api/cli-types";
import { useMarketplaceCopy } from "../i18n";
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
  const copy = useMarketplaceCopy();

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
        <Dialog.Content className="detail-sheet ui-scrollbar" aria-label={copy.detail.sheet.cliLabel}>
          <Dialog.Title className="u-visually-hidden">{copy.detail.sheet.cliLabel}</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            {copy.detail.sheet.cliDescription}
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
