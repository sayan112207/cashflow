import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";

/**
 * The one section with a real screen in this build.
 *
 * Still a placeholder: tiles, aging bar and the chase table land in a later
 * step. The heading is here so the shell has something to frame and so the
 * one-h1-per-page rule holds from the start.
 */
export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: `Dashboard — ${PRODUCT_NAME}` }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <>
      <h1 className="text-title font-bold tracking-tight text-fg">Dashboard</h1>
      <p className="mt-2 max-w-prose text-prose font-normal text-fg-soft">
        The backend is live — accounts, contacts, invoices, payments and reminders all exist with
        their rules enforced in the database. The screens for importing invoices and chasing them
        are the next piece of work.
      </p>
    </>
  );
}
