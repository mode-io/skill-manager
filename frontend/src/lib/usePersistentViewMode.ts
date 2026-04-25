import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface PersistentViewModeOptions<T extends string> {
  storageKey: string;
  defaultMode: T;
  isValidMode: (value: unknown) => value is T;
  normalizeMode?: (value: unknown) => T | null;
  urlParam?: string;
}

function resolveMode<T extends string>(
  value: unknown,
  isValidMode: (value: unknown) => value is T,
  normalizeMode?: (value: unknown) => T | null,
): T | null {
  if (isValidMode(value)) return value;
  return normalizeMode?.(value) ?? null;
}

function readStoredMode<T extends string>(
  storageKey: string,
  isValidMode: (value: unknown) => value is T,
  normalizeMode?: (value: unknown) => T | null,
): { mode: T | null; raw: string | null } {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return { mode: resolveMode(raw, isValidMode, normalizeMode), raw };
  } catch {
    return { mode: null, raw: null };
  }
}

function writeStoredMode<T extends string>(storageKey: string, mode: T): void {
  try {
    window.localStorage.setItem(storageKey, mode);
  } catch {
    /* noop - storage may be unavailable */
  }
}

export function usePersistentViewMode<T extends string>({
  storageKey,
  defaultMode,
  isValidMode,
  normalizeMode,
  urlParam = "view",
}: PersistentViewModeOptions<T>): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const initial = useRef<T | null>(null);
  const pendingCanonicalization = useRef<{ urlMode?: T; storageMode?: T } | null>(null);
  if (initial.current === null) {
    const fromUrl = searchParams.get(urlParam);
    const urlMode = resolveMode(fromUrl, isValidMode, normalizeMode);
    if (urlMode) {
      initial.current = urlMode;
      if (fromUrl !== urlMode) {
        pendingCanonicalization.current = { urlMode };
      }
    } else {
      const stored = readStoredMode(storageKey, isValidMode, normalizeMode);
      initial.current = stored.mode ?? defaultMode;
      if (stored.raw && stored.mode && stored.raw !== stored.mode) {
        pendingCanonicalization.current = { storageMode: stored.mode };
      }
    }
  }

  const [mode, setMode] = useState<T>(initial.current as T);

  useEffect(() => {
    const pending = pendingCanonicalization.current;
    if (!pending) return;
    pendingCanonicalization.current = null;

    if (pending.storageMode) {
      writeStoredMode(storageKey, pending.storageMode);
    }
    if (pending.urlMode) {
      const params = new URLSearchParams(searchParams);
      if (pending.urlMode === defaultMode) {
        params.delete(urlParam);
      } else {
        params.set(urlParam, pending.urlMode);
      }
      setSearchParams(params, { replace: true });
    }
  }, [defaultMode, searchParams, setSearchParams, storageKey, urlParam]);

  const setModeExplicit = useCallback(
    (next: T) => {
      setMode(next);
      writeStoredMode(storageKey, next);
      const params = new URLSearchParams(searchParams);
      if (next === defaultMode) {
        params.delete(urlParam);
      } else {
        params.set(urlParam, next);
      }
      setSearchParams(params, { replace: true });
    },
    [defaultMode, searchParams, setSearchParams, storageKey, urlParam],
  );

  return [mode, setModeExplicit];
}
