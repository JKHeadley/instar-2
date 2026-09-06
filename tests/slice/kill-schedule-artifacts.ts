// Loads the kill-schedule execution artifacts written by scripts/run-kill-schedule.mjs
// (the pre-step). A test uses an artifact when the manifest's report-generator hash
// matches the current scripts/slice-assembly.mjs — otherwise it returns null and the
// caller falls back to a LIVE execution, so a standalone `vitest run` without the
// pre-step still works and a stale artifact is never trusted (astra C4).
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SliceReport } from './acceptance.js';

export const KILL_SCHEDULE_RUN_DIR = join(tmpdir(), 'p11-kill-schedule-artifacts');

export interface ScheduleArtifact {
  readonly report: SliceReport;
  readonly firedCuts: readonly string[];
  readonly boots: number;
  readonly neverReached: readonly string[];
}
interface Index { assemblyHash: string; pairs: Record<string, string>; controls: Record<string, string> }

const assemblyHash = (): string => createHash('sha256').update(readFileSync('scripts/slice-assembly.mjs')).digest('hex');

let cached: Index | null | undefined;
function manifest(): Index | null {
  if (cached !== undefined) return cached;
  const path = join(KILL_SCHEDULE_RUN_DIR, 'index.json');
  if (!existsSync(path)) { cached = null; return cached; }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Index;
    cached = parsed.assemblyHash === assemblyHash() ? parsed : null;
  } catch { cached = null; }
  return cached;
}

const read = (file: string): ScheduleArtifact => JSON.parse(readFileSync(join(KILL_SCHEDULE_RUN_DIR, file), 'utf8')) as ScheduleArtifact;

/** The artifact for one profile+pair from THIS run, or null to fall back to a live execution. */
export function loadPair(profile: string, pair: readonly [string, string]): ScheduleArtifact | null {
  const m = manifest(); if (!m) return null;
  const file = m.pairs[`${profile}:${pair[0]}+${pair[1]}`];
  return file ? read(file) : null;
}

/** The uninterrupted control report for one profile from THIS run, or null. */
export function loadControl(profile: string): SliceReport | null {
  const m = manifest(); if (!m) return null;
  const file = m.controls[profile];
  return file ? read(file).report : null;
}
