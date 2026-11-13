/**
 * Pure functions for keyset pagination navigation trail.
 * Keeps an indexed history of cursor tokens so users can navigate forward and backward
 * across pages deterministically.
 */
export function updateCursorTrail(
  prev: readonly (string | null)[],
  pageIdx: number,
  nextCursor: string | null,
): readonly (string | null)[] {
  if (!nextCursor) {
    return prev.length > pageIdx + 1 ? prev.slice(0, pageIdx + 1) : prev;
  }
  if (prev[pageIdx + 1] === nextCursor) {
    return prev;
  }
  return [...prev.slice(0, pageIdx + 1), nextCursor];
}
