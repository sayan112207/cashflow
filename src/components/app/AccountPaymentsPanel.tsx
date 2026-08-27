import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { AppButton } from "@/components/app/AppButton";
import { AppSkeleton } from "@/components/app/AppSkeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatShortDate, isZeroMoney } from "@/lib/format";
import type { AccountPayment, PaymentTone } from "@/lib/schemas/accounts";
import { AccountsApiError, accountsQueryKeys, getAccountPayments } from "@/lib/services/accounts";

type AccountPaymentsPanelProps = {
  accountId: string;
  accountName: string;
};

const TONE_CLASS: Record<PaymentTone, string> = {
  muted: "text-fg-soft",
  warn: "text-warn",
  danger: "text-danger",
};

/** Spec §5 — stats strip, payments table, unapplied-credit banner. */
export function AccountPaymentsPanel({ accountId, accountName }: AccountPaymentsPanelProps) {
  const paymentsQuery = useQuery({
    queryKey: accountsQueryKeys.payments(accountId),
    queryFn: () => getAccountPayments(accountId),
    retry: false,
  });

  if (paymentsQuery.isPending) {
    return <PaymentsLoading />;
  }

  if (paymentsQuery.isError) {
    const message =
      paymentsQuery.error instanceof AccountsApiError
        ? paymentsQuery.error.message
        : "Couldn't load payments.";
    return (
      <div className="rounded-card border border-hairline bg-card p-6">
        <p className="text-body font-semibold text-fg">{message}</p>
        <div className="mt-3">
          <AppButton
            variant="secondary"
            onClick={() => {
              void paymentsQuery.refetch();
            }}
          >
            Retry
          </AppButton>
        </div>
      </div>
    );
  }

  const data = paymentsQuery.data;
  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-card border border-hairline bg-card p-8 text-center">
        <p className="text-body font-semibold text-fg">
          No payments recorded from {accountName} yet.
        </p>
      </div>
    );
  }

  const { stats, items } = data;
  const hasUnapplied = !isZeroMoney(stats.unapplied_total);

  return (
    <div className="flex flex-col gap-5">
      <StatRow
        received={stats.received_90d}
        unapplied={stats.unapplied_total}
        averageDelay={stats.average_delay_days}
      />

      <div className="overflow-x-auto rounded-card border border-hairline bg-card">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="bg-subtle">
              <TableHead
                scope="col"
                className="text-eyebrow font-semibold tracking-[0.08em] text-fg-muted uppercase"
              >
                Payment
              </TableHead>
              <TableHead
                scope="col"
                className="text-right text-eyebrow font-semibold tracking-[0.08em] text-fg-muted uppercase"
              >
                Amount
              </TableHead>
              <TableHead
                scope="col"
                className="text-eyebrow font-semibold tracking-[0.08em] text-fg-muted uppercase"
              >
                Applied to
              </TableHead>
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((payment) => (
              <PaymentRow key={payment.payment_id} payment={payment} />
            ))}
          </TableBody>
        </Table>
      </div>

      {hasUnapplied ? (
        <div className="flex items-center justify-between gap-4 rounded-card border border-warn-edge bg-warn-tint px-4 py-3">
          <p className="text-body font-semibold text-warn">
            {formatINR(stats.unapplied_total)} is held as unapplied credit on this account.
          </p>
          <Link
            to="/app/payments"
            className="shrink-0 text-body font-semibold text-accent hover:text-accent-hover"
          >
            Go to payment triage
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function StatRow({
  received,
  unapplied,
  averageDelay,
}: {
  received: string;
  unapplied: string;
  averageDelay: number | null;
}) {
  return (
    <dl className="grid grid-cols-3 gap-4">
      <Stat label="received in 90 days" value={formatINR(received)} tone="fg" />
      <Stat label="unapplied credit" value={formatINR(unapplied)} tone="warn" />
      <Stat
        label="average delay"
        value={averageDelay === null ? "—" : `${averageDelay} days`}
        tone={averageDelay === null ? "muted" : "danger"}
      />
    </dl>
  );
}

const STAT_TONE = {
  fg: "text-fg",
  warn: "text-warn",
  danger: "text-danger",
  muted: "text-fg-muted",
} as const;

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof STAT_TONE;
}) {
  return (
    <div className="rounded-card border border-hairline bg-card px-5 py-4">
      <dd className={`tnum text-metric font-bold tracking-tight ${STAT_TONE[tone]}`}>{value}</dd>
      <dt className="mt-1 text-prose font-normal text-fg-muted">{label}</dt>
    </div>
  );
}

function PaymentRow({ payment }: { payment: AccountPayment }) {
  return (
    <TableRow className="group hover:bg-hovered">
      <TableCell className="py-3 align-top">
        <div className="text-body font-semibold text-fg">{formatShortDate(payment.date)}</div>
        <div className="mt-0.5 text-prose font-normal text-fg-muted">
          {payment.source} · {payment.reference}
        </div>
      </TableCell>

      <TableCell className="py-3 text-right align-top">
        <div className="tnum text-body font-semibold text-fg">{formatINR(payment.amount)}</div>
        <div className={`mt-0.5 text-prose font-normal ${TONE_CLASS[payment.status_tone]}`}>
          {payment.status_label}
        </div>
      </TableCell>

      <TableCell className="py-3 align-top">
        <span
          className={`text-body font-semibold ${payment.is_applied ? "text-fg" : "text-danger"}`}
        >
          {payment.applied_to}
        </span>
      </TableCell>

      <TableCell className="py-3 text-right align-top">
        <AppButton variant="text" className="row-action">
          {payment.action_label}
        </AppButton>
      </TableCell>
    </TableRow>
  );
}

function PaymentsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card border border-hairline bg-card px-5 py-4">
            <AppSkeleton className="h-7 w-32 rounded-check" />
            <AppSkeleton className="mt-2 h-4 w-24 rounded-check" />
          </div>
        ))}
      </div>
      <div className="rounded-card border border-hairline bg-card p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <AppSkeleton key={i} className="mb-3 h-11 w-full rounded-check" />
        ))}
      </div>
    </div>
  );
}
