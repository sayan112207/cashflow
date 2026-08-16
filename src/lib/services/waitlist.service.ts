import { createServerFn } from "@tanstack/react-start";

import { getAdminSupabase } from "@/lib/supabase/admin-client.server";
import { waitlistSignupSchema } from "@/lib/schemas/waitlist.schema";

export type WaitlistResult = { ok: true } | { ok: false; message: string };

/**
 * Adds an email to the early-access waitlist.
 *
 * Uses the admin client because a waitlist signup happens before any user or
 * org exists — there is no session for RLS to key off. The table's policies
 * allow anonymous INSERT and grant SELECT to nobody, so even a leaked anon key
 * could not read the list back.
 *
 * CSRF protection is inherited: `src/start.ts` installs a CSRF middleware for
 * every `serverFn`, so no extra guard is needed here.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator(waitlistSignupSchema)
  .handler(async ({ data }): Promise<WaitlistResult> => {
    const supabase = getAdminSupabase();

    // `ignoreDuplicates` turns a repeat signup into a no-op rather than a
    // 23505. Combined with the identical success response below, the form
    // cannot be used to test whether an address is already registered.
    const { error } = await supabase
      .from("waitlist")
      .upsert(
        { email: data.email, source: data.source ?? null },
        { onConflict: "email_normalized", ignoreDuplicates: true },
      );

    if (error) {
      // Log server-side for diagnosis; return something a visitor can act on.
      console.error("[waitlist] insert failed", error);
      return { ok: false, message: "Something went wrong on our end. Please try again." };
    }

    return { ok: true };
  });
