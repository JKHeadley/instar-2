// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY,
  validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { createJournalWorker, openPreviewJournal, previewTestContext } from './journal-test-worker.js';
import { activationMatchesJournal } from './journal.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { decisionWithinFloor } from './model-call-boundary.js';

// w3-renewal1012 option (b): a runner on the record ending at the predecessor's reviewed end (v5, 2026-10-05) with the
// governed record installed for renewal (v6, 2026-10-12) starts while the journal is at 10-05, the renewal is applied by
// the operator's yes, and from then on only v6 runs. Every launch is the real `run`; the model answers in the phone step
// are the REAL recorded answers (claude-sonnet-5, tests/preview/fixtures/operator-yes-live-2026-10-02.json, scenarios
// renew-ask and yes-applied).
const P = SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY, G = SUBSCRIPTION_PREVIEW_EXPIRY;
const NOW = P - 86_400_000;                                        // 2026-10-04T20:40Z, fixed: no assertion reads the host clock
const clock = `data:text/javascript,Date.now=()=>${String(NOW)}`;
const ASK = 'The trial ends tomorrow. Could you extend it so we can keep going?';
const PHONE = 'phone: the operator replies "yes" to the exact request in the bound chat';
const RENEWED = 'activation renewed: restart on the renewed record';
const recorded = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/preview/fixtures/operator-yes-live-2026-10-02.json'), 'utf8')).outputs;
const raw = (scenario: string) => recorded.find(item => item.scenario === scenario).raw;
/** What journal-agent's invokeSubscription hands the worker for a complete subscription result (as operator-yes-live). */
function livePort(output: string) {
  const extracted = parseModelJson(output, { wrapped: 'accept' });
  const decision = extracted.ok ? extracted.value : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete', failureClass: 'malformed', usage: { inputTokens: null, outputTokens: null, charge: null } }
    : { state: 'complete', text: value, usage: { inputTokens: null, outputTokens: null, charge: null } };
}

/** A journal at the predecessor end, v5/v6/other-end records under the fixture's sealed authority, the explicit-yes
 * installation, and the offline Telegram endpoint (long-poll, so a cycle bound spans real time). */
async function renewalWorld() {
  const world = successiveWorld(), root = join(world.directory, 'renewal-journal'), journalPath = join(root, 'journal.encrypted');
  const trial = world.state().read().trial, c = world.configuration;
  const v6 = world.activation(), v5 = { ...v6, expiresAt: P };
  const file = (name: string, value: unknown) => { const path = join(world.directory, name); writeFileSync(path, JSON.stringify(value)); return path; };
  const paths = { v5: file('activation-talk-v5.json', v5), v6: file('activation-talk-v6.json', v6),
    other: file('activation-talk-other.json', { ...v6, expiresAt: P + 86_400_000 }), profile: file('profile.json', offlineProfile),
    records: join(world.directory, 'operator-records'), updates: file('updates.json', []), log: join(world.directory, 'poll.log'),
    answers: file('answers.json', { [ASK]: raw('renew-ask'), yes: raw('yes-applied') }),
    installation: file('explicit-yes-installation.json', { type: 'ExplicitYesInstallation', schemaVersion: 1, installation: trial.id,
      adapter: 'telegram-bot-api', machine: 'Mac Studio', agentSpeaksAsOperatorInChat: false,
      chat: { method: 'telegram-sender', boundChatId: c.chatId, operatorAccountId: c.operatorSenderId, agentHoldsNoAccess: true }, github: null }) };
  openPreviewJournal(journalPath, OFFLINE_STORAGE_KEY, { kind: 'genesis', origin: 'test', bot: c.botId, chat: c.chatId,
    operator: c.operatorSenderId, grant: trial.id, configurationDigest: trial.configurationDigest, expires: P,
    maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 }).close();
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), paths.log, paths.updates, '', 'long-poll'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  const port = await new Promise((done, reject) => {
    endpoint.stdout.once('data', data => done(Number(String(data).trim())));
    endpoint.once('error', reject);
    endpoint.once('exit', code => reject(Error(`endpoint exited before listening: ${String(code)}`)));
  });
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
    INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder', INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    INSTAR_PREVIEW_SIMULATE_UNKNOWN_ANSWER: '1', INSTAR_PREVIEW_RECORDED_ANSWERS: paths.answers,
    INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${String(port)}` };
  const argv = (args: string[], loader: string) => ['--no-warnings', '--import', clock, '--loader', './scripts/slice-ts-loader.mjs',
    '--loader', loader, 'tests/preview/journal-agent.mjs', ...args];
  // The desk's option-(b) run line: the launch record, plus the renewal record and the explicit-yes options.
  const runArgs = (activation: string, cycles: number) => ['run', '--root', root, '--bot-id', c.botId, '--chat-id', c.chatId,
    '--operator-sender-id', c.operatorSenderId, '--grant-reference', trial.id, '--configuration-digest', trial.configurationDigest,
    '--expires-at', '2026-10-05T20:40:00Z', '--activation-record', activation, '--renewal-activation', paths.v6,
    '--explicit-yes-installation', paths.installation, '--operator-records', paths.records, '--login-profile', paths.profile,
    '--model', world.model, '--bot-username', c.botUsername, '--max-cycles', String(cycles), '--max-poll-seconds', '1'];
  const run = (activation: string) => spawnSync(process.execPath, argv(runArgs(activation, 1), './tests/preview/model-failure-loader.mjs'),
    { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env });
  const status = () => {
    const result = spawnSync(process.execPath, argv(['status', '--root', root, '--explicit-yes-installation', paths.installation,
      '--renewal-activation', paths.v6, '--login-profile', paths.profile, '--model', world.model, '--operator-records', paths.records],
    './tests/preview/model-failure-loader.mjs'), { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env });
    expect(result.status, result.stderr).toBe(0); return JSON.parse(result.stdout);
  };
  const lastExit = () => readFileSync(join(root, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
    .filter(row => row.exit !== undefined).at(-1);
  return { world, c, v6, root, journalPath, paths, env, argv, runArgs, run, status, lastExit, close: () => endpoint.kill('SIGTERM') };
}

it('before the renewal only the predecessor-end record starts; after it only the governed record does', async () => {
  const w = await renewalWorld(), { c, v6, paths } = w;
  try {
    // Each refusal differs from the success that follows in the activation path alone; the launcher suppresses the reason
    // (recorded with a local debug print: v6 "activation differs from journal", the other end "expired or clock differs").
    for (const refused of [paths.v6, paths.other]) expect(w.run(refused).status).toBe(1);
    const started = w.run(paths.v5);
    expect(started.status, started.stderr).toBe(0);
    expect(w.lastExit()).toMatchObject({ reason: 'cycle limit reached' });
    // The status branch with the same renewal options names the phone route (the request this runner proposes).
    const before = w.status();
    expect([before.expires, before.operatorActionSurface.renewExpiry]).toEqual([P, PHONE]);

    // The phone renewal through the worker's own proposal and admission, on the real recorded answers.
    const v6Digest = `sha256:${createHash('sha256').update(readFileSync(paths.v6, 'utf8'), 'utf8').digest('hex')}`;
    const journal = openPreviewJournal(w.journalPath, OFFLINE_STORAGE_KEY);
    let answer = raw('renew-ask'), next = 500;
    const worker = createJournalWorker(journal, { now: () => NOW, stopped: () => false, origin: 'test', checkOutbound: () => {},
      explicitYes: { context: previewTestContext, installation: JSON.parse(readFileSync(paths.installation, 'utf8')),
        // As journal-agent's renewalActivationOf: the renewal record validated as the runner validates it, at that end.
        renewalActivation: expires => { validateSubscriptionActivation(v6, offlineProfile, w.world.model, NOW, SUBSCRIPTION_CONVERSATION_FRAMING);
          return v6.expiresAt === expires && activationMatchesJournal(journal.view, v6, expires) ? v6Digest : null; } },
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The operator asked to extend the trial.', people: [] }) : livePort(answer),
      send: async () => { next += 1; return next; } });
    const say = async (update: number, messageId: number, text: string) => {
      worker.intake([{ update_id: update, message: { message_id: messageId, chat: { id: Number(c.chatId), type: 'private' },
        from: { id: Number(c.operatorSenderId) }, text, date: Math.floor(NOW / 1000) } }]);
      for (let pass = 0; pass < 3; pass++) await worker.drain();
    };
    await say(1, 100, ASK);
    expect(journal.view.operatorRequests.map(item => [item.request.action, item.request.expires])).toEqual([['renew-expiry', G]]);
    expect(journal.view.expires).toBe(P);
    answer = raw('yes-applied');
    await say(2, next + 1, 'yes');
    expect(journal.view.operatorRequests).toEqual([expect.objectContaining({ applied: true })]);
    expect(journal.view.expires).toBe(G);
    journal.close();

    // After the renewal the same v5 (and any other end) is refused before launch; v6 runs.
    // (Recorded reason for both: "subscription activation expired or clock differs".)
    for (const refused of [paths.v5, paths.other]) expect(w.run(refused).status).toBe(1);
    const renewed = w.run(paths.v6);
    expect(renewed.status, renewed.stderr).toBe(0);
    expect(w.lastExit()).toMatchObject({ reason: 'cycle limit reached' });
    const after = w.status();
    expect(after.expires).toBe(G);
    expect(after.operatorActionSurface.renewExpiry).not.toBe(PHONE);  // nothing later to renew to
  } finally { w.close(); }
}, 120_000);

it('one runner on v5 proposes the renewal, applies it on the operator\'s yes, and ends its cycle so the next launch takes v6', async () => {
  const w = await renewalWorld(), { c, paths } = w;
  try {
    const sends = () => existsSync(`${paths.log}.sends`) ? readFileSync(`${paths.log}.sends`, 'utf8') : '';
    const until = async (done: () => boolean, label: string) => {
      for (let waited = 0; !done(); waited += 100) {
        if (waited > 60_000) throw Error(`timed out waiting for ${label}`);
        await new Promise(next => setTimeout(next, 100));
      }
    };
    const update = (id: number, messageId: number, text: string, replyTo?: number) => ({ update_id: id, message: { message_id: messageId,
      chat: { id: Number(c.chatId), type: 'private' }, from: { id: Number(c.operatorSenderId) }, text, date: Math.floor(NOW / 1000),
      ...(replyTo === undefined ? {} : { reply_to_message: { message_id: replyTo } }) } });
    writeFileSync(paths.updates, JSON.stringify([update(1, 100, ASK)]));
    const child = spawn(process.execPath, w.argv(w.runArgs(paths.v5, 200), './tests/preview/recorded-answer-loader.mjs'),
      { cwd: process.cwd(), env: w.env, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', data => { stderr += String(data); });
    const exited = new Promise(done => child.once('exit', code => done(code)));
    try {
      // The runner answers the real recorded renew-ask output and puts the exact renewal request on its reply; the
      // request's message id is recorded once that send returns.
      const durable = () => openPreviewJournal(w.journalPath, OFFLINE_STORAGE_KEY, undefined, undefined, true).view;
      await until(() => /Request [0-9a-f]{16}: extend /u.test(sends()) && durable().operatorRequests.at(-1)?.message !== undefined,
        'the sent renewal request');
      const view = durable(), request = view.operatorRequests.at(-1);
      expect([request.request.action, request.request.expires, view.expires]).toEqual(['renew-expiry', G, P]);
      // The operator's plain yes, as a Telegram reply to the request message.
      writeFileSync(paths.updates, JSON.stringify([update(1, 100, ASK), update(2, request.message + 1000, 'yes', request.message)]));
      // Bounded: a yes that did not apply would leave the runner polling out its whole cycle bound.
      expect(await Promise.race([exited, new Promise(done => setTimeout(() => done('still running after 40 s'), 40_000))]), stderr).toBe(0);
    } finally { if (child.exitCode === null) child.kill('SIGTERM'); }
    // The runner applied the renewal itself, then ended its cycle instead of running on a record no call accepts.
    const after = openPreviewJournal(w.journalPath, OFFLINE_STORAGE_KEY, undefined, undefined, true).view;
    expect(after.expires).toBe(G);
    expect(after.operatorRequests).toEqual([expect.objectContaining({ applied: true })]);
    expect(w.lastExit()).toMatchObject({ reason: RENEWED });
    // The cycle ended before its drain: the operator's yes is kept, unanswered, for the renewed launch.
    const yesTurn = () => openPreviewJournal(w.journalPath, OFFLINE_STORAGE_KEY, undefined, undefined, true).view.order.find(turn => turn.text === 'yes');
    expect(yesTurn()).toMatchObject({ accepted: true });
    expect(yesTurn().answer).toBeUndefined();
    const sentBefore = sends().split('\n').filter(Boolean).length;
    // The relaunch the supervisor would make with v5 is refused; the desk's v6 line runs and answers the waiting yes
    // (with the real recorded yes-applied output).
    expect(w.run(paths.v5).status).toBe(1);
    const renewed = spawnSync(process.execPath, w.argv(w.runArgs(paths.v6, 20), './tests/preview/recorded-answer-loader.mjs'),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, env: w.env });
    expect(renewed.status, renewed.stderr).toBe(0);
    expect(w.lastExit()).toMatchObject({ reason: 'cycle limit reached' });
    expect(yesTurn().answer).toEqual(expect.any(String));
    expect(sends().split('\n').filter(Boolean).length).toBeGreaterThan(sentBefore);
  } finally { w.close(); }
}, 150_000);
