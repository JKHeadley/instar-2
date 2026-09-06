// The kill schedule is driven from the assembly's own PROFILE_BOUNDARIES and
// RECOVERY_CUT_PAIRS. It is split into one test FILE per profile so each vitest
// worker's task-update RPC channel carries a bounded chunk of the heavy, restart-
// spawning executions — a whole-schedule file starved that channel on slower CI
// runners ("Timeout calling onTaskUpdate") even with the async child spawn. Each
// per-profile file asserts every one of its rows byte-equals the pinned record and
// satisfies every per-row invariant; the separate completeness file asserts the
// pinned table itself is complete and well-formed. No assertion is dropped.
import { afterAll, afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { acrossExecutions, adjacentPairs, withinExecution } from '../slice/acceptance.js';
import type { SliceReport } from '../slice/acceptance.js';
import { SLICE_INPUT, discard, runExecution } from '../slice/harness.js';
import { PROFILE_BOUNDARIES, RECOVERY_BOUNDARIES, RECOVERY_CUT_PAIRS, scheduleRow } from '../slice/boundaries.js';

const EXPECTED = readFileSync('tests/slice/expected-schedule.md', 'utf8').trim();
export const expectedRow = (profile: string, pair: readonly [string, string]): string => {
  const prefix = `| ${profile} | \`${pair[0]}\` | \`${pair[1]}\` |`;
  const line = EXPECTED.split('\n').find(row => row.startsWith(prefix));
  if (!line) throw new Error(`the pinned schedule has no row for ${profile} ${pair.join('+')}`);
  return line;
};

/** The full ordered cut list for a profile: its adjacent control pairs, then its recovery pairs. */
export function profilePairs(profile: string): readonly (readonly [string, string])[] {
  return [...adjacentPairs(PROFILE_BOUNDARIES[profile]!), ...(RECOVERY_CUT_PAIRS[profile] ?? [])];
}

/**
 * Declare the kill-schedule tests for ONE profile. Each pair is a real restart-driven
 * execution asserted against the pinned row and every per-row invariant the whole-file
 * completeness check used to make over the live rows.
 */
export function registerProfileSchedule(profile: string): void {
  const homes: string[] = [];
  afterAll(() => discard(...homes));
  afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });

  const controlPairs = adjacentPairs(PROFILE_BOUNDARIES[profile]!);
  const recoveryPairs = RECOVERY_CUT_PAIRS[profile] ?? [];
  const reachedRecoveryHere = new Set<string>();

  let controlReport: SliceReport | undefined;
  const control = async (): Promise<SliceReport> => {
    if (!controlReport) { const run = await runExecution({ profile }); homes.push(run.home); controlReport = run.report; }
    return controlReport;
  };

  const runPair = async (pair: readonly [string, string]): Promise<void> => {
    const execution = await runExecution({ profile, cuts: pair, maxBoots: 12 });
    homes.push(execution.home);
    // The first cut of every pair is reachable by construction; the second may be
    // unreachable BECAUSE of the first, and the schedule records that honestly.
    expect(execution.firedCuts[0]).toBe(pair[0]);
    expect(execution.firedCuts.every(cut => pair.includes(cut))).toBe(true);
    expect(execution.boots).toBe(execution.firedCuts.length + 1);
    expect(execution.boots).toBeGreaterThanOrEqual(2);
    expect(withinExecution(execution.report, SLICE_INPUT)).toEqual([]);
    expect(acrossExecutions(await control(), execution.report)).toEqual([]);
    // Never more than one external application per execution, in any cut position.
    expect(execution.report.externalApplications.length, `${profile} ${pair.join('+')}`).toBeLessThanOrEqual(1);
    // An unreachable second cut is RECORDED, never silently dropped.
    if (execution.neverReached.length) {
      expect(execution.neverReached).toEqual([pair[1]]);
      expect(execution.firedCuts).toEqual([pair[0]]);
    }
    // The whole outcome row is pinned, not just the fired cuts: a regression in which
    // recovery stopped driving the chain would change boots, the application count or
    // the terminal disposition, and this byte comparison is what notices.
    const rendered = scheduleRow(profile, pair, execution.boots, execution.firedCuts, execution.report);
    expect(rendered).toBe(expectedRow(profile, pair));
    // A recovery-only boundary that this pair REACHED (whether or not it was the cut).
    for (const boundary of Object.keys(RECOVERY_BOUNDARIES))
      if (execution.report.boundariesReached.includes(boundary)) reachedRecoveryHere.add(boundary);
  };

  for (const pair of controlPairs)
    it(`P11-NF-44 kill schedule ${profile}: cut after ${pair[0]} then after ${pair[1]}`, () => runPair(pair), 240000);
  for (const pair of recoveryPairs)
    it(`P11-NF-44 kill schedule ${profile} (recovery): cut after ${pair[0]} then after ${pair[1]}`, () => runPair(pair), 240000);

  // Per-profile closure: every control boundary of THIS profile was cut at least once,
  // and any recovery boundary this profile cuts was reached before it was cut.
  it(`P11-NF-44 the ${profile} schedule cuts every one of its control boundaries and reaches what it recovers`, () => {
    const cut = new Set([...controlPairs, ...recoveryPairs].flatMap(p => [...p]));
    for (const boundary of PROFILE_BOUNDARIES[profile]!) expect(cut, `${profile} ${boundary}`).toContain(boundary);
    for (const pair of recoveryPairs) {
      expect(cut, `${profile} ${pair[1]}`).toContain(pair[1]);
      expect(reachedRecoveryHere, `${profile} reached ${pair[1]}`).toContain(pair[1]);
    }
  });
}
