// Pure helpers for scripts/run-kill-schedule.mjs: the execution plan, the bounded worker
// pool, the default concurrency, and the reuse decision. Kept free of process spawning so
// they can be unit-tested; the runner wires them to the real slice execution.
import { availableParallelism, cpus } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Deterministic plan: controls first, then pairs, in the exact order the serial runner
 * used, with file names assigned UP FRONT so a concurrent completion order can never
 * change which file a given profile+pair lands in or the key order of the manifest.
 */
export function planExecutions(profileBoundaries, recoveryCutPairs, adjacentPairs) {
  const jobs = [];
  let n = 0;
  for (const [profile, boundaries] of Object.entries(profileBoundaries)) {
    jobs.push({ kind: 'control', profile, cuts: [], key: profile, file: `control-${profile}.json` });
    const pairs = [...adjacentPairs(boundaries), ...(recoveryCutPairs[profile] ?? [])];
    for (const pair of pairs)
      jobs.push({ kind: 'pair', profile, cuts: pair, key: `${profile}:${pair[0]}+${pair[1]}`, file: `pair-${n++}.json` });
  }
  return jobs;
}

/**
 * How many drills run at once. The serial pre-step existed because a 2-core CI runner's
 * CPU-heavy children starve the vitest main process; that concern is per-core, so the
 * default scales with the machine (one drill per ~4 cores, at most 4) and stays at 1 on
 * the 2-core runner. KILL_SCHEDULE_CONCURRENCY overrides (a positive integer).
 */
export function defaultConcurrency(env = process.env, cores = coreCount()) {
  const raw = env.KILL_SCHEDULE_CONCURRENCY;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new Error(`KILL_SCHEDULE_CONCURRENCY must be a positive integer, got ${JSON.stringify(raw)}`);
    return n;
  }
  return Math.max(1, Math.min(4, Math.floor(cores / 4)));
}

function coreCount() {
  try { return availableParallelism(); } catch { return cpus().length || 1; }
}

/**
 * Run `jobs` through `execute` with at most `concurrency` in flight. Resolves to results in
 * PLAN order regardless of completion order; the first rejection aborts (no new starts)
 * and is rethrown after in-flight drills settle, so a failure never leaves orphans.
 */
export async function runPool(jobs, execute, concurrency) {
  const results = new Array(jobs.length);
  let next = 0, failure = null;
  const worker = async () => {
    while (failure === null) {
      const i = next++;
      if (i >= jobs.length) return;
      try { results[i] = await execute(jobs[i], i); }
      catch (err) { failure ??= err; return; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, worker));
  if (failure !== null) throw failure;
  return results;
}

/**
 * True when `runDir` already holds a complete artifact set for exactly this fingerprint:
 * the manifest parses, its fingerprint matches, and EVERY planned key is present with a
 * file whose bytes hash to the recorded sha. Anything else (absent, stale, torn, partial,
 * extra-key-missing) is false, so a re-run is the only way a doubtful cache is ever used.
 * The loader in tests/slice applies the same checks at read time; this pre-check only
 * saves the executions, it grants no trust the loader would not grant.
 */
export function reusable(runDir, fingerprint, jobs, artifactHash) {
  const path = join(runDir, 'index.json');
  if (!existsSync(path)) return false;
  let index;
  try { index = JSON.parse(readFileSync(path, 'utf8')); } catch { return false; }
  if (!index || typeof index !== 'object' || index.fingerprint !== fingerprint) return false;
  for (const job of jobs) {
    const entry = (job.kind === 'control' ? index.controls : index.pairs)?.[job.key];
    if (!entry || typeof entry.file !== 'string' || typeof entry.sha !== 'string') return false;
    const file = join(runDir, entry.file);
    if (!existsSync(file)) return false;
    try { if (artifactHash(readFileSync(file)) !== entry.sha) return false; } catch { return false; }
  }
  return true;
}
