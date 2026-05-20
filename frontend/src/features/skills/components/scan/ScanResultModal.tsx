import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import ScanPanel from "../../../../components/ScanPanel";
import type { ScanResult } from "../../../../api/scan";
import { useLocale } from "../../../../i18n";
import { useSkillsCopy } from "../../i18n";
import type { LLMScanConfig } from "../../model/use-skill-scan";

interface ScanResultModalProps {
  open: boolean;
  result: ScanResult | null;
  completedAt: number | null;
  llmConfig: LLMScanConfig | null;
  onClose: () => void;
}

export function ScanResultModal({ open, result, completedAt, llmConfig, onClose }: ScanResultModalProps) {
  const { locale } = useLocale();
  const copy = useSkillsCopy().inUse.scan.result;

  return (
    <Dialog.Root open={open && result !== null} onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="scan-result-modal">
          <Dialog.Title className="u-visually-hidden">{copy.dialogTitle}</Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            {copy.description}
          </Dialog.Description>
          <div className="scan-result-modal__header">
            <div className="scan-result-modal__heading">
              <h2 className="scan-result-modal__title">{copy.title}</h2>
              {completedAt ? (
                <span className="scan-result-modal__timestamp">{formatScanCompletedAt(completedAt, locale)}</span>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button type="button" className="scan-result-modal__close" aria-label={copy.close}>
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          {result ? <ScanPanel result={result} llmConfig={llmConfig} copy={copy} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function formatScanCompletedAt(value: number, locale: string): string {
  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
