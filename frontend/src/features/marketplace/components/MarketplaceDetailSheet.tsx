import * as Dialog from "@radix-ui/react-dialog";

import type { MarketplaceItemDto } from "../api/types";
import { MarketplaceDetailView } from "./MarketplaceDetailView";

interface MarketplaceDetailSheetProps {
  itemId: string | null;
  initialItem: MarketplaceItemDto | null;
  installPending: boolean;
  actionErrorMessage: string;
  onDismissActionError: () => void;
  onClose: () => void;
  onInstall: (item: Pick<MarketplaceItemDto, "id" | "installToken">) => Promise<void>;
  onOpenInstalledSkill: (skillRef: string) => void;
}

export function MarketplaceDetailSheet({
  itemId,
  initialItem,
  installPending,
  actionErrorMessage,
  onDismissActionError,
  onClose,
  onInstall,
  onOpenInstalledSkill,
}: MarketplaceDetailSheetProps) {
  if (!itemId) {
    return null;
  }

  return (
    <Dialog.Root open onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="marketplace-detail-overlay" />
        <Dialog.Content className="marketplace-detail-sheet ui-scrollbar" aria-label="Marketplace skill details">
          <Dialog.Title className="u-visually-hidden">Marketplace skill details</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            Preview a marketplace skill before opening it in Skills or installing it.
          </Dialog.Description>
          <MarketplaceDetailView
            itemId={itemId}
            initialItem={initialItem}
            installPending={installPending}
            actionErrorMessage={actionErrorMessage}
            onDismissActionError={onDismissActionError}
            onClose={onClose}
            onInstall={onInstall}
            onOpenInstalledSkill={onOpenInstalledSkill}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
