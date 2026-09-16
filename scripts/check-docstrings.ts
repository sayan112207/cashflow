#!/usr/bin/env bun
/**
 * Docstring coverage gate, scoped to the functions a change actually touches.
 *
 * Mirrors the metric CodeRabbit's "Docstring Coverage" pre-merge check applies,
 * so the number is settled here — in a command anyone can run and debug —
 * rather than arriving as a review comment after the PR is open.
 *
 * Scoped to touched functions on purpose. The repo sits near 29% overall, so a
 * whole-tree rule would fail on ~168 pre-existing functions and teach everyone
 * to ignore it. Touching a function is the moment its documentation is cheapest
 * to write, and it is the only moment this gate asks for it.
 *
 * Usage: bun scripts/check-docstrings.ts [baseRef]
 *   baseRef defaults to $GITHUB_BASE_REF, then origin/develop.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Matches the threshold pinned in `.coderabbit.yaml`; change both together. */
const THRESHOLD = 80;

const SOURCE = /^src\/.*\.tsx?$/;
/** Generated or fixture files nobody hand-documents. */
const EXEMPT = /(\.test\.tsx?|routeTree\.gen\.ts|types\.gen\.ts|^src\/components\/ui\/)/;

function git(...args: string[]): string {
  const { stdout, status, stderr } = spawnSync("git", args, { encoding: "utf8" });
  if (status !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
  return stdout;
}

/**
 * The merge base against the target branch.
 *
 * Diffing against the base *tip* would attribute every function touched on the
 * base since this branch started to this change. The merge base is the point
 * the branch actually diverged, which is the set the author is answerable for.
 */
function resolveBase(): string {
  const explicit = process.argv[2] ?? process.env["GITHUB_BASE_REF"];
  const candidates = explicit
    ? [explicit, `origin/${explicit}`]
    : ["origin/develop", "origin/main"];
  for (const ref of candidates) {
    const { status } = spawnSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
      encoding: "utf8",
    });
    if (status === 0) return git("merge-base", "HEAD", ref).trim();
  }
  throw new Error(`No usable base ref among: ${candidates.join(", ")}`);
}

/** Line numbers (1-indexed) added or modified in each changed source file. */
function changedLines(base: string): Map<string, Set<number>> {
  const diff = git("diff", "--unified=0", "--diff-filter=ACM", base, "--", "src");
  const out = new Map<string, Set<number>>();
  let file = "";
  for (const line of diff.split("\n")) {
    const toFile = /^\+\+\+ b\/(.+)$/.exec(line);
    if (toFile?.[1]) {
      file = toFile[1];
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || !file || !SOURCE.test(file) || EXEMPT.test(file)) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const set = out.get(file) ?? new Set<number>();
    for (let n = start; n < start + count; n++) set.add(n);
    out.set(file, set);
  }
  return out;
}

type Fn = { name: string; line: number; endLine: number; documented: boolean };

const DECL =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_]\w*)|^(?:export\s+)?const\s+([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*(?::[^=]+)?=>/;

/**
 * Top-level functions in a file, with the span each one covers.
 *
 * Deliberately a line scanner rather than a real parse: the gate needs to agree
 * with a reviewer reading the diff, and a brace-counted span does that for the
 * declaration styles this codebase uses. Anything it cannot resolve is skipped
 * rather than guessed at, so the check never invents a failure.
 */
function functionsIn(path: string): Fn[] {
  const lines = readFileSync(path, "utf8").split("\n");
  const fns: Fn[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const match = DECL.exec(raw);
    if (!match) continue;
    const name = match[1] ?? match[2];
    if (name === undefined) continue;

    // Walk braces from the declaration to find where the function ends.
    let depth = 0;
    let end = i;
    let opened = false;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j] ?? "") {
        if (ch === "{") {
          depth++;
          opened = true;
        } else if (ch === "}") depth--;
      }
      if (opened && depth <= 0) {
        end = j;
        break;
      }
      end = j;
    }

    // A docstring is the block comment immediately above, allowing only blank
    // lines between. A `//` comment is a note to the next reader, not an API
    // description, and does not count — which is also how CodeRabbit reads it.
    let k = i - 1;
    while (k >= 0 && (lines[k] ?? "").trim() === "") k--;
    const documented = (lines[k] ?? "").trim().endsWith("*/");

    fns.push({ name, line: i + 1, endLine: end + 1, documented });
  }
  return fns;
}

const base = resolveBase();
const changed = changedLines(base);

const touched: { path: string; fn: Fn }[] = [];
for (const [path, lineNumbers] of changed) {
  for (const fn of functionsIn(path)) {
    if ([...lineNumbers].some((n) => n >= fn.line && n <= fn.endLine)) touched.push({ path, fn });
  }
}

if (touched.length === 0) {
  console.log(`No functions touched against ${base.slice(0, 7)}. Docstring check skipped.`);
  process.exit(0);
}

const undocumented = touched.filter((t) => !t.fn.documented);
const coverage = Math.round(((touched.length - undocumented.length) / touched.length) * 100);

console.log(
  `Docstring coverage on touched functions: ${coverage}% ` +
    `(${touched.length - undocumented.length}/${touched.length}, threshold ${THRESHOLD}%)`,
);

if (undocumented.length > 0) {
  console.log("\nUndocumented:");
  for (const { path, fn } of undocumented) console.log(`  ${path}:${fn.line}  ${fn.name}`);
}

if (coverage < THRESHOLD) {
  // `::error::` renders the failure on the PR's Files tab, not only in the log.
  console.log(
    `\n::error::Docstring coverage ${coverage}% is below the ${THRESHOLD}% threshold. ` +
      `Document the functions listed above, or narrow the change.`,
  );
  process.exit(1);
}
