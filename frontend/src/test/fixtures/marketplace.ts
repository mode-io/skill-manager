export function marketplacePage<T>(
  items: T[] = [],
  {
    nextOffset = null,
    hasMore = false,
  }: {
    nextOffset?: number | null;
    hasMore?: boolean;
  } = {},
) {
  return { items, nextOffset, hasMore };
}
