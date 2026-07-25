import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { HarnessAvatar } from "../../../components/harness/HarnessAvatar";
import { useFormatPath } from "../../../lib/paths";
import type { SettingsHarness } from "../api/types";
import type { SettingsCopy } from "../i18n";

interface SettingsHarnessCardProps {
  harness: SettingsHarness;
  pending: boolean;
  copy: SettingsCopy["harnesses"];
  onToggle: (harness: string, nextEnabled: boolean) => void;
}

export function SettingsHarnessCard({ harness, pending, copy, onToggle }: SettingsHarnessCardProps) {
  const formatPath = useFormatPath();
  return (
    <div className="settings-row">
      <span className="settings-row__icon">
        <HarnessAvatar harness={harness.harness} label={harness.label} logoKey={harness.logoKey} />
      </span>
      <div className="settings-row__body">
        <p className="settings-row__title">{harness.label}</p>
        <p className="settings-row__sub">
          {harness.installed ? copy.detected : copy.notDetected}
        </p>
      </div>
      <div className="settings-row__controls">
        {harness.managedLocation ? (
          <span className="settings-path">{formatPath(harness.managedLocation)}</span>
        ) : null}
        <ToggleSwitch
          checked={harness.supportEnabled}
          disabled={pending}
          label=""
          ariaLabel={copy.enableSupport(harness.label)}
          pendingLabel={copy.saving}
          onCheckedChange={(checked) => onToggle(harness.harness, checked)}
        />
      </div>
    </div>
  );
}
