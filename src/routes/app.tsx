import { createFileRoute, redirect, useNavigate, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";

import { getAuthContext, signOut } from "@/lib/services/auth.service";

/**
 * The signed-in shell, and the gate every route under /app inherits.
 *
 * Guard order matters: no session → /login, session but no org → /onboarding.
 * Without the second check a signed-in user would land here and see nothing,
 * because every RLS policy in the schema keys off org membership.
 *
 * `beforeLoad` returns the resolved identity into route context, so children
 * read `user`/`orgs` without re-fetching or re-checking for null.
 */
export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const ctx = await getAuthContext();
    if (!ctx.user) throw redirect({ to: "/login" });
    if (ctx.orgs.length === 0) throw redirect({ to: "/onboarding" });
    return { user: ctx.user, orgs: ctx.orgs };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

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
    <div className="app-shell app-theme min-h-screen bg-page">
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
                {/* displayName is "" if the profile row is missing or hidden by
                    RLS; fall back to the email so the avatar is never blank. */}
                {(user.displayName || user.email || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-sm text-ink">{user.displayName || user.email}</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-[8px] border border-line px-3 py-1.5 text-sm text-ink-secondary transition-colors hover:bg-hovered focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Required: pages under /app render here. Removing <Outlet /> blanks every child. */}
        <Outlet />
      </main>
    </div>
  );
}
