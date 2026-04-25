export const productLanguage = {
  inUse: "In use",
  needsReview: "Needs review",
  review: "Review",
  discover: "Discover",
} as const;

export type ProductInventoryConcept = "inUse" | "needsReview";

export function skillStatusConcept(displayStatus: string): ProductInventoryConcept | null {
  if (displayStatus === "Managed") return "inUse";
  if (displayStatus === "Unmanaged") return "needsReview";
  return null;
}

export function mcpKindConcept(kind: string): ProductInventoryConcept | null {
  if (kind === "managed") return "inUse";
  if (kind === "unmanaged") return "needsReview";
  return null;
}
