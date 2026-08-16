import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";

import { getPublicEnv } from "@/lib/env.public";
import type { Database } from "./types.gen";

type UserSupabase = ReturnType<typeof createServerClient<Database>>;

/**
 * Server-side Supabase client bound to the caller's session cookies.
 *
 * Uses the anon key, so **RLS applies** — this client can only ever see rows
 * the signed-in user is entitled to. It is the right client for essentially
 * every service function; reach for the admin client only when there is
 * genuinely no user.
 *
 * Not memoised: each request has its own cookies, and caching the client across
 * requests would leak one user's session into another's.
 */
export function getUserSupabase(): UserSupabase {
  const env = getPublicEnv();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        // Supabase writes here when it silently refreshes an expired token.
        // Setting a cookie is only possible while response headers are still
        // open — during SSR render or a server function. If a refresh lands
        // after headers are flushed, swallow it: the refreshed token is still
        // live in this client instance, so the request succeeds and the
        // browser simply picks up the new cookie on the next round trip.
        // Letting it throw here would fail an otherwise healthy page render.
        try {
          for (const { name, value, options } of cookiesToSet) {
            setCookie(name, value, options);
          }
        } catch {
          // no-op, see above
        }
      },
    },
  });
}

// A `getCurrentUser()` helper used to live here. It had no callers — every
// route reads identity through `getAuthContext()` in auth.service.ts, which
// needs the profile and org list in the same round trip — and it collapsed
// "signed out" and "auth server unreachable" into the same null. Removed
// rather than elaborated, so there is one way to answer "who is this".
