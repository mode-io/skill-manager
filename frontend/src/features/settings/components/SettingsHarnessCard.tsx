import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { HarnessMark } from "../../skills/components/harness/HarnessMark";
import type { SettingsHarness } from "../api/types";

interface SettingsHarnessCardProps {
  harness: SettingsHarness;
  pending: boolean;
  onToggle: (harness: string, nextEnabled: boolean) => void;
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
        <ToggleSwitch
          checked={harness.supportEnabled}
          disabled={pending}
          label="Enabled"
          ariaLabel={`Enable ${harness.label} support`}
          pendingLabel="Saving..."
          onCheckedChange={(checked) => onToggle(harness.harness, checked)}
        />
      </div>

      <div className="settings-harness-card__body">
        <p className="settings-harness-card__copy">
          {harness.detected
            ? "Ready for skill discovery and management on this computer."
            : "skill-manager can keep this harness available, but it is not currently detected on this computer."}
        </p>

        <dl className="settings-harness-card__locations">
          {harness.managedLocation ? (
            <div className="settings-harness-card__location-row">
              <dt>Managed location</dt>
              <dd>
                <span className="settings-harness-card__path">{harness.managedLocation}</span>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </article>
  );
}
