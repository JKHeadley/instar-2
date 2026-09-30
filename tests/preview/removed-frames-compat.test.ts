import { expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnAsync } from './spawn-async.js';

const current = process.cwd();
// The last build that shipped requested summaries, fixed-text requested reminders and the email import route.
const baseCommit = 'f134a26a';
const fixture = join(current, 'tests/preview/removed-frames-fixture.mjs');
const key = Buffer.alloc(32, 53).toString('hex');

async function checkout(commit: string, target: string) {
  mkdirSync(target);
  const archived = await spawnAsync('git', ['archive', '--format=tar', commit], { cwd: current });
  expect(archived.status, archived.stderr).toBe(0);
  const unpacked = await spawnAsync('tar', ['-xf', '-', '-C', target], { input: archived.stdoutBytes });
  expect(unpacked.status, unpacked.stderr).toBe(0);
  symlinkSync(realpathSync(join(current, 'node_modules')), join(target, 'node_modules'), 'dir');
}
const run = (mode: string, checkoutPath: string, root: string) => spawnAsync(process.execPath,
  ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', fixture, mode, checkoutPath, root],
  { cwd: checkoutPath, encoding: 'utf8', timeout: 60000 });

it('opens and replays a journal holding every removed frame kind; nothing in it is answered or sent again', async () => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'preview-removed-frames-')));
  try {
    const base = join(temp, 'base'), root = join(temp, 'root'), copy = join(temp, 'copy');
    await checkout(baseCommit, base); mkdirSync(root);
    const written = await run('write', base, root);
    expect(written.status, written.stderr).toBe(0);
    // The base build wrote summary grants and a cancel, a delivered summary that carried a reminder, a fixed-text
    // reminder push, and an email channel item.
    expect(JSON.parse(written.stdout)).toMatchObject({ summaryGrants: 2, summaryCancels: 1, summaryTurns: 1, summarySent: 1,
      reminderBatches: [{ items: 1, sent: true }, { items: 1, sent: true }], groupedIntoSummary: 1, channelItems: ['email'] });
    cpSync(root, copy, { recursive: true });
    const status = await spawnAsync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', copy],
    { cwd: current, env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key }, encoding: 'utf8', timeout: 30000 });
    expect(status.status, status.stderr).toBe(0);
    const report = JSON.parse(status.stdout);
    expect(report.requestedActions).toEqual({ requested: 2, cancelled: 0, accepted: 2, refused: 0, unknown: 0, open: [], dueTurns: [] });
    expect(report.channelItems).toBe(0);
    expect(report).not.toHaveProperty('requestedSummaries');
    const exercised = await run('exercise', current, root);
    expect(exercised.status, exercised.stderr).toBe(0);
    const result = JSON.parse(exercised.stdout);
    expect(result.replayed).toEqual({ legacySummaryTurns: [{ intent: true, sent: true }], channelItems: 0, requested: 2 });
    expect(result.afterReplay).toBe(0);
    expect(result.sent).toEqual([
      'PREVIEW — Okay. Date 1: 2026-09-27 09:00 (America/Los_Angeles). I will act on this once at 2026-09-27 09:00 (America/Los_Angeles) and send you the result here.',
      'PREVIEW — You asked on 2026-09-26 10:06: "remind me tomorrow at 9 am to stretch" (due 2026-09-27 09:00 America/Los_Angeles)\nTime to stretch.']);
    expect(result.dueTurns).toBe(1);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}, 180000);
