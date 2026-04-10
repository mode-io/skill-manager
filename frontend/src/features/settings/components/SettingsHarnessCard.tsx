import { HoverTooltip } from "../../../components/ui/HoverTooltip";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { HarnessMark } from "../../skills/components/harness/HarnessMark";
import type { SettingsHarness } from "../api/types";

interface SettingsHarnessCardProps {
  harness: SettingsHarness;
  pending: boolean;
  onToggle: (harness: string, nextEnabled: boolean) => void;
}

function supportTooltipCopy(harness: SettingsHarness): string {
  if (harness.supportEnabled) {
    return "Turn off to make skill-manager ignore this harness. Your local files stay unchanged.";
  }
  return "Turn on to let skill-manager discover and manage skills for this harness. Nothing is moved or deleted.";
}

export function SettingsHarnessCard({
  harness,
  pending,
  onToggle,
}: SettingsHarnessCardProps) {
  return (
    <article className="settings-harness-card">
      <div className="settings-harness-card__header">
        <div className="settings-harness-card__identity">
          <HarnessMark harness={harness.harness} label={harness.label} logoKey={harness.logoKey} />
          <span className={`ui-status-badge ${harness.detected ? "ui-status-badge--success" : "ui-status-badge--muted"}`}>
            {harness.detected ? "Detected" : "Not detected"}
          </span>
        </div>
        <HoverTooltip copy={supportTooltipCopy(harness)} disabled={pending} align="end" side="top">
          <span className="settings-harness-card__toggle">
            <ToggleSwitch
              checked={harness.supportEnabled}
              disabled={pending}
              label="Enabled"
              ariaLabel={`Enable ${harness.label} support`}
              pendingLabel="Saving..."
              onCheckedChange={(checked) => onToggle(harness.harness, checked)}
            />
          </span>
        </HoverTooltip>
      </div>

      <div className="settings-harness-card__body">
        <dl className="settings-harness-card__locations">
          <div className="settings-harness-card__location-row">
            <dt>Managed location</dt>
            <dd>
              {harness.managedLocation ? (
                <span className="settings-harness-card__path">{harness.managedLocation}</span>
              ) : (
                <span className="settings-harness-card__path settings-harness-card__path--muted">Unavailable</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
