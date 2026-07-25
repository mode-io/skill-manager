import type { ReactNode } from "react";

import { HomeDirContext, useHomeDirQuery } from "./useHomeDir";

/**
 * Fetches the home dir once (via ``/api/health``) and provides it to the tree
 * so path displays can abbreviate it to ``~``. Must sit inside the app's
 * QueryClientProvider.
 */
export function HomeDirProvider({ children }: { children: ReactNode }) {
  const home = useHomeDirQuery();
  return <HomeDirContext.Provider value={home}>{children}</HomeDirContext.Provider>;
}
