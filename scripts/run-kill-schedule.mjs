// Pre-step: run every kill-schedule EXECUTION here, in the main process, BEFORE any
// vitest worker exists — then the test files load the artifacts and run pure
// assertions. The executions spawn CPU-heavy `slice-worker.mjs` children; on a 2-core
// CI runner those children saturate the CPU and starve the vitest MAIN process past
// its fixed 60s worker-RPC deadline ("Timeout calling onTaskUpdate"), which a file
// split alone did not cure (astra C4). Moving the spawning out of the worker phase
// removes that contention window entirely.
//
// Each execution's { report, firedCuts, boots, neverReached } is written to a run
// directory with an index keyed by profile+pair, plus a manifest carrying a content
// hash of the report generator so a stale artifact is never silently trusted.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROFILE_BOUNDARIES, RECOVERY_CUT_PAIRS } from './slice-assembly.mjs';
import { adjacentPairs } from './slice-schedule-record.mjs';

export const KILL_SCHEDULE_RUN_DIR = join(tmpdir(), 'p11-kill-schedule-artifacts');
export const assemblyHash = () => createHash('sha256').update(readFileSync('scripts/slice-assembly.mjs')).digest('hex');

const spawnBoot = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', c => { stdout += c; });
  child.stderr.on('data', c => { stderr += c; });
  child.on('error', reject);
  child.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
});

const jsonl = file => existsSync(file)
  ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

// Mirrors tests/slice/harness.ts runExecution exactly: same worker, same encoding,
// same restart loop and cut accounting — so an artifact equals a live execution.
async function runExecution(profile, cuts) {
  const home = mkdtempSync(join(tmpdir(), 'p11-kill-schedule-home-'));
  const encoded = JSON.stringify({ profile, adapter: 'telegram-slice', cuts });
  let boots = 0, report, stderr = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    boots++;
    const run = await spawnBoot(['scripts/slice-worker.mjs', home, encoded]);
    stderr = run.stderr;
    if (run.status === 0) { report = JSON.parse(run.stdout.trim().split('\n').pop()); break; }
    if (run.signal !== 'SIGKILL') throw new Error(`slice worker failed: status=${run.status} signal=${run.signal}\n${stderr}`);
  }
  if (!report) throw new Error(`execution never completed after ${boots} boots\n${stderr}`);
  const fired = jsonl(join(home, 'cuts.jsonl')).map(r => r.boundary);
  rmSync(home, { recursive: true, force: true });
  return { report, firedCuts: fired, boots, neverReached: cuts.filter(c => !fired.includes(c)) };
}

async function main() {
  rmSync(KILL_SCHEDULE_RUN_DIR, { recursive: true, force: true });
  mkdirSync(KILL_SCHEDULE_RUN_DIR, { recursive: true });
  const index = { assemblyHash: assemblyHash(), generatedAt: new Date().toISOString(), pairs: {}, controls: {} };
  let n = 0;
  for (const [profile, boundaries] of Object.entries(PROFILE_BOUNDARIES)) {
    const control = await runExecution(profile, []);
    const controlFile = `control-${profile}.json`;
    writeFileSync(join(KILL_SCHEDULE_RUN_DIR, controlFile), JSON.stringify(control));
    index.controls[profile] = controlFile;
    const pairs = [...adjacentPairs(boundaries), ...(RECOVERY_CUT_PAIRS[profile] ?? [])];
    for (const pair of pairs) {
      const execution = await runExecution(profile, pair);
      const file = `pair-${n++}.json`;
      writeFileSync(join(KILL_SCHEDULE_RUN_DIR, file), JSON.stringify(execution));
      index.pairs[`${profile}:${pair[0]}+${pair[1]}`] = file;
    }
  }
  writeFileSync(join(KILL_SCHEDULE_RUN_DIR, 'index.json'), JSON.stringify(index, null, 2));
  process.stdout.write(`kill-schedule artifacts: ${Object.keys(index.pairs).length} pairs, ${Object.keys(index.controls).length} controls → ${KILL_SCHEDULE_RUN_DIR}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('run-kill-schedule.mjs'))
  main().catch(err => { console.error(err); process.exit(1); });
