import { useCallback, useState } from "react";

interface MutationResult {
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useMutation<A extends unknown[]>(
  fn: (...args: A) => Promise<void>,
): { execute: (...args: A) => Promise<void> } & MutationResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (...args: A) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await fn(...args);
    } catch (e) {
      setError(e instanceof Error ? e.message : "operation failed");
    } finally {
      setLoading(false);
    }
  }, [fn, loading]);

  const clearError = useCallback(() => setError(null), []);

  return { execute, loading, error, clearError };
}
