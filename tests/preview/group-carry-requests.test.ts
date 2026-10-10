// Execution ownership of the operator's open dated requests moves from the private root to the group root exactly
// once (Rules 52, 57, 93): the predecessor records the transfer first and never fires them again, including when it
// is resumed for rollback; the group fires each once, can withdraw it, and holds it while disclosure fails.
import { afterEach, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { appendGroupCarry, validCarriedMemory } from './group-carry.js';
import { createJournalWorker, GROUP_DISCLOSURE_HOLD, GROUP_DISCLOSURE_HOLD_NOTICE, openPreviewJournal, openRequests, ModelDisclosureRefused, createModelLaunchBoundary, type JournalRecord } from './journal-test-worker.js';
import { key, scope, permissionFor } from './group-carry-fixture.js';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const start = Date.UTC(2026, 9, 10, 17); // Saturday 2026-10-10 10:00 in Los Angeles.
const friday9 = Date.UTC(2026, 9, 16, 16); // Friday 2026-10-16 09:00 in Los Angeles.
const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.operator, operator: scope.operator,
  grant: 'TEST-request-transfer', configurationDigest: 'sha256:test', expires: Date.UTC(2026, 9, 30),
  maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 409600, cursor: 0 };
const priya = 'remind me Friday at 9 am to call Priya';
const header = `You asked on 2026-10-10 10:01: "${priya}" (due 2026-10-16 09:00 America/Los_Angeles)`;
const update = (id: number, text: string, forum = false) => ({ update_id: id, message: { message_id: id,
  chat: { id: Number(forum ? scope.chat : scope.operator), type: forum ? 'supergroup' : 'private', ...(forum ? { is_forum: true } : {}) },
  from: { id: Number(scope.operator) }, text, date: Math.floor(start / 1000) + id * 60 } });
type Input = { id: string; question: string; context: string };
/** The model stand-in reads the packet as the real answer contract asks (journal-requested-action.test.ts). */
const decide = (input: Input) => {
  if (input.id.startsWith('requested-action:')) return `Doing what you asked: ${[...input.question.matchAll(/\] (.+)$/gmu)].map(m => m[1]).join(' / ')}.`;
  const request = /^remind me (.+?) to /u.exec(input.question);
  if (request) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: input.question, when: request[1]!, remind: true }] });
  const cancel = /^cancel the (\w+) reminder/u.exec(input.question);
  if (cancel) {
    const listed = (JSON.parse(input.context) as { reminders?: { id: string; quote: string }[] }).reminders ?? [];
    return JSON.stringify({ reply: 'Okay.', memory: [], dated: [], cancelReminders: listed
      .filter(item => item.quote.includes(cancel[1]!)).map(item => ({ id: item.id, quote: cancel[0]! })) });
  }
  return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
};
const ports = (state: { now: number; allowed?: boolean; due: number; sent: { text: string; thread?: number }[] }, group = false) => ({
  now: () => state.now, stopped: () => false, timeZone: 'America/Los_Angeles', checkOutbound: () => {},
  ...(group ? { groupDisclosure: async () => state.allowed !== false } : {}),
  model: async (input: Input) => { if (input.id.startsWith('requested-action:')) state.due++; return decide(input); },
  send: async (value: { expectedText: string; thread?: number }) => {
    state.sent.push({ text: value.expectedText, ...(value.thread === undefined ? {} : { thread: value.thread }) });
    return state.sent.length;
  } });
const permission = () => { const p = permissionFor(scope); if (p.kind !== 'resolved') throw Error(p.reason); return p; };
const pushes = (sent: readonly { text: string }[]) => sent.filter(item => item.text.startsWith('You asked on')).map(item => item.text);

async function world(unsettledLater = false) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'group-carry-requests-'))); dirs.push(dir);
  const path = join(dir, 'private.encrypted'), target = join(dir, 'group.encrypted');
  const state = { now: start, due: 0, sent: [] as { text: string; thread?: number }[] };
  const writer = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(writer, ports(state));
  worker.intake([update(1, priya)]); await worker.drain();
  // A later private message whose answer never came: it may have withdrawn the request.
  if (unsettledLater) worker.intake([update(2, 'Actually, cancel the Priya one.')]);
  expect(writer.view.dated).toMatchObject([{ day: '2026-10-16', time: '09:00', remind: true }]);
  writer.close();
  const source = openPreviewJournal(path, key);
  const destination = openPreviewJournal(target, key, { ...genesis, chat: scope.chat, forum: true });
  return { path, target, source, destination };
}

it('moves execution once: the predecessor records the transfer first and never fires it, even resumed for rollback', async () => {
  const w = await world(), before = readFileSync(w.path), carriedAt = start + 3600_000;
  // Control: the same private root without the carry does fire this request at its due time.
  const control = join(dirs.at(-1)!, 'control.encrypted'); copyFileSync(w.path, control);
  const controlJournal = openPreviewJournal(control, key), fired = { now: friday9, due: 0, sent: [] as { text: string }[] };
  await createJournalWorker(controlJournal, ports(fired)).sendRequested(); controlJournal.close();
  expect(pushes(fired.sent)).toEqual([`${header}\nDoing what you asked: ${priya}.`]);
  expect(openRequests(w.source.view).map(item => item.quote)).toEqual([priya]);
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), true, carriedAt, () => false)).toBe('carried');
  // Predecessor: every earlier byte kept, one transfer record, nothing left for it to fire.
  const after = readFileSync(w.path);
  expect(after.subarray(0, before.length)).toEqual(before); expect(after.length).toBeGreaterThan(before.length);
  expect(openRequests(w.source.view)).toEqual([]);
  expect(w.source.view.requestTransfer).toMatchObject({ destinationRoot: scope.destinationRoot, chat: scope.chat,
    requests: [{ quote: priya, when: 'Friday at 9 am' }] });
  // Destination: now the one owner of a live, withdrawable request.
  expect(openRequests(w.destination.view).map(item => item.quote)).toEqual([priya]);
  expect(w.destination.view.groupCarry!.requests).toHaveLength(1);
  expect(w.destination.view.groupCarry!.entries.some(e => e.kind === 'reminder')).toBe(false);
  const sizes = [readFileSync(w.path).length, w.destination.size];
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), true, carriedAt, () => false)).toBe('already-carried');
  expect([readFileSync(w.path).length, w.destination.size]).toEqual(sizes);
  w.source.close();

  const group = { now: friday9 - 60_000, due: 0, sent: [] as { text: string; thread?: number }[] };
  let destination = w.destination, worker = createJournalWorker(destination, ports(group, true));
  await worker.sendRequested();
  expect(group.sent).toEqual([]); // not yet due: no turn, no call.
  group.now = friday9; await worker.sendRequested();
  expect(pushes(group.sent)).toEqual([`${header}\nDoing what you asked: ${priya}.`]);
  expect(group.sent[0]!.thread).toBeUndefined(); // the forum's General topic.
  expect(group.due).toBe(1);
  expect(openRequests(destination.view)).toEqual([]);

  // Rollback: the private root resumed on its own at the due time sends nothing, before and after compaction.
  for (const compact of [false, true]) {
    const predecessor = openPreviewJournal(w.path, key);
    if (compact) predecessor.compact();
    const rollback = { now: friday9 + 60_000, due: 0, sent: [] as { text: string; thread?: number }[] };
    const resumed = createJournalWorker(predecessor, ports(rollback));
    await resumed.sendRequested(); await resumed.drain();
    expect(rollback.sent).toEqual([]); expect(rollback.due).toBe(0);
    expect(predecessor.view.order.some(turn => turn.requestedAction)).toBe(false);
    predecessor.close();
  }
  // The destination never fires it twice, across compaction and restart.
  destination.compact(); destination.close();
  destination = openPreviewJournal(w.target, key); worker = createJournalWorker(destination, ports(group, true));
  group.now = friday9 + 3600_000; await worker.sendRequested(); await worker.drain();
  expect(pushes(group.sent)).toHaveLength(1); expect(group.due).toBe(1);
  destination.close();
});

it('a crash between the two records leaves the request owned by neither; re-running completes it, never a second owner', async () => {
  const w = await world();
  const ref = { source: w.source.view.dated[0]!.source, quote: priya, when: 'Friday at 9 am' };
  w.source.append({ kind: 'request-transfer', destinationRoot: scope.destinationRoot, chat: scope.chat, requests: [ref], at: start + 60_000 });
  expect(openRequests(w.source.view)).toEqual([]); expect(openRequests(w.destination.view)).toEqual([]);
  expect(() => w.source.append({ kind: 'request-transfer', destinationRoot: scope.destinationRoot, chat: scope.chat,
    requests: [], at: start + 61_000 })).toThrow(/request transfer refused/u);
  // A different group root cannot claim the already-moved requests.
  const other = { ...scope, destinationRoot: '/test/other-group' };
  const otherGroup = openPreviewJournal(join(dirs.at(-1)!, 'other.encrypted'), key, { ...genesis, chat: scope.chat, forum: true });
  const p = permissionFor(other); if (p.kind !== 'resolved') throw Error(p.reason);
  expect(() => appendGroupCarry(otherGroup, w.source, other, p, true, start + 62_000, () => false)).toThrow(/another root/u);
  expect(otherGroup.view.groupCarry).toBeUndefined(); otherGroup.close();
  const size = readFileSync(w.path).length;
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 120_000, () => false)).toBe('carried');
  expect(readFileSync(w.path).length).toBe(size); // the recorded transfer is reused, not written again.
  expect(openRequests(w.destination.view).map(item => item.quote)).toEqual([priya]);
  w.source.close(); w.destination.close();
});

it('the operator withdraws a carried request from the group, and it then never fires', async () => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 3600_000, () => false); w.source.close();
  const group = { now: start + 7200_000, due: 0, sent: [] as { text: string; thread?: number }[] };
  const worker = createJournalWorker(w.destination, ports(group, true));
  worker.intake([update(100, 'cancel the Priya reminder please', true)]); await worker.drain();
  expect(openRequests(w.destination.view)).toEqual([]);
  expect(group.sent.at(-1)!.text).toContain(`Cancelled request: "${priya}"`);
  group.now = friday9; await worker.sendRequested();
  expect(pushes(group.sent)).toEqual([]); expect(group.due).toBe(0);
  w.destination.close();
});

it('holds a due carried request while disclosure is refused, tells the operator once with fixed content-free words, then fires it once', async () => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 3600_000, () => false); w.source.close();
  const group = { now: friday9, allowed: false, due: 0, sent: [] as { text: string; thread?: number }[] };
  const worker = createJournalWorker(w.destination, ports(group, true));
  await worker.sendRequested();
  const due = w.destination.view.order.find(turn => turn.requestedAction)!;
  expect(due.held).toBe(GROUP_DISCLOSURE_HOLD); expect(due.reserved).toBe(false);
  expect(group.due).toBe(0); expect(group.sent).toEqual([]);
  group.now = friday9 + 5 * 60_000; await worker.sendRequested();
  expect(group.sent).toEqual([]); // inside the self-heal window: nothing pushed yet (Rule 88).
  group.now = friday9 + 11 * 60_000; await worker.sendRequested();
  expect(group.sent).toEqual([{ text: GROUP_DISCLOSURE_HOLD_NOTICE }]);
  expect(GROUP_DISCLOSURE_HOLD_NOTICE).not.toMatch(/priya|friday|call|remind/iu);
  group.now = friday9 + 30 * 60_000; await worker.sendRequested();
  expect(group.sent).toHaveLength(1); // one notice per window (Rule 52).
  expect(group.due).toBe(0);
  group.allowed = true; group.now = friday9 + 40 * 60_000; await worker.sendRequested();
  expect(pushes(group.sent)).toEqual([`${header}\nDoing what you asked: ${priya}.`]);
  expect(group.due).toBe(1);
  group.now = friday9 + 120 * 60_000; await worker.sendRequested(); await worker.drain();
  expect(pushes(group.sent)).toHaveLength(1); expect(group.sent).toHaveLength(2);
  w.destination.close();
});

it('a request a later unsettled private message may have withdrawn stays with the predecessor; the group gets it only as context', async () => {
  const w = await world(true), before = readFileSync(w.path);
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 3600_000, () => false)).toBe('carried');
  expect(readFileSync(w.path)).toEqual(before);
  expect(w.source.view.requestTransfer).toBeUndefined();
  expect(openRequests(w.source.view).map(item => item.quote)).toEqual([priya]);
  expect(openRequests(w.destination.view)).toEqual([]);
  expect(w.destination.view.groupCarry!.requests).toEqual([]);
  expect(w.destination.view.groupCarry!.entries.filter(e => e.kind === 'reminder').map(e => JSON.parse(e.text).quote)).toEqual([priya]);
  w.source.close(); w.destination.close();
});

// SYNTHETIC control, not recorded evidence: no real empty delivered bubble has been captured (desk ruling 2026-10-09
// 22:05 for w4-credname-answer2). A carried request whose due answer comes back empty never sends an empty message
// and is never answered a second time.
it('a carried due request whose model answer is empty sends no empty bubble and is never repeated (synthetic control)', async () => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 3600_000, () => false); w.source.close();
  const group = { now: friday9, due: 0, sent: [] as { text: string; thread?: number }[] };
  const base = ports(group, true);
  const worker = createJournalWorker(w.destination, { ...base, model: async (input: Input) =>
    input.id.startsWith('requested-action:') ? (group.due++, '') : decide(input) });
  await worker.sendRequested();
  group.now = friday9 + 3600_000; await worker.sendRequested(); await worker.drain();
  expect(group.sent.every(item => item.text.replace(/^PREVIEW — /u, '').trim().length > 0)).toBe(true);
  expect(pushes(group.sent)).toEqual([`${header}\nI could not produce an answer to this. Ask me again if you still want it.`]);
  expect(group.due).toBe(1);
  expect(w.destination.view.order.filter(turn => turn.requestedAction)).toHaveLength(1);
  expect(openRequests(w.destination.view)).toEqual([]);
  w.destination.close();
});

it.each([['before-model', false], ['before-model', true], ['before-send', false], ['before-send', true]] as const)('recovers disclosure lost %s (read failure: %s) without losing or repeating the carried request', async (boundary, readFailure) => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 3600_000, () => false); w.source.close();
  const group = { now: friday9, due: 0, sent: [] as { text: string; thread?: number }[] };
  let reads = 0, restored = false;
  const base = ports(group, true);
  const bound = { ...base, groupDisclosure: async () => {
    // Bind the send-side loss to the completed model call, not the number of admission reads.
    const allowed = restored || (boundary === 'before-model' ? ++reads < 2 : group.due === 0);
    if (!allowed && readFailure) throw Error('membership read unavailable');
    return allowed;
  } };
  await createJournalWorker(w.destination, bound).sendRequested();
  const due = w.destination.view.order.find(turn => turn.requestedAction)!;
  expect(due.held).toBe(GROUP_DISCLOSURE_HOLD);
  expect(due.reserved).toBe(boundary === 'before-send');
  expect(due.intent).toBeUndefined();
  expect(group.due).toBe(boundary === 'before-send' ? 1 : 0);
  expect(group.sent).toEqual([]);
  expect(openRequests(w.destination.view)).toHaveLength(1);
  expect(w.destination.view.tokenTotals.answer.unknownCalls).toBe(boundary === 'before-model' ? 0 : 1);
  w.destination.compact(); w.destination.close();
  const resumed = openPreviewJournal(w.target, key);
  restored = true;
  const worker = createJournalWorker(resumed, bound);
  await worker.sendRequested(); await worker.sendRequested();
  expect(group.due).toBe(1);
  expect(pushes(group.sent)).toEqual([`${header}\nDoing what you asked: ${priya}.`]);
  expect(openRequests(resumed.view)).toEqual([]);
  resumed.close();
});

it.each(['model', 'send'] as const)('does not repeat a genuinely uncertain %s after disclosure returns', async boundary => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 3600_000, () => false); w.source.close();
  const group = { now: friday9, due: 0, sent: [] as { text: string }[] };
  const base = ports(group, true);
  let models = 0, sends = 0;
  const bound = { ...base, model: async (input: Input) => {
    models++; if (boundary === 'model') throw Error('provider outcome unknown'); return base.model(input);
  }, send: async () => { sends++; throw Error('transport outcome unknown'); } };
  const worker = createJournalWorker(w.destination, bound);
  await worker.sendRequested(); await worker.sendRequested();
  w.destination.compact(); w.destination.close();
  const resumed = openPreviewJournal(w.target, key);
  await createJournalWorker(resumed, bound).sendRequested();
  expect(models).toBe(1); expect(sends).toBe(boundary === 'send' ? 1 : 0);
  resumed.close();
});

it('forgetting carried request text cannot silently cancel the owned request', async () => {
  const w = await world();
  const source = w.source.view.order[0]!.id;
  appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 3600_000, () => false); w.source.close();
  const group = { now: start + 7200_000, due: 0, sent: [] as { text: string }[] };
  const worker = createJournalWorker(w.destination, { ...ports(group, true), model: async () => JSON.stringify({
    reply: 'Okay.', memory: [{ mode: 'forget', source, quote: priya }], dated: [] }) });
  worker.intake([update(100, `I want you to forget this phrase: ${priya}`, true)]); await worker.drain();
  expect(w.destination.view.memory).toEqual([]);
  expect(openRequests(w.destination.view).map(item => item.quote)).toEqual([priya]);
  expect(w.destination.view.order.at(-1)!.memoryPending).toBeUndefined();
  expect(group.sent).toHaveLength(1);
  w.destination.close();
});

// Round-two reproduction uses the shipped host bodies with only external dependencies substituted.
const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const modelCode = host.split('      model: async ({ id, prepared }) => {')[1]!.split('\n      summaryCheck:')[0]!;
const modelFunction = 'async ({ id, prepared }) => {' + modelCode.trimEnd().replace(/,$/, '');
const sendCode = host.split('      send: async ({ text, expectedText, chat, thread, replyMarkup, target, provenance, admit }) => {')[1]!.split('\n    if (existsSync(stopPath))')[0]!;
const sendFunction = 'async ({ text, expectedText, chat, thread, replyMarkup, target, provenance, admit }) => {' + sendCode.slice(0, sendCode.lastIndexOf(' });'));

it.each([['model', false], ['subscription', false], ['send', false], ['model', true], ['subscription', true], ['send', true]] as const)('exact shipped %s boundary recovers recorded answer after disclosure loss (authorized control: %s)', async (boundary, initiallyAdmitted) => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 3600_000, () => false); w.source.close();
  let activeJournal = w.destination;
  const journalProxy = new Proxy(w.destination, { get: (_target, prop) => Reflect.get(activeJournal, prop) });
  const modelLaunch = createModelLaunchBoundary();
  let restored = initiallyAdmitted, providerCalls = 0, networkSends = 0;
  const requireAt = (which: string) => async () => {
    if (!restored && boundary === which) throw Error('group carry: disclosure grant or operator-only audience refused');
  };
  const subscriptionCode = host.split('    const callSubscription = async ')[1]!.split('    const callJev =')[0]!.trim().replace(/;$/, '');
  const recorded = (JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as { rows: JournalRecord[] })
    .rows.find((row): row is Extract<JournalRecord, { kind: 'answer' }> => row.kind === 'answer' && row.id.endsWith(':715672480'))!;
  const subscription = Function('journal', 'requireGroupDisclosure', 'ModelDisclosureRefused', 'assertLiveJudgment', 'shared',
    'modelRoute', 'performance', 'required', 'options', 'recordModelCall', `return (async ${subscriptionCode});`)(
    journalProxy, requireAt('subscription'), ModelDisclosureRefused, () => {}, null,
    () => ({ invoke: async () => { modelLaunch.started(); providerCalls++; return { state: 'complete', bytes: recorded.text }; } }),
    { now: () => 0 }, () => 'fixture', {}, () => {});
  const model = Function('journal', 'requireGroupDisclosure', 'toolsActive', 'toolTurnEligible', 'invokeTools', 'invokeSubscription', 'recordedUsage', 'ModelDisclosureRefused', 'modelLaunch', `return (${modelFunction});`)(
    journalProxy, requireAt('model'), () => false, () => false, () => { throw Error('unused'); },
    async (prepared: string, id: string) => { const result = await subscription('answer', prepared, id, {}); return { state: result.state, value: result.bytes }; },
    (x: unknown) => x, ModelDisclosureRefused, modelLaunch);
  let claims = 0;
  const shared = { admit: async () => {
    expect(activeJournal.view.order.find(t => t.requestedAction)?.intent).toBeDefined(); claims++; return null;
  }, outcome: async () => {} };
  const send = Function('journal', 'workerStop', 'existsSync', 'stopPath', 'wallNow', 'ownerHeld', 'shared', 'GROUP_DISCLOSURE_HOLD_NOTICE', 'requireGroupDisclosure', 'physical', 'secretRef', 'token', 'classifyTelegramSend', 'g', `return (${sendFunction});`)(
    journalProxy, { value: false }, () => false, '/test/stop', () => friday9, () => true, shared,
    GROUP_DISCLOSURE_HOLD_NOTICE, requireAt('send'), { invoke: () => { expect(claims).toBe(1); networkSends++; return {}; } },
    (x: string) => x, () => 'TEST', () => ({ kind: 'accepted', message: 1 }), w.destination.view.genesis);
  const bindings = { now: () => friday9, stopped: () => false, timeZone: 'America/Los_Angeles',
    ...(host.includes('      sendAdmits: true,') ? { sendAdmits: true as const } : {}), checkOutbound: () => {}, groupDisclosure: async () => true, prepareModel: (input: Input) => JSON.stringify({ messages: [{ role: 'context', content: input.context }, { role: 'user', content: input.question }] }), model, send };
  await createJournalWorker(w.destination, bindings).sendRequested();
  await createJournalWorker(w.destination, bindings).sendRequested();
  const before = w.destination.view.order.find(t => t.requestedAction)!;
  if (!initiallyAdmitted) {
    expect(before.held).toBe(GROUP_DISCLOSURE_HOLD);
    expect(before.reserved).toBe(boundary === 'send');
    expect(before.intent).toBeUndefined();
    expect(providerCalls).toBe(boundary === 'send' ? 1 : 0);
    expect(networkSends).toBe(0); expect(claims).toBe(0);
    expect(openRequests(w.destination.view)).toHaveLength(1);
    if (boundary !== 'send') {
      expect(w.destination.view.calls).toBe(0);
      expect(w.destination.view.tokenTotals.answer.unknownCalls).toBe(0);
      expect(w.destination.view.tokenTotals.answer.inputTokens).toBe(0);
      expect(() => w.destination.append({ kind: 'hold', id: before.id, reason: GROUP_DISCLOSURE_HOLD,
        unusedModel: { corrections: [] }, at: friday9 })).toThrow('unused model reservation order');
    }
  }
  w.destination.close();
  const rawReplay = openPreviewJournal(w.target, key);
  expect(rawReplay.view.order.find(t => t.requestedAction)?.reserved).toBe(before.reserved);
  expect(rawReplay.view.calls).toBe(w.destination.view.calls);
  rawReplay.compact(); rawReplay.close();
  const resumed = openPreviewJournal(w.target, key); activeJournal = resumed; restored = true;
  const recovery = createJournalWorker(resumed, bindings);
  await recovery.sendRequested(); await recovery.sendRequested();
  expect(openRequests(resumed.view)).toEqual([]);
  expect(resumed.view.order.find(t => t.requestedAction)?.intent).toContain(recorded.text);
  resumed.close();
  expect(providerCalls).toBe(1);
  expect(networkSends).toBe(1);
});

it('the shipped model wrapper never releases an invocation that already reached a provider before a later disclosure refusal', async () => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, start + 3600_000, () => false); w.source.close();
  let calls = 0;
  const model = Function('journal', 'requireGroupDisclosure', 'toolsActive', 'toolTurnEligible', 'invokeTools',
    'ModelDisclosureRefused', 'modelLaunch', `return (${modelFunction});`)(w.destination, async () => {}, () => true, () => true,
    async () => { calls++; w.destination.view.modelCalls.total++; throw new ModelDisclosureRefused(); }, ModelDisclosureRefused, createModelLaunchBoundary());
  const bindings = { now: () => friday9, stopped: () => false, groupDisclosure: async () => true, checkOutbound: () => {},
    prepareModel: () => '{}', model, send: async () => { throw Error('must not send'); } };
  const worker = createJournalWorker(w.destination, bindings);
  await worker.sendRequested(); await worker.sendRequested();
  const turn = w.destination.view.order.find(t => t.requestedAction)!;
  expect(calls).toBe(1); expect(turn.reserved).toBe(true); expect(turn.held).not.toBe(GROUP_DISCLOSURE_HOLD);
  expect(w.destination.view.tokenTotals.answer.unknownCalls).toBe(1);
  w.destination.close();
});

it('carries a daily series after dispatch without repeating that day, then resumes and cancels it in the group', async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'group-carry-recurring-'))); dirs.push(dir);
  const source = openPreviewJournal(join(dir, 'private.encrypted'), key, genesis);
  const target = join(dir, 'group.encrypted');
  let destination = openPreviewJournal(target, key, { ...genesis, chat: scope.chat, forum: true });
  const request = 'remind me every day at 11 am to call Priya';
  const privateState = { now: start, due: 0, sent: [] as { text: string }[] };
  const privateWorker = createJournalWorker(source, ports(privateState));
  privateWorker.intake([update(1, request)]); await privateWorker.drain();
  privateState.now = start + 3600_000; await privateWorker.sendRequested();
  expect(pushes(privateState.sent)).toHaveLength(1);
  expect(appendGroupCarry(destination, source, scope, permission(), true, privateState.now, () => false)).toBe('carried');
  expect(destination.view.groupCarry!.requests[0]!.item).toMatchObject({ recurrence: 'daily', day: '2026-10-11' });
  for (const recurrence of ['daily', 'weekdays', 'monthly'] as const) {
    const { digest: _digest, ...body } = structuredClone(destination.view.groupCarry!);
    Object.assign(body.requests[0]!.item, { recurrence });
    const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    expect(validCarriedMemory({ ...body, digest })).toBe(recurrence !== 'monthly');
  }
  expect(openRequests(source.view)).toEqual([]);
  const group = { now: privateState.now, due: 0, sent: [] as { text: string }[] };
  await createJournalWorker(destination, ports(group, true)).sendRequested();
  expect(pushes(group.sent)).toEqual([]);
  destination.close(); destination = openPreviewJournal(target, key);
  let worker = createJournalWorker(destination, ports(group, true));
  group.now += 86400_000; privateState.now = group.now;
  await privateWorker.sendRequested(); await worker.sendRequested(); await worker.sendRequested();
  expect(pushes(privateState.sent)).toHaveLength(1);
  expect(pushes(group.sent)).toHaveLength(1);
  expect(pushes(group.sent)[0]).toContain('due 2026-10-11 11:00 America/Los_Angeles');
  destination.close(); destination = openPreviewJournal(target, key);
  worker = createJournalWorker(destination, ports(group, true));
  group.now += 86400_000; await worker.sendRequested();
  expect(pushes(group.sent)).toHaveLength(2);
  worker.intake([update(100, 'cancel the Priya reminder please', true)]); await worker.drain();
  expect(openRequests(destination.view)).toEqual([]);
  group.now += 86400_000; await worker.sendRequested();
  expect(pushes(group.sent)).toHaveLength(2);
  source.close(); destination.close();
});
