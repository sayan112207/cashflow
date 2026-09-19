/**
 * Server side of `GET /api/v1/dashboard/*` and `POST /api/v1/chases`.
 *
 * Reads go through the caller-bound Supabase client, so RLS decides which rows
 * exist at all; the `org_id` filters below pick *which* of the caller's orgs to
 * show, they are not what keeps tenants apart.
 *
 * The rules themselves live in `dashboard-rules.ts`. This module only loads
 * rows, turns them into `BookInvoice`s, and shapes responses — so a scoring
 * change never needs a database to test.
 */

import { z } from "zod";

import type {
  AgingBucket,
  ChaseQueue,
  ChaseResponse,
  DashboardSummary,
} from "@/lib/schemas/dashboard";
import {
  addDays,
  agingTotals,
  daysOverdue,
  eligibleInvoices,
  ineligibleReason,
  paiseToMoney,
  scoreQueue,
  sharePct,
  todayInTimezone,
  toPaise,
  type BookInvoice,
  type IsoDate,
} from "@/lib/services/dashboard-rules";
import { retryOnJwtSkew } from "@/lib/supabase/jwt-skew-retry";
import { getUserSupabase } from "@/lib/supabase/user-client.server";

type Supabase = ReturnType<typeof getUserSupabase>;

/**
 * A failure with a contract error envelope. `message` is user-facing copy and
 * is rendered verbatim by the frontend, so it never carries internal detail.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** A JSON response with the contract's content type. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Runs a handler and turns any failure into the contract's error envelope.
 *
 * Unexpected errors are logged in full and answered with `fallback`, so a
 * Postgres message never reaches the browser.
 */
export async function handleApi(
  fallback: { code: string; message: string },
  run: () => Promise<Response>,
): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ error: { code: error.code, message: error.message } }, error.status);
    }
    console.error(`[api] ${fallback.code}`, error);
    return json({ error: fallback }, 500);
  }
}

type Caller = { supabase: Supabase; userId: string; orgId: string; timezone: string };

/**
 * The signed-in user and the org the dashboard is showing.
 *
 * With several memberships this is the oldest one — the same org the app shell
 * names, since `getAuthContext` returns memberships in the same order.
 */
async function resolveCaller(): Promise<Caller> {
  const supabase = getUserSupabase();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new ApiError(401, "unauthenticated", "Your session expired. Please sign in again.");
  }

  // Retried once on PGRST303 (JWT issued at future): right after an OAuth
  // sign-in this is the first PostgREST call, and a brief clock drift between
  // Auth and PostgREST would otherwise turn all three endpoints into a 500.
  const userId = userData.user.id;
  const { data: membership, error: membershipError } = await retryOnJwtSkew(
    () =>
      supabase
        .from("org_members")
        .select("org_id, orgs(timezone)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    (result) => result.error,
  );

  if (membershipError) throw membershipError;
  if (!membership) {
    throw new ApiError(403, "no_workspace", "Create a workspace before using the dashboard.");
  }

  const org = membership.orgs as unknown as { timezone: string } | null;
  return {
    supabase,
    userId: userData.user.id,
    orgId: membership.org_id,
    timezone: org?.timezone ?? "Asia/Kolkata",
  };
}

/** PostgREST caps a response at its `max-rows` (1000 by default); page past it rather than silently truncate the book. */
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

/**
 * Invoice statuses that can still carry a balance. `paid`, `void`, `draft` and
 * `written_off` are closed: nothing collectible is left on them.
 */
const OPEN_STATUSES = ["open", "partially_paid"] as const;

/**
 * Every invoice in the org with money still owed, shaped for the rules.
 *
 * INR only: the dashboard contract has one amount per tile, and adding rupees
 * to dollars would produce a number that means nothing. Other currencies need
 * their own tiles before they can appear here.
 */
async function loadBook(caller: Caller, today: IsoDate): Promise<BookInvoice[]> {
  const { supabase, orgId, timezone } = caller;

  const [invoices, usableP0] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("invoices")
        .select(
          "id, account_id, invoice_number, amount, due_date, disputed_at, promised_date, " +
            "promised_at, promise_broken_count, last_promise_broken_at, " +
            "accounts(name, paused_at, paused_until), payments(amount), reminders(status, sent_at)",
        )
        .eq("org_id", orgId)
        .eq("currency", "INR")
        .in("status", [...OPEN_STATUSES])
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("contacts")
        .select("account_id")
        .eq("org_id", orgId)
        .eq("priority", "P0")
        .eq("is_active", true)
        .neq("delivery_state", "bounced")
        .order("id")
        .range(from, to),
    ),
  ]);

  const accountsWithP0 = new Set(usableP0.map((contact) => contact.account_id));

  return (invoices as unknown as InvoiceRow[]).flatMap((row): BookInvoice[] => {
    const paidPaise = row.payments.reduce((sum, payment) => sum + toPaise(payment.amount), 0);
    const outstandingPaise = toPaise(row.amount) - paidPaise;
    if (outstandingPaise <= 0) return [];

    const sent = row.reminders.filter((r) => r.status === "sent" && r.sent_at !== null);
    const lastSentAt = sent.reduce<string | null>(
      (latest, r) => (latest === null || (r.sent_at ?? "") > latest ? r.sent_at : latest),
      null,
    );

    const account = row.accounts;
    const accountPaused =
      account?.paused_at != null && (account.paused_until == null || account.paused_until >= today);

    return [
      {
        id: row.id,
        accountId: row.account_id,
        accountName: account?.name ?? "",
        invoiceNumber: row.invoice_number,
        dueDate: row.due_date,
        outstandingPaise,
        partiallyPaid: paidPaise > 0,
        disputed: row.disputed_at !== null,
        promisedDate: row.promised_date,
        promisedAt: row.promised_at,
        promiseBrokenCount: row.promise_broken_count,
        lastPromiseBrokenAt: row.last_promise_broken_at,
        reminderCount: sent.length,
        lastReminderOn:
          lastSentAt === null ? null : todayInTimezone(timezone, new Date(lastSentAt)),
        accountPaused,
        accountHasUsableP0: accountsWithP0.has(row.account_id),
      },
    ];
  });
}

/** The row shape `loadBook` selects. Written out because the select string is too long for the generated types to infer. */
type InvoiceRow = {
  id: string;
  account_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  disputed_at: string | null;
  promised_date: string | null;
  promised_at: string | null;
  promise_broken_count: number;
  last_promise_broken_at: string | null;
  accounts: { name: string; paused_at: string | null; paused_until: string | null } | null;
  payments: Array<{ amount: number }>;
  reminders: Array<{ status: string; sent_at: string | null }>;
};

/**
 * Records any promise whose pause ran out since the last look. Idempotent, so
 * running it on every read stands in for the nightly job the contract
 * describes — each promise is still counted exactly once.
 */
async function reconcileBrokenPromises(caller: Caller): Promise<void> {
  const { error } = await caller.supabase.rpc("reconcile_broken_promises", {
    p_org: caller.orgId,
  });
  if (error) throw error;
}

async function loadCurrentBook(): Promise<{ caller: Caller; today: IsoDate; book: BookInvoice[] }> {
  const caller = await resolveCaller();
  await reconcileBrokenPromises(caller);
  const today = todayInTimezone(caller.timezone);
  return { caller, today, book: await loadBook(caller, today) };
}

/** `GET /api/v1/dashboard/summary` */
export async function buildSummary(): Promise<DashboardSummary> {
  const { today, book } = await loadCurrentBook();

  const totalPaise = book.reduce((sum, invoice) => sum + invoice.outstandingPaise, 0);
  const overduePaise = book
    .filter((invoice) => daysOverdue(invoice, today) > 0)
    .reduce((sum, invoice) => sum + invoice.outstandingPaise, 0);

  const owingAccounts = new Map<string, boolean>();
  for (const invoice of book) owingAccounts.set(invoice.accountId, invoice.accountHasUsableP0);
  const accountsWithoutP0 = [...owingAccounts.values()].filter((hasP0) => !hasP0).length;

  const weekStart = addDays(today, -6);
  const bucketPaise = new Map(agingTotals(book, today).map(({ bucket, paise }) => [bucket, paise]));
  const segment = <B extends AgingBucket>(bucket: B) => {
    const paise = bucketPaise.get(bucket) ?? 0;
    return { bucket, amount: paiseToMoney(paise), share_pct: sharePct(paise, totalPaise) };
  };

  return {
    as_of: new Date().toISOString(),
    // Priority is computed on every request, so it can never be behind.
    stale: false,
    tiles: {
      total_outstanding: paiseToMoney(totalPaise),
      account_count: owingAccounts.size,
      overdue: paiseToMoney(overduePaise),
      overdue_share_pct: sharePct(overduePaise, totalPaise),
      open_invoice_count: book.length,
      missing_contact_account_count: accountsWithoutP0,
    },
    aging: [
      segment("Not yet due"),
      segment("1–30"),
      segment("31–60"),
      segment("61–90"),
      segment("90+"),
    ],
    attention: {
      accounts_without_p0: accountsWithoutP0,
      disputes_open: book.filter((invoice) => invoice.disputed).length,
      promises_broken_this_week: book.filter(
        (invoice) =>
          invoice.lastPromiseBrokenAt !== null &&
          invoice.lastPromiseBrokenAt >= weekStart &&
          invoice.lastPromiseBrokenAt <= today,
      ).length,
    },
  };
}

/** Contract: `limit` defaults to 6, max 50. */
export const chaseQueueLimitSchema = z.coerce.number().int().min(1).max(50).default(6);

/** `GET /api/v1/dashboard/chase-queue?limit=` */
export async function buildChaseQueue(limit: number): Promise<ChaseQueue> {
  const { today, book } = await loadCurrentBook();
  const ranked = scoreQueue(eligibleInvoices(book, today), today);

  return {
    total_eligible: ranked.length,
    items: ranked.slice(0, limit).map((entry) => ({
      invoice_id: entry.invoice.id,
      account_id: entry.invoice.accountId,
      account_name: entry.invoice.accountName,
      invoice_number: entry.invoice.invoiceNumber,
      amount_outstanding: paiseToMoney(entry.invoice.outstandingPaise),
      days_overdue: entry.daysOverdue,
      priority_band: entry.band,
      priority_reason: entry.reason,
    })),
  };
}

/** `POST /api/v1/chases` request body. */
export const chaseRequestBodySchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * `POST /api/v1/chases` — re-checks every invoice against the current book,
 * since the page that sent the list may be minutes old, then appends one
 * `chase_requests` row per invoice that still qualifies.
 *
 * All accepted rows go in one insert, which PostgREST runs as one transaction:
 * either the whole accepted set is recorded or none of it is.
 */
export async function requestChases(invoiceIds: readonly string[]): Promise<ChaseResponse> {
  const { caller, today, book } = await loadCurrentBook();
  const byId = new Map(book.map((invoice) => [invoice.id, invoice]));

  const accepted: string[] = [];
  const skipped: ChaseResponse["skipped"] = [];

  for (const invoiceId of new Set(invoiceIds)) {
    const invoice = byId.get(invoiceId);
    // Not in the open book: paid, written off, in another org, or never existed.
    // The same answer for all of them, so the response cannot probe other tenants.
    if (!invoice) {
      skipped.push({ invoice_id: invoiceId, reason: "Nothing left to collect" });
      continue;
    }
    const reason = ineligibleReason(invoice, today);
    if (reason) skipped.push({ invoice_id: invoiceId, reason });
    else accepted.push(invoiceId);
  }

  if (accepted.length > 0) {
    const { error } = await caller.supabase.from("chase_requests").insert(
      accepted.map((invoiceId) => ({
        org_id: caller.orgId,
        invoice_id: invoiceId,
        requested_by: caller.userId,
      })),
    );
    if (error) throw error;
  }

  return { queued: accepted.length, skipped };
}
