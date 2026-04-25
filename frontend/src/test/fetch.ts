type FetchInput = RequestInfo | URL;

export function okJson(payload: unknown, init: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
    ...init,
  } as Response;
}

export function errorJson(
  message: string,
  {
    status = 500,
    statusText = "Server Error",
    field = "detail",
  }: {
    status?: number;
    statusText?: string;
    field?: "detail" | "error";
  } = {},
): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({ [field]: message }),
  } as Response;
}

export interface FetchRoute {
  match: string | RegExp | ((url: string, input: FetchInput, init?: RequestInit) => boolean);
  response:
    | Response
    | unknown
    | ((url: string, input: FetchInput, init?: RequestInit) => Response | Promise<Response> | unknown | Promise<unknown>);
}

export function createRouteFetchMock(
  routes: FetchRoute[],
  fallback?: (url: string, input: FetchInput, init?: RequestInit) => Response | Promise<Response>,
) {
  return async (input: FetchInput, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    for (const route of routes) {
      if (!routeMatches(route.match, url, input, init)) {
        continue;
      }
      const response =
        typeof route.response === "function"
          ? await route.response(url, input, init)
          : route.response;
      return isResponseLike(response) ? response : okJson(response);
    }
    if (fallback) {
      return fallback(url, input, init);
    }
    throw new Error(`Unhandled URL ${url}`);
  };
}

function routeMatches(
  match: FetchRoute["match"],
  url: string,
  input: FetchInput,
  init?: RequestInit,
): boolean {
  if (typeof match === "string") {
    return url === match || url.includes(match);
  }
  if (match instanceof RegExp) {
    return match.test(url);
  }
  return match(url, input, init);
}

function isResponseLike(value: unknown): value is Response {
  return Boolean(
    value &&
      typeof value === "object" &&
      "ok" in value &&
      "json" in value &&
      typeof (value as { json?: unknown }).json === "function",
  );
}
