// ONE slice-execution implementation, shared by the test harness (tests/slice/harness.ts)
// and the kill-schedule pre-step (scripts/run-kill-schedule.mjs), so the two can never
// drift (astra advisory: the producer had hardcoded 30 boots vs the harness's 12). Each
// boot is an ASYNC child so the caller's event loop stays free — a blocking spawnSync
// here starved the vitest worker's task-update RPC once the schedule doubled the e2e
// wall time (the transport-settlement fixture fixed the same class the same way).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nicedNode } from './test-child.mjs';

export const spawnBoot = (args) => new Promise((resolve, reject) => {
  // Reduced-priority child so the vitest main process keeps servicing its RPC under
  // CPU saturation on 2-core CI runners (REPAIR5). Byte-for-byte the same node run.
  const child = spawn(...nicedNode(args), { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
});

const jsonl = (file) => existsSync(file)
  ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

/**
 * Run one slice execution to completion, restarting after every SIGKILL cut. Returns
 * the durable `home` (the caller decides whether to keep or discard it), the boot count,
 * the completed report, the cuts that actually fired, and the requested cuts that were
 * never reached. Identical semantics for the harness and the pre-step.
 */
export async function runSliceExecution({ profile = 'full', adapter = 'telegram-slice', cuts = [], maxBoots = 30 } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'p11-slice-'));
  const encoded = JSON.stringify({ profile, adapter, cuts });
  let boots = 0, report, stderr = '';
  for (let attempt = 0; attempt < maxBoots; attempt++) {
    boots++;
    const run = await spawnBoot(['scripts/slice-worker.mjs', home, encoded]);
    stderr = run.stderr;
    if (run.status === 0) { report = JSON.parse(run.stdout.trim().split('\n').pop()); break; }
    if (run.signal !== 'SIGKILL') throw new Error(`slice worker failed: status=${run.status} signal=${run.signal}\n${stderr}`);
  }
  if (!report) throw new Error(`slice execution never completed after ${boots} boots\n${stderr}`);
  const fired = jsonl(join(home, 'cuts.jsonl')).map(row => row.boundary);
  return { home, boots, report, firedCuts: fired, neverReached: cuts.filter(cut => !fired.includes(cut)), stderr };
}
