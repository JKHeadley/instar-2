// Spawns slice executions through the assembly's PUBLIC boot path only.
// Every restart is a fresh `node scripts/slice-worker.mjs`; nothing here reaches
// into the assembly, and there is no test-only recovery helper.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SliceReport } from './acceptance.js';
import { PROFILE_BOUNDARIES } from './boundaries.js';

export const SLICE_INPUT = JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'Please classify and acknowledge this request.' });

// The durable boundaries each profile reaches come from the ASSEMBLY, which is the
// single source: `boundary()` refuses an undeclared name, and the control executions
// below assert the converse. Nothing here restates a boundary name.
export const REPLY_BOUNDARIES: readonly string[] = PROFILE_BOUNDARIES['reply']!;
export const JUDGMENT_BOUNDARIES: readonly string[] = PROFILE_BOUNDARIES['judgment']!;

export interface Execution {
  readonly home: string; readonly boots: number; readonly report: SliceReport;
  readonly firedCuts: readonly string[]; readonly requestedCuts: readonly string[];
  readonly neverReached: readonly string[]; readonly stderr: string;
}

const jsonl = (file: string): { boundary: string }[] =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as { boundary: string }) : [];

/**
 * Runs one execution to completion, restarting after every SIGKILL cut.
 *
 * Each boot is a blocking `spawnSync`, so the loop yields between boots: that keeps a
 * long execution from starving the runner's task-update IPC on a slow machine.
 */
export async function runExecution(options: { profile?: string; adapter?: string; cuts?: readonly string[]; maxBoots?: number } = {}): Promise<Execution> {
  const home = mkdtempSync(join(tmpdir(), 'p11-slice-'));
  const cuts = options.cuts ?? [];
  const encoded = JSON.stringify({ profile: options.profile ?? 'reply', adapter: options.adapter ?? 'telegram-slice', cuts });
  let boots = 0, report: SliceReport | undefined, stderr = '';
  for (let attempt = 0; attempt < (options.maxBoots ?? 30); attempt++) {
    if (attempt > 0) await new Promise<void>(done => setImmediate(done));
    boots++;
    const run = spawnSync(process.execPath, ['scripts/slice-worker.mjs', home, encoded],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    stderr = run.stderr ?? '';
    if (run.status === 0) { report = JSON.parse(run.stdout.trim().split('\n').pop()!) as SliceReport; break; }
    if (run.signal !== 'SIGKILL') throw new Error(`slice worker failed: status=${run.status} signal=${run.signal}\n${stderr}`);
  }
  if (!report) throw new Error(`slice execution never completed after ${boots} boots\n${stderr}`);
  const fired = jsonl(join(home, 'cuts.jsonl')).map(row => row.boundary);
  return { home, boots, report, firedCuts: fired, requestedCuts: cuts, stderr,
    neverReached: cuts.filter(cut => !fired.includes(cut)) };
}

/** An independent fresh-process rebuild of every projection from the durable facts. */
export function rebuildInFreshProcess(home: string, profile = 'reply'): SliceReport['rebuilds'] {
  const run = spawnSync(process.execPath, ['scripts/slice-rebuild.mjs', home, JSON.stringify({ profile })],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`rebuild process failed: ${run.stderr}`);
  return JSON.parse(run.stdout.trim().split('\n').pop()!) as SliceReport['rebuilds'];
}

export function discard(...homes: readonly string[]): void {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
}
