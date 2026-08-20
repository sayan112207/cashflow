import { createFileRoute } from "@tanstack/react-router";

/**
 * What `/app` itself shows inside the shell.
 *
 * `user` and `orgs` come from the parent's `beforeLoad` via route context, so
 * they are already non-null by the time this renders.
 */
export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Tagada" }] }),
  component: AppHome,
});

function AppHome() {
  const { user, orgs } = Route.useRouteContext();
  const org = orgs[0];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {org ? org.name : "Your workspace"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-secondary">
        Signed in as {user.email ?? user.displayName}
        {org ? ` · ${org.role}` : ""}
      </p>

      <div className="mt-8 rounded-[14px] border border-line bg-card p-6">
        <h2 className="text-sm font-semibold text-ink">Nothing here yet</h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-secondary">
          The backend is live — accounts, contacts, invoices, payments and reminders all exist with
          their rules enforced in the database. The screens for importing invoices and chasing them
          are the next piece of work.
        </p>
      </div>
    </>
  );
}
