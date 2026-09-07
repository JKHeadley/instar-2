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
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILE_BOUNDARIES, RECOVERY_CUT_PAIRS } from './slice-assembly.mjs';
import { adjacentPairs } from './slice-schedule-record.mjs';
import { runSliceExecution } from './slice-execution.mjs';
import { artifactHash, executionFingerprint, killScheduleRunDir } from './kill-schedule-fingerprint.mjs';

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
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(runDir, { recursive: true });
  const index = { fingerprint: executionFingerprint(), generatedAt: new Date().toISOString(), pairs: {}, controls: {} };
  // Write a payload and record { file, sha } so the loader refuses a torn/partial write
  // (valid-shape but corrupted) rather than asserting it — both desks' clause (c).
  const persist = (file, value) => {
    const bytes = JSON.stringify(value);
    writeFileSync(join(runDir, file), bytes);
    return { file, sha: artifactHash(bytes) };
  };
  let n = 0;
  for (const [profile, boundaries] of Object.entries(PROFILE_BOUNDARIES)) {
    index.controls[profile] = persist(`control-${profile}.json`, await execute(profile, []));
    const pairs = [...adjacentPairs(boundaries), ...(RECOVERY_CUT_PAIRS[profile] ?? [])];
    for (const pair of pairs)
      index.pairs[`${profile}:${pair[0]}+${pair[1]}`] = persist(`pair-${n++}.json`, await execute(profile, pair));
  }
  writeFileSync(join(runDir, 'index.json'), JSON.stringify(index, null, 2));
  process.stdout.write(`kill-schedule artifacts: ${Object.keys(index.pairs).length} pairs, ${Object.keys(index.controls).length} controls → ${runDir}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('run-kill-schedule.mjs'))
  main().catch(err => { console.error(err); process.exit(1); });
