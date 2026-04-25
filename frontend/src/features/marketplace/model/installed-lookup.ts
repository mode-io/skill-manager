import { useMemo } from "react";

import { useMcpInventoryQuery } from "../../mcp/public";

export type InstalledState =
  | { kind: "not-installed" }
  | { kind: "installed"; managedName: string };

export interface InstalledLookup {
  lookup: (qualifiedName: string) => InstalledState;
  isLoading: boolean;
}

export function useInstalledServerLookup(): InstalledLookup {
  const inventoryQuery = useMcpInventoryQuery();
  const installedByQualifiedName = useMemo(() => {
    const entries = inventoryQuery.data?.entries ?? [];
    const names = new Map<string, string>();
    for (const entry of entries) {
      if (entry.kind !== "managed" || !entry.spec) {
        continue;
      }
      if (entry.spec.source.kind !== "marketplace") {
        continue;
      }
      names.set(entry.spec.source.locator, entry.name);
    }
    return names;
  }, [inventoryQuery.data]);

  const lookup = useMemo<(name: string) => InstalledState>(() => {
    return (qualifiedName: string) => {
      const managedName = installedByQualifiedName.get(qualifiedName);
      if (managedName) {
        return { kind: "installed", managedName };
      }
      return { kind: "not-installed" };
    };
  }, [installedByQualifiedName]);

  return { lookup, isLoading: inventoryQuery.isPending && !inventoryQuery.data };
}
