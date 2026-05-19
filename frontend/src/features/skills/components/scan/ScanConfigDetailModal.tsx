import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Cpu, Eye, EyeOff, Key, Link2, Loader2 } from "lucide-react";

import type { ScanConfigItem, ScanConfigValidationResponse } from "../../../../api/scan";
import { DetailHeader } from "../../../../components/detail/DetailHeader";
import type { LLMScanConfigInput } from "../../model/use-skill-scan";

type ScanConfigEditorMode = "create" | "edit";

interface ScanConfigDetailModalProps {
  open: boolean;
  mode: ScanConfigEditorMode;
  config: ScanConfigItem | null;
  onClose: () => void;
  onAddConfig: (config: LLMScanConfigInput) => Promise<unknown>;
  onEditConfig: (id: number, config: LLMScanConfigInput) => Promise<void>;
  onRevealApiKey: (id: number) => Promise<string>;
  onValidateConfig: (config: LLMScanConfigInput & { existingConfigId?: number }) => Promise<ScanConfigValidationResponse>;
}

interface ConfigFormState {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

type ConfigFormField = keyof ConfigFormState;

const REQUIRED_FIELDS: Array<{ key: ConfigFormField; label: string }> = [
  { key: "name", label: "Configuration name" },
  { key: "baseUrl", label: "API Base URL" },
  { key: "apiKey", label: "API Key" },
  { key: "model", label: "Model" },
];
const HIDDEN_API_KEY_PLACEHOLDER = "x".repeat(64);

function emptyForm(): ConfigFormState {
  return {
    name: "",
    baseUrl: "",
    apiKey: "",
    model: "",
  };
}

function formFromConfig(config: ScanConfigItem): ConfigFormState {
  return {
    name: config.name,
    baseUrl: config.baseUrl,
    apiKey: HIDDEN_API_KEY_PLACEHOLDER,
    model: config.model,
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not validated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not validated";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function missingRequiredFields(form: ConfigFormState, mode: ScanConfigEditorMode): string[] {
  return REQUIRED_FIELDS
    .filter(({ key }) => mode === "create" || key !== "apiKey")
    .filter(({ key }) => form[key].trim() === "")
    .map(({ label }) => label);
}

function formChanged(form: ConfigFormState, config: ScanConfigItem | null, savedApiKey: string | null): boolean {
  if (!config) {
    return Object.values(form).some((value) => value.trim() !== "");
  }
  if (form.name.trim() !== config.name.trim()) return true;
  if (form.baseUrl.trim() !== config.baseUrl.trim()) return true;
  if (form.model.trim() !== config.model.trim()) return true;
  const apiKey = form.apiKey.trim();
  if (!apiKey || apiKey === HIDDEN_API_KEY_PLACEHOLDER || apiKey === config.apiKeyMasked.trim()) return false;
  return savedApiKey === null || apiKey !== savedApiKey.trim();
}

function payloadFromForm(form: ConfigFormState): LLMScanConfigInput {
  return {
    name: form.name.trim(),
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim(),
    model: form.model.trim(),
  };
}

function StatusMessage({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "error";
  children: ReactNode;
}) {
  return (
    <div className={`scan-config-panel__status scan-config-panel__status--${tone}`} aria-live="polite">
      {children}
    </div>
  );
}

function ConfigField({
  field,
  label,
  icon,
  type = "text",
  value,
  placeholder,
  hint,
  wide = false,
  autoComplete,
  required = true,
  trailing,
  onChange,
}: {
  field: ConfigFormField;
  label: string;
  icon?: ReactNode;
  type?: "text" | "url" | "password";
  value: string;
  placeholder: string;
  hint: string;
  wide?: boolean;
  autoComplete?: string;
  required?: boolean;
  trailing?: ReactNode;
  onChange: (field: ConfigFormField, value: string) => void;
}) {
  const id = `scan-config-${field}`;
  return (
    <div className={wide ? "scan-config-panel__field scan-config-panel__field--wide" : "scan-config-panel__field"}>
      <label className="scan-config-panel__label" htmlFor={id}>
        {icon}
        {label}
      </label>
      <span className="scan-config-panel__input-wrap">
        <input
          id={id}
          type={type}
          className="scan-config-panel__input"
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(field, event.target.value)}
          required={required}
        />
        {trailing}
      </span>
      <span className="scan-config-panel__hint">{hint}</span>
    </div>
  );
}

export function ScanConfigDetailModal({
  open,
  mode,
  config,
  onClose,
  onAddConfig,
  onEditConfig,
  onRevealApiKey,
  onValidateConfig,
}: ScanConfigDetailModalProps) {
  const headingId = useId();
  const [form, setForm] = useState<ConfigFormState>(emptyForm);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ScanConfigValidationResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(mode === "edit" && config ? formFromConfig(config) : emptyForm());
    setApiKeyVisible(false);
    setIsRevealing(false);
    setSavedApiKey(null);
    setTestResult(null);
    setSaveError(null);
  }, [config, mode, open]);

  useEffect(() => {
    if (!open || mode !== "edit" || !config) return;
    let cancelled = false;
    setIsRevealing(true);
    onRevealApiKey(config.id)
      .then((apiKey) => {
        if (cancelled) return;
        setSavedApiKey(apiKey);
        setForm((current) => ({ ...current, apiKey }));
      })
      .catch((error) => {
        if (cancelled) return;
        setSaveError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsRevealing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [config, mode, onRevealApiKey, open]);

  const missingFields = useMemo(() => missingRequiredFields(form, mode), [form, mode]);
  const isFormValid = missingFields.length === 0;
  const isDirty = useMemo(
    () => (mode === "edit" ? formChanged(form, config, savedApiKey) : formChanged(form, null, null)),
    [config, form, mode, savedApiKey],
  );
  const title = mode === "edit" ? "Update configuration" : "New configuration";
  const apiKeyHint = mode === "edit"
    ? `Leave blank to keep the saved API key${config?.apiKeyMasked ? ` (${config.apiKeyMasked})` : ""}`
    : "Stored in local SQLite; lists only show a masked value";
  const lastValidationLabel = config?.lastValidationError
    ? "Failed"
    : formatDateTime(config?.lastValidatedAt ?? null);
  const canSubmit = isFormValid && isDirty && !isSaving && !isTesting && !isRevealing;

  function resetFeedback() {
    setTestResult(null);
    setSaveError(null);
  }

  function updateField(field: ConfigFormField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    resetFeedback();
  }

  function buildPayload(): LLMScanConfigInput {
    const payload = payloadFromForm(form);
    if (mode === "edit") {
      if (payload.apiKey === HIDDEN_API_KEY_PLACEHOLDER) {
        return { ...payload, apiKey: "" };
      }
      if (payload.apiKey === config?.apiKeyMasked.trim()) {
        return { ...payload, apiKey: "" };
      }
      if (savedApiKey !== null && payload.apiKey === savedApiKey.trim()) {
        return { ...payload, apiKey: "" };
      }
    }
    return payload;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    if (mode === "edit" && !config) return;
    resetFeedback();
    setIsSaving(true);
    try {
      if (mode === "edit" && config) {
        await onEditConfig(config.id, buildPayload());
      } else {
        await onAddConfig(buildPayload());
      }
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    if (!isFormValid || isTesting || isRevealing) return;
    resetFeedback();
    setIsTesting(true);
    try {
      const result = await onValidateConfig({
        ...buildPayload(),
        existingConfigId: mode === "edit" ? config?.id : undefined,
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        provider: null,
        model: null,
        durationMs: null,
        errorCode: "request_failed",
      });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleApiKeyVisibility() {
    if (isRevealing) return;
    const currentApiKey = form.apiKey.trim();
    const hasRealTypedValue =
      currentApiKey &&
      currentApiKey !== HIDDEN_API_KEY_PLACEHOLDER &&
      currentApiKey !== config?.apiKeyMasked.trim();
    if (mode !== "edit" || !config || hasRealTypedValue || savedApiKey !== null) {
      setApiKeyVisible((current) => !current);
      return;
    }
    setIsRevealing(true);
    setSaveError(null);
    try {
      const apiKey = await onRevealApiKey(config.id);
      setSavedApiKey(apiKey);
      setForm((current) => ({ ...current, apiKey }));
      setApiKeyVisible(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRevealing(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="detail-sheet scan-config-detail-modal">
          <Dialog.Title asChild>
            <span className="u-visually-hidden">{title}</span>
          </Dialog.Title>
          <Dialog.Description className="u-visually-hidden">Configure LLM API key</Dialog.Description>
          <DetailHeader
            title={<h2 id={headingId}>{title}</h2>}
            meta={<p className="scan-config-detail-modal__description">Configure LLM API key</p>}
            closeLabel="Close scan configuration"
            onClose={onClose}
          />
          <form className="scan-config-detail-modal__form" onSubmit={handleSubmit}>
            <div className="scan-config-detail-modal__body ui-scrollbar" aria-labelledby={headingId}>
              <div className="detail-sheet__body">
                <div className="scan-config-panel__form-grid">
                  <ConfigField
                    field="name"
                    label="Configuration name"
                    value={form.name}
                    placeholder="e.g. Volcano Engine, Anthropic"
                    hint="Shown in the saved configuration list"
                    autoComplete="off"
                    onChange={updateField}
                  />
                  <ConfigField
                    field="model"
                    label="Model"
                    icon={<Cpu size={14} />}
                    value={form.model}
                    placeholder="claude-3-5-sonnet-20241022"
                    hint="Model used for scan requests"
                    autoComplete="off"
                    onChange={updateField}
                  />
                  <ConfigField
                    field="baseUrl"
                    label="API Base URL"
                    icon={<Link2 size={14} />}
                    type="url"
                    value={form.baseUrl}
                    placeholder="https://api.anthropic.com"
                    hint="The provider is inferred from this URL"
                    autoComplete="url"
                    wide
                    onChange={updateField}
                  />
                  <ConfigField
                    field="apiKey"
                    label="API Key"
                    icon={<Key size={14} />}
                    type={apiKeyVisible ? "text" : "password"}
                    value={form.apiKey}
                    placeholder={mode === "edit" ? "Leave blank to keep existing key" : "sk-..."}
                    hint={apiKeyHint}
                    autoComplete="new-password"
                    required={mode === "create"}
                    wide
                    onChange={updateField}
                    trailing={
                      <button
                        type="button"
                        className="scan-config-panel__input-action"
                        disabled={isRevealing}
                        aria-label={apiKeyVisible ? "Hide API key" : "Show API key"}
                        onClick={handleApiKeyVisibility}
                      >
                        {apiKeyVisible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                      </button>
                    }
                  />
                </div>

                {mode === "edit" && config ? (
                  <section className="scan-config-detail-modal__validation" aria-label="Last validation">
                    <span className="scan-config-detail-modal__validation-label">Last validation</span>
                    <span
                      className={
                        config.lastValidationError
                          ? "scan-config-detail-modal__validation-value scan-config-detail-modal__validation-value--error"
                          : "scan-config-detail-modal__validation-value"
                      }
                      title={config.lastValidationError || undefined}
                    >
                      {lastValidationLabel}
                    </span>
                    {config.lastValidationError ? (
                      <p className="scan-config-detail-modal__validation-error">{config.lastValidationError}</p>
                    ) : null}
                  </section>
                ) : null}

                {!isFormValid && missingFields.length > 0 ? (
                  <StatusMessage tone="neutral">Missing required fields: {missingFields.join(", ")}</StatusMessage>
                ) : null}
                {testResult ? (
                  <StatusMessage tone={testResult.ok ? "success" : "error"}>
                    {testResult.ok ? "Connectivity test passed" : testResult.message}
                  </StatusMessage>
                ) : null}
                {saveError ? <StatusMessage tone="error">{saveError}</StatusMessage> : null}
              </div>
            </div>
            <footer className="scan-config-detail-modal__footer" aria-label="Scan config actions">
              <button
                type="button"
                className="action-pill action-pill--md"
                disabled={!isFormValid || isTesting || isRevealing}
                data-pending={isTesting ? "true" : undefined}
                onClick={handleTestConnection}
              >
                {isTesting ? <Loader2 size={14} className="card-action-spinner" /> : <Link2 size={14} />}
                {isTesting ? "Testing" : "Test connectivity"}
              </button>
              <button
                type="submit"
                className="action-pill action-pill--md action-pill--accent"
                disabled={!canSubmit}
                data-pending={isSaving ? "true" : undefined}
              >
                {mode === "edit" ? "Update" : "Save"}
                {isSaving ? <Loader2 size={14} className="card-action-spinner" /> : <ArrowRight size={14} />}
              </button>
              <button type="button" className="action-pill action-pill--md" onClick={onClose}>
                Cancel
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
