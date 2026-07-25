/**
 * Abbreviate an absolute path's home prefix to ``~`` for display, matching how
 * the harnesses themselves refer to their config dirs (e.g. ``~/.hermes``).
 *
 * Display-only: callers pass the raw absolute path from the API (which stays
 * intact for keys, matching, and round-trips) and render the abbreviated form.
 * Paths outside ``home`` — and any input while ``home`` is still loading — are
 * returned unchanged.
 */
export function formatHomePath(
  path: string | null | undefined,
  home: string | null | undefined,
): string {
  if (!path) {
    return "";
  }
  if (!home) {
    return path;
  }
  const normalizedHome = home.replace(/[/\\]+$/, "");
  if (path === normalizedHome) {
    return "~";
  }
  if (path.startsWith(`${normalizedHome}/`)) {
    return `~${path.slice(normalizedHome.length)}`;
  }
  return path;
}
