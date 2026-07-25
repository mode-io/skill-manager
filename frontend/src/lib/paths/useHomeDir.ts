import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "../../api/http";
import { queryPolicy } from "../query";
import { formatHomePath } from "./formatHomePath";

interface HealthPayload {
  homeDir?: string | null;
}

// Home dir is stable for the life of the process, so cache it aggressively.
const HOME_DIR_STALE_TIME_MS = 24 * 60 * 60_000;
const HOME_DIR_GC_TIME_MS = 24 * 60 * 60_000;

export const homeDirKeys = {
  all: ["home-dir"] as const,
};

/**
 * Home dir is provided via context (default ``null``) rather than read from a
 * query in every component. That keeps path-displaying components renderable in
 * tests without a QueryClient — they just receive ``null`` and paths pass
 * through unabbreviated.
 */
export const HomeDirContext = createContext<string | null>(null);

/** Fetches the home dir once and supplies it to {@link useHomeDir}. */
export function useHomeDirQuery(): string | null {
  const query = useQuery({
    queryKey: homeDirKeys.all,
    queryFn: async () => {
      const health = await fetchJson<HealthPayload>("/health");
      return health.homeDir ?? null;
    },
    ...queryPolicy(HOME_DIR_STALE_TIME_MS, HOME_DIR_GC_TIME_MS),
  });
  return query.data ?? null;
}

export function useHomeDir(): string | null {
  return useContext(HomeDirContext);
}

/**
 * Returns a formatter that abbreviates the home prefix of displayed paths to
 * ``~``. Safe to call before the home dir loads — paths pass through unchanged.
 */
export function useFormatPath(): (path: string | null | undefined) => string {
  const home = useHomeDir();
  return (path) => formatHomePath(path, home);
}
