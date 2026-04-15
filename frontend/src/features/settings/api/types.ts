export interface SettingsHarness {
  harness: string;
  label: string;
  logoKey?: string | null;
  supportEnabled: boolean;
  installed: boolean;
  managedLocation: string | null;
}

export interface SettingsData {
  harnesses: SettingsHarness[];
}
