import { actionKey, type ActionKey } from "../../../lib/async/action-key";

export function settingsSupportActionKey(harness: string): ActionKey {
  return actionKey("settings", "support", harness);
}
