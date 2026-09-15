import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { getAuthContext } from "@/lib/services/auth.service";

/**
 * The signed-in shell, and the gate every route under /app inherits.
 *
 * Guard order matters: no session → /login, session but no org → /onboarding.
 * Without the second check a signed-in user would land here and see nothing,
 * because every RLS policy in the schema keys off org membership.
 *
 * `beforeLoad` returns the resolved identity into route context, so children
 * read `user`/`orgs` without re-fetching or re-checking for null.
 *
 * Child pages render into `<Outlet />` inside AppShell — without it,
 * `/app/accounts` would match but paint nothing.
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
  const { user, orgs } = Route.useRouteContext();
  // The guard rejects an empty org list, so there is always a first org; the
  // fallback exists only to satisfy the indexed-access type.
  const orgName = orgs[0]?.name ?? "";

  return (
    <AppShell user={user} orgName={orgName}>
      {/* Required: pages under /app render here. Removing <Outlet /> blanks every child. */}
      <Outlet />
    </AppShell>
  );
}
