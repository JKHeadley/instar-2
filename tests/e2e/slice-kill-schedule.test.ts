// docs/15 section 7: "A deterministic kill schedule enumerates every adjacent pair
// and records which cut actually fired." Each execution restarts ONLY through the
// assembly's public boot path. One test per pair keeps every fixture short enough
// for the runner's task-update IPC to flush between them.
import { afterAll, afterEach, it, expect } from 'vitest';
import { acrossExecutions, adjacentPairs, withinExecution } from '../slice/acceptance.js';
import type { SliceReport } from '../slice/acceptance.js';
import { JUDGMENT_BOUNDARIES, REPLY_BOUNDARIES, SLICE_INPUT, discard, runExecution } from '../slice/harness.js';

const homes: string[] = [];
afterAll(() => discard(...homes));
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });

interface ScheduleRow { profile: string; pair: readonly [string, string]; boots: number;
  fired: readonly string[]; neverReached: readonly string[]; applications: number; settlement: string }
const schedule: ScheduleRow[] = [];
const controls: Record<string, SliceReport> = {};

async function control(profile: string): Promise<SliceReport> {
  if (!controls[profile]) { const run = await runExecution({ profile }); homes.push(run.home); controls[profile] = run.report; }
  return controls[profile]!;
}

async function runPair(profile: string, pair: readonly [string, string]): Promise<void> {
  const execution = await runExecution({ profile, cuts: pair, maxBoots: 12 });
  homes.push(execution.home);
  // The first cut of every pair is reachable by construction; the second may be
  // unreachable BECAUSE of the first, and the schedule records that honestly.
  expect(execution.firedCuts[0]).toBe(pair[0]);
  expect(execution.firedCuts.every(cut => pair.includes(cut))).toBe(true);
  expect(execution.boots).toBe(execution.firedCuts.length + 1);
  expect(withinExecution(execution.report, SLICE_INPUT)).toEqual([]);
  expect(acrossExecutions(await control(profile), execution.report)).toEqual([]);
  schedule.push({ profile, pair, boots: execution.boots, fired: execution.firedCuts,
    neverReached: execution.neverReached, applications: execution.report.externalApplications.length,
    settlement: execution.report.settlement?.outcome ?? 'none' });
}

for (const [profile, boundaries] of [['reply', REPLY_BOUNDARIES], ['judgment', JUDGMENT_BOUNDARIES]] as const)
  for (const pair of adjacentPairs(boundaries))
    it(`P11-NF-44 kill schedule ${profile}: cut after ${pair[0]} then after ${pair[1]}`, () => runPair(profile, pair), 240000);

it('P11-NF-44 P11-NF-45 the recorded schedule covers every adjacent pair and skips none', () => {
  const expected = [...adjacentPairs(REPLY_BOUNDARIES).map(p => `reply:${p.join('+')}`),
    ...adjacentPairs(JUDGMENT_BOUNDARIES).map(p => `judgment:${p.join('+')}`)];
  expect(schedule.map(row => `${row.profile}:${row.pair.join('+')}`)).toEqual(expected);
  // Every boundary the design enumerates was cut at least once by the schedule.
  const cut = new Set(schedule.flatMap(row => row.fired));
  for (const boundary of REPLY_BOUNDARIES) expect(cut, boundary).toContain(boundary);
  for (const boundary of JUDGMENT_BOUNDARIES) expect(cut, boundary).toContain(boundary);
  // Never more than one external application per execution, in any cut position.
  for (const row of schedule) expect(row.applications, `${row.profile} ${row.pair.join('+')}`).toBeLessThanOrEqual(1);
  // Unreachable second cuts are RECORDED, never silently dropped.
  for (const row of schedule.filter(r => r.neverReached.length > 0)) {
    expect(row.neverReached).toEqual([row.pair[1]]);
    expect(row.fired).toEqual([row.pair[0]]);
  }
  expect(schedule.every(row => row.boots >= 2)).toBe(true);
});
