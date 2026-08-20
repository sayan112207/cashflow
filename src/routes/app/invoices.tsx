import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PRODUCT_NAME } from "@/lib/brand";

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

function InvoicesPage() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Invoices</h1>;
}
