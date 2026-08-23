import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Structural stub until Account Detail (spec §2) is built. List rows link here
 * so the destination exists and the URL shape is frozen.
 */
export const Route = createFileRoute("/app/accounts/$accountId")({
  head: () => ({ meta: [{ title: `Account — ${PRODUCT_NAME}` }] }),
  component: AccountDetailStub,
});

function AccountDetailStub() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Account</h1>;
}
