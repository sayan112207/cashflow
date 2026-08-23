import { createFileRoute, redirect, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { getAuthContext, signOut } from "@/lib/services/auth.service";
import { PRODUCT_NAME } from "@/lib/brand";

/**
 * The signed-in shell, and the gate every route under /app inherits.
 *
 * Guard order matters: no session → /login, session but no org → /onboarding.
 * Child pages render into `<Outlet />` — without it, `/app/accounts` would
 * match but paint nothing.
 */
export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: `${PRODUCT_NAME}` }] }),
  beforeLoad: async () => {
    const ctx = await getAuthContext();
    if (!ctx.user) throw redirect({ to: "/login" });
    if (ctx.orgs.length === 0) throw redirect({ to: "/onboarding" });
    return { user: ctx.user, orgs: ctx.orgs };
  },
  component: AppLayout,
});

function AppLayout() {
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
            {PRODUCT_NAME}
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
                {(user.displayName || user.email || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-sm text-ink">{user.displayName || user.email}</span>
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
        {org ? (
          <p className="mb-6 text-sm text-ink-secondary">
            {org.name} · {org.role}
          </p>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
