import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env.public";
import { getServiceRoleKey } from "@/lib/env.server";
import type { Database } from "./types.gen";

/**
 * Service-role Supabase client. **Bypasses every row-level security policy.**
 *
 * Legitimate uses are narrow: work with no signed-in user to attribute it to
 * (the public waitlist insert) and genuine system jobs. Never use it to satisfy
 * a user-facing read — that discards the tenancy guarantees the schema is built
 * on and moves them into application code, where they get forgotten.
 *
 * Background jobs using this client should set the audit actor explicitly:
 *   await supabase.rpc('set_config', ...)  /  select set_config('app.actor_id', …)
 * otherwise `auth.uid()` is null and the audit trail loses attribution.
 */
export function getAdminSupabase(): SupabaseClient<Database> {
  return createClient<Database>(getPublicEnv().supabaseUrl, getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
