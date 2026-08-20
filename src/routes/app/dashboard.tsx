import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AgingBar } from "@/components/app/AgingBar";
import { AppButton } from "@/components/app/AppButton";
import { AppCheckbox } from "@/components/app/AppCheckbox";
import { BulkBar } from "@/components/app/BulkBar";
import { DataTable, type Column } from "@/components/app/DataTable";
import { MetricTile } from "@/components/app/MetricTile";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { PRODUCT_NAME } from "@/lib/brand";
import {
  formatDays,
  formatFirstName,
  formatGreeting,
  formatINR,
  formatLongDate,
  formatTimeOfDay,
} from "@/lib/format";
import type { ChaseQueueItem } from "@/lib/schemas/dashboard";
import {
  chaseQueueFixture,
  PRE_CHECKED_INVOICE_IDS,
  summaryFixture,
} from "@/lib/services/dashboard.mocks";

/**
 * Fixtures are imported directly, on purpose. This build is about whether the
 * layout holds; wiring the service in would mix layout bugs with loading,
 * error and race-condition bugs in the same change.
 */
export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: `Dashboard — ${PRODUCT_NAME}` }] }),
  component: DashboardPage,
});

/**
 * FILLER DATA — every figure on this screen except the user's name comes from
 * these two fixtures, not from the API. The account names, invoice numbers and
 * amounts are invented; do not read anything into them.
 *
 * This is the only seam. Step 7 swaps these two bindings for `getSummary()` and
 * `getChaseQueue()` behind TanStack Query, and nothing below changes: the
 * fixtures are typed as the zod schemas' output, so the component already
 * consumes exactly the shape a real response parses into.
 */
const summary = summaryFixture;
const queue = chaseQueueFixture;

function DashboardPage() {
  // Resolved by the /app guard, so it is never null by the time this renders.
  const { user } = Route.useRouteContext();
  const firstName = formatFirstName(user.displayName);
  const greeting = formatGreeting();

  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(PRE_CHECKED_INVOICE_IDS),
  );

  const allSelected = queue.items.length > 0 && selected.size === queue.items.length;
  const headerChecked = allSelected ? true : selected.size === 0 ? false : "indeterminate";

  function toggleRow(invoiceId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((previous) =>
      previous.size === queue.items.length
        ? new Set<string>()
        : new Set(queue.items.map((item) => item.invoice_id)),
    );
  }

  /** Step 7 replaces this with `postChases`. Deliberately inert for now. */
  function chase() {}

  const columns: readonly Column<ChaseQueueItem>[] = [
    {
      id: "select",
      header: "Select",
      headerHidden: true,
      headerCell: () => (
        <AppCheckbox
          checked={headerChecked}
          onCheckedChange={toggleAll}
          aria-label="Select all invoices"
        />
      ),
      cell: (row) => (
        <AppCheckbox
          checked={selected.has(row.invoice_id)}
          onCheckedChange={() => toggleRow(row.invoice_id)}
          aria-label={`Select invoice ${row.invoice_number}`}
        />
      ),
    },
    { id: "account", header: "Account", text: (row) => row.account_name, truncateAt: "xs" },
    { id: "invoice", header: "Invoice", text: (row) => row.invoice_number },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      text: (row) => formatINR(row.amount_outstanding),
    },
    {
      id: "overdue",
      header: "Overdue",
      align: "right",
      // Spec §7: never "0 days". A non-overdue invoice reads "Not yet due".
      text: (row) => (row.days_overdue > 0 ? formatDays(row.days_overdue) : "Not yet due"),
    },
    {
      id: "priority",
      header: "Priority",
      cell: (row) => <PriorityBadge band={row.priority_band} />,
    },
    { id: "reason", header: "Reason", text: (row) => row.priority_reason, truncateAt: "sm" },
    {
      // Unheaded, so the table announces exactly seven column headers.
      id: "action",
      header: "",
      headerHidden: true,
      align: "right",
      cell: () => (
        // `row-action` hides this until the row is hovered *or* the button
        // itself takes focus. The rule lives in app-tokens.css.
        <AppButton variant="text" className="row-action ml-auto">
          Chase
        </AppButton>
      ),
    },
  ];

  return (
    <>
      <header className="mb-6">
        {/*
         * The spec's "Good morning, Priya" was sample copy — Priya is the
         * persona and the greeting was frozen at one time of day. Both are live
         * now, and the name degrades to a bare greeting rather than falling
         * back to an email.
         *
         * suppressHydrationWarning covers one case only: the page rendering at
         * 11:59:59 and hydrating at 12:00:01, where "morning" and "afternoon"
         * are both correct for the moment they were computed. The time zone is
         * pinned in the formatter, so that sub-second window is the whole of
         * the remaining risk.
         */}
        <h1 className="text-title font-bold tracking-tight text-fg" suppressHydrationWarning>
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>
        <p className="mt-1 text-prose font-normal text-fg-soft">
          {formatLongDate(summary.as_of)} · Last synced at {formatTimeOfDay(summary.as_of)}
        </p>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <MetricTile
          to="/app/accounts"
          eyebrow="Total outstanding"
          value={formatINR(summary.tiles.total_outstanding)}
          subline={`${summary.tiles.account_count} accounts`}
        />
        <MetricTile
          to="/app/invoices"
          search={{ status: "overdue" }}
          eyebrow="Overdue"
          value={formatINR(summary.tiles.overdue)}
          subline={`${summary.tiles.overdue_share_pct.toFixed(1)}% of book`}
          tone="danger"
        />
        <MetricTile
          to="/app/invoices"
          eyebrow="Open invoices"
          value={String(summary.tiles.open_invoice_count)}
          subline={`across ${summary.tiles.account_count} accounts`}
        />
        <MetricTile
          to="/app/accounts"
          search={{ filter: "missing-contact" }}
          eyebrow="Missing contacts"
          value={String(summary.tiles.missing_contact_account_count)}
          subline="accounts can't be chased"
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-section font-bold tracking-tight text-fg">
          Where the money is sitting
        </h2>
        <AgingBar segments={summary.aging} />
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-section font-bold tracking-tight text-fg">Needs your attention</h2>
        <div className="grid grid-cols-3 gap-4">
          <MetricTile
            to="/app/accounts"
            search={{ filter: "missing-contact" }}
            value={String(summary.attention.accounts_without_p0)}
            subline="accounts with no P0 contact"
          />
          <MetricTile
            to="/app/invoices"
            search={{ status: "disputed" }}
            value={String(summary.attention.disputes_open)}
            subline={summary.attention.disputes_open === 1 ? "dispute raised" : "disputes raised"}
          />
          <MetricTile
            to="/app/invoices"
            search={{ status: "promise-broken" }}
            value={String(summary.attention.promises_broken_this_week)}
            subline="promises broken this week"
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-section font-bold tracking-tight text-fg">Chase now</h2>
        <p className="mt-1 mb-4 text-prose font-normal text-fg-soft">
          Ranked by what's most worth chasing today
        </p>
        <BulkBar count={selected.size} onChase={chase} />
        <DataTable
          columns={columns}
          rows={queue.items}
          rowKey={(row) => row.invoice_id}
          isRowSelected={(row) => selected.has(row.invoice_id)}
        />
      </section>
    </>
  );
}
