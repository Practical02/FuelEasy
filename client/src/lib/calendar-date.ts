import { format } from "date-fns";
import { startOfLocalDayFromYmd } from "./date-range";

/**
 * Business/calendar dates from the API are often stored as ISO timestamps.
 * `new Date(iso).toLocaleDateString()` vs `<input value={d.toISOString().slice(0,10)}>`
 * can disagree (off-by-one) when the instant crosses UTC midnight vs local midnight.
 * Prefer the YYYY-MM-DD prefix of ISO strings when present; otherwise use local
 * getFullYear/getMonth/getDate from a Date in memory (e.g. from a date picker).
 */
export function toYmdString(value: string | Date | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const t = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }
  if (Number.isNaN(value.getTime())) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

/** Value for `input type="date"`. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  return toYmdString(value);
}

export function fromDateInputValue(ymd: string): Date {
  return startOfLocalDayFromYmd(ymd);
}

function noonLocalDate(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Display: matches list/detail when using default locale. */
export function formatCalendarDateLocale(
  value: string | Date | null | undefined,
  empty = "—",
): string {
  const ymd = toYmdString(value);
  if (!ymd) return empty;
  const [y, m, d] = ymd.split("-").map(Number);
  return noonLocalDate(y, m, d).toLocaleDateString();
}

/** Same calendar day, date-fns format (e.g. `PPP` for sales table). */
export function formatCalendarDateFns(
  value: string | Date | null | undefined,
  pattern: string,
  empty = "—",
): string {
  const ymd = toYmdString(value);
  if (!ymd) return empty;
  const [y, m, d] = ymd.split("-").map(Number);
  return format(noonLocalDate(y, m, d), pattern);
}

/**
 * Send to API: ISO for local noon of the chosen calendar day (avoids midnight UTC skew on round-trip).
 */
export function toCalendarDayIsoForApi(value: string | Date | null | undefined): string {
  const ymd = toYmdString(value);
  if (!ymd) return new Date().toISOString();
  const [y, m, d] = ymd.split("-").map(Number);
  return noonLocalDate(y, m, d).toISOString();
}
