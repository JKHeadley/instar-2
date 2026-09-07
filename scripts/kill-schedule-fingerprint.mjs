// The COMPLETE execution-input fingerprint for kill-schedule artifacts, shared by the
// pre-step (which stamps it) and the loader (which verifies it). A slice execution's
// output is determined by every producer/harness script, the contract/declaration JSON,
// and the built owner code the assembly imports — not by slice-assembly.mjs alone (astra
// N1: hashing only the assembly let a changed slice-worker.mjs reuse stale artifacts and
// false-pass a whole profile). Hashing the whole of scripts/ + dist/ is a deliberate
// SUPERSET: it can only ever over-invalidate (fall back to a live execution, which is
// safe), never reuse a stale result.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : 1)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

/**
 * A content hash over every execution input the produced REPORT depends on — the owner
 * code (`dist/`), the producer/harness scripts and contract JSON (`scripts/`), and the
 * harness that also drives the live fallback (`extra`). `roots`/`extra` are overridable
 * for testing. An owner change (part six/eight/ten in `dist/`) or a worker change
 * therefore invalidates the artifacts, per both desks' N1/R7 required repair.
 */
export function executionFingerprint(roots = ['scripts', 'dist'], extra = ['tests/slice/harness.ts']) {
  const files = [];
  for (const root of roots)
    for (const file of walk(root))
      if (/\.(mjs|js|json)$/.test(file)) files.push(file);
  for (const file of extra) files.push(file);
  files.sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file); hash.update('\0');
    try { hash.update(readFileSync(file)); } catch { hash.update('\0missing'); }
    hash.update('\0');
  }
  return hash.digest('hex');
}

/** The content hash of one artifact file's bytes, recorded in the manifest and verified on load. */
export function artifactHash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * A per-checkout artifact directory, so two worktrees never share (or clobber) one
 * another's cache. Keyed on the working directory, which is the repo root for both the
 * pre-step and the vitest workers.
 */
export function killScheduleRunDir(cwd = process.cwd()) {
  const tag = createHash('sha256').update(cwd).digest('hex').slice(0, 16);
  return join(tmpdir(), `p11-kill-schedule-${tag}`);
}
