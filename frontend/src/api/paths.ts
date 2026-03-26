function normalizeBase(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (trimmed === "" || trimmed === "/") {
    return "";
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

const apiBase = normalizeBase(import.meta.env.VITE_API_BASE);

export function apiPath(path: string): string {
  return `${apiBase}${path}`;
}
