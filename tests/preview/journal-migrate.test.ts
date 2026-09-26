// @ts-nocheck -- offline old-root export/import integration fixture.
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OFFLINE_STORAGE_KEY, successiveWorld } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';

const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const migrate = (args, key) => spawnSync(process.execPath,
  ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-migrate.mjs', ...args],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
    encoding: 'utf8', timeout: 30000 });

it('exports an old stopped root once, preserves its bytes, imports transcript and uncertain fences, and rejects a live old poller', async () => {
  const world = successiveWorld();
  world.say('Remember the old first turn.'); world.answer('I remember the old first turn.');
  const composition = world.compose();
  try { await composition.run({ maxCycles: 3, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); }
  finally { composition.close(); }
  world.state().latchStop('operator');
  const old = world.root, output = join(world.directory, 'transfer.enc'), target = join(world.directory, 'journal-new');
  const files = ['preview-state.json', 'preview-stop.json', 'successive-state.json',
    '.successive/facts.encrypted', '.successive/captures.encrypted'].map(file => join(old, file));
  const before = files.map(hash);
  const exportArgs = ['export', '--old-root', old, '--export-file', output,
    '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
    '--operator-sender-id', world.configuration.operatorSenderId];
  const lease = join(old, '.successive', '.boot-lease');
  mkdirSync(lease); writeFileSync(join(lease, 'owner.json'), JSON.stringify({pid:process.pid}));
  expect(migrate(exportArgs, OFFLINE_STORAGE_KEY).status).not.toBe(0);
  expect(existsSync(output)).toBe(false);
  rmSync(lease, { recursive: true });
  expect(migrate(exportArgs, OFFLINE_STORAGE_KEY).status).toBe(0);
  expect(migrate(exportArgs, OFFLINE_STORAGE_KEY).status).not.toBe(0); // one use
  expect(files.map(hash)).toEqual(before);
  expect(readFileSync(output, 'utf8')).not.toContain('Remember the old first turn.');
  expect(migrate(['import', '--export-file', output, '--new-root', target], OFFLINE_STORAGE_KEY).status).toBe(0);
  expect(migrate(['import', '--export-file', output, '--new-root', target], OFFLINE_STORAGE_KEY).status).not.toBe(0);
  const journal = openPreviewJournal(join(target, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
  try {
    expect(journal.view.cursor).toBeGreaterThan(100);
    expect(journal.view.order[0]?.text).toBe('Remember the old first turn.');
    expect(journal.view.order[0]?.answer).toBe('I remember the old first turn.');
    expect(journal.view.calls).toBe(1);
    expect(journal.view.replies).toBe(1);
    expect(journal.view.sourceStop).toBe('operator');
  } finally { journal.close(); }
  expect(files.map(hash)).toEqual(before);
}, 120000);

it('keeps a sent-but-unconfirmed old reply fenced after import', async () => {
  const world = successiveWorld();
  world.say('Please answer once.'); world.answer('One answer.');
  const composition = world.compose({ telegramIO: physical => ({ invoke(request, credential) {
    const result = physical.invoke(request, credential);
    return request.method === 'sendMessage' ? {kind:'uncertain',limitation:'transport',stage:'fetch-failure'} : result;
  } }) });
  try { await composition.run({ maxCycles: 3, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); }
  finally { composition.close(); }
  world.state().latchStop('operator');
  const output = join(world.directory, 'uncertain.enc'), target = join(world.directory, 'journal-uncertain');
  expect(migrate(['export', '--old-root', world.root, '--export-file', output,
    '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
    '--operator-sender-id', world.configuration.operatorSenderId], OFFLINE_STORAGE_KEY).status).toBe(0);
  expect(migrate(['import', '--export-file', output, '--new-root', target], OFFLINE_STORAGE_KEY).status).toBe(0);
  const journal = openPreviewJournal(join(target, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
  try {
    expect(journal.view.order[0]?.intent).toContain('One answer.');
    expect(journal.view.order[0]?.sent).toBeUndefined();
  } finally { journal.close(); }
}, 120000);
