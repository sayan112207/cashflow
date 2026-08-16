import { createServerFn } from "@tanstack/react-start";

import { getUserSupabase } from "@/lib/supabase/user-client.server";
import { createOrgSchema } from "@/lib/schemas/auth.schema";

/**
 * Creates an org and makes the caller its owner.
 *
 * Goes through the `public.create_org` RPC rather than two inserts: an
 * authenticated user cannot insert into `orgs` and then `org_members`, because
 * the membership policy requires membership in an org they are not yet part of.
 * The RPC does both in one transaction.
 */
export const createOrg = createServerFn({ method: "POST" })
  .validator(createOrgSchema)
  .handler(
    async ({ data }): Promise<{ ok: true; orgId: string } | { ok: false; message: string }> => {
      const supabase = getUserSupabase();

      const { data: org, error } = await supabase.rpc("create_org", { p_name: data.name });

      if (error) {
        // 42501 is the RPC's own "authentication required" guard.
        if (error.code === "42501") {
          return { ok: false, message: "Your session expired. Please sign in again." };
        }
        console.error("[orgs] create_org failed", error);
        return { ok: false, message: "Couldn't create your workspace. Please try again." };
      }

      const created = org as unknown as { id: string } | null;
      if (!created?.id) {
        return { ok: false, message: "Couldn't create your workspace. Please try again." };
      }

      return { ok: true, orgId: created.id };
    },
  );
