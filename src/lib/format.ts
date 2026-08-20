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
