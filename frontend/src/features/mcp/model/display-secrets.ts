export const MASKED_MCP_SECRET_VALUE = "••••••••";

const SECRET_KEY_RE = /(authorization|api[-_]?key|token|secret|password)/i;

export function formatDisplayHeaders(headers: Record<string, string> | null | undefined): string {
  if (!headers || Object.keys(headers).length === 0) {
    return "—";
  }
  return JSON.stringify(maskSecretLikeObject(headers));
}

export function maskMcpPayloadPreview(payload: Record<string, unknown>): Record<string, unknown> {
  return maskSecretLikeObject(payload) as Record<string, unknown>;
}

function maskSecretLikeObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSecretLikeObject);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SECRET_KEY_RE.test(key) ? MASKED_MCP_SECRET_VALUE : maskSecretLikeObject(nested),
    ]),
  );
}
