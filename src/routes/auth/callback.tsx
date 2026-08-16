import { createFileRoute, redirect } from "@tanstack/react-router";

import { completeOAuth } from "@/lib/services/auth.service";

/**
 * Where Google sends the browser back to.
 *
 * The exchange happens in the loader rather than in a component effect: the
 * loader runs during SSR on this first full page load, so the session cookie is
 * written before anything renders and there is no signed-out flash.
 *
 * `?error=` arrives when the user cancels at Google's consent screen.
 */
export const Route = createFileRoute("/auth/callback")({
  // Keys are omitted rather than set to `undefined` so they stay genuinely
  // optional under `exactOptionalPropertyTypes` — see the note in login.tsx.
  validateSearch: (search: Record<string, unknown>): { code?: string; error?: string } => ({
    ...(typeof search["code"] === "string" ? { code: search["code"] } : {}),
    ...(typeof search["error"] === "string" ? { error: search["error"] } : {}),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (deps.error) {
      throw redirect({ to: "/login", search: { reason: "oauth-cancelled" } });
    }
    if (!deps.code) {
      throw redirect({ to: "/login", search: { reason: "oauth-missing-code" } });
    }

    const result = await completeOAuth({ data: { code: deps.code } });
    if (!result.ok) {
      throw redirect({ to: "/login", search: { reason: "oauth-failed" } });
    }

    // /app sends them on to /onboarding if this is a first sign-in.
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
