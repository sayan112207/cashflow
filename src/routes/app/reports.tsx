import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";

/** Structural stub — see accounts.tsx. */
export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: `Reports — ${PRODUCT_NAME}` }] }),
  component: ReportsPage,
});

function ReportsPage() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Reports</h1>;
}
