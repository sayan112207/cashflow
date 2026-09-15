import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

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
import type { AccountPayment, AccountPayments } from "@/lib/schemas/accounts";
import { AccountsApiError, accountsQueryKeys, getAccountPayments } from "@/lib/services/accounts";

type AccountPaymentsPanelProps = {
  accountId: string;
  accountName: string;
};

/** Spec §5 — payments table + unapplied-credit strip. Allocate routes out; no modal. */
export function AccountPaymentsPanel({ accountId, accountName }: AccountPaymentsPanelProps) {
  const paymentsQuery = useQuery({
    queryKey: accountsQueryKeys.payments(accountId),
    queryFn: () => getAccountPayments(accountId),
    retry: false,
  });

  if (paymentsQuery.isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading payments">
        {Array.from({ length: 4 }, (_, i) => (
          <AppSkeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (paymentsQuery.isError) {
    const message =
      paymentsQuery.error instanceof AccountsApiError
        ? paymentsQuery.error.message
        : "Couldn't load payments.";
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-body font-semibold text-fg">{message}</p>
        <AppButton
          variant="secondary"
          onClick={() => {
            void paymentsQuery.refetch();
          }}
        >
          Retry
        </AppButton>
      </div>
    );
  }

  const data = paymentsQuery.data;
  if (!data || data.items.length === 0) {
    return (
      <p className="py-6 text-body font-semibold text-fg">
        No payments recorded from {accountName} yet.
      </p>
    );
  }

  return <PaymentsTable data={data} />;
}

function PaymentsTable({ data }: { data: AccountPayments }) {
  const showUnapplied = !isZeroMoney(data.unapplied_total);

  return (
    <div className="space-y-4">
      {showUnapplied ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-body font-semibold text-warn">
            {formatINR(data.unapplied_total)} unapplied credit
          </p>
          <Link
            to="/app/payments"
            className="inline-flex items-center justify-center rounded-pill border border-stroke bg-card px-4 py-2 text-body font-semibold text-fg transition-colors duration-150 hover:bg-hovered"
          >
            Allocate
          </Link>
        </div>
      ) : null}

      <Table className="min-w-max border-collapse">
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead
              scope="col"
              className="h-auto border-b border-hairline bg-subtle px-3 py-3 text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
            >
              Date
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
              Source
            </TableHead>
            <TableHead
              scope="col"
              className="h-auto border-b border-hairline bg-subtle px-3 py-3 text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
            >
              Allocated to
            </TableHead>
            <TableHead
              scope="col"
              className="h-auto border-b border-hairline bg-subtle px-3 py-3 text-right text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
            >
              Unapplied
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((payment) => (
            <PaymentRow key={payment.payment_id} payment={payment} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PaymentRow({ payment }: { payment: AccountPayment }) {
  const allocatedTo =
    payment.allocations.length === 0
      ? "—"
      : payment.allocations.map((a) => a.invoice_number).join(", ");

  return (
    <TableRow className="border-0 hover:bg-hovered">
      <TableCell className="border-b border-hairline px-3 py-3 text-body font-semibold text-fg">
        {formatShortDate(payment.received_on)}
      </TableCell>
      <TableCell className="border-b border-hairline px-3 py-3 text-right text-body font-semibold text-fg tnum">
        {formatINR(payment.amount)}
      </TableCell>
      <TableCell className="border-b border-hairline px-3 py-3 text-body font-semibold text-fg">
        {payment.source}
      </TableCell>
      <TableCell className="border-b border-hairline px-3 py-3 text-body font-semibold text-fg">
        {allocatedTo}
      </TableCell>
      <TableCell className="border-b border-hairline px-3 py-3 text-right text-body font-semibold text-fg tnum">
        {isZeroMoney(payment.unapplied) ? "—" : formatINR(payment.unapplied)}
      </TableCell>
    </TableRow>
  );
}
