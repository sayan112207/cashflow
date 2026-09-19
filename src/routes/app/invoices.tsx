import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PRODUCT_NAME } from "@/lib/brand";
import { formatINR, formatShortDate } from "@/lib/format";
import { accountsQueryKeys, getAccounts } from "@/lib/services/accounts";
import { getInvoices, invoicesQueryKeys } from "@/lib/services/invoices";

/**
 * Structural stub — see accounts.tsx.
 *
 * The search schema exists ahead of the screen because the Dashboard already
 * links here three ways, and spec §2 requires all four tile destinations to be
 * distinct. Declaring it now makes those links type-checked instead of
 * hand-built strings that rot silently.
 */
const invoicesSearchSchema = z.object({
  status: z.enum(["overdue", "disputed", "promise-broken"]).optional(),
});

export const Route = createFileRoute("/app/invoices")({
  validateSearch: invoicesSearchSchema,
  head: () => ({ meta: [{ title: `Invoices — ${PRODUCT_NAME}` }] }),
  component: InvoicesPage,
});

/**
 * Invoices list screen. Loads this org's invoices and account names in
 * parallel and renders loading, error (with retry), empty, and populated
 * table states.
 */
function InvoicesPage() {
  const { orgs } = Route.useRouteContext();
  const orgId = orgs[0]!.id;
  const invoicesQuery = useQuery({
    queryKey: invoicesQueryKeys.list(orgId),
    queryFn: () => getInvoices({ data: { org_id: orgId } }),
    retry: false,
  });
  const accountsQuery = useQuery({
    queryKey: accountsQueryKeys.list({ sort: "name", dir: "asc" }),
    queryFn: () => getAccounts({ sort: "name", dir: "asc" }),
    retry: false,
  });
  const accountNames = new Map(
    (accountsQuery.data?.items ?? []).map((account) => [account.account_id, account.name]),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title font-bold tracking-tight text-fg">Invoices</h1>
        <p className="mt-1 text-prose text-fg-soft">Your open receivables and invoice history.</p>
      </header>
      {invoicesQuery.isPending ? (
        <p aria-busy="true" className="text-prose text-fg-soft">
          Loading invoices…
        </p>
      ) : null}
      {invoicesQuery.error ? (
        <p role="alert" className="text-body text-danger">
          Couldn't load invoices.{" "}
          <button type="button" className="underline" onClick={() => void invoicesQuery.refetch()}>
            Retry
          </button>
        </p>
      ) : null}
      {invoicesQuery.data?.length === 0 ? (
        <p className="rounded-card border border-hairline bg-card p-6 text-body text-fg-soft">
          No invoices yet. Add entries to begin.
        </p>
      ) : null}
      {invoicesQuery.data && invoicesQuery.data.length > 0 ? (
        <div className="overflow-auto rounded-card border border-hairline bg-card">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                {["Account", "Invoice", "Amount", "Invoice date", "Due date", "Status"].map(
                  (header) => (
                    <th
                      key={header}
                      scope="col"
                      className="border-b border-hairline bg-subtle px-3 py-3 text-left text-eyebrow font-semibold tracking-widest text-fg-muted uppercase"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {invoicesQuery.data.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-hovered">
                  <td className="border-b border-hairline px-3 py-3 text-body font-semibold text-fg">
                    {accountNames.get(invoice.account_id) ?? invoice.account_id}
                  </td>
                  <td className="border-b border-hairline px-3 py-3 text-body text-fg">
                    {invoice.invoice_number}
                  </td>
                  <td className="border-b border-hairline px-3 py-3 text-right text-body tnum">
                    {formatINR(String(invoice.amount))}
                  </td>
                  <td className="border-b border-hairline px-3 py-3 text-body">
                    {formatShortDate(invoice.issue_date)}
                  </td>
                  <td className="border-b border-hairline px-3 py-3 text-body">
                    {formatShortDate(invoice.due_date)}
                  </td>
                  <td className="border-b border-hairline px-3 py-3 text-prose text-fg-soft">
                    {invoice.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
