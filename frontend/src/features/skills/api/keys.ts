export const SKILLS_STALE_TIME_MS = 60_000;
export const SKILLS_GC_TIME_MS = 15 * 60_000;

export const skillsKeys = {
  all: ["skills"] as const,
  list: () => ["skills", "list"] as const,
  detailPrefix: () => ["skills", "detail"] as const,
  detail: (skillRef: string) => ["skills", "detail", skillRef] as const,
  sourceStatusPrefix: () => ["skills", "source-status"] as const,
  sourceStatus: (skillRef: string) => ["skills", "source-status", skillRef] as const,
};
