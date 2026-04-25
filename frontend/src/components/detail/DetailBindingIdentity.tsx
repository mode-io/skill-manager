import { HarnessAvatar } from "../harness/HarnessAvatar";
import { UiTooltip } from "../ui/UiTooltip";

export type DetailBindingTone = "enabled" | "disabled" | "warning";

interface DetailBindingIdentityProps {
  harness: string;
  label: string;
  logoKey?: string | null;
  statusLabel: string;
  tone: DetailBindingTone;
  visibleStatus?: string | null;
  detail?: string | null;
}

export function DetailBindingIdentity({
  harness,
  label,
  logoKey,
  statusLabel,
  tone,
  visibleStatus = null,
  detail = null,
}: DetailBindingIdentityProps) {
  return (
    <>
      <UiTooltip content={label}>
        <HarnessAvatar
          harness={harness}
          label={label}
          logoKey={logoKey}
          className="detail-sheet__binding-logo"
        />
      </UiTooltip>
      <div
        className="detail-sheet__binding-identity"
        role="group"
        aria-label={`${label}, ${statusLabel}`}
      >
        <span className="detail-sheet__binding-label" aria-hidden="true">
          <span
            className="detail-sheet__binding-dot"
            data-tone={tone}
            aria-hidden="true"
          />
          <span className="detail-sheet__binding-label-text">{label}</span>
        </span>
        {visibleStatus ? (
          <UiTooltip content={detail ?? ""} disabled={!detail}>
            <span
              className="detail-sheet__binding-state"
              data-tone={tone}
              aria-hidden="true"
            >
              {visibleStatus}
              {detail ? <span className="detail-sheet__binding-detail"> · {detail}</span> : null}
            </span>
          </UiTooltip>
        ) : null}
      </div>
    </>
  );
}
