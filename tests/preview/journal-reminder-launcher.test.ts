// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

// The request was due an hour ago; the cancellation (if any) is already waiting in Telegram when the launcher
// starts. No provider runs: the model-failure route answers every model call UNKNOWN, so the cancellation stays
// unsettled and a due turn can only send its truthful loss line under the reason header.
it.each([
  ['a queued cancellation', ['cancel']],
  ['a cancellation behind a benign update', ['benign', 'cancel']],
  ['an empty queue', []],
])('reads %s before answering an overdue requested action', async (_name, queued) => {
  const world = successiveWorld(), root = join(world.directory, 'reminder-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  const trial = world.state().read().trial;
  const due = Math.floor(Date.now() / 3600_000) * 3600_000 - 3600_000, start = due - 3 * 3600_000;
  const part = (type: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    .formatToParts(due).find(item => item.type === type)!.value;
  const when = `${part('month')} ${part('day')} at ${part('hour')}:00 ${part('dayPeriod').toLowerCase()}`;
  const request = `remind me ${when} to call Priya`;
  const chat = Number(world.configuration.chatId), operator = Number(world.configuration.operatorSenderId);
  const update = (id: number, text: string, from = operator) => ({ update_id: id,
    message: { chat: { id: chat, type: 'private' }, from: { id: from }, text, date: Math.floor(start / 1000) + id * 60 } });
  let journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, { kind: 'genesis', origin: 'test',
    bot: world.configuration.botId, chat: world.configuration.chatId, operator: world.configuration.operatorSenderId,
    grant: trial.id, configurationDigest: trial.configurationDigest, expires: trial.expiresAt,
    maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const worker = createJournalWorker(journal, { now: () => start, stopped: () => false, timeZone: 'America/Los_Angeles', origin: 'test',
    checkOutbound: () => {}, send: async () => 100,
    model: async () => JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: request, when, remind: true }] }) });
  worker.intake([update(1, request)]); await worker.drain();
  expect(journal.view.dated).toMatchObject([{ remind: true }]);
  journal.close();
  writeFileSync(updates, JSON.stringify(queued.map((kind, index) => kind === 'cancel'
    ? update(index + 2, 'cancel the Priya reminder') : update(index + 2, 'hello from someone else', operator + 1))));
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim())));
      endpoint.once('error', reject);
      endpoint.once('exit', code => reject(Error(`endpoint exited before listening: ${String(code)}`)));
    });
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      '--loader', './tests/preview/model-failure-loader.mjs', 'tests/preview/journal-agent.mjs', 'run', '--root', root,
      '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile, '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', String(queued.length + 2), '--max-poll-seconds', '1'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env: { ...process.env,
        INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
        INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder',
        INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        INSTAR_PREVIEW_SIMULATE_UNKNOWN_ANSWER: '1', INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` } });
    expect(run.status, run.stderr).toBe(0);
    const sends = existsSync(`${log}.sends`) ? readFileSync(`${log}.sends`, 'utf8') : '';
    journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    const due = journal.view.order.filter(turn => turn.requestedAction);
    if (queued.includes('cancel')) {
      // The queued cancellation was read first; its UNKNOWN answer leaves it unsettled, so no due turn was created.
      expect(sends).not.toContain('PREVIEW — You asked on');
      expect(journal.view.order.find(turn => turn.text === 'cancel the Priya reminder')?.modelState).toBe('uncertain');
      expect(due).toEqual([]);
    } else {
      expect(sends.match(/You asked on/gu)).toHaveLength(1);
      expect(sends).toContain('call Priya');
      expect(sends).toContain("I lost my answer to this: the model call's outcome is unknown");
      expect(due).toHaveLength(1);
    }
    journal.close();
  } finally { endpoint.kill('SIGTERM'); }
}, 30000);
