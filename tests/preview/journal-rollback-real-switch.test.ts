// The recorded refusal, replayed by the two real builds (Rule 36, Rule 70: the real captured behaviour, not a
// hand-typed approximation). Rehearsed 2026-10-04 00:03: cint-L45 wrote a root, cint-L44 refused to start on
// it, so rolling the operator's preview back one build would have cost his conversation memory.
//
// Honest scope: cint-L44 is a shipped build and cannot be repaired from here, so this test records the defect
// and confirms the forward direction still holds. The window the fix installs — a root one generation ahead
// opening, two ahead refusing — is proved on the same byte shape in journal-rollback-window.test.ts.
import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnAsync } from './spawn-async.js';

const current = process.cwd();
const writerCommit = 'c0b57925'; // cint-L45 round-3 repair record: the build that added the session-work frame
const readerCommit = '9ee1c2bd'; // cint-L44 pipeline repair 3 record: the build one back, with no branch for it
const fixture = join(current, 'tests/preview/journal-rollback-fixture.mjs');

async function checkout(commit: string, target: string) {
  mkdirSync(target);
  const archived = await spawnAsync('git', ['archive', '--format=tar', commit], { cwd: current });
  expect(archived.status, archived.stderr).toBe(0);
  const unpacked = await spawnAsync('tar', ['-xf', '-', '-C', target], { input: archived.stdoutBytes });
  expect(unpacked.status, unpacked.stderr).toBe(0);
  symlinkSync(realpathSync(join(current, 'node_modules')), join(target, 'node_modules'), 'dir');
}
const run = (mode: string, checkoutPath: string, root: string) =>
  spawnAsync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', fixture, mode, checkoutPath, root],
    { cwd: checkoutPath, encoding: 'utf8', timeout: 60000 });

it('records cint-L44 refusing cint-L45\'s root as an orphan effect, and this build reading it', async () => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'rollback-switch-')));
  try {
    const writer = join(temp, 'writer'), reader = join(temp, 'reader'), root = join(temp, 'root');
    await checkout(writerCommit, writer); await checkout(readerCommit, reader); mkdirSync(root);
    const written = await run('write', writer, root);
    expect(written.status, written.stderr).toBe(0);

    // The build one back refuses the whole root, and names it as an effect whose turn is missing — the
    // misdiagnosis this unit replaces. Nothing is read: no status, no projection, no mutation.
    const refused = await run('read', reader, root);
    expect(refused.status).not.toBe(0);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toContain('preview journal: orphan effect');

    // The forward direction is unchanged: the newer build opens its own root and the conversation is intact.
    const opened = await run('read', current, root);
    expect(opened.status, opened.stderr).toBe(0);
    expect(JSON.parse(opened.stdout)).toEqual({ cursor: 2, turns: [1],
      answer: 'Sam keeps the cedar map in the green drawer.', forward: [] });
  } finally { rmSync(temp, { recursive: true, force: true }); }
}, 300000); // Three node subprocesses each carry their own 60 s bound; the test bound must exceed their sum under load.

it('opens a root last written by the live build (cint-L50) with this build, conversation intact', async () => {
  // sb-w4-rollback repair 3 (plan #578). The 2026-10-05 08:28 answer check refused on a copy of the live root
  // with "preview: bot identity refused": the startup getMe transport failed before Telegram answered (the copy's
  // sealed-capture folder was untouched), after this build had already opened the copied journal. This test is
  // the switch the desk suspected: the live build writes the root, and this build must read it.
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'rollback-live-')));
  try {
    const writer = join(temp, 'writer'), root = join(temp, 'root');
    await checkout('57e12273', writer); mkdirSync(root);
    const written = await run('write', writer, root);
    expect(written.status, written.stderr).toBe(0);
    const opened = await run('read', current, root);
    expect(opened.status, opened.stderr).toBe(0);
    expect(JSON.parse(opened.stdout)).toEqual({ cursor: 2, turns: [1],
      answer: 'Sam keeps the cedar map in the green drawer.', forward: [] });
  } finally { rmSync(temp, { recursive: true, force: true }); }
}, 300000);
