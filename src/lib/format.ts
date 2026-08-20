/**
 * Display formatters. These produce strings for humans to read — never parse
 * their output back into a number.
 */

// Built once at module scope: constructing an Intl formatter is expensive
// relative to calling it, and an invoice table formats one per row.
const inrFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/**
 * Renders a rupee amount using the Indian digit grouping (lakh/crore), so
 * 1840000 reads as ₹18,40,000 rather than ₹1,840,000.
 *
 * Takes a string because money arrives from Postgres `numeric` columns as a
 * string — going through a float in transit is what loses paise. Amounts are
 * rounded to whole rupees for display; keep the original string for anything
 * that has to add up.
 *
 * The sign is placed outside the symbol (-₹50,000, not ₹-50,000) for the
 * credit notes and refunds that come back negative.
 */
export function formatINR(value: string): string {
  const amount = Number(value);
  // A malformed amount is a bug upstream, but rendering "₹NaN" in a table is
  // worse than an em dash — and returning ₹0 would quietly state a falsehood.
  if (!Number.isFinite(amount)) return "—";

  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${inrFormatter.format(Math.abs(amount))}`;
}

/**
 * Renders a day count with its unit: 1 → "1 day", 30 → "30 days".
 *
 * Rounded because the inputs include computed averages such as days-to-pay,
 * where "34.2 days" is more precision than the number deserves.
 */
export function formatDays(n: number): string {
  if (!Number.isFinite(n)) return "—";

  const days = Math.round(n);
  return `${days} ${Math.abs(days) === 1 ? "day" : "days"}`;
}

/**
 * The locale and time zone are both pinned rather than taken from the runtime.
 *
 * This is a correctness requirement, not a preference: these strings are
 * rendered on the server and again on the client, and a formatter that reads
 * the ambient time zone produces two different strings for the same timestamp,
 * which React reports as a hydration mismatch. Per-user time zones are a real
 * feature and need a stored preference, not `Intl` guessing.
 */
const DISPLAY_LOCALE = "en-IN";
const DISPLAY_TIME_ZONE = "Asia/Kolkata";

const longDateFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: DISPLAY_TIME_ZONE,
});

const timeOfDayFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: DISPLAY_TIME_ZONE,
});

/** An ISO timestamp as "Monday, 17 August". */
export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return longDateFormatter.format(date);
}

/** An ISO timestamp as "09:12", 24-hour. */
export function formatTimeOfDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return timeOfDayFormatter.format(date);
}

const hourFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: DISPLAY_TIME_ZONE,
});

/**
 * The time-of-day greeting: "Good morning" through to "Working late".
 *
 * The hour is read in the pinned display time zone rather than the runtime's,
 * which is what makes this safe to render on the server. A server in UTC
 * deciding the greeting for a user in India would say "Good morning" at 3pm
 * their time, and would disagree with the browser at hydration.
 *
 * Takes the clock as an argument so it can be tested at a boundary instead of
 * only at whatever time the suite happens to run.
 */
export function formatGreeting(now: Date = new Date()): string {
  const hour = Number(hourFormatter.format(now));

  // The small hours are tested first. Ordered the other way round, midnight to
  // 04:59 falls through the morning check and lands on "Good afternoon".
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Working late";
}

/**
 * The name to greet someone by, from a full display name: "Priya Menon" → "Priya".
 *
 * Returns "" when there is nothing usable, which callers must handle by
 * dropping the name rather than substituting the email — "Good morning,
 * ops@acme.co" is worse than "Good morning". A display name is empty whenever
 * the profile row is missing or hidden by RLS.
 */
export function formatFirstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? "";
}
