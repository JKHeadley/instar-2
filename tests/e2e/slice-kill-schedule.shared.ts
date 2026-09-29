// The kill schedule is driven from the assembly's own PROFILE_BOUNDARIES and
// RECOVERY_CUT_PAIRS, split into one test FILE per profile. The heavy restart-spawning
// EXECUTIONS run in the pre-step (scripts/run-kill-schedule.mjs), in the main process
// before any worker exists, so the CPU-heavy children never starve the vitest main
// process past its fixed 60s worker-RPC deadline (astra C4). Each test here LOADS its
// pair's artifact and runs the SAME per-row assertions the in-worker version ran; if an
// artifact is absent (a standalone run without the pre-step) it falls back to a live
// execution, so no assertion is lost and nothing depends on the pre-step for
// correctness. One live pair per profile is executed in-worker as a smoke check.
import { afterAll, afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { acrossExecutions, adjacentPairs, withinExecution } from '../slice/acceptance.js';
import type { SliceReport } from '../slice/acceptance.js';
import { SLICE_INPUT, discard, runExecution } from '../slice/harness.js';
import { PROFILE_BOUNDARIES, RECOVERY_BOUNDARIES, RECOVERY_CUT_PAIRS, scheduleRow } from '../slice/boundaries.js';
import { loadControl, loadPair } from '../slice/kill-schedule-artifacts.js';
import type { ScheduleArtifact } from '../slice/kill-schedule-artifacts.js';

const EXPECTED = readFileSync('tests/slice/expected-schedule.md', 'utf8').trim();
export const expectedRow = (profile: string, pair: readonly [string, string]): string => {
  const prefix = `| ${profile} | \`${pair[0]}\` | \`${pair[1]}\` |`;
  const line = EXPECTED.split('\n').find(row => row.startsWith(prefix));
  if (!line) throw new Error(`the pinned schedule has no row for ${profile} ${pair.join('+')}`);
  return line;
};

/** Declare the kill-schedule tests for ONE profile. */
export function registerProfileSchedule(profile: string): void {
  const homes: string[] = [];
  afterAll(() => discard(...homes));
  afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });

  const controlPairs = adjacentPairs(PROFILE_BOUNDARIES[profile]!);
  const recoveryPairs = RECOVERY_CUT_PAIRS[profile] ?? [];
  const reachedRecoveryHere = new Set<string>();

  let liveControl: SliceReport | undefined;
  const control = async (): Promise<SliceReport> => {
    const artifact = loadControl(profile);
    if (artifact) return artifact;
    if (!liveControl) { const run = await runExecution({ profile }); homes.push(run.home); liveControl = run.report; }
    return liveControl;
  };

  // An artifact from the pre-step, or a LIVE execution when the pre-step did not run.
  const getExecution = async (pair: readonly [string, string]): Promise<ScheduleArtifact> => {
    const artifact = loadPair(profile, pair);
    if (artifact) return artifact;
    const run = await runExecution({ profile, cuts: pair, maxBoots: 12 });
    homes.push(run.home);
    return { report: run.report, firedCuts: run.firedCuts, boots: run.boots, neverReached: run.neverReached };
  };

  // Every per-row assertion the in-worker schedule made, operating on an execution
  // (artifact or live) — unchanged in substance.
  const assertPair = async (pair: readonly [string, string], execution: ScheduleArtifact): Promise<void> => {
    expect(execution.firedCuts[0]).toBe(pair[0]);
    expect(execution.firedCuts.every(cut => pair.includes(cut))).toBe(true);
    // A scheduled cut records its row before it kills, so one boot more than cuts + 1 means a
    // boot was SIGKILLed from outside the schedule; the runner counts that as a boot.
    expect(execution.boots, 'a boot died by SIGKILL without recording a cut').toBe(execution.firedCuts.length + 1);
    expect(execution.boots).toBeGreaterThanOrEqual(2);
    expect(withinExecution(execution.report, SLICE_INPUT)).toEqual([]);
    expect(acrossExecutions(await control(), execution.report)).toEqual([]);
    expect(execution.report.externalApplications.length, `${profile} ${pair.join('+')}`).toBeLessThanOrEqual(1);
    if (execution.neverReached.length) {
      expect(execution.neverReached).toEqual([pair[1]]);
      expect(execution.firedCuts).toEqual([pair[0]]);
    }
    const rendered = scheduleRow(profile, pair, execution.boots, execution.firedCuts, execution.report);
    expect(rendered).toBe(expectedRow(profile, pair));
    for (const boundary of Object.keys(RECOVERY_BOUNDARIES))
      if (execution.report.boundariesReached.includes(boundary)) reachedRecoveryHere.add(boundary);
  };

  for (const pair of controlPairs)
    it(`P11-NF-44 kill schedule ${profile}: cut after ${pair[0]} then after ${pair[1]}`, async () => assertPair(pair, await getExecution(pair)), 240000);
  for (const pair of recoveryPairs)
    it(`P11-NF-44 kill schedule ${profile} (recovery): cut after ${pair[0]} then after ${pair[1]}`, async () => assertPair(pair, await getExecution(pair)), 240000);

  // Smoke: one pair per profile is executed LIVE in-worker (never from an artifact), so
  // the real restart-driven path stays exercised inside vitest, not only in the pre-step.
  const smoke = controlPairs[0]!;
  it(`P11-NF-44 kill schedule ${profile} smoke: a LIVE cut after ${smoke[0]} then after ${smoke[1]}`, async () => {
    const run = await runExecution({ profile, cuts: smoke, maxBoots: 12 });
    homes.push(run.home);
    await assertPair(smoke, { report: run.report, firedCuts: run.firedCuts, boots: run.boots, neverReached: run.neverReached });
  }, 240000);

  it(`P11-NF-44 the ${profile} schedule cuts every one of its control boundaries and reaches what it recovers`, () => {
    const cut = new Set([...controlPairs, ...recoveryPairs].flatMap(p => [...p]));
    for (const boundary of PROFILE_BOUNDARIES[profile]!) expect(cut, `${profile} ${boundary}`).toContain(boundary);
    for (const pair of recoveryPairs) {
      expect(cut, `${profile} ${pair[1]}`).toContain(pair[1]);
      expect(reachedRecoveryHere, `${profile} reached ${pair[1]}`).toContain(pair[1]);
    }
  });
}
