import { FormEvent, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";

import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { useMcpCopy } from "../../i18n";
import {
  buildInitialInstallConfigValues,
  buildInstallConfigPayload,
  type InstallConfigFormValues,
  type McpInstallConfigValues,
  missingRequiredInstallConfigFields,
  type PendingMcpInstallConfig,
} from "../../model/install-config";
import { McpInstallConfigField } from "./McpInstallConfigField";

interface McpInstallConfigDialogProps {
  pending: PendingMcpInstallConfig | null;
  installing: boolean;
  onClose: () => void;
  onSubmit: (config: McpInstallConfigValues) => void;
}

export function McpInstallConfigDialog({
  pending,
  installing,
  onClose,
  onSubmit,
}: McpInstallConfigDialogProps) {
  const copy = useMcpCopy();
  const fields = useMemo(() => pending?.installConfig.fields ?? [], [pending]);
  const [values, setValues] = useState<InstallConfigFormValues>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  useEffect(() => {
    setValues(buildInitialInstallConfigValues(fields));
    setVisibleSecrets(new Set());
  }, [fields]);

  if (!pending) {
    return null;
  }

  const missingRequired = missingRequiredInstallConfigFields(fields, values);
  const canInstall = missingRequired.length === 0 && !installing;

  function toggleSecret(name: string): void {
    setVisibleSecrets((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canInstall) {
      return;
    }
    onSubmit(buildInstallConfigPayload(fields, values));
  }

  return (
    <Dialog.Root open onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="detail-sheet scan-config-detail-modal">
          <Dialog.Title className="u-visually-hidden">
            {copy.detail.installConfig.title(pending.displayName)}
          </Dialog.Title>
          <Dialog.Description className="u-visually-hidden">
            {copy.detail.installConfig.description(pending.targetLabel)}
          </Dialog.Description>
          <DetailHeader
            title={<h2>{copy.detail.installConfig.title(pending.displayName)}</h2>}
            meta={
                <p className="scan-config-detail-modal__description">
                {copy.detail.installConfig.description(pending.targetLabel)}
              </p>
            }
            closeLabel={copy.detail.installConfig.cancel}
            onClose={onClose}
          />
          <form className="scan-config-detail-modal__form" onSubmit={handleSubmit}>
            <div className="scan-config-detail-modal__body ui-scrollbar">
              <div className="detail-sheet__body">
                <p className="muted-text">
                  {pending.installConfig.required
                    ? copy.detail.installConfig.requiredHint
                    : copy.detail.installConfig.optionalHint}
                </p>
                <div className="scan-config-panel__form-grid">
                  {fields.map((field) => (
                    <McpInstallConfigField
                      key={field.name}
                      field={field}
                      value={values[field.name]}
                      secretVisible={visibleSecrets.has(field.name)}
                      onToggleSecret={() => toggleSecret(field.name)}
                      onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
                    />
                  ))}
                </div>
                {missingRequired.length > 0 ? (
                  <p className="scan-config-detail-modal__validation-error">
                    {copy.detail.installConfig.missingRequired(missingRequired.join(", "))}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="scan-config-detail-modal__footer">
              <button type="button" className="action-pill action-pill--md" onClick={onClose}>
                {copy.detail.installConfig.cancel}
              </button>
              <button
                type="submit"
                className="action-pill action-pill--md action-pill--accent"
                disabled={!canInstall}
              >
                {installing ? (
                  <Loader2 size={14} className="mcp-dialog__spinner" aria-hidden="true" />
                ) : null}
                {copy.detail.installConfig.install}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
