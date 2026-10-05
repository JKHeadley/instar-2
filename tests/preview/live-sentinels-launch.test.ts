// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
// Live proof on a scratch root (plan #402): the real journal runner, its real loop and its real status command, against
// the offline Telegram endpoint. Each sentinel's trigger is recorded durably and its effect is read back from `status`.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY, FIXTURE_DOORWAY, PER_RULE_PASS } from './successive-fixture.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { createLiveSentinels } from './live-sentinels.js';
import { defaultPresenceConfig } from '../../src/sentinels/presence.js';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/held-reply-live-2026-09-27.json', import.meta.url), 'utf8'));

/** `episode`: a poll-failure episode carried from an earlier launch (that many failed polls in a row) and this launch's
 * cycle count. */
async function launch(sentinels?: string, promise = false, pollDown = false, episode = { carried: 0, cycles: 4 }) {
  const world = successiveWorld(), root = join(world.directory, 'sentinel-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  const chat = Number(world.configuration.chatId), operator = Number(world.configuration.operatorSenderId);
  const trial = world.state().read().trial;
  // A previous launch: the recorded live held turn (2026-09-27, its update id and text verbatim) arrived ten
  // minutes ago, was held because its reply check could not decide, and that launch's presence sentinel already
  // recorded its self-heal request three minutes ago. Real minutes are not waited out here; the durable record is.
  const live = recorded.held.find(item => item.cause === 'reply check unavailable');
  const now = Date.now(), heldAt = now - 10 * 60_000, healedAt = now - defaultPresenceConfig.healWindowMs - 60_000;
  let journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, { kind: 'genesis', origin: 'test',
    bot: world.configuration.botId, chat: world.configuration.chatId, operator: world.configuration.operatorSenderId,
    grant: trial.id, configurationDigest: trial.configurationDigest, expires: trial.expiresAt,
    maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  let clock = heldAt;
  const prior = createJournalWorker(journal, { origin: 'test', now: () => clock, stopped: () => false, model: async () => 'unused',
    send: async () => 1, checkOutbound: () => {} });
  prior.intake([{ update_id: live.update, message: { chat: { id: chat, type: 'private' }, from: { id: operator }, text: live.text } }]);
  const heldId = journal.view.order[0].id;
  journal.append({ kind: 'hold', id: heldId, reason: live.cause, at: clock });
  clock = healedAt;
  const earlier = createLiveSentinels(journal, { now: () => clock, stopped: () => false, startedAt: heldAt - 60_000,
    families: new Set(['presence']), reground: () => {}, recoverContext: () => {}, selfHeal: () => {}, actOnPromise: () => {} });
  expect(earlier.tick().effects).toEqual([{ family: 'presence', kind: 'self-heal', subject: heldId }]);
  let requestId = null;
  if (promise) {
    // That earlier launch also recorded a dated request from the operator, due two days ago and never answered.
    clock = now - 3 * 86_400_000;
    const asker = createJournalWorker(journal, { origin: 'test', now: () => clock, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async input => input.id.startsWith('summary:') ? JSON.stringify({ summary: 'x', people: [], memory: [], commitments: [], questions: [] })
        : JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: input.question, when: 'tomorrow at 9 am', remind: true }] }),
      send: async () => 1, checkOutbound: () => {} });
    asker.intake([{ update_id: live.update + 5, message: { chat: { id: chat, type: 'private' }, from: { id: operator },
      date: Math.floor(clock / 1000), text: 'remind me tomorrow at 9 am to water the seedlings' } }]);
    await asker.drain();
    requestId = journal.view.order.at(-1).id;
  }
  journal.close();
  if (episode.carried > 0) writeFileSync(join(root, 'runs.jsonl'), [JSON.stringify({ v: 1, launch: now - 1000, pid: 1 }),
    ...Array.from({ length: episode.carried }, (_, i) => JSON.stringify({ v: 1, launch: now - 1000, poll: 'failed', at: now - 1000 + i }))]
    .join('\n') + '\n');
  writeFileSync(updates, JSON.stringify([{ update_id: live.update + 10, message: { chat: { id: chat, type: 'private' },
    from: { id: operator }, text: 'What should I plant this week?' } }]));
  writeFileSync(provider, `export { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  validateSubscriptionActivation, SUBSCRIPTION_TOOLS_FRAMING, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
  subscriptionToolsPolicy } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'src/assembly/production-provider.ts')).href)};
${FIXTURE_DOORWAY}
${PER_RULE_PASS}
export const createClaudeCodeSubscriptionRoute = () => ({kind:'Success',value:{invoke:async prepared => {
  const binding=JSON.parse(JSON.parse(prepared).messages[1].content).bindings;
  const asked=JSON.parse(prepared).messages[0].content, review=asked.startsWith('Judge this proposed reply');
  const decision={type:'Decision',schemaVersion:1,id:'sentinel-answer',at:binding.at,by:binding.by,
    conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value:review
      ? perRulePass(asked,'The reply stays within the rules.') : 'Garlic and broad beans.',evidence:binding.evidence},
    reason:{subject:'question',predicate:'answered',value:true,evidence:binding.evidence},
    floor:{allowed:binding.floor,chosen:binding.floor.default}};
  return {state:'complete',bytes:JSON.stringify(decision),usage:{inputTokens:1,outputTokens:1}};
}}});
`);
  writeFileSync(loader, `export async function resolve(specifier,context,next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
    return {url:${JSON.stringify(pathToFileURL(provider).href)},shortCircuit:true};
  return next(specifier,context);
}\n`);
  // pollDown: every getUpdates answers 503 (an intake outage); every other method still answers normally.
  let endpointScript = join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs');
  if (pollDown) {
    const down = join(world.directory, 'poll-down-endpoint.mjs'), source = readFileSync(endpointScript, 'utf8');
    const marker = "response.setHeader('content-type', 'application/json');";
    expect(source).toContain(marker);
    writeFileSync(down, source.replace(marker, `if (method === 'getUpdates') response.statusCode = 503; ${marker}`));
    endpointScript = down;
  }
  const endpoint = spawn(process.execPath, [endpointScript, log, updates],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((done, fail) => {
      endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail);
    });
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: '', INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--loader', loader,
      'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile,
      '--model', world.model, '--bot-username', world.configuration.botUsername, '--max-cycles', String(episode.cycles), '--max-poll-seconds', '1',
      ...(sentinels === undefined ? [] : ['--sentinels', sentinels])], { cwd: process.cwd(), encoding: 'utf8', timeout: 70000, env });
    const runLog = readFileSync(join(root, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    expect(run.status, run.stderr + JSON.stringify(runLog.slice(-3))).toBe(0);
    const status = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
      'status', '--root', root, ...(sentinels === undefined ? [] : ['--sentinels', sentinels])],
      { cwd: process.cwd(), env, encoding: 'utf8', timeout: 20000 });
    expect(status.status, status.stderr).toBe(0);
    journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    const view = journal.view; journal.close();
    return { status: JSON.parse(status.stdout), view, heldId, requestId, sends: readFileSync(log, 'utf8').split('sendMessage').length - 1,
      sentTexts: readFileSync(log, 'utf8'), runLog };
  } finally { endpoint.kill('SIGTERM'); }
}

it('the real runner records each sentinel trigger and its effect, and status reads them back', async () => {
  const out = await launch();
  const live = out.status.liveSentinels;
  expect(live.enabled).toEqual(['context', 'presence', 'promise']);
  // Presence: the durable self-heal from the earlier launch plus this launch's tick made the holding note due. The
  // message then has exactly one truthful outcome, whichever lands first in the loop: its real answer (the ordinary
  // pass got to it); the minimal path's one fixed infrastructure note; or, where Part Eleven does not admit the minimal
  // path (this offline world has no accepted single-machine policy), no note and the outage recorded on the turn.
  const events = live.events.map(event => event.event), held = out.view.turns.get(out.heldId);
  expect(events).toContain('holding-note-due');
  expect(live.events.find(event => event.event === 'holding-note-due').subject).toBe(out.heldId);
  if (held.intent !== undefined) {
    expect(events).toContain('answered-after-note');
    expect(live.presence.holdingNoteDue).toEqual([]);
  } else if (held.limited) {
    expect(held.limited.reason).toBe('worker');
    expect(out.view.speakers.infrastructure).toBe(1);
    expect(live.presence.holdingNoteDue).toEqual([out.heldId]);
  } else {
    expect(held.minimalOutage.missing).toEqual(['installation-policy']);
    expect(out.view.speakers.infrastructure).toBe(0);
    expect(live.presence.holdingNoteDue).toEqual([out.heldId]);
  }
  // Context: this launch opened its respawn episode and the answered message on the current frontier verified it.
  expect(live.context.episode).toMatchObject({ kind: 'respawn', status: 'recovered' });
  expect(live.events.map(event => event.event)).toContain('grounding-verified');
  expect(live.recordedTicks.context).toBeGreaterThanOrEqual(1);
  expect(out.sends).toBeGreaterThanOrEqual(2);
}, 60000);

it('the off-switch keeps every sentinel out of the live loop', async () => {
  const out = await launch('none');
  expect(out.status.liveSentinels).toMatchObject({ enabled: [], recordedTicks: { context: 0, presence: 1, promise: 0 } });
  // Only the earlier launch's record exists; no note became due and none was sent for the held turn.
  expect(out.view.sentinels.counts).toEqual({ context: 0, presence: 1, promise: 0 });
  expect(out.view.turns.get(out.heldId).limited).toBeUndefined();
}, 60000);

it('the real runner acts on a dated promise past its instant and records it closing once answered', async () => {
  const out = await launch(undefined, true);
  const live = out.status.liveSentinels;
  const promiseEvents = live.events.filter(event => event.family === 'promise').map(event => event.event);
  expect(promiseEvents[0]).toBe('work-requested');
  // The requested owner step answered the request (a requested-action turn) and the promise left the open set.
  expect(out.view.order.some(turn => turn.requestedAction && !turn.requestedAction.legacy && turn.intent !== undefined)).toBe(true);
  expect(promiseEvents).toContain('closed');
  expect(live.recordedTicks.promise).toBeGreaterThanOrEqual(2);
}, 60000);

// Rule 93 (review finding, round 3): a due reminder never goes out ahead of intake. While every poll fails, a waiting
// operator message (a withdrawal included) cannot be read, so no reminder may be sent, with the promise sentinel on or off.
it.each(['none', 'promise'])('with --sentinels %s, a due reminder waits while polling fails', async family => {
  const out = await launch(family, true, true);
  expect(out.view.order.filter(turn => turn.requestedAction && turn.intent !== undefined)).toHaveLength(0);
  expect(out.sends).toBe(0);
  expect(out.sentTexts.split('\n').filter(Boolean)[1]).toBe('getUpdates');
  if (family === 'promise')
    expect(out.status.liveSentinels.events.some(event => event.family === 'promise' && event.event === 'work-requested')).toBe(true);
}, 60000);

// Plan #548, unit review MUST-FIX 1: a temporary Telegram server failure (here a 503 on every getUpdates) is an outage,
// not a refusal. Carried 19 failures in a row, the 20th (a 503) used to end the run with 'Telegram polling failed 20
// times in a row'; now the breaker stays open and the run goes on to its cycle limit, its due work unaffected. The
// healthy control: the same carried episode with a working poll records the restoration and ends normally.
it.each([[true, 'a 503 outage keeps the run going'], [false, 'a healthy poll restores the carried episode']])(
  'with a carried 19-failure episode, pollDown=%s: %s', async pollDown => {
    const out = await launch(undefined, false, pollDown, { carried: 19, cycles: 1 });
    const mine = out.runLog.filter(entry => entry.launch !== out.runLog[0].launch);
    const ended = mine.find(entry => entry.exit !== undefined);
    expect(ended?.reason).toBe('cycle limit reached');
    expect(out.runLog.some(entry => String(entry.reason ?? '').startsWith('Telegram polling failed'))).toBe(false);
    if (pollDown) {
      expect(mine.filter(entry => entry.poll === 'failed').length).toBeGreaterThanOrEqual(1);
      expect(mine.some(entry => entry.poll === 'restored')).toBe(false);
    } else expect(mine.some(entry => entry.poll === 'restored')).toBe(true);
  }, 90000);
