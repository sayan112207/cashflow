import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppButton } from "@/components/app/AppButton";
import { AppSkeleton } from "@/components/app/AppSkeleton";
import {
  formatDays,
  formatINR,
  formatShortDate,
  invoiceStatusLabel,
  type InvoiceStatusDisplay,
} from "@/lib/format";
import type { AccountInvoice, AccountInvoiceGroup, AccountInvoices } from "@/lib/schemas/accounts";
import type { AgingBucket } from "@/lib/schemas/dashboard";
import { AccountsApiError } from "@/lib/services/accounts";
import { cn } from "@/lib/utils";

/**
 * The row actions have no mutation flows behind them in this build. They stay
 * visible because the row layout is part of what this PR is for, but an enabled
 * button that does nothing reads as broken rather than unfinished.
 */
const ROW_ACTION_PENDING = "Invoice actions are not in this build yet.";

type AccountInvoicesPanelProps = {
  accountName: string;
  data: AccountInvoices | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
};

/**
 * Spec §3 — invoices grouped by aging bucket. Group order and subtotals are
 * whatever the API returned; this component does not re-bucket or re-sum.
 */
export function AccountInvoicesPanel({
  accountName,
  data,
  isPending,
  error,
  onRetry,
}: AccountInvoicesPanelProps) {
  if (isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading invoices">
        {Array.from({ length: 6 }, (_, i) => (
          <AppSkeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    const message =
      error instanceof AccountsApiError ? error.message : "Couldn't load this account.";
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-body font-semibold text-fg">{message}</p>
        <AppButton variant="secondary" onClick={onRetry}>
          Retry
        </AppButton>
      </div>
    );
  }

  if (!data || data.groups.length === 0 || data.groups.every((g) => g.invoices.length === 0)) {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-body font-semibold text-fg">Nothing outstanding from {accountName}.</p>
        {/* Spec keeps this in the empty state, so it stays visible; invoice
            creation is not in this build, so it does not stay enabled. */}
        <AppButton variant="secondary" disabled title={ROW_ACTION_PENDING}>
          Add an invoice
        </AppButton>
      </div>
    );
  }

  return <GroupedInvoicesTable groups={data.groups} />;
}

function GroupedInvoicesTable({ groups }: { groups: readonly AccountInvoiceGroup[] }) {
  return (
    <Table className="min-w-max border-collapse">
      <TableHeader>
        <TableRow className="border-0 hover:bg-transparent">
          <TableHead
            scope="col"
            className="h-auto border-b border-hairline bg-subtle px-3 py-3 text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
          >
            Invoice #
          </TableHead>
          <TableHead
            scope="col"
            className="h-auto border-b border-hairline bg-subtle px-3 py-3 text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
          >
            Invoice date
          </TableHead>
          <TableHead
            scope="col"
            className="h-auto border-b border-hairline bg-subtle px-3 py-3 text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
          >
            Due date
          </TableHead>
          <TableHead
            scope="col"
            className="h-auto border-b border-hairline bg-subtle px-3 py-3 text-right text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
          >
            Days overdue
          </TableHead>
          <TableHead
            scope="col"
            className="h-auto border-b border-hairline bg-subtle px-3 py-3 text-right text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
          >
            Amount
          </TableHead>
          <TableHead
            scope="col"
            className="h-auto border-b border-hairline bg-subtle px-3 py-3 text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
          >
            Status
          </TableHead>
          <TableHead scope="col" className="h-auto border-b border-hairline bg-subtle px-3 py-3">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      {groups.map((group) => (
        <TableBody key={group.bucket}>
          <TableRow className="border-0 bg-alt hover:bg-alt">
            <TableCell
              colSpan={7}
              className="border-b border-hairline px-3 py-2 text-eyebrow font-semibold tracking-widest text-fg uppercase"
            >
              {groupHeaderLabel(group.bucket)} ⟶ {formatINR(group.subtotal)}
            </TableCell>
          </TableRow>
          {group.invoices.map((invoice) => (
            <InvoiceRow key={invoice.invoice_id} invoice={invoice} />
          ))}
        </TableBody>
      ))}
    </Table>
  );
}

function groupHeaderLabel(bucket: AgingBucket): string {
  if (bucket === "Not yet due") return "Not yet due";
  return `${bucket} days overdue`;
}

const INVOICE_STATUS_CLASSES: Record<InvoiceStatusDisplay, string> = {
  "Not yet due": "bg-alt text-fg-soft",
  Open: "bg-alt text-fg-soft",
  Overdue: "bg-danger-tint text-danger",
  "Partially paid": "bg-warn-tint text-warn",
  Promised: "bg-warn-tint text-warn",
  Disputed: "bg-danger-tint text-danger",
  Paid: "bg-alt text-fg-muted",
  "Written off": "bg-alt text-fg-muted",
};

function InvoiceStatusBadge({ label }: { label: InvoiceStatusDisplay }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 text-pill font-semibold",
        INVOICE_STATUS_CLASSES[label],
      )}
    >
      {label}
    </span>
  );
}

function InvoiceRow({ invoice }: { invoice: AccountInvoice }) {
  const chaseDisabled = invoice.chase_disabled_reason !== null;

  return (
    <TableRow className="border-0 hover:bg-hovered">
      <TableCell className="whitespace-nowrap border-b border-hairline px-3 py-3 text-body font-semibold text-fg">
        {invoice.number}
      </TableCell>
      <TableCell className="whitespace-nowrap border-b border-hairline px-3 py-3 text-body font-semibold text-fg">
        {formatShortDate(invoice.invoice_date)}
      </TableCell>
      <TableCell className="whitespace-nowrap border-b border-hairline px-3 py-3 text-body font-semibold text-fg">
        {formatShortDate(invoice.due_date)}
      </TableCell>
      <TableCell className="whitespace-nowrap border-b border-hairline px-3 py-3 text-right text-body font-semibold">
        <DaysOverdue days={invoice.days_overdue} />
      </TableCell>
      <TableCell className="whitespace-nowrap border-b border-hairline px-3 py-3 text-right text-body font-semibold text-fg tnum">
        {formatINR(invoice.amount_outstanding)}
      </TableCell>
      <TableCell className="whitespace-nowrap border-b border-hairline px-3 py-3 text-body font-semibold text-fg">
        <InvoiceStatusBadge label={invoiceStatusLabel(invoice.status, invoice.days_overdue)} />
      </TableCell>
      <TableCell className="whitespace-nowrap border-b border-hairline px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          <AppButton
            variant="text"
            className="row-action"
            disabled
            title={invoice.chase_disabled_reason ?? ROW_ACTION_PENDING}
            aria-label={
              chaseDisabled
                ? `Chase ${invoice.number} (disabled: ${invoice.chase_disabled_reason})`
                : `Chase ${invoice.number}`
            }
          >
            Chase
          </AppButton>
          <AppButton
            variant="text"
            className="row-action"
            disabled
            title={ROW_ACTION_PENDING}
            aria-label={`Mark ${invoice.number} paid`}
          >
            Mark paid
          </AppButton>
          <AppButton
            variant="text"
            className="row-action"
            disabled
            title={ROW_ACTION_PENDING}
            aria-label={`Snooze ${invoice.number}`}
          >
            Snooze
          </AppButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

function DaysOverdue({ days }: { days: number }) {
  if (days <= 0) {
    return <span className="text-fg-muted">Not yet due</span>;
  }
  if (days <= 30) {
    return <span className="text-warn tnum">{formatDays(days)}</span>;
  }
  return <span className="text-danger tnum">{formatDays(days)}</span>;
}
