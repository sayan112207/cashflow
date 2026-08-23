import { createFileRoute } from "@tanstack/react-router";

/**
 * `/app` has no screen of its own. Child routes (accounts, later dashboard)
 * render through the parent outlet.
 */
export const Route = createFileRoute("/app/")({
  component: AppIndexPage,
});

function AppIndexPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Your workspace</h1>
      <p className="mt-1.5 text-sm text-ink-secondary">
        Signed in. Open Accounts to try URL search params — the table comes next.
      </p>

      <div className="mt-8 rounded-[14px] border border-line bg-card p-6">
        <h2 className="text-sm font-semibold text-ink">Nothing here yet</h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-secondary">
          The backend is live — accounts, contacts, invoices, payments and reminders all exist
          with their rules enforced in the database. The screens for importing invoices and
          chasing them are the next piece of work.
        </p>
      </div>
    </>
  );
}
