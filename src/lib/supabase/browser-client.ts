import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env.public";
import type { Database } from "./types.gen";

type BrowserSupabase = ReturnType<typeof createBrowserClient<Database>>;

let client: BrowserSupabase | undefined;

/**
 * Browser-side Supabase client, for reading the current auth session and
 * subscribing to auth state changes.
 *
 * Mutations do not belong here — they go through the typed service functions in
 * `@/lib/services`, which run on the server behind CSRF protection.
 */
export function getBrowserSupabase(): BrowserSupabase {
  if (!client) {
    const env = getPublicEnv();
    client = createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  }
  return client;
}
