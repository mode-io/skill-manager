import * as Dialog from "@radix-ui/react-dialog";

import type { McpInventoryColumnDto } from "../../api/management-types";
import { useMcpCopy } from "../../i18n";
import type { McpInstallConfigValues } from "../../model/install-config";
import { McpServerDetailView } from "./McpServerDetailView";

interface McpServerDetailSheetProps {
  name: string | null;
  columns: McpInventoryColumnDto[];
  pendingPerHarness: ReadonlySet<string>;
  isServerPending: boolean;
  isUninstalling: boolean;
  onClose: () => void;
  onEnableHarness: (harness: string, config?: McpInstallConfigValues) => void;
  onDisableHarness: (harness: string) => void;
  onResolveConfig: (
    args: {
      sourceKind: "managed" | "harness";
      observedHarness?: string | null;
      harnesses?: string[];
    },
  ) => Promise<void>;
  onUninstall: () => void;
}

export function McpServerDetailSheet({ name, onClose, ...rest }: McpServerDetailSheetProps) {
  const copy = useMcpCopy();
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
          aria-label={copy.detail.sheet.inUseLabel(name)}
        >
          <Dialog.Title className="u-visually-hidden">{copy.detail.sheet.inUseTitle(name)}</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            {copy.detail.sheet.inUseDescription}
          </Dialog.Description>
          <McpServerDetailView name={name} onClose={onClose} {...rest} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
