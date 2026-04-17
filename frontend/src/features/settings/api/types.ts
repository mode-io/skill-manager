import type { components } from "../../../api/generated";

export type SetHarnessSupportRequest = components["schemas"]["SetHarnessSupportRequest"];

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
