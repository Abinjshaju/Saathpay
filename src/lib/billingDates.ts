/** Local start of calendar day */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Next monthly billing date from a reminder anchor (YYYY-MM-DD).
 * Repeats on the same day-of-month each month, clamped to valid month length.
 */
export function nextBillingDateFromReminder(
  reminderYmd: string | null | undefined,
  from: Date = new Date(),
): Date | null {
  if (!reminderYmd || typeof reminderYmd !== "string") return null;
  const m = reminderYmd.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const dayOfMonth = Math.min(31, Math.max(1, parseInt(m[3], 10)));
  const fromStart = startOfDay(from);
  const y = fromStart.getFullYear();
  const mo = fromStart.getMonth();

  function dateInMonth(year: number, month: number, dom: number): Date {
    const dim = new Date(year, month + 1, 0).getDate();
    const d = Math.min(dom, dim);
    return new Date(year, month, d);
  }

  let cand = dateInMonth(y, mo, dayOfMonth);
  if (cand < fromStart) {
    const nextM = mo + 1;
    const ny = nextM > 11 ? y + 1 : y;
    const nmo = nextM % 12;
    cand = dateInMonth(ny, nmo, dayOfMonth);
  }
  return cand;
}

/** Whole calendar days from `from` to `to` (both at start-of-day). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** True if `due` is on or after `referenceDay` and within the next `days` calendar days (inclusive). */
export function isDueWithinNextDays(due: Date, referenceDay: Date, days: number): boolean {
  const ref = startOfDay(referenceDay);
  const d = startOfDay(due);
  const delta = calendarDaysBetween(ref, d);
  return delta >= 0 && delta <= days;
}
