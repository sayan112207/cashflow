#!/usr/bin/env bun
/**
 * Database task runner.
 *
 * Exists because `bun run` does not expand `$VAR` from `.env` inside
 * package.json script strings — the value reaches the Bun runtime but not the
 * script's shell, so `supabase --db-url "$SUPABASE_DB_URL"` silently received
 * an empty string and fell back to a local socket. A TS entrypoint sidesteps
 * that: Bun loads `.env` into `process.env` before this file runs.
 *
 * Usage: bun scripts/db.ts <push|diff|types> [extra supabase flags…]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFrom } from "./load-env";

// Resolved against this file, not process.cwd(), so the script works when run
// from a subdirectory rather than only from the package root.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES_PATH = join(ROOT, "src/lib/supabase/types.gen.ts");
const CLI = join(ROOT, "node_modules/.bin/supabase");

loadEnvFrom(join(ROOT, ".env"));

const dbUrl = process.env["SUPABASE_DB_URL"];
if (!dbUrl) {
  console.error(
    "SUPABASE_DB_URL is not set.\n" +
      "Copy .env.example to .env and fill it in (Dashboard → Connect → Session pooler).\n" +
      "Remember the password must be percent-encoded inside the URI.",
  );
  process.exit(1);
}

const [task, ...extra] = process.argv.slice(2);
const redact = (s: string) => s.split(dbUrl).join("[DB_URL]");

function run(args: string[], capture = false) {
  // --workdir: the CLI locates supabase/config.toml relative to the working
  // directory, so without this it fails when invoked from a subdirectory.
  const res = spawnSync(CLI, ["--workdir", ROOT, ...args], {
    encoding: "utf8",
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    // Passed explicitly: under Bun, values written into `process.env` at
    // runtime are not inherited by spawned children, so the variables loaded
    // from .env above would otherwise be invisible to the CLI.
    env: { ...process.env },
  });
  // A missing binary surfaces as res.error with status === null, which would
  // otherwise become a bare exit 1 with nothing explaining it.
  if (res.error) {
    console.error(`Could not run ${CLI}: ${res.error.message}\nDid you run \`bun install\`?`);
  }
  if (capture) {
    if (res.stderr) process.stderr.write(redact(res.stderr));
    return res;
  }
  return res;
}

switch (task) {
  case "push":
    process.exit(run(["db", "push", "--db-url", dbUrl, ...extra]).status ?? 1);
    break;

  case "diff":
    process.exit(run(["db", "diff", "--db-url", dbUrl, ...extra]).status ?? 1);
    break;

  case "types": {
    // Two routes to the same output, with very different prerequisites:
    //
    //   --project-id : Supabase's Management API generates the types server
    //                  side. Needs an access token (env var or `supabase
    //                  login`), but NO Docker.
    //   --db-url     : the generator runs locally in a container. Needs a
    //                  running Docker daemon, but no access token.
    //
    // Try the API route first — a token is far cheaper to obtain than a
    // container runtime — and fall back to the local one.
    const projectRef = process.env["SUPABASE_PROJECT_REF"];
    const attempts: Array<{ label: string; args: string[] }> = [];
    if (projectRef) {
      attempts.push({
        label: `Management API (--project-id ${projectRef})`,
        args: ["--project-id", projectRef],
      });
    }
    attempts.push({ label: "local container (--db-url)", args: ["--db-url", dbUrl] });

    let out = "";
    let lastStatus: number | null = null;
    for (const attempt of attempts) {
      const res = run(
        ["gen", "types", "typescript", ...attempt.args, "--schema", "public", ...extra],
        true,
      );
      lastStatus = res.status;
      if (res.status === 0 && (res.stdout ?? "").trim().length >= 200) {
        out = res.stdout ?? "";
        console.error(`Generated via ${attempt.label}.`);
        break;
      }
      console.error(`  ${attempt.label} unavailable, trying next…`);
    }

    // Guard against clobbering a good types file with nothing: a failed
    // generator exits having written zero bytes, and a plain `>` redirect in a
    // package script would truncate the committed file.
    if (out.trim().length < 200) {
      console.error(
        `\nRefusing to overwrite ${TYPES_PATH}: no route produced usable output ` +
          `(last exit ${lastStatus}). The committed file stays as-is.\n\n` +
          `Fix either one:\n` +
          `  • set SUPABASE_ACCESS_TOKEN in .env (or run \`supabase login\`) — no Docker needed\n` +
          `  • start a Docker daemon, which enables the --db-url route`,
      );
      process.exit(1);
    }
    const before = (() => {
      try {
        return readFileSync(TYPES_PATH, "utf8");
      } catch {
        return "";
      }
    })();
    writeFileSync(TYPES_PATH, out);
    console.error(
      before === out
        ? `${TYPES_PATH} unchanged.`
        : `${TYPES_PATH} regenerated — review the diff for semantic drift ` +
            `(column names, nullability, enum members).`,
    );
    break;
  }

  default:
    console.error("Usage: bun scripts/db.ts <push|diff|types> [extra supabase flags…]");
    process.exit(1);
}
