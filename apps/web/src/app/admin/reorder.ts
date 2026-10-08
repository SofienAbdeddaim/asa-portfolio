/** Returns a copy of `list` with the item at `from` moved to index `to` (both clamped). */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const result = [...list];
  if (from < 0 || from >= result.length) return result;
  const target = Math.min(Math.max(to, 0), result.length - 1);
  const [item] = result.splice(from, 1);
  result.splice(target, 0, item as T);
  return result;
}
