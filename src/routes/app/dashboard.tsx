import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { AgingBar } from "@/components/app/AgingBar";
import { AppButton } from "@/components/app/AppButton";
import { AppCheckbox } from "@/components/app/AppCheckbox";
import { AppSkeleton } from "@/components/app/AppSkeleton";
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
  isZeroMoney,
} from "@/lib/format";
import type { ChaseQueue, ChaseQueueItem, DashboardSummary } from "@/lib/schemas/dashboard";
import {
  aggregatesUnavailableFixture,
  allAgedSummaryFixture,
  chaseQueueFixture,
  emptyChaseQueueFixture,
  largeTotalSummaryFixture,
  longAccountNameChaseQueueFixture,
  PRE_CHECKED_INVOICE_IDS,
  summaryFixture,
} from "@/lib/services/dashboard.mocks";

/**
 * Temporary. Spec §6's five states are otherwise unreachable without a backend.
 * Deleted when this screen is wired to the service — nothing should come to
 * depend on the param.
 *
 *   /app/dashboard
 *   /app/dashboard?state=loading
 *   /app/dashboard?state=empty
 *   /app/dashboard?state=error
 *   /app/dashboard?state=overflow
 *   /app/dashboard?state=aged
 */
const dashboardSearchSchema = z.object({
  state: z.enum(["loading", "empty", "error", "overflow", "aged"]).optional(),
});

export const Route = createFileRoute("/app/dashboard")({
  validateSearch: dashboardSearchSchema,
  head: () => ({ meta: [{ title: `Dashboard — ${PRODUCT_NAME}` }] }),
  component: DashboardPage,
});

type PreviewState = z.infer<typeof dashboardSearchSchema>["state"];

type DashboardView =
  | { kind: "loading" }
  | { kind: "error"; message: string; queue: ChaseQueue }
  | { kind: "ready"; summary: DashboardSummary; queue: ChaseQueue };

/**
 * FILLER DATA — every figure on this screen except the user's name comes from
 * fixtures, not from the API. `viewFor` is the seam: Step 7 replaces it with
 * the service calls, and the rest of this file already consumes the schemas'
 * output types.
 */
function viewFor(state: PreviewState): DashboardView {
  switch (state) {
    case "loading":
      return { kind: "loading" };
    case "error":
      return {
        kind: "error",
        message: aggregatesUnavailableFixture.error.message,
        queue: chaseQueueFixture,
      };
    case "empty":
      return { kind: "ready", summary: summaryFixture, queue: emptyChaseQueueFixture };
    case "aged":
      return { kind: "ready", summary: allAgedSummaryFixture, queue: emptyChaseQueueFixture };
    case "overflow":
      return {
        kind: "ready",
        summary: largeTotalSummaryFixture,
        queue: longAccountNameChaseQueueFixture,
      };
    default:
      return { kind: "ready", summary: summaryFixture, queue: chaseQueueFixture };
  }
}

/**
 * Spec §6: an empty queue is "everything is 90+" when that bucket holds the
 * whole book. `share_pct` is rounded to one decimal, so 100 is not a reliable
 * signal — a fully aged book can arrive as 99.9 and the cheerful empty copy
 * would then claim the book is current.
 *
 * Every other bucket being zero-money is the same fact without the rounding.
 * A 90+ of zero is an empty book, not an aged one.
 */
function isAllAged(summary: DashboardSummary): boolean {
  const oldest = summary.aging.find((segment) => segment.bucket === "90+");
  if (oldest === undefined || isZeroMoney(oldest.amount)) return false;
  return summary.aging.every((segment) => segment.bucket === "90+" || isZeroMoney(segment.amount));
}

function DashboardPage() {
  const { state } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const firstName = formatFirstName(user.displayName);
  const greeting = formatGreeting();
  const view = viewFor(state);

  function retry() {
    void navigate({ to: "/app/dashboard", search: {} });
  }

  const asOf = view.kind === "ready" ? view.summary.as_of : null;

  return (
    <div aria-busy={view.kind === "loading" || undefined}>
      <header className="mb-6">
        <h1 className="text-title font-bold tracking-tight text-fg" suppressHydrationWarning>
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>
        {asOf ? (
          <p className="mt-1 text-prose font-normal text-fg-soft">
            {formatLongDate(asOf)} · Last synced at {formatTimeOfDay(asOf)}
          </p>
        ) : (
          // Same line-height as the metadata so the tile row does not jump
          // when loading resolves into a timestamp.
          <p className="mt-1 text-prose font-normal text-fg-soft">&nbsp;</p>
        )}
      </header>

      {view.kind === "loading" ? (
        <DashboardLoading />
      ) : view.kind === "error" ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <p role="alert" className="text-body font-semibold text-fg">
              {view.message}
            </p>
            <AppButton variant="secondary" onClick={retry}>
              Retry
            </AppButton>
          </div>
          <TileRow summary={null} />
          <ChaseNowSection queue={view.queue} />
        </>
      ) : (
        <>
          <TileRow summary={view.summary} />
          <section className="mt-8">
            <h2 className="mb-4 text-section font-bold tracking-tight text-fg">
              Where the money is sitting
            </h2>
            <AgingBar segments={view.summary.aging} />
          </section>
          <AttentionRow summary={view.summary} />
          <ChaseNowSection
            queue={view.queue}
            {...(view.queue.items.length === 0
              ? {
                  emptyAmount: view.summary.tiles.total_outstanding,
                  emptyKind: isAllAged(view.summary) ? "aged" : "current",
                }
              : {})}
          />
        </>
      )}
    </div>
  );
}

function TileRow({ summary }: { summary: DashboardSummary | null }) {
  const dash = summary === null;
  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricTile
        to="/app/accounts"
        eyebrow="Total outstanding"
        value={dash ? "—" : formatINR(summary.tiles.total_outstanding)}
        subline={dash ? "\u00a0" : `${summary.tiles.account_count} accounts`}
      />
      <MetricTile
        to="/app/invoices"
        search={{ status: "overdue" }}
        eyebrow="Overdue"
        value={dash ? "—" : formatINR(summary.tiles.overdue)}
        subline={dash ? "\u00a0" : `${summary.tiles.overdue_share_pct.toFixed(1)}% of book`}
        tone="danger"
      />
      <MetricTile
        to="/app/invoices"
        eyebrow="Open invoices"
        value={dash ? "—" : String(summary.tiles.open_invoice_count)}
        subline={dash ? "\u00a0" : `across ${summary.tiles.account_count} accounts`}
      />
      <MetricTile
        to="/app/accounts"
        search={{ filter: "missing-contact" }}
        eyebrow="Missing contacts"
        value={dash ? "—" : String(summary.tiles.missing_contact_account_count)}
        subline={dash ? "\u00a0" : "accounts can't be chased"}
      />
    </div>
  );
}

function AttentionRow({ summary }: { summary: DashboardSummary }) {
  return (
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
  );
}

/**
 * Spec §6 enumerates three skeleton regions. The attention strip is not in
 * that list, but omitting it would drop the Chase now block by a card-row when
 * data arrives, which is the layout shift the same paragraph forbids. Three
 * card skeletons occupy the strip's final size; they are not extra chrome.
 */
function DashboardLoading() {
  return (
    <>
      <span className="sr-only">Loading dashboard</span>
      <div className="grid grid-cols-4 gap-4">
        <TileSkeleton />
        <TileSkeleton />
        <TileSkeleton />
        <TileSkeleton />
      </div>
      <section className="mt-8">
        <h2 className="mb-4 text-section font-bold tracking-tight text-fg">
          Where the money is sitting
        </h2>
        <AgingBarSkeleton />
      </section>
      <section className="mt-8">
        <h2 className="mb-4 text-section font-bold tracking-tight text-fg">Needs your attention</h2>
        <div className="grid grid-cols-3 gap-4">
          <TileSkeleton eyebrow={false} />
          <TileSkeleton eyebrow={false} />
          <TileSkeleton eyebrow={false} />
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-section font-bold tracking-tight text-fg">Chase now</h2>
        <p className="mt-1 mb-4 text-prose font-normal text-fg-soft">
          Ranked by what's most worth chasing today
        </p>
        <DataTable columns={SKELETON_COLUMNS} rows={SKELETON_ROWS} rowKey={(row) => row.id} />
      </section>
    </>
  );
}

function TileSkeleton({ eyebrow = true }: { eyebrow?: boolean }) {
  return (
    <div className="rounded-card border border-hairline bg-card px-5 py-4">
      {eyebrow ? <AppSkeleton className="h-3 w-24" /> : null}
      {/* h-7 is 28px — the metric size — so the card is the loaded tile's height. */}
      <AppSkeleton className={eyebrow ? "mt-2 h-7 w-32" : "h-7 w-16"} />
      <AppSkeleton className="mt-1 h-3 w-28" />
    </div>
  );
}

function AgingBarSkeleton() {
  return (
    <div>
      <AppSkeleton className="h-2.5 w-full rounded-pill" />
      <div className="mt-3 grid grid-cols-5 gap-4">
        {AGING_SKELETON_KEYS.map((key) => (
          <div key={key}>
            <AppSkeleton className="h-3 w-16" />
            <AppSkeleton className="mt-1 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

const AGING_SKELETON_KEYS = ["none", "30", "60", "90", "over"] as const;

const SKELETON_ROWS = [
  { id: "s1" },
  { id: "s2" },
  { id: "s3" },
  { id: "s4" },
  { id: "s5" },
  { id: "s6" },
] as const;

const SKELETON_COLUMNS: readonly Column<(typeof SKELETON_ROWS)[number]>[] = [
  {
    id: "select",
    header: "Select",
    headerHidden: true,
    cell: () => <AppSkeleton className="size-4" />,
  },
  { id: "account", header: "Account", cell: () => <AppSkeleton className="h-3.5 w-40" /> },
  { id: "invoice", header: "Invoice", cell: () => <AppSkeleton className="h-3.5 w-16" /> },
  {
    id: "amount",
    header: "Amount",
    align: "right",
    cell: () => <AppSkeleton className="ml-auto h-3.5 w-20" />,
  },
  {
    id: "overdue",
    header: "Overdue",
    align: "right",
    cell: () => <AppSkeleton className="ml-auto h-3.5 w-16" />,
  },
  {
    id: "priority",
    header: "Priority",
    cell: () => <AppSkeleton className="h-5 w-20 rounded-pill" />,
  },
  { id: "reason", header: "Reason", cell: () => <AppSkeleton className="h-3.5 w-48" /> },
  {
    id: "action",
    header: "",
    headerHidden: true,
    cell: () => <AppSkeleton className="ml-auto h-3.5 w-12" />,
  },
];

function ChaseNowSection({
  queue,
  emptyAmount,
  emptyKind,
}: {
  queue: ChaseQueue;
  emptyAmount?: string;
  emptyKind?: "current" | "aged";
}) {
  return (
    <section className="mt-8">
      <h2 className="text-section font-bold tracking-tight text-fg">Chase now</h2>
      <p className="mt-1 mb-4 text-prose font-normal text-fg-soft">
        Ranked by what's most worth chasing today
      </p>
      {emptyKind === "current" && emptyAmount !== undefined ? (
        <EmptyCurrent total={emptyAmount} />
      ) : emptyKind === "aged" ? (
        <EmptyAged />
      ) : (
        <ChaseTable
          key={queue.items.map((item) => item.invoice_id).join(",")}
          items={queue.items}
        />
      )}
    </section>
  );
}

function EmptyCurrent({ total }: { total: string }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <EmptyCheckIcon />
      <h3 className="mt-4 text-section font-bold tracking-tight text-fg">
        Nothing overdue. All {formatINR(total)} is current.
      </h3>
      <p className="mt-2 text-prose font-normal text-fg-soft">
        We'll start chasing again the moment something slips.
      </p>
    </div>
  );
}

function EmptyAged() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h3 className="text-section font-bold tracking-tight text-fg">
        Nothing in the chase queue — everything is over 90 days old.
      </h3>
      <Link
        to="/app/reports"
        className="mt-3 inline-block text-body font-semibold text-accent hover:text-accent-hover"
      >
        Reports
      </Link>
    </div>
  );
}

/**
 * 40px, stroke 1.6, muted — spec §6. Inline rather than a lucide icon because
 * lucide's default stroke is 2 and its size-4 override on buttons does not
 * apply here, but matching 1.6 exactly is cheaper as three paths than as a
 * library default plus an override.
 */
function EmptyCheckIcon() {
  return (
    <svg
      className="mx-auto size-10 text-fg-muted"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M13 20.5 17.5 25 27 15.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChaseTable({ items }: { items: readonly ChaseQueueItem[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => {
    const present = new Set(items.map((item) => item.invoice_id));
    return new Set(PRE_CHECKED_INVOICE_IDS.filter((id) => present.has(id)));
  });

  const allSelected = items.length > 0 && selected.size === items.length;
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
      previous.size === items.length
        ? new Set<string>()
        : new Set(items.map((item) => item.invoice_id)),
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
      text: (row) => (row.days_overdue > 0 ? formatDays(row.days_overdue) : "Not yet due"),
    },
    {
      id: "priority",
      header: "Priority",
      cell: (row) => <PriorityBadge band={row.priority_band} />,
    },
    { id: "reason", header: "Reason", text: (row) => row.priority_reason, truncateAt: "sm" },
    {
      id: "action",
      header: "",
      headerHidden: true,
      align: "right",
      cell: () => (
        <AppButton variant="text" className="row-action ml-auto">
          Chase
        </AppButton>
      ),
    },
  ];

  return (
    <>
      <BulkBar count={selected.size} onChase={chase} />
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.invoice_id}
        isRowSelected={(row) => selected.has(row.invoice_id)}
      />
    </>
  );
}
