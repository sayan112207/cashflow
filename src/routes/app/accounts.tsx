import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Structural stub. Reachable on purpose: the nav is complete from this build,
 * so a section without a screen still has to resolve to a real page.
 */
export const Route = createFileRoute("/app/accounts")({
  head: () => ({ meta: [{ title: `Accounts — ${PRODUCT_NAME}` }] }),
  component: AccountsPage,
});

function AccountsPage() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Accounts</h1>;
}
