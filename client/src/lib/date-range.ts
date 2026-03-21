/**
 * Local calendar-day bounds for YYYY-MM-DD strings from <input type="date" />.
 * Ensures the end date is inclusive (sales/transactions on that day match).
 */

export function startOfLocalDayFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function endOfLocalDayFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Inclusive range check for a Date (or ISO string) against optional YYYY-MM-DD bounds */
export function isInLocalYmdRange(
  value: Date | string,
  fromYmd?: string,
  toYmd?: string
): boolean {
  const t = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(t.getTime())) return false;
  if (fromYmd) {
    const start = startOfLocalDayFromYmd(fromYmd);
    if (Number.isNaN(start.getTime()) || t < start) return false;
  }
  if (toYmd) {
    const end = endOfLocalDayFromYmd(toYmd);
    if (Number.isNaN(end.getTime()) || t > end) return false;
  }
  return true;
}

/** End of local day for a Date (e.g. from a date picker) */
export function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
