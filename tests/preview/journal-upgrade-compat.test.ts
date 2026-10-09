import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnAsync } from './spawn-async.js';

const current = process.cwd();
const baseCommit = '7d824d64'; // runner-frozen14, live from 2026-09-27 07:34
const olderCommit = '89d5ee35'; // frozen13, before renewal-frame support
const fixture = join(current, 'tests/preview/journal-upgrade-fixture.mjs');
const key = Buffer.alloc(32, 47).toString('hex');
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

async function checkout(commit: string, target: string) {
  mkdirSync(target);
  const archived = await spawnAsync('git', ['archive', '--format=tar', commit],
    { cwd: current });
  expect(archived.status, archived.stderr).toBe(0);
  const unpacked = await spawnAsync('tar', ['-xf', '-', '-C', target], { input: archived.stdoutBytes });
  expect(unpacked.status, unpacked.stderr).toBe(0);
  symlinkSync(realpathSync(join(current, 'node_modules')), join(target, 'node_modules'), 'dir');
}
function fixtureRun(mode: string, checkoutPath: string, root: string) {
  return spawnAsync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    fixture, mode, checkoutPath, root], { cwd: checkoutPath, encoding: 'utf8', timeout: 30000 });
}
function status(checkoutPath: string, root: string) {
  return spawnAsync(process.execPath, ['--no-warnings', '--import', 'data:text/javascript,Date.now=()=>1790520001000',
    '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'status', '--root', root],
    { cwd: checkoutPath, env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key },
      encoding: 'utf8', timeout: 30000 });
}

it('opens the frozen14 journal and preserves state with current reply rendering; frozen13 refuses the renewed format before status or mutation', async () => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'preview-upgrade-')));
  try {
    const base = join(temp, 'base'), older = join(temp, 'older'), seed = join(temp, 'seed');
    await checkout(baseCommit, base); await checkout(olderCommit, older); mkdirSync(seed);
    const written = await fixtureRun('write', base, seed);
    expect(written.status, written.stderr).toBe(0);
    const baseRoot = join(temp, 'base-read'), nextRoot = join(temp, 'next-read');
    cpSync(seed, baseRoot, { recursive: true }); cpSync(seed, nextRoot, { recursive: true });
    const baseStatus = await status(base, seed), nextStatus = await status(current, seed);
    expect(baseStatus.status, baseStatus.stderr).toBe(0);
    expect(nextStatus.status, nextStatus.stderr).toBe(0);
    const nextView = JSON.parse(nextStatus.stdout), baseView = JSON.parse(baseStatus.stdout);
    // int11/int12 add status fields and plainer wording; the replayed journal state is unchanged. cint-23-occam
    // removed the operator digest, so its status field is no longer reported.
    const { holds: nextHolds, self: nextSelf, ...nextState } = nextView;
    const { holds: baseHolds, self: baseSelf, digest: _removedDigest, ...baseState } = baseView;
    expect(nextState).toMatchObject(baseState);
    expect(nextHolds.map((item: { update: number }) => item.update)).toEqual(baseHolds.map((item: { update: number }) => item.update));
    for (const line of ['Operator messages received: 3 today, 3 in this trial', 'My replies Telegram accepted: 2 today, 2 in this trial']) {
      expect(baseSelf).toContain(line);
      expect(nextSelf).toContain(line.replace('in this trial', 'so far'));
    }
    const baseAnswer = await fixtureRun('exercise', base, baseRoot);
    const nextAnswer = await fixtureRun('exercise', current, nextRoot);
    expect(baseAnswer.status, baseAnswer.stderr).toBe(0);
    expect(nextAnswer.status, nextAnswer.stderr).toBe(0);
    // The probe packet carries int11/int12 instructions and projections; the replayed state,
    // the answer and single send match frozen14 apart from the retired presentation prefix.
    const { probe: nextProbe, ...nextRun } = JSON.parse(nextAnswer.stdout);
    const { probe: baseProbe, ...baseRun } = JSON.parse(baseAnswer.stdout);
    expect(nextRun).toEqual({ ...baseRun, sent: baseRun.sent.map((text: string) => text.replace(/^PREVIEW — /u, '')) });
    expect(nextProbe.memory).toEqual(baseProbe.memory);
    expect(nextProbe.historyMode).toBe(baseProbe.historyMode);
    expect(JSON.parse(nextAnswer.stdout)).toMatchObject({
      before: { cursor: 4, calls: 3, replies: 2, held: [[3, 'reply check unavailable']],
        expires: 1791232800000, shapes: { version: 1, counts: { 'answer/decision/tolerated/fenced': 1 } } },
      sent: ['Sam keeps the cedar map in the green drawer.'], answer: 'Sam keeps the cedar map in the green drawer.', cursor: 5 });
    const before = digest(join(seed, 'journal.encrypted'));
    const sidecarBefore = digest(join(seed, 'model-json-shapes.json'));
    const refused = await status(older, seed);
    expect(refused.status).not.toBe(0);
    expect(refused.stdout).toBe('');
    expect(digest(join(seed, 'journal.encrypted'))).toBe(before);
    expect(digest(join(seed, 'model-json-shapes.json'))).toBe(sidecarBefore);
    // A writer open must also fail before it can truncate or append to this root.
    const oldWrite = await spawnAsync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      fixture, 'exercise', older, seed], { cwd: older, encoding: 'utf8', timeout: 30000 });
    expect(oldWrite.status).not.toBe(0);
    expect(oldWrite.stdout).toBe('');
    expect(digest(join(seed, 'journal.encrypted'))).toBe(before);
    expect(digest(join(seed, 'model-json-shapes.json'))).toBe(sidecarBefore);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}, 240000); // Seven checkout subprocesses each carry their own 30 s bound; the test bound must exceed their sum under load.
