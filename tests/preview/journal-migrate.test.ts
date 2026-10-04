// @ts-nocheck -- offline old-root export/import integration fixture.
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OFFLINE_STORAGE_KEY, offlineProfile, successiveWorld } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';

const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const migrate = (args, key, extraEnv = {}) => spawnSync(process.execPath,
  ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-migrate.mjs', ...args],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex'), ...extraEnv },
    encoding: 'utf8', timeout: 30000 });
const keyEnv = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex') };
const status = target => spawnSync(process.execPath,
  ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', target],
  { cwd: process.cwd(), env: keyEnv, encoding: 'utf8', timeout: 10000 });
const launch = (world, target) => {
  const activation = world.activation(), directory = world.directory, dispatch = join(directory, 'dispatch.log');
  const activationPath = join(directory, 'activation.json'), profilePath = join(directory, 'profile.json');
  const ioPath = join(directory, 'io.mjs'), loaderPath = join(directory, 'loader.mjs');
  writeFileSync(activationPath, JSON.stringify(activation)); writeFileSync(profilePath, JSON.stringify(offlineProfile));
  writeFileSync(ioPath, `import { appendFileSync } from 'node:fs';
export { productionStorageIO, createSubscriptionProviderIO } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'scripts/production-boot-io.mjs')).href)};
export const createProductionTelegramIO = () => ({ invoke(input) {
  appendFileSync(${JSON.stringify(dispatch)}, input.method + '\\n');
  if (input.method === 'getMe') return { kind: 'identity', identity: { id: ${world.configuration.botId} } };
  if (input.method === 'getUpdates') return { kind: 'response', status: 200, bytes: '{"ok":true,"result":[]}' };
  throw Error('unexpected outbound dispatch');
} });`);
  writeFileSync(loaderPath, `export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-boot-io.mjs'))
    return { url: ${JSON.stringify(pathToFileURL(ioPath).href)}, shortCircuit: true };
  return next(specifier, context);
}`);
  const result = spawnSync(process.execPath,
    ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--loader', loaderPath,
      'tests/preview/journal-agent.mjs', 'run', '--root', target,
      '--bot-id', world.configuration.botId, '--bot-username', world.configuration.botUsername,
      '--chat-id', world.configuration.chatId, '--operator-sender-id', world.configuration.operatorSenderId,
      '--grant-reference', activation.trial, '--configuration-digest', activation.baseConfigurationDigest,
      '--expires-at', String(activation.expiresAt), '--tools', 'off', '--activation-record', activationPath, '--operator-records', join(directory, 'operator-records'),
      '--login-profile', profilePath, '--model', world.model, '--max-cycles', '1'],
    { cwd: process.cwd(), env: { ...keyEnv, INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
      encoding: 'utf8', timeout: 10000 });
  return { result, dispatches: existsSync(dispatch) ? readFileSync(dispatch, 'utf8') : '' };
};

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
  expect(migrate(['import', '--export-file', output, '--new-root', join(world.directory, 'second-journal')], OFFLINE_STORAGE_KEY).status).not.toBe(0);
  const completed = launch(world, target);
  expect(completed.result.status).toBe(0);
  expect(completed.dispatches).toBe('getMe\ngetUpdates\n');
  const journal = openPreviewJournal(join(target, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
  try {
    expect(journal.view.cursor).toBeGreaterThan(100);
    expect(journal.view.order[0]?.text).toBe('Remember the old first turn.');
    expect(journal.view.order[0]?.answer).toBe('I remember the old first turn.');
    // The imported message is a day-old owed review case, so the first launch may run one retrospective
    // pass (never a send: dispatches above are getMe/getUpdates only). It is the only other attempt.
    const reviewAttempts = journal.view.retroPasses.length + journal.view.retroPasses.flatMap(pass => pass.reruns ?? []).length;
    expect(reviewAttempts).toBeLessThanOrEqual(1);
    expect(journal.view.calls - reviewAttempts).toBe(1);
    expect(journal.view.replies).toBe(1);
    expect(journal.view.sourceStop).toBe('operator');
  } finally { journal.close(); }
  expect(files.map(hash)).toEqual(before);
}, 120000);

it('exports a real successor root whose state records no host notice', async () => {
  const world = successiveWorld();
  world.say('Question without a host notice.'); world.answer('Answer without a host notice.');
  const composition = world.compose();
  try { await composition.run({ maxCycles: 3, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); }
  finally { composition.close(); }
  world.state().latchStop('operator');
  // hostNotice is optional in preview state; a live successor root does not record it.
  const statePath = join(world.root, 'preview-state.json'), state = JSON.parse(readFileSync(statePath, 'utf8'));
  delete state.trial.hostNotice; writeFileSync(statePath, JSON.stringify(state));
  const output = join(world.directory, 'no-notice.enc');
  expect(migrate(['export', '--old-root', world.root, '--export-file', output,
    '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
    '--operator-sender-id', world.configuration.operatorSenderId], OFFLINE_STORAGE_KEY).status).toBe(0);
  expect(migrate(['import', '--export-file', output, '--new-root', join(world.directory, 'no-notice-journal')], OFFLINE_STORAGE_KEY).status).toBe(0);
}, 120000);

it.each(['before:genesis', 'after:answer'])('refuses an interrupted %s import with valid launch ports and zero dispatch', async cutAt => {
  const world = successiveWorld();
  world.say('Old question.'); world.answer('Old answer.');
  const composition = world.compose();
  try { await composition.run({ maxCycles: 3, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); }
  finally { composition.close(); }
  world.state().latchStop('operator');
  const output = join(world.directory, 'cut-transfer.enc'), target = join(world.directory, 'cut-journal');
  expect(migrate(['export', '--old-root', world.root, '--export-file', output,
    '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
    '--operator-sender-id', world.configuration.operatorSenderId], OFFLINE_STORAGE_KEY).status).toBe(0);
  const cut = migrate(['import', '--export-file', output, '--new-root', target], OFFLINE_STORAGE_KEY,
    { INSTAR_PREVIEW_IMPORT_KILL_AT: cutAt });
  expect(cut.signal).toBe('SIGKILL');
  if (cutAt === 'after:answer') {
    const journal = openPreviewJournal(join(target, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    try {
      expect(journal.view.cursor).toBe(0);
      expect(journal.view.imported).toBe(false);
      expect(journal.view.order[0]?.answer).toBe('Old answer.');
      expect(journal.view.order[0]?.intent).toBeUndefined();
    } finally { journal.close(); }
  } else expect(statSync(join(target, 'journal.encrypted')).size).toBe(0);
  const report = status(target);
  expect(report.status).toBe(0);
  expect(JSON.parse(report.stdout).importComplete).toBe(false);
  const refused = launch(world, target);
  expect(refused.result.status).not.toBe(0);
  expect(refused.dispatches).toBe('');
  if (cutAt === 'before:genesis') {
    const journalPath = join(target, 'journal.encrypted');
    rmSync(journalPath);
    expect(JSON.parse(status(target).stdout).importComplete).toBe(false);
    expect(launch(world, target).result.status).not.toBe(0);
    writeFileSync(journalPath, Buffer.from([0, 0, 0, 50, 1]));
    expect(JSON.parse(status(target).stdout).importComplete).toBe(false);
    expect(launch(world, target).result.status).not.toBe(0);
    expect(readFileSync(join(target, 'preview-import.json'), 'utf8')).toContain('sha256:');
    expect(existsSync(join(world.directory, 'dispatch.log'))).toBe(false);
  }
  expect(migrate(['import', '--export-file', output, '--new-root', join(world.directory, 'other-journal')], OFFLINE_STORAGE_KEY).status).not.toBe(0);
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
