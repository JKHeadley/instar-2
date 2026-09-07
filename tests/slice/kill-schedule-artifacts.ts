// Loads the kill-schedule execution artifacts written by scripts/run-kill-schedule.mjs
// (the pre-step). An artifact is used only when the manifest's COMPLETE execution-input
// fingerprint matches the current tree (astra N1: a slice-assembly-only hash reused
// stale results after any other input changed); otherwise, and for any absent,
// unreadable, or malformed payload (astra N2: an unguarded read threw ENOENT instead of
// falling back), these return null and the caller runs a LIVE execution. So a standalone
// `vitest run` without the pre-step still works, a stale artifact is never trusted, and a
// partial/removed cache degrades to live rather than failing a healthy run.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error the fingerprint helper is JavaScript, outside pure core compilation.
import { artifactHash, executionFingerprint, killScheduleRunDir } from '../../scripts/kill-schedule-fingerprint.mjs';
import type { SliceReport } from './acceptance.js';

export const KILL_SCHEDULE_RUN_DIR: string = killScheduleRunDir() as string;
export { executionFingerprint, killScheduleRunDir };

export interface ScheduleArtifact {
  readonly report: SliceReport;
  readonly firedCuts: readonly string[];
  readonly boots: number;
  readonly neverReached: readonly string[];
}
interface Entry { file: string; sha: string }
interface Index { fingerprint: string; pairs: Record<string, Entry>; controls: Record<string, Entry> }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isEntry = (v: unknown): v is Entry => isObject(v) && typeof v.file === 'string' && typeof v.sha === 'string';
const validArtifact = (v: unknown): v is ScheduleArtifact => isObject(v) && isObject(v.report)
  && Array.isArray(v.firedCuts) && typeof v.boots === 'number' && Array.isArray(v.neverReached);
const validControl = (v: unknown): v is ScheduleArtifact => isObject(v) && isObject(v.report);

/**
 * Read an artifact by its manifest entry: verify the file's bytes hash to the recorded
 * sha (a torn/partial write is refused, not parsed), then parse and shape-check. Null (a
 * cache miss → live fallback) on ANY failure — never throws.
 */
function readEntry<T>(dir: string, entry: Entry, valid: (v: unknown) => v is T): T | null {
  const path = join(dir, entry.file);
  if (!existsSync(path)) return null;
  try {
    const bytes = readFileSync(path);
    if ((artifactHash(bytes) as string) !== entry.sha) return null;
    const parsed: unknown = JSON.parse(bytes.toString('utf8'));
    return valid(parsed) ? parsed : null;
  } catch { return null; }
}

/** The manifest for `dir`, or null when absent, unreadable, malformed, or fingerprint-stale. */
function manifest(dir: string): Index | null {
  const path = join(dir, 'index.json');
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
  if (!(isObject(parsed) && typeof parsed.fingerprint === 'string' && isObject(parsed.pairs) && isObject(parsed.controls))) return null;
  return parsed.fingerprint === (executionFingerprint() as string) ? (parsed as unknown as Index) : null;
}

/** The artifact for one profile+pair from THIS run, or null to fall back to a live execution. */
export function loadPair(profile: string, pair: readonly [string, string], dir: string = KILL_SCHEDULE_RUN_DIR): ScheduleArtifact | null {
  const m = manifest(dir); if (!m) return null;
  const entry = m.pairs[`${profile}:${pair[0]}+${pair[1]}`];
  return isEntry(entry) ? readEntry(dir, entry, validArtifact) : null;
}

/** The uninterrupted control report for one profile from THIS run, or null. */
export function loadControl(profile: string, dir: string = KILL_SCHEDULE_RUN_DIR): SliceReport | null {
  const m = manifest(dir); if (!m) return null;
  const entry = m.controls[profile];
  if (!isEntry(entry)) return null;
  const artifact = readEntry(dir, entry, validControl);
  return artifact ? artifact.report : null;
}
