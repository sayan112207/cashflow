import { readFileSync } from "node:fs";

/**
 * Loads a `.env` file into `process.env` from an explicit path.
 *
 * The runtime auto-loads `.env` relative to the *current directory*, so a
 * script run from a subdirectory silently sees no configuration. Node's
 * `process.loadEnvFile` would solve this, but Bun 1.3 does not implement it,
 * so this parses the handful of forms our `.env` actually uses.
 *
 * Existing environment variables always win, so `FOO=bar bun scripts/…` and CI
 * secrets still override the file.
 */
export function loadEnvFrom(path: string): void {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return; // no .env — callers report on whatever ends up missing
  }

  for (const raw of contents.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip one layer of matching quotes; the DB password is single-quoted
    // because it contains characters a bare value would not survive.
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}
