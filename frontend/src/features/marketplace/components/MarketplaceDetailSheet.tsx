import * as Dialog from "@radix-ui/react-dialog";

import type { MarketplaceItemDto } from "../api/types";
import { useMarketplaceCopy } from "../i18n";
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
  const copy = useMarketplaceCopy();

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
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="detail-sheet ui-scrollbar" aria-label={copy.detail.sheet.skillLabel}>
          <Dialog.Title className="u-visually-hidden">{copy.detail.sheet.skillLabel}</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            {copy.detail.sheet.skillDescription}
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
