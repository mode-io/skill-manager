import { actionKey, type ActionKey } from "../../../lib/async/action-key";

export function marketplaceSearchActionKey(query: string): ActionKey {
  return actionKey("marketplace", "search", query.trim() || "__popular__");
}

export function marketplaceInstallActionKey(itemId: string): ActionKey {
  return actionKey("marketplace", "install", itemId);
}
