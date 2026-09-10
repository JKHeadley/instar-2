// Pre-step: run every kill-schedule EXECUTION here, in the main process, BEFORE any
// vitest worker exists — then the test files load the artifacts and run pure
// assertions. The executions spawn CPU-heavy `slice-worker.mjs` children; on a 2-core
// CI runner those children saturate the CPU and starve the vitest MAIN process past its
// fixed 60s worker-RPC deadline ("Timeout calling onTaskUpdate"), which a file split
// alone did not cure (astra C4). Moving the spawning out of the worker phase removes
// that contention window entirely.
//
// Each execution's { report, firedCuts, boots, neverReached } is written to a
// PER-CHECKOUT run directory with an index keyed by profile+pair, plus a manifest
// carrying the COMPLETE execution-input fingerprint so a stale artifact (any changed
// producer/harness/owner input, not just slice-assembly.mjs) is never trusted (astra N1).
// The execution itself is the shared implementation the harness uses (astra advisory).
//
// Two speedups (operator-approved 2026-09-10; measured: the serial pre-step was ~80 min of
// every ~2h20m Part Eleven gate run):
//  1. Drills run through a bounded pool. Every drill already has its own temp home and
//     no drill shares a port or file, so they are independent; the only reason they were
//     serial was the 2-core runner, so the default concurrency scales with the machine
//     (see kill-schedule-pool.mjs) and stays at 1 there. Files and manifest keys are
//     assigned before anything runs, so a pooled run writes the same file names, the same
//     manifest keys in the same order, and the same non-telemetry content (steps, outcomes,
//     identities, fired cuts, boots, never-reached) as a serial run. Timing and memory
//     telemetry inside each report (and therefore each recorded sha) varies between ANY two
//     runs, serial or pooled; the sha guards a file against corruption, not against re-running.
//  2. Reuse. When the run directory already holds a COMPLETE set for exactly this
//     fingerprint (every planned key present, every file hashing to its recorded sha),
//     the executions are skipped. The fingerprint covers scripts/ + dist/ + the harness,
//     so any input change forces a live run; KILL_SCHEDULE_FORCE=1 forces one regardless.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILE_BOUNDARIES, RECOVERY_CUT_PAIRS } from './slice-assembly.mjs';
import { adjacentPairs } from './slice-schedule-record.mjs';
import { runSliceExecution } from './slice-execution.mjs';
import { artifactHash, executionFingerprint, killScheduleRunDir } from './kill-schedule-fingerprint.mjs';
import { defaultConcurrency, planExecutions, reusable, runPool } from './kill-schedule-pool.mjs';

async function execute(profile, cuts) {
  // Match the harness's kill-schedule calls exactly: pairs cap at 12 boots, an
  // uninterrupted control uses the default. The shared impl guarantees no drift.
  const { report, firedCuts, boots, neverReached, home } = await runSliceExecution({
    profile, cuts, maxBoots: cuts.length ? 12 : 30 });
  rmSync(home, { recursive: true, force: true });
  return { report, firedCuts, boots, neverReached };
}

async function main() {
  const runDir = killScheduleRunDir();
  const fingerprint = executionFingerprint();
  const jobs = planExecutions(PROFILE_BOUNDARIES, RECOVERY_CUT_PAIRS, adjacentPairs);
  const pairCount = jobs.filter(j => j.kind === 'pair').length, controlCount = jobs.length - pairCount;
  if (process.env.KILL_SCHEDULE_FORCE !== '1' && reusable(runDir, fingerprint, jobs, artifactHash)) {
    process.stdout.write(`kill-schedule artifacts: reused ${pairCount} pairs, ${controlCount} controls (fingerprint unchanged) → ${runDir}\n`);
    return;
  }
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(runDir, { recursive: true });
  const concurrency = defaultConcurrency();
  const started = Date.now();
  // Write a payload and record { file, sha } so the loader refuses a torn/partial write
  // (valid-shape but corrupted) rather than asserting it — both desks' clause (c).
  const persist = (file, value) => {
    const bytes = JSON.stringify(value);
    writeFileSync(join(runDir, file), bytes);
    return { file, sha: artifactHash(bytes) };
  };
  const entries = await runPool(jobs, async job => persist(job.file, await execute(job.profile, job.cuts)), concurrency);
  const index = { fingerprint, generatedAt: new Date().toISOString(), pairs: {}, controls: {} };
  jobs.forEach((job, i) => { (job.kind === 'control' ? index.controls : index.pairs)[job.key] = entries[i]; });
  writeFileSync(join(runDir, 'index.json'), JSON.stringify(index, null, 2));
  const secs = Math.round((Date.now() - started) / 1000);
  process.stdout.write(`kill-schedule artifacts: ${pairCount} pairs, ${controlCount} controls in ${secs}s at concurrency ${concurrency} → ${runDir}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('run-kill-schedule.mjs'))
  main().catch(err => { console.error(err); process.exit(1); });
