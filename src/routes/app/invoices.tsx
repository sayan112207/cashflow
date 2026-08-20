import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";

/** Structural stub — see accounts.tsx. */
export const Route = createFileRoute("/app/invoices")({
  head: () => ({ meta: [{ title: `Invoices — ${PRODUCT_NAME}` }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Invoices</h1>;
}
