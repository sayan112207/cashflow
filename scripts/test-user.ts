#!/usr/bin/env bun
/**
 * Creates pre-confirmed test users, for local development only.
 *
 * Why this exists: the project keeps email confirmation ON (production-shaped),
 * and Supabase's built-in sender allows only `rate_limit_email_sent` messages
 * per hour — 2 by default. Signing up through the form more than twice an hour
 * fails with "email rate limit exceeded". The Admin API sidesteps it entirely:
 * `email_confirm: true` marks the address verified without sending anything.
 *
 * Uses the service-role key, so it BYPASSES RLS. Never import this from app
 * code — it lives in scripts/ and is not part of the bundle.
 *
 * It acts on whatever project `.env` points at, which today is the hosted one.
 * `delete` is therefore destructive against real data, so it prints the target
 * host and the account it matched before removing anything.
 *
 * Usage:
 *   bun scripts/test-user.ts create [email] [password]   # defaults are generated
 *   bun scripts/test-user.ts delete <email>
 *   bun scripts/test-user.ts list
 */
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFrom } from "./load-env";

// Load .env from the package root, not the current directory, so this works
// when run from a subdirectory.
loadEnvFrom(join(dirname(fileURLToPath(import.meta.url)), "..", ".env"));

const url = process.env["VITE_SUPABASE_URL"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Copy .env.example to .env and fill it in.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [task, argEmail, argPassword] = process.argv.slice(2);

async function findByEmail(email: string) {
  // listUsers is paginated; for a dev project one page is plenty.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

switch (task) {
  case "create": {
    const email = argEmail ?? `test.user.${Date.now()}@gmail.com`;
    const password = argPassword ?? "TestPassword!23";

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // the whole point: verified without sending mail
    });
    if (error) {
      console.error(`Could not create ${email}: ${error.message}`);
      process.exit(1);
    }

    // Populated by the on_auth_user_created trigger, derived from the address.
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", data.user.id)
      .maybeSingle();

    console.log(`Created and confirmed:\n`);
    console.log(`  email        ${email}`);
    console.log(`  password     ${password}`);
    console.log(`  display name ${profile?.display_name ?? "(trigger did not fire)"}`);
    console.log(`\nSign in at http://localhost:8080/login — you'll land on onboarding.`);
    break;
  }

  case "delete": {
    if (!argEmail) {
      console.error("Usage: bun scripts/test-user.ts delete <email>");
      process.exit(1);
    }
    const user = await findByEmail(argEmail);
    if (!user) {
      console.error(`No user with email ${argEmail}`);
      process.exit(1);
    }
    const provider = String(user.app_metadata["provider"] ?? "?");

    // `.env` points at the hosted project, which holds real accounts alongside
    // test ones. Rather than blocking every remote target — which would defeat
    // the purpose, since test users are deliberately created there — refuse the
    // two shapes that indicate a real person, and let --force override.
    const { data: ownedOrgs } = await admin
      .from("org_members")
      .select("role, orgs(name)")
      .eq("user_id", user.id)
      .eq("role", "owner");

    const reasons: string[] = [];
    if (provider !== "email") {
      reasons.push(`signed in via "${provider}", so this is not a password test account`);
    }
    if (ownedOrgs && ownedOrgs.length > 0) {
      const names = ownedOrgs
        .map((m) => (m.orgs as unknown as { name: string } | null)?.name ?? "?")
        .join(", ");
      reasons.push(`owns ${ownedOrgs.length} workspace(s): ${names}`);
    }

    const force = process.argv.includes("--force");
    if (reasons.length > 0 && !force) {
      console.error(
        `Refusing to delete ${user.email} from ${new URL(url).host}:\n` +
          reasons.map((r) => `  - ${r}`).join("\n") +
          `\n\nDeleting cascades the profile and all org memberships. ` +
          `Pass --force if you are certain.`,
      );
      process.exit(1);
    }

    console.log(
      `Deleting from ${new URL(url).host}:\n` +
        `  ${user.email}  created ${user.created_at}  provider ${provider}` +
        (force && reasons.length > 0 ? `\n  (--force: ${reasons.join("; ")})` : ""),
    );
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`Could not delete: ${error.message}`);
      process.exit(1);
    }
    // profiles.id references auth.users on delete cascade, so the profile and
    // any org memberships go with it.
    console.log(`Deleted ${argEmail} (profile and memberships cascade).`);
    break;
  }

  case "list": {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    if (data.users.length === 0) {
      console.log("No users yet.");
      break;
    }
    const { data: profiles } = await admin.from("profiles").select("id, display_name");
    const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    console.log(`${data.users.length} user(s):\n`);
    for (const u of data.users) {
      const confirmed = u.email_confirmed_at ? "confirmed" : "UNCONFIRMED";
      // app_metadata is an index signature, so `provider` is `any` — coerce
      // before padEnd rather than assuming a string comes back.
      const provider = String(u.app_metadata["provider"] ?? "?");
      console.log(
        `  ${(u.email ?? "—").padEnd(38)} ${String(names.get(u.id) ?? "—").padEnd(20)} ${provider.padEnd(8)} ${confirmed}`,
      );
    }
    break;
  }

  default:
    console.error(
      "Usage:\n" +
        "  bun scripts/test-user.ts create [email] [password]\n" +
        "  bun scripts/test-user.ts delete <email>\n" +
        "  bun scripts/test-user.ts list",
    );
    process.exit(1);
}
