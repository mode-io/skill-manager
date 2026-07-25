export const agentsKeys = {
  all: ["agents"] as const,
  list: () => [...agentsKeys.all, "list"] as const,
  detail: (ref: string) => [...agentsKeys.all, "detail", ref] as const,
};
