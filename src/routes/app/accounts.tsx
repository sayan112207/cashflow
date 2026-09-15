import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Structural stub. Reachable on purpose: the nav is complete from this build,
 * so a section without a screen still has to resolve to a real page.
 *
 * `filter=missing-contact` stands in for the spec's `/accounts/contacts-fill`.
 * That path would make this file a layout route and force a separate index
 * route for /app/accounts itself — a restructure this build does not need.
 */
const accountsSearchSchema = z.object({
  filter: z.enum(["missing-contact"]).optional(),
});

export const Route = createFileRoute("/app/accounts")({
  validateSearch: accountsSearchSchema,
  head: () => ({ meta: [{ title: `Accounts — ${PRODUCT_NAME}` }] }),
  component: AccountsPage,
});

function AccountsPage() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Accounts</h1>;
}
