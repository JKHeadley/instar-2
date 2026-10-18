import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical supervisor is JavaScript.
import { lastJournalRun, superviseJournal } from '../../scripts/host-watch.mjs';

// Group P's recorded 2026-10-18 proof failures used the old threshold+1 expectation.
// Rules 55/68 require bounded revival, not one extra crash beyond the durable brake.
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture(maxRestarts: number) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'group-p-')));
  roots.push(root);
  return { root, maxRestarts, backoffMs: 100, maxBackoffMs: 250,
    agent: [process.execPath, fileURLToPath(new URL('./journal-agent.mjs', import.meta.url)), 'run', '--root', root] };
}

it('P55c: reaches the backoff cap and pauses durably at the failure threshold', async () => {
  const config = fixture(4), waits: number[] = [];
  let launches = 0, clock = 1_000_000;
  const io = { launch: async () => { launches++; clock += 10; return { code: 1, signal: null }; },
    now: () => clock, wait: async (_root: string, ms: number) => { waits.push(ms); } };
  expect(await superviseJournal(config, io)).toBe(0);
  expect(launches).toBe(4);
  expect(waits).toEqual([100, 200, 250]);
  const state = JSON.parse(readFileSync(join(config.root, 'host-watch.json'), 'utf8'));
  expect(state.crashLoop.failures).toHaveLength(4);
  expect(state.crashLoop.pausedAt).toBe(clock);
  await superviseJournal(config, io);
  expect(launches).toBe(4);
});

it('P55d: zero cap refuses before launch; a positive cap admits a launch', async () => {
  let launches = 0;
  const io = { launch: async () => { launches++; return { code: 1, signal: null }; }, now: () => 100 };
  await expect(superviseJournal(fixture(0), io)).rejects.toThrow();
  expect(launches).toBe(0);
  expect(await superviseJournal(fixture(1), io)).toBe(0);
  expect(launches).toBe(1);
});

it.each([
  ['queued', 0, 3, [100, 100]],
  ['queued', 1, 4, [100, 200, 250]],
  ['inhibited', 0, 1, []],
  ['none', 0, 1, []],
] as const)('P68e: revival %s with exit %i has bounded launches', async (revival, code, expected, delays) => {
  const config = fixture(4), waits: number[] = [];
  let launches = 0, clock = 5_000_000;
  expect(await superviseJournal(config, {
    launch: async () => {
      launches++;
      const launch = clock;
      clock += 61_000;
      appendFileSync(join(config.root, 'runs.jsonl'), JSON.stringify({ v: 1, launch, pid: 1000 + launches }) + '\n');
      expect(lastJournalRun(config.root).revival).toBe('unrecorded');
      appendFileSync(join(config.root, 'runs.jsonl'), JSON.stringify({ v: 1, launch, exit: clock, unfinished: 2, revival }) + '\n');
      expect(lastJournalRun(config.root).revival).toBe(revival);
      if (launches === 3 && revival === 'queued' && code === 0) writeFileSync(join(config.root, 'preview-stop.json'), '{}');
      return { code, signal: null };
    }, now: () => clock, wait: async (_root: string, ms: number) => { waits.push(ms); },
  })).toBe(0);
  expect(launches).toBe(expected);
  expect(waits).toEqual(delays);
});
