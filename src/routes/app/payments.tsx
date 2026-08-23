import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";

/** Structural stub — see accounts.tsx. */
export const Route = createFileRoute("/app/payments")({
  head: () => ({ meta: [{ title: `Payments — ${PRODUCT_NAME}` }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Payments</h1>;
}
