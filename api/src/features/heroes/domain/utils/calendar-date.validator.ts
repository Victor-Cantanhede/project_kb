export const MIN_DATE_OF_BIRTH = '1000-01-01';

/**
 * Checks whether a string is a valid ISO calendar date (YYYY-MM-DD),
 * rejecting invalid leap years (e.g. 2025-02-29), nonexistent months or days.
 */
export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Today's date (YYYY-MM-DD) in an IANA timezone; falls back to `fallbackZone` when the zone is unknown.
 */
export function todayIn(timeZone: string, now: Date = new Date(), fallbackZone = 'UTC'): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  try {
    return format(timeZone);
  } catch (error: unknown) {
    if (error instanceof RangeError) return format(fallbackZone);
    throw error;
  }
}
