export function flattenUniquePageItems<T, Page extends { items: readonly T[] }>(
  data: { pages: readonly Page[] } | undefined,
  keyOf: (item: T) => string,
): T[] {
  if (!data) {
    return [];
  }

  const seen = new Set<string>();
  const items: T[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      const key = keyOf(item);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}
