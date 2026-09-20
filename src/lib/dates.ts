/**
 * Every date in this app is a *business date* — a calendar day in the office
 * timezone, stored as UTC midnight. Keeping one representation everywhere
 * avoids the classic "task due Monday shows up Sunday night" bug that comes
 * from mixing local Date objects with Postgres `date` columns.
 */

export const BUSINESS_TZ = process.env.BUSINESS_TIMEZONE ?? "America/Los_Angeles";

/** Today in the office timezone, as UTC midnight. */
export function businessToday(now: Date = new Date()): Date {
  // en-CA formats as YYYY-MM-DD, which parses unambiguously as UTC.
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Strip any Date down to UTC midnight so it can be compared to a stored date. */
export function dateOnly(d: Date | string): Date {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Parse a YYYY-MM-DD value from a date input. */
export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a business date back to YYYY-MM-DD for a date input. */
export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

export function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  const targetMonth = out.getUTCMonth() + n;
  out.setUTCDate(1);
  out.setUTCMonth(targetMonth);
  // Clamp: 31 Jan + 1 month is 28/29 Feb, not 2/3 March.
  const lastDay = daysInMonth(out.getUTCFullYear(), out.getUTCMonth());
  out.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return out;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Whole days from a to b. Negative when b is before a. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86_400_000);
}

export function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** Nudge a weekend date forward to Monday. Used by weekday-only cadences. */
export function nextWeekday(d: Date): Date {
  let out = d;
  while (isWeekend(out)) out = addDays(out, 1);
  return out;
}

/** Monday of the week containing d. */
export function startOfWeek(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sunday
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(d, delta);
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// ------------------------------------------------------------- formatting

const WEEKDAY_LONG = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});
const MED = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
const MED_YEAR = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatLongDate(d: Date): string {
  return WEEKDAY_LONG.format(d);
}

export function formatShortDate(d: Date, withYear = false): string {
  return (withYear ? MED_YEAR : MED).format(d);
}

/** "Today", "Tomorrow", "3 days overdue", "in 5 days". */
export function relativeDay(due: Date, today: Date = businessToday()): string {
  const diff = daysBetween(today, due);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "1 day overdue";
  if (diff < -1) return `${Math.abs(diff)} days overdue`;
  if (diff < 7) return `in ${diff} days`;
  return formatShortDate(due);
}

/** 105 -> "1h 45m", 60 -> "1h", 45 -> "45m", 0 -> "0m". */
export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Decimal hours for reporting, e.g. 105 -> "1.75". */
export function formatHours(totalMinutes: number): string {
  return (totalMinutes / 60).toFixed(2);
}

/**
 * Accepts what a person actually types into a time box: "90", "1:30", "1.5h",
 * "1h 30m", "45m". Returns minutes, or null if it cannot be read.
 */
export function parseDurationInput(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  // 1:30
  const colon = s.match(/^(\d+):([0-5]?\d)$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);

  // 1h 30m / 1h / 30m / 1.5h
  const hm = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/);
  if (hm && (hm[1] || hm[2])) {
    return Math.round(Number(hm[1] ?? 0) * 60 + Number(hm[2] ?? 0));
  }

  // Bare number means minutes.
  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Math.round(Number(bare[1]));

  return null;
}
