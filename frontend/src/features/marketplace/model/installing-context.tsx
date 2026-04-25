import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface InstallingContextValue {
  isInstalling: (qualifiedName: string) => boolean;
  begin: (qualifiedName: string) => void;
  finish: (qualifiedName: string) => void;
}

const noop: InstallingContextValue = {
  isInstalling: () => false,
  begin: () => undefined,
  finish: () => undefined,
};

const InstallingContext = createContext<InstallingContextValue>(noop);

/**
 * Provider tracking per-qualifiedName install mutations across the marketplace
 * subtree so cards can render an "Installing" state while the install dialog
 * owns the actual mutation.
 */
export function InstallingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

  const begin = useCallback((qualifiedName: string) => {
    setPending((prev) => {
      if (prev.has(qualifiedName)) return prev;
      const next = new Set(prev);
      next.add(qualifiedName);
      return next;
    });
  }, []);

  const finish = useCallback((qualifiedName: string) => {
    setPending((prev) => {
      if (!prev.has(qualifiedName)) return prev;
      const next = new Set(prev);
      next.delete(qualifiedName);
      return next;
    });
  }, []);

  const isInstalling = useCallback(
    (qualifiedName: string) => pending.has(qualifiedName),
    [pending],
  );

  const value = useMemo(
    () => ({ isInstalling, begin, finish }),
    [isInstalling, begin, finish],
  );

  return <InstallingContext.Provider value={value}>{children}</InstallingContext.Provider>;
}

export function useInstallingState(): InstallingContextValue {
  return useContext(InstallingContext);
}
