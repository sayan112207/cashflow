import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";

import { getAuthContext, signOut } from "@/lib/services/auth.service";

/**
 * The signed-in home, and the gate every future authed route can copy.
 *
 * Guard order matters: no session → /login, session but no org → /onboarding.
 * Without the second check a signed-in user would land here and see nothing,
 * because every RLS policy in the schema keys off org membership.
 */
export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Dashboard — Tagada" }] }),
  beforeLoad: async () => {
    const ctx = await getAuthContext();
    if (!ctx.user) throw redirect({ to: "/login" });
    if (ctx.orgs.length === 0) throw redirect({ to: "/onboarding" });
    return { user: ctx.user, orgs: ctx.orgs };
  },
  component: AppHome,
});

function AppHome() {
  const { user, orgs } = Route.useRouteContext();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const org = orgs[0];

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      await navigate({ to: "/login" });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-base font-semibold tracking-tight text-ink">
            Tagada
          </Link>
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="size-8 rounded-full border border-line"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-deep">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-sm text-ink">{user.displayName}</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-[8px] border border-line px-3 py-1.5 text-sm text-ink-secondary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
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
            The backend is live — accounts, contacts, invoices, payments and reminders all exist
            with their rules enforced in the database. The screens for importing invoices and
            chasing them are the next piece of work.
          </p>
        </div>
      </main>
    </div>
  );
}
