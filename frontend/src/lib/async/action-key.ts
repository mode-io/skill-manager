export type ActionKey = string;

export function actionKey(...segments: Array<string | number | null | undefined>): ActionKey {
  return segments
    .filter((segment): segment is string | number => segment !== null && segment !== undefined && segment !== "")
    .map(String)
    .join(":");
}
