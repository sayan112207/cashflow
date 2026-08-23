import { Outlet, createFileRoute } from "@tanstack/react-router";

/**
 * Layout for `/app/accounts` and `/app/accounts/$accountId`.
 * The list lives on the index route so detail does not remount under the table.
 */
export const Route = createFileRoute("/app/accounts")({
  component: AccountsLayout,
});

function AccountsLayout() {
  return <Outlet />;
}
