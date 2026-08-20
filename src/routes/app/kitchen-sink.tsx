import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppButton } from "@/components/app/AppButton";
import { DataTable, type Column } from "@/components/app/DataTable";
import { MetricTile } from "@/components/app/MetricTile";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatDays, formatINR } from "@/lib/format";
import type { ChaseQueueItem, PriorityBand } from "@/lib/schemas/dashboard";
import { longAccountNameChaseQueueFixture } from "@/lib/services/dashboard.mocks";

/**
 * Temporary. Every variant and state of the shared components on one page, so
 * they can be reviewed side by side before the real screens exist. Deleted in
 * Step 9 — nothing should come to depend on this route.
 */
export const Route = createFileRoute("/app/kitchen-sink")({
  head: () => ({ meta: [{ title: `Kitchen sink — ${PRODUCT_NAME}` }] }),
  component: KitchenSinkPage,
});

const BANDS: readonly PriorityBand[] = ["Escalate", "Chase now", "Watch"];

/**
 * The long-name fixture, so the truncation path is exercised rather than
 * described.
 */
const QUEUE_ROWS = longAccountNameChaseQueueFixture.items;

const QUEUE_COLUMNS: readonly Column<ChaseQueueItem>[] = [
  {
    id: "account",
    header: "Account",
    text: (row) => row.account_name,
    truncateAt: "xs",
  },
  { id: "invoice", header: "Invoice", text: (row) => row.invoice_number },
  {
    id: "amount",
    header: "Outstanding",
    align: "right",
    text: (row) => formatINR(row.amount_outstanding),
  },
  {
    id: "overdue",
    header: "Overdue",
    align: "right",
    text: (row) => formatDays(row.days_overdue),
  },
  {
    id: "priority",
    header: "Priority",
    cell: (row) => <PriorityBadge band={row.priority_band} />,
  },
  { id: "reason", header: "Why", text: (row) => row.priority_reason, truncateAt: "sm" },
  {
    id: "action",
    header: "Actions",
    headerHidden: true,
    align: "right",
    cell: () => (
      <AppButton variant="text" className="ml-auto">
        Chase
      </AppButton>
    ),
  },
];

function KitchenSinkPage() {
  return (
    <>
      <h1 className="text-title font-bold tracking-tight text-fg">Kitchen sink</h1>
      <p className="mt-2 max-w-prose text-prose font-normal text-fg-soft">
        Every shared component in one place. This route is scaffolding and gets removed once the
        real screens are built.
      </p>

      <Section title="Buttons">
        <div className="flex flex-col gap-4">
          <ButtonRow label="Default" />
          <ButtonRow label="Disabled" disabled />
          <ButtonRow label="Loading" loading />
        </div>
      </Section>

      <Section title="Priority badges">
        <div className="flex items-center gap-3">
          {BANDS.map((band) => (
            <PriorityBadge key={band} band={band} />
          ))}
        </div>
      </Section>

      <Section title="Metric tiles">
        <div className="grid grid-cols-3 gap-4">
          <MetricTile
            to="/app/accounts"
            eyebrow="Total outstanding"
            value={formatINR("1840000.00")}
            subline="Across 47 accounts"
          />
          <MetricTile
            to="/app/invoices"
            eyebrow="Overdue"
            value={formatINR("920000.00")}
            subline="50% of outstanding"
            tone="danger"
          />
          <MetricTile
            to="/app/settings"
            eyebrow="Missing contacts"
            value="2"
            subline="Accounts with nobody to chase"
          />
        </div>
      </Section>

      <Section title="Data table">
        <DataTable columns={QUEUE_COLUMNS} rows={QUEUE_ROWS} rowKey={(row) => row.invoice_id} />
      </Section>
    </>
  );
}

function ButtonRow({
  label,
  disabled = false,
  loading = false,
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-20 text-prose font-normal text-fg-muted">{label}</span>
      <AppButton variant="primary" disabled={disabled} loading={loading}>
        Send reminders
      </AppButton>
      <AppButton variant="secondary" disabled={disabled} loading={loading}>
        Export CSV
      </AppButton>
      <AppButton variant="text" disabled={disabled} loading={loading}>
        Chase
      </AppButton>
      <AppButton variant="destructive" disabled={disabled} loading={loading}>
        Delete import
      </AppButton>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-section font-bold tracking-tight text-fg">{title}</h2>
      {children}
    </section>
  );
}
