import { Eye, EyeOff } from "lucide-react";

import { useMcpCopy } from "../../i18n";
import type { McpInstallConfigFieldDto } from "../../model/install-config";
import { LinkifiedText } from "./LinkifiedText";

interface McpInstallConfigFieldProps {
  field: McpInstallConfigFieldDto;
  value: string | boolean | undefined;
  secretVisible: boolean;
  onToggleSecret: () => void;
  onChange: (value: string | boolean) => void;
}

const SECRET_NAME_RE = /(key|token|secret|password|authorization)/i;

export function McpInstallConfigField({
  field,
  value,
  secretVisible,
  onToggleSecret,
  onChange,
}: McpInstallConfigFieldProps) {
  const copy = useMcpCopy();
  const fieldId = `mcp-install-config-${field.name}`;
  const isSecret = isInstallConfigFieldSecret(field);
  const label = `${field.label || field.name}${field.required ? " *" : ""}`;

  if (field.format === "boolean") {
    return (
      <div className="mcp-config-form__field">
        <label className="mcp-config-form__checkbox">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
          <span>{label}</span>
        </label>
        <InstallConfigFieldHint description={field.description} />
      </div>
    );
  }

  const inputType = field.format === "number" ? "number" : isSecret && !secretVisible ? "password" : "text";
  return (
    <div className="mcp-config-form__field">
      <label className="mcp-config-form__label" htmlFor={fieldId}>{label}</label>
      <span className="mcp-config-form__input-wrap">
        {field.choices?.length ? (
          <select
            id={fieldId}
            className="mcp-config-form__input"
            value={String(value ?? "")}
            onChange={(event) => onChange(event.currentTarget.value)}
          >
            <option value="" />
            {field.choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={fieldId}
            className="mcp-config-form__input"
            type={inputType}
            value={String(value ?? "")}
            placeholder={field.placeholder ?? undefined}
            autoComplete={isSecret ? "new-password" : "off"}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        )}
        {isSecret ? (
          <button
            type="button"
            className="mcp-config-form__input-action"
            aria-label={secretVisible ? copy.detail.installConfig.hideSecret : copy.detail.installConfig.showSecret}
            onClick={onToggleSecret}
          >
            {secretVisible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          </button>
        ) : null}
      </span>
      <InstallConfigFieldHint description={field.description} />
    </div>
  );
}

export function isInstallConfigFieldSecret(field: McpInstallConfigFieldDto): boolean {
  return field.secret || SECRET_NAME_RE.test(`${field.name} ${field.description}`);
}

function InstallConfigFieldHint({ description }: { description: string | null | undefined }) {
  if (!description) {
    return null;
  }
  return (
    <span className="mcp-config-form__hint">
      <LinkifiedText text={description} />
    </span>
  );
}
