// Spawns slice executions through the assembly's PUBLIC boot path only.
// Every restart is a fresh `node scripts/slice-worker.mjs`; nothing here reaches
// into the assembly, and there is no test-only recovery helper.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SliceReport } from './acceptance.js';
import { PROFILE_BOUNDARIES } from './boundaries.js';

export const SLICE_INPUT = JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'Please classify and acknowledge this request.' });

// The durable boundaries each profile reaches come from the ASSEMBLY, which is the
// single source: `boundary()` refuses an undeclared name, and the control executions
// below assert the converse. Nothing here restates a boundary name.
export const FULL_BOUNDARIES: readonly string[] = PROFILE_BOUNDARIES['full']!;
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
 * One child process, awaited WITHOUT blocking the runner's event loop. A blocking
 * `spawnSync` here starved the vitest worker's `onTaskUpdate` RPC once the 49-pair
 * kill schedule doubled the e2e wall time — the same failure the
 * transport-settlement fixture hit and fixed the same way (async child, worker kept
 * responsive; no reporting/global timeout raised, no assertion weakened).
 */
const spawnBoot = (args: readonly string[]): Promise<{ status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
  });

/** Runs one execution to completion, restarting after every SIGKILL cut. */
export async function runExecution(options: { profile?: string; adapter?: string; cuts?: readonly string[]; maxBoots?: number } = {}): Promise<Execution> {
  const home = mkdtempSync(join(tmpdir(), 'p11-slice-'));
  const cuts = options.cuts ?? [];
  const encoded = JSON.stringify({ profile: options.profile ?? 'full', adapter: options.adapter ?? 'telegram-slice', cuts });
  let boots = 0, report: SliceReport | undefined, stderr = '';
  for (let attempt = 0; attempt < (options.maxBoots ?? 30); attempt++) {
    boots++;
    const run = await spawnBoot(['scripts/slice-worker.mjs', home, encoded]);
    stderr = run.stderr;
    if (run.status === 0) { report = JSON.parse(run.stdout.trim().split('\n').pop()!) as SliceReport; break; }
    if (run.signal !== 'SIGKILL') throw new Error(`slice worker failed: status=${run.status} signal=${run.signal}\n${stderr}`);
  }
  if (!report) throw new Error(`slice execution never completed after ${boots} boots\n${stderr}`);
  const fired = jsonl(join(home, 'cuts.jsonl')).map(row => row.boundary);
  return { home, boots, report, firedCuts: fired, requestedCuts: cuts, stderr,
    neverReached: cuts.filter(cut => !fired.includes(cut)) };
}

/** An independent fresh-process rebuild of every projection from the durable facts. */
export async function rebuildInFreshProcess(home: string, profile = 'reply'): Promise<SliceReport['rebuilds']> {
  const run = await spawnBoot(['scripts/slice-rebuild.mjs', home, JSON.stringify({ profile })]);
  if (run.status !== 0) throw new Error(`rebuild process failed: ${run.stderr}`);
  return JSON.parse(run.stdout.trim().split('\n').pop()!) as SliceReport['rebuilds'];
}

export function discard(...homes: readonly string[]): void {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
}
