export function queryPolicy(staleTime: number, gcTime: number) {
  return {
    staleTime,
    gcTime,
    refetchOnWindowFocus: false,
  } as const;
}
