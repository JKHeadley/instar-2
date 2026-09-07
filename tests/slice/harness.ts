// Spawns slice executions through the assembly's PUBLIC boot path only.
// Every restart is a fresh `node scripts/slice-worker.mjs`; nothing here reaches
// into the assembly, and there is no test-only recovery helper. The execution core is
// the SHARED implementation the kill-schedule pre-step also uses, so the harness and the
// pre-step can never drift (astra advisory).
import { rm } from 'node:fs/promises';
import type { SliceReport } from './acceptance.js';
import { PROFILE_BOUNDARIES } from './boundaries.js';
// @ts-expect-error the shared execution helper is JavaScript, outside pure core compilation.
import { runSliceExecution, spawnBoot } from '../../scripts/slice-execution.mjs';

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

interface RawExecution {
  home: string; boots: number; report: SliceReport;
  firedCuts: string[]; neverReached: string[]; stderr: string;
}

/** Runs one execution to completion, restarting after every SIGKILL cut. */
export async function runExecution(options: { profile?: string; adapter?: string; cuts?: readonly string[]; maxBoots?: number } = {}): Promise<Execution> {
  const cuts = options.cuts ?? [];
  const run = await (runSliceExecution as (o: unknown) => Promise<RawExecution>)({
    profile: options.profile ?? 'full', adapter: options.adapter ?? 'telegram-slice', cuts, maxBoots: options.maxBoots ?? 30 });
  return { home: run.home, boots: run.boots, report: run.report, firedCuts: run.firedCuts,
    requestedCuts: cuts, neverReached: run.neverReached, stderr: run.stderr };
}

/** An independent fresh-process rebuild of every projection from the durable facts. */
export async function rebuildInFreshProcess(home: string, profile = 'reply'): Promise<SliceReport['rebuilds']> {
  const run = await (spawnBoot as (a: readonly string[]) => Promise<{ status: number | null; stdout: string; stderr: string }>)(
    ['scripts/slice-rebuild.mjs', home, JSON.stringify({ profile })]);
  if (run.status !== 0) throw new Error(`rebuild process failed: ${run.stderr}`);
  return JSON.parse(run.stdout.trim().split('\n').pop()!) as SliceReport['rebuilds'];
}

// ASYNC teardown: run the durable-home deletions on libuv's threadpool, awaited, so the
// worker's event loop stays FREE during cleanup. A synchronous rmSync of many large home
// trees at afterAll blocked the loop ~30s locally (60-90s on a slower arm64 runner) —
// long enough that the file's final onTaskUpdate RPC could not be serviced and vitest
// threw a worker-RPC timeout after every test had passed (REPAIR6). Deletion is a
// best-effort cleanup, so a failure to remove a temp dir is ignored.
export async function discard(...homes: readonly string[]): Promise<void> {
  await Promise.all(homes.map(home => rm(home, { recursive: true, force: true }).catch(() => {})));
}
