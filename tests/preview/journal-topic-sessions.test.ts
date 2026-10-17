import { currentActionFacts, approvalBase, validateSessionWorkRow } from './journal.js';
import { proposeOperatorRequest, operatorRequestText } from './operator-yes.js';
// @ts-expect-error the shipped admission checkpoint is JavaScript
import { createToolEffectOwner } from './admission-gate.mjs';
import type { SessionWorkEdge, SessionWorkEffect } from '../../src/assembly/production-session-work.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { afterEach, expect, it } from 'vitest';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';
import { encodeReply, wholeReplySent } from './reply-parts.js';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConversationTopicsPort } from '../../src/assembly/conversation-topics.js';
import type { ConversationTopicsState } from '../../src/assembly/conversation-topics.js';
import type { HarnessInputDelivery } from '../../src/assembly/contracts.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { nestedSessionWorkEdge, nestedSessionWorkClose } from '../../src/assembly/production-session-work.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';
import { readAnswer } from './answer-reading.js';
import { createJournalWorker, openPreviewJournal, REPLY_ACKNOWLEDGEMENT, ModelNotStarted, ModelDisclosureRefused, createModelLaunchBoundary,
  type PreviewPorts } from './journal-test-worker.js';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 1));
async function until(test: () => boolean) { for (let i = 0; i < 1000 && !test(); i++) await tick(); expect(test()).toBe(true); }
const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const actionFactsBody = source.split('currentActionFacts: async operation => ')[1]!.split(',\n          ...(handoff')[0]!;
const signature = 'async ({ id, prepared, question, context: packet }) => {';
const body = source.split(`      model: ${signature}`)[1]!.split('\n      summaryCheck:')[0]!.trimEnd().replace(/,$/u, '');
const topicOfBody = source.split('topicOf: operation => {')[1]!.split('\n          },')[0]!;
const update = (id: number, text: string, thread?: number) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    ...(thread === undefined ? {} : { message_thread_id: thread, is_topic_message: true }) } });
function fixture(forum = false, prepared = false, maxSessions = 2, timeZone = 'America/Los_Angeles') {
  const root = mkdtempSync(join(tmpdir(), 'topic-session-journal-')); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot: '12345678', chat: forum ? '-7654321' : '7654321', operator: '7654321', ...(forum ? { forum: true } : {}), grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 200, maxReplies: 30,
    maxTurns: 30, maxBytes: 262144, cursor: 0 });
  const topicOf = Function('journal', `return operation => {${topicOfBody}}`)(journal) as (operation: string) => string;
  let evidence: unknown = null, replyOverride: string | undefined, batchFailure: Error | undefined;
  let capacity = true, quota = true;
  let beforeFacts: (() => void) | undefined, verifiedAudience = true;
  let now = 1000, state: ConversationTopicsState | null = null, live = 0;
  const held = new Set<string>(), deliveries: { topic: string; input: HarnessInputDelivery }[] = [];
  const launches: string[] = [], sent: { text: string; thread: number | undefined; update: number }[] = [];
  const queuedAtDelivery: string[][] = [];
  const readFacts = Function('currentActionFacts', 'journal', 'wallNow', 'verifiedActionAudience', 'timeZoneOf', 'options',
    `return async operation => ${actionFactsBody}`)(currentActionFacts, journal, () => now, async () => verifiedAudience, () => timeZone, {}) as (operation: string) => Promise<string>;
  const port = value(createConversationTopicsPort({
    context: assemblyRuntimeFixture().c, conversation: 'operator', topicOf,
    allowanceDeadline: 9999999999999, authorized: () => true, currentAuthority: () => 'grant',
    prepareTurn: async () => quota,
    maxSessions, capacity: async () => ({ admit: capacity, memoryPressure: false }), idleMs: 500, deadlineMs: 2000, pollMs: 25, maxSteps: 3, maxCalls: 10, maxResultBytes: 65536,
    now: () => now, stopped: () => journal.view.stop !== null, parent: 'run', owner: 'machine', placement: 'local', transport: 'fake',
    workingScope: '/scope', resultDirectory: '/scope/results', artifact: 'artifact', incarnation: 'boot',
    store: { load: () => state, save: next => { state = structuredClone(next); } },
    append: record => journal.append({ kind: 'session-work', record, at: now }),
    recoveryEdges: () => journal.sessionWorkRecords(),
    currentActionFacts: async operation => { beforeFacts?.(); beforeFacts = undefined; return readFacts(operation); },
    resources: { admit: async () => { live++; return { attach: async () => {}, release: async () => { live--; return true; } }; } },
    io: { modelCalls: () => 0, wait: tick, readResult: () => null, clearResult: () => {},
      prepareAdmission: () => {}, closeAdmission: () => {}, admissionState: () => ({ refused: false, openDelegations: [] }) },
    createAdapter: topic => ({
      describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false }),
      launch: async input => { launches.push(topic); return { launch: `worker-${launches.length}`, claim: input.claim, incarnation: input.incarnation }; },
      deliver: async input => {
        expect(journal.view.turns.get(input.operation)?.reserved).toBe(true);
        port.reserveCall(input.claim, state!.topics[topic]!.claimCalls + 1);
        queuedAtDelivery.push(state!.topics[topic]!.inputs.filter(row => row.state === 'queued').map(row => row.request.operation));
        deliveries.push({ topic, input }); return { state: 'accepted', evidence: 'fake' };
      },
      observe: async input => {
        if (!input.delivery || held.has(topic)) return { observations: [], cursor: input.cursor, complete: true };
        const turn = journal.view.turns.get(input.delivery.operation)!;
        const answer = { reply: replyOverride ?? `Answer for topic ${topic}.`, memory: turn.text === 'Remember my sister is called Wren.'
          ? [{ mode: 'remember', source: turn.id, quote: 'my sister is called Wren' }] : [] };
        const ids = state!.topics[topic]!.inputs.find(row => row.request.operation === input.delivery!.operation)!.batch ?? [];
        const text = JSON.stringify(ids.length > 1 ? { results: ids.map(operation => ({ operation, answer })) } : answer);
        return { observations: [{ kind: 'reply', delivery: input.delivery.operation, text,
          digest: `sha256:${createHash('sha256').update(text).digest('hex')}` },
        { kind: 'turn-end', delivery: input.delivery.operation, state: 'completed' }], cursor: input.cursor + 2, complete: true };
      }, control: async () => ({ state: 'closed', evidence: 'fake' }),
    }),
  }));
  const model = Function('journal', 'requireGroupDisclosure', 'toolsActive', 'toolTurnEligible', 'invokeTools',
    'invokeSubscription', 'recordedUsage', 'ModelDisclosureRefused', 'modelLaunch', 'conversationSession',
    'sessionWork', 'ModelNotStarted', 'conversationSessionAnswer', 'readAnswer', 'recordShape', 'shapesPath', `return (${signature}${body});`)(journal,
    async () => {}, () => false, () => false, () => { throw Error('fallback'); }, () => { throw Error('fallback'); },
    (input: unknown) => input, ModelDisclosureRefused, createModelLaunchBoundary(), true, { port, authority: 'grant' },
    ModelNotStarted, conversationSessionAnswer, readAnswer, () => {}, '/unused') as PreviewPorts['model'];
  const batchBody = source.split('modelBatch: async inputs => {')[1]!.split('\n      } } : {}),')[0]!;
  const modelBatch = Function('journal', 'requireGroupDisclosure', 'sessionWork', 'ModelNotStarted',
    'conversationSessionAnswer', 'recordShape', 'shapesPath', `return async inputs => {${batchBody}}`)(journal,
    async () => {}, { port, authority: 'grant' }, ModelNotStarted, conversationSessionAnswer, () => {}, '/unused') as NonNullable<PreviewPorts['modelBatch']>;
  const collectModel: PreviewPorts['collectModel'] = async id => {
    const saved = await port.collect(id);
    return saved && { context: saved.request.context, prepared: saved.request.question,
      answer: conversationSessionAnswer(saved.outcome, id, () => {}) };
  };
  const worker = createJournalWorker(journal, { timeZone, topicConcurrency: maxSessions, groupDisclosure: async () => verifiedAudience, now: () => now, stopped: () => false, model, modelBatch: async inputs => { if (batchFailure) throw batchFailure; return modelBatch(inputs); }, collectModel,
    sources: () => evidence ? [evidence] : [],
    prepareModel: input => prepared ? prepareJournalEnvelope(input, 'offline-model', 'grant:offline', now, 262144) : JSON.stringify(input), checkOutbound: () => {},
    send: async input => {
      sent.push({ text: input.expectedText, thread: input.thread, update: input.update });
      expect(input.text).toBe(encodeReply(input.expectedText));
      return classifyTelegramSend({ kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result: {
        message_id: sent.length, chat: { id: Number(input.chat) }, text: input.expectedText.trimEnd(),
        ...(input.thread === undefined ? {} : { message_thread_id: input.thread }),
      } }) }, input);
    } });
  return { quota: (value: boolean) => { quota = value; }, capacity: (value: boolean) => { capacity = value; }, root, journal, worker, held, deliveries, launches, sent, port, queuedAtDelivery, live: () => live, state: () => state!,
    audience: (verified: boolean) => { verifiedAudience = verified; },
    beforeFacts: (run: () => void) => { beforeFacts = run; },
    failBatch: (error: Error | undefined) => { batchFailure = error; },
    evidence: (value: unknown) => { evidence = value; }, reply: (value: string) => { replyOverride = value; },
    advance: (ms: number) => { now += ms; }, close: async () => { await port.close(); journal.close(); } };
}

it('a newly arriving topic answers during another busy turn, routes its own reply, and shares agent memory', async () => {
  const f = fixture();
  try {
    f.worker.intake([update(1, 'My sister is called Wren.', 7)]); await f.worker.drain();
    f.held.add('7'); f.worker.intake([update(2, 'Take your time with this.', 7)]);
    const drain = f.worker.drain(); await until(() => f.deliveries.length === 2);
    f.worker.intake([update(3, 'What is my sister called?', 8)]);
    await until(() => f.sent.some(row => row.update === 3));
    expect(f.sent.find(row => row.update === 3)).toMatchObject({ thread: 8, text: 'Answer for topic 8.' });
    expect(f.sent.some(row => row.update === 2)).toBe(false);
    expect(f.launches).toEqual(['7', '8']); expect(f.live()).toBe(2);
    expect(f.deliveries.find(row => row.topic === '8')!.input.text).toContain('My sister is called Wren.');
    f.held.delete('7'); await drain;
    expect(f.sent.find(row => row.update === 2)?.thread).toBe(7);
    await f.worker.drain(); expect(f.sent).toHaveLength(3);
    expect(Object.values(f.state().topics).reduce((sum, row) => sum + row.spent, 0)).toBe(3);
  } finally { f.held.clear(); await f.close(); }
});

it('the general topic is one session and idle replacement retains its journal-grounded history', async () => {
  const f = fixture();
  try {
    f.worker.intake([update(1, 'The boat is at berth K4.')]); await f.worker.drain();
    f.advance(500); await f.port.maintain(); expect(f.live()).toBe(0);
    f.worker.intake([update(2, 'Where is the boat?')]); await f.worker.drain();
    expect(f.launches).toEqual(['main', 'main']);
    expect(f.deliveries[1]!.input.text).toContain('The boat is at berth K4.');
    expect(f.sent.map(row => row.thread)).toEqual([undefined, undefined]);
    expect(f.deliveries[1]!.input.claim).not.toBe(f.deliveries[0]!.input.claim);
    expect(() => Function('journal', `return operation => {${topicOfBody}}`)(f.journal)('missing')).toThrow(/durably admitted/);
  } finally { await f.close(); }
});

it('a forum topic grounds in its own history while recalling a fact learned in a different topic', async () => {
  const f = fixture(true);
  const forumUpdate = (id: number, text: string, thread: number) => ({ update_id: id,
    message: { message_id: id, message_thread_id: thread, chat: { id: -7654321, type: 'supergroup', is_forum: true }, from: { id: 7654321 }, text } });
  try {
    f.worker.intake([forumUpdate(1, 'Remember my sister is called Wren.', 7)]); await f.worker.drain();
    f.worker.intake([forumUpdate(2, 'This topic is about the boat.', 8)]); await f.worker.drain();
    f.worker.intake([forumUpdate(3, 'What is my sister called?', 8)]); await f.worker.drain();
    const packet = JSON.parse(f.state().topics['8']!.inputs[1]!.request.context);
    expect(packet.history).toHaveLength(1);
    expect(packet.history[0].user).toBe('This topic is about the boat.');
    expect(JSON.stringify(packet.memory)).toContain('my sister is called Wren');
    expect(f.deliveries[2]!.input.text).toContain('my sister is called Wren');
    expect(f.sent.map(row => row.thread)).toEqual([7, 8, 8]);
  } finally { await f.close(); }
});


it('the shipped journal host batches three messages arriving behind one busy turn and sends each once', async () => {
  const f = fixture();
  try {
    f.held.add('7'); f.worker.intake([update(1, 'First request.', 7)]);
    const drain = f.worker.drain(); await until(() => f.deliveries.length === 1);
    f.worker.intake([update(2, 'Second request.', 7), update(3, 'Third request.', 7), update(4, 'Fourth request.', 7)]);
    f.held.delete('7'); await drain;
    expect(f.deliveries).toHaveLength(2);
    expect(f.sent.map(row => row.update)).toEqual([1, 2, 3, 4]);
    expect(f.journal.view.order.every(turn => turn.sent !== undefined)).toBe(true);
    expect(f.state().topics['7']!.inputs.every(row => row.outcome?.state === 'complete')).toBe(true);
    await f.worker.drain(); expect(f.sent).toHaveLength(4); expect(f.deliveries).toHaveLength(2);
  } finally { f.held.clear(); await f.close(); }
});


const recordedBatchShapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string; source: unknown }[] };
it.each(recordedBatchShapes.otherShapes)('batch path preserves recorded $kind from $id and terminalizes each intake', async sample => {
  const f = fixture(false, true);
  try {
    f.evidence({ recordedShape: sample });
    f.beforeFacts(() => effectFor(f).observe());
    if (sample.kind === 'delivered-reply' || sample.kind === 'empty-reply-in-recorded-context') f.reply(sample.raw);
    f.worker.intake([update(1, 'Continue this conversation.', 7), update(2, 'And this next message.', 7)]);
    await f.worker.drain();
    expect(f.deliveries[0]!.input.text).toContain('exactly one {operation, answer}');
    expect(f.deliveries[0]!.input.text).toContain('CURRENT ACTION FACTS');
    expect(f.deliveries[0]!.input.text).toContain('mcp:mail:send');
    expect(f.deliveries[0]!.input.text).not.toContain('PRIVATE BODY');
    const text = f.deliveries[0]!.input.text;
    const members = JSON.parse(text.split('OWNER MESSAGE\n')[1]!.split('\n')[1]!) as { envelope: string; context?: string }[];
    expect(members).toHaveLength(2);
    members.forEach((member, index) => {
      expect(member.context).toBeUndefined();
      const request = f.state().topics['7']!.inputs[index]!.request;
      expect(member.envelope).toBe(request.question);
      expect(text.split(JSON.stringify(member.envelope).slice(1, -1))).toHaveLength(2);
      const envelope = JSON.parse(member.envelope);
      const content = JSON.parse(envelope.messages.find((m: { role: string }) => m.role === 'context').content);
      expect(content.packet).toEqual(JSON.parse(request.context));
    });
    expect(text).not.toContain('MEMORY AND OPEN WORK');
    expect(f.state().topics['7']!.inputs.every(input => input.request.context.includes(JSON.stringify(sample.raw)))).toBe(true);
    expect(f.journal.view.order.every(turn => turn.sent !== undefined)).toBe(true);
    expect(f.sent.every(row => row.text.trim().length > 0)).toBe(true);
    if (sample.kind === 'empty-reply-in-recorded-context')
      expect(f.journal.view.order.every(turn => turn.failureClass === 'empty')).toBe(true);
    const count = f.sent.length; await f.worker.drain(); expect(f.sent).toHaveLength(count);
  } finally { await f.close(); }
});

it.each([new ModelNotStarted(), new ModelDisclosureRefused()])('a definitely unstarted batch restores every unused reservation: %s', async error => {
  const f = fixture();
  try {
    f.failBatch(error); f.worker.intake([update(1, 'First waiting question', 7), update(2, 'Second waiting question', 7)]);
    await f.worker.drain();
    expect(f.deliveries).toHaveLength(0);
    expect(f.sent.every(row => row.text !== 'Answer for topic 7.')).toBe(true);
    expect(f.journal.view.order.every(turn => !turn.reserved)).toBe(true);
    expect(f.journal.view.calls).toBe(0);
    f.failBatch(undefined); await f.worker.drain();
    const expected = error instanceof ModelNotStarted ? 0 : 2;
    expect(f.sent.filter(row => row.text === 'Answer for topic 7.')).toHaveLength(expected);
    expect(f.deliveries).toHaveLength(expected);
    if (error instanceof ModelNotStarted) {
      expect(f.journal.view.order.every(turn => turn.held === 'model not started' && !turn.reserved)).toBe(true);
      expect(f.sent.length).toBeGreaterThan(0);
    } else expect(f.journal.view.order.every(turn => turn.sent)).toBe(true);
  } finally { await f.close(); }
});

// Four individually admitted packets reproduce the review's real journal envelope
// overflow. Smaller neighbors retain one batch; larger ones drain in ordered pieces.
it.each([20_000, 120_000, 210_000])('journal batches only a fitting prefix with %i bytes of retained evidence', async bytes => {
  const f = fixture();
  try {
    f.evidence({ retained: 'x'.repeat(bytes) });
    f.worker.intake([1, 2, 3, 4].map(id => update(id, `Question ${id}?`, 7)));
    await f.worker.drain();
    expect(f.sent.map(row => row.update)).toEqual([1, 2, 3, 4]);
    expect(f.sent.every(row => row.text === 'Answer for topic 7.')).toBe(true);
    expect(f.state().topics['7']!.inputs.every(row => row.outcome?.state === 'complete')).toBe(true);
    expect(f.deliveries.every(row => Buffer.byteLength(row.input.text) <= 1_048_576)).toBe(true);
    expect(f.state().topics['7']!.inputs.every(row => Buffer.byteLength(row.request.question) <= 262_144)).toBe(true);
    if (bytes <= 120_000) { expect(f.deliveries).toHaveLength(1); expect(f.queuedAtDelivery[0]).toEqual([]); }
    else { expect(f.deliveries).toHaveLength(2); expect(f.queuedAtDelivery[0]!.length).toBeGreaterThan(0); }
    if (bytes === 210_000) expect(f.deliveries.every(row => row.input.text.includes('exactly one {operation, answer}'))).toBe(true);
    const count = f.deliveries.length; await f.worker.drain();
    expect(f.sent).toHaveLength(4); expect(f.deliveries).toHaveLength(count);
  } finally { await f.close(); }
});

it('recovery reads the same process and child evidence after journal compaction and reopen', async () => {
  const f = fixture();
  try {
    f.worker.intake([update(1, 'First question', 7), update(2, 'Second question', 7)]);
    await f.worker.drain();
    const state = f.state().topics['7']!;
    const process = f.journal.sessionWorkRecords().find(row => row.type === 'SessionWorkEdge' && row.id === `${state.claim}:process`)!;
    if (process.type !== 'SessionWorkEdge') throw Error('missing process edge');
    const child = nestedSessionWorkEdge(process, { id: 'child-1', tool: 'Task' }, 1001);
    f.journal.append({ kind: 'session-work', record: child, at: 1001 });
    f.journal.append({ kind: 'session-work', record: nestedSessionWorkClose(child, 'complete', 'child result', 'receipt:child', 2, 1002), at: 1002 });
    const before = f.journal.sessionWorkRecords();
    f.journal.compact();
    expect(f.journal.sessionWorkRecords()).toEqual(before);
    const reopened = openPreviewJournal(join(f.root, 'journal.encrypted'), new Uint8Array(32).fill(61), undefined, undefined, true);
    try { expect(reopened.sessionWorkRecords()).toEqual(before); } finally { reopened.close(); }
  } finally { await f.close(); }
});


it('a long answer finishes with batched follow-ups waiting: all canonical parts are accepted once in order', async () => {
  const f = fixture();
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/receipt-match-c1-2026-10-14.json', import.meta.url), 'utf8')) as { answer: string };
  // The captured fitting answer, repeated solely to force the multi-part boundary.
  const long = recorded.answer.repeat(4) + ' \t\n';
  try {
    f.reply(long); f.held.add('7'); f.worker.intake([update(1, 'Give the detailed plan.', 7)]);
    const drain = f.worker.drain(); await until(() => f.deliveries.length === 1);
    f.worker.intake([update(2, 'And the next question.', 7), update(3, 'And another.', 7)]);
    expect(f.journal.view.order.slice(1).every(turn => turn.sent === undefined)).toBe(true);
    f.held.delete('7'); await drain;
    expect(f.deliveries).toHaveLength(2);
    expect(f.deliveries[1]!.input.text).toContain('exactly one {operation, answer}');
    for (const turn of f.journal.view.order) {
      expect(turn.answer).toBe(long);
      expect(turn.intent).toBe(long.trimEnd());
      expect(turn.replyParts!.length).toBeGreaterThan(0);
      expect(wholeReplySent(turn)).toBe(true);
    }
    expect(f.sent.every(row => row.text === row.text.trimEnd())).toBe(true);
    expect(f.sent.map(row => row.update)).toEqual([...f.sent.map(row => row.update)].sort((a, b) => a - b));
    const count = f.sent.length; await f.worker.drain(); expect(f.sent).toHaveLength(count);
  } finally { f.held.clear(); await f.close(); }
});

function effectFor(f: ReturnType<typeof fixture>, index = 0) {
  const owner = createToolEffectOwner({ decide: () => ({ admitted: true, consequential: true, reason: 'granted' }),
    append: (record: SessionWorkEffect) => f.journal.append({ kind: 'session-work', record, at: 1000 }),
    prepared: (id: string) => f.journal.view.toolEffects?.includes(id), stopped: () => false, now: () => 1000 });
  const parent = { id: 'topic-seven-edge', child: 'topic-seven-worker', topic: '7' } as SessionWorkEdge;
  const result = owner.admit({ parent, tool: 'mcp__mail__send', input: { to: 'private@example.test', body: `PRIVATE BODY ${index}` }, call: `call${index}` });
  expect(result.admitted).toBe(true);
  return { observe: () => owner.observed({ parent, ...result, resultBytes: 27 }) };
}

it('projects an existing outbound approval request from topic A into topic B before advising', async () => {
  const f = fixture();
  try {
    const id = 'telegram:12345678:update:1';
    f.worker.intake([update(1, 'PRIVATE request context', 7)]);
    f.journal.append({ kind: 'reserve', id, at: 1000 });
    f.journal.append({ kind: 'answer', id, text: 'I can ask.', operatorAction: { action: 'raise-caps' }, at: 1000 });
    const { maxCalls, maxReplies, maxTurns } = f.journal.view.limits;
    const current = { limits: { maxCalls, maxReplies, maxTurns }, expires: f.journal.view.expires };
    const proposed = proposeOperatorRequest({ ...current, used: { maxCalls: 1, maxReplies: 0, maxTurns: 1 },
      step: current.limits, governedExpiry: current.expires, unknownCalls: 0, stopped: false,
      grant: 'grant:preview', renewalActivation: null, base: approvalBase(f.journal.view) }, { action: 'raise-caps' }, id, 1000);
    expect(proposed.kind).toBe('request'); if (proposed.kind !== 'request') throw Error('proposal refused');
    f.journal.append({ kind: 'intent', id, text: operatorRequestText(proposed.request, current, null),
      chat: '7654321', thread: 7, update: 1, grant: 'grant:preview', operatorRequest: proposed.request, at: 1000 });
    f.journal.append({ kind: 'sent', id, message: 1, at: 1000 });
    f.worker.intake([update(2, 'What work is pending?', 8)]); await f.worker.drain();
    const facts = currentActionFacts(f.journal.view, 1000, true);
    expect(facts.items).toContainEqual(expect.objectContaining({ kind: 'operator-request', operation: 'raise-caps', topic: '7', state: 'awaiting approval' }));
    expect(f.journal.view.turns.get('telegram:12345678:update:2')!.prompt).toContain('awaiting approval');
    expect(f.deliveries.at(-1)!.input.text).toContain('awaiting approval');
    expect(JSON.stringify(facts)).not.toContain('PRIVATE');
    const state = f.journal.view.operatorRequests[0]!;
    const show = (patch: Partial<typeof state>, now = 1000) => currentActionFacts({ ...f.journal.view,
      operatorRequests: [{ ...state, ...patch }] }, now, true).items;
    const unsent = { ...state }; delete unsent.message;
    expect(currentActionFacts({ ...f.journal.view, operatorRequests: [unsent] }, 1000, true).items[0]!.state)
      .toBe('prepared, not delivered');
    expect(show({}, state.request.expiresAt)[0]!.state).toBe('awaiting approval');
    expect(show({}, state.request.expiresAt + 1)[0]!.state).toBe('expired');
    expect(show({ refusals: [{ turn: 'refusal', detail: 'PRIVATE reason' }] })[0]!.state).toBe('refused');
    const approved = { turn: 'yes', reference: 'ref', hash: 'hash', at: 1001 };
    expect(show({ approved })[0]!.state).toBe('approved, not applied');
    expect(show({ approved, applied: true })[0]!.state).toBe('applied');
    expect(show({ superseded: true })).toEqual([]);
  } finally { await f.close(); }
});

it('refreshes a running sibling with an effect appended after its packet was prepared', async () => {
  const f = fixture();
  try {
    f.worker.intake([update(1, 'First turn', 8)]); await f.worker.drain();
    let observed = false;
    f.beforeFacts(() => { effectFor(f).observe(); observed = true; });
    f.worker.intake([update(2, 'Next turn', 8)]); await f.worker.drain();
    expect(observed).toBe(true); expect(f.launches).toEqual(['8']);
    expect(f.journal.view.turns.get('telegram:12345678:update:2')!.prompt).not.toContain('mcp:mail:send');
    expect(f.deliveries.at(-1)!.input.text).toContain('mcp:mail:send');
    expect(f.deliveries.at(-1)!.input.text).toContain('tool returned, success not established');
    expect(f.deliveries.at(-1)!.input.text).not.toContain('PRIVATE BODY');
    expect(f.deliveries.at(-1)!.input.text).not.toContain('private@example.test');
  } finally { await f.close(); }
});

it('bounds the projection, retains journal evidence on reopen, and withholds unverified audiences', async () => {
  const f = fixture();
  try {
    for (let i = 0; i < 80; i++) effectFor(f, i).observe();
    const facts = currentActionFacts(f.journal.view, 1000, true);
    expect(facts.items).toHaveLength(32);
    expect(f.journal.view.actionEffects).toHaveLength(64);
    expect(Buffer.byteLength(JSON.stringify(facts))).toBeLessThan(32768);
    expect(currentActionFacts(f.journal.view, 1000, false)).toEqual({ items: [], withheld: true });
    const reread = openPreviewJournal(join(f.root, 'journal.encrypted'), new Uint8Array(32).fill(61));
    try { expect(currentActionFacts(reread.view, 1000, true)).toEqual(facts); expect(reread.view.toolEffects).toHaveLength(80); }
    finally { reread.close(); }
  } finally { await f.close(); }
});

it('refreshes action facts with recorded canary 969390374 reply and reviewer evidence in the prepared envelope', async () => {
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/canary9-review-2026-10-11.json', import.meta.url), 'utf8'));
  const f = fixture(false, true);
  try {
    f.evidence({ recorded }); f.reply(recorded.answer);
    f.beforeFacts(() => effectFor(f).observe());
    f.worker.intake([update(1, recorded.text, 8)]); await f.worker.drain();
    const delivered = f.deliveries[0]!.input.text;
    expect(delivered).toContain('CURRENT ACTION FACTS'); expect(delivered).toContain('mcp:mail:send');
    expect(f.state().topics['8']!.inputs[0]!.request.context).toContain(JSON.stringify(recorded.answer));
    expect(f.journal.view.order[0]!.sent).toBeDefined();
  } finally { await f.close(); }
});

it('the wired dispatch reader withholds cross-topic action facts for an unverified forum audience', async () => {
  const f = fixture(true);
  try {
    effectFor(f).observe(); f.audience(false);
    const incoming = { update_id: 1, message: { message_id: 1, message_thread_id: 8,
      chat: { id: -7654321, type: 'supergroup', is_forum: true }, from: { id: 7654321 }, text: 'Hello' } };
    f.worker.intake([incoming]); await f.worker.drain();
    expect(f.deliveries).toHaveLength(1);
    expect(f.deliveries[0]!.input.text).not.toContain('mcp:mail:send');
    expect(f.deliveries[0]!.input.text).toContain('withheld');
  } finally { await f.close(); }
});

it('validates optional effect provenance without inventing it for legacy records', () => {
  const record: SessionWorkEffect = { type: 'SessionWorkEffect', schemaVersion: 1, id: `sha256:${'a'.repeat(64)}`,
    edge: 'edge', operation: 'mcp:mail:send', digest: 'digest', detail: 'admitted', state: 'prepared', at: 1000 };
  expect(() => validateSessionWorkRow(record)).not.toThrow();
  const metadata = { topic: '7', source: `sha256:${'b'.repeat(64)}`, subject: `sha256:${'c'.repeat(64)}` };
  expect(() => validateSessionWorkRow({ ...record, ...metadata })).not.toThrow();
  for (const patch of [{ topic: 'private topic name' }, { topic: 7 }, { source: 'private source' }, { subject: 'PRIVATE body' }])
    expect(() => validateSessionWorkRow({ ...record, ...metadata, ...patch } as SessionWorkEffect)).toThrow('effect incomplete');
});

function siblingUpdate(f: ReturnType<typeof fixture>, id: number, text: string, thread: number) {
  const incoming = update(id, text, thread);
  return f.journal.view.genesis.forum ? { ...incoming, message: { ...incoming.message,
    chat: { id: -7654321, type: 'supergroup', is_forum: true } } } : incoming;
}

function siblingReply(f: ReturnType<typeof fixture>, updateId: number, text: string, thread = 7, promise = false, receipt = true, fulfills?: number[]) {
  const id = `telegram:12345678:update:${updateId}`, at = 1000 + updateId;
  f.worker.intake([siblingUpdate(f, updateId, 'PRIVATE operator words from sibling', thread)]);
  const loops = promise ? [{ kind: 'promise' as const, quote: text, waitsOn: 'external' as const }] : undefined;
  f.journal.append({ kind: 'reserve', id, at });
  f.journal.append({ kind: 'answer', id, text, ...(loops ? { loops } : {}), at });
  f.journal.append({ kind: 'intent', id, text, chat: f.journal.view.genesis.chat, thread, update: updateId, grant: 'grant:preview',
    ...(loops ? { loops, promises: [{ quote: text, action: 'promised', owner: 'agent', waitsOn: 'next-relevant-reply' }] } : {}), ...(fulfills ? { fulfills } : {}), at });
  if (receipt) f.journal.append({ kind: 'sent', id, message: updateId, at });
  return id;
}

it('refreshes sibling words at dispatch, excludes operator text and the current topic, and replays receipts', async () => {
  const f = fixture(true, true);
  try {
    f.worker.intake([siblingUpdate(f, 1, 'Hello', 8)]); await f.worker.drain();
    siblingReply(f, 3, 'I will hold the restart until 5 pm.', 7, true, false);
    const prior = f.journal.view.order.at(-1)!;
    f.beforeFacts(() => f.journal.append({ kind: 'sent', id: prior.id, message: 3, at: 1003 }));
    f.worker.intake([siblingUpdate(f, 2, 'What about the restart?', 8)]); await f.worker.drain();
    const delivered = f.deliveries.at(-1)!.input.text;
    expect(delivered).toContain('I will hold the restart until 5 pm.');
    expect(delivered).not.toContain('PRIVATE operator words');
    expect(f.journal.view.turns.get('telegram:12345678:update:2')!.prompt).not.toContain('I will hold the restart');
    const words = currentActionFacts(f.journal.view, 2000, true, '8').siblingWords!;
    expect(words.items).toContainEqual(expect.objectContaining({ kind: 'promise', topic: '7', ownWords: expect.stringContaining('when I said it: 1969-12-31 16:00 PST (reply delivery); operator input received:'), state: 'open' }));
    expect(words.items.every(item => item.topic !== '8')).toBe(true);
    expect(currentActionFacts(f.journal.view, 2000, false, '8')).toEqual({ items: [], withheld: true });
    const reread = openPreviewJournal(join(f.root, 'journal.encrypted'), new Uint8Array(32).fill(61));
    try { expect(currentActionFacts(reread.view, 2000, true, '8').siblingWords).toEqual(words); }
    finally { reread.close(); }
    // Existing lifecycle owns closure; projection never infers completion from a statement.
    siblingReply(f, 4, 'The restart was held until 5 pm.', 7, false, true, [0]);
    expect(currentActionFacts(f.journal.view, 2000, true, '8').siblingWords!.items)
      .toContainEqual(expect.objectContaining({ kind: 'promise', state: 'closed' }));
  } finally { await f.close(); }
});

it.each([['America/Los_Angeles', '1969-12-31 16:00 PST'], ['UTC', '1970-01-01 00:00 UTC']])(
  'the shipped dispatch reader uses configured zone %s', async (zone, expected) => {
    const f = fixture(true, true, 2, zone);
    try {
      siblingReply(f, 1, 'The restart is on hold.', 7);
      f.worker.intake([siblingUpdate(f, 2, 'What about the restart?', 8)]); await f.worker.drain();
      const refreshed = JSON.parse(f.deliveries.at(-1)!.input.text.split('CURRENT ACTION FACTS')[1]!.split('\n')[1]!);
      expect(refreshed.siblingWords.items[0].ownWords).toContain(`when I said it: ${expected} (reply delivery); operator input received:`);
    } finally { await f.close(); }
  });

it('bounds sibling excerpts, keeps newest first, scrubs secrets and forgetting, and excludes unknown receipts', async () => {
  const f = fixture();
  try {
    for (let n = 1; n <= 20; n++) siblingReply(f, n, `Advice ${n}: ` + 'a'.repeat(400), 7, n < 4);
    const latest = f.journal.view.order.at(-1)!;
    const words = currentActionFacts(f.journal.view, 2000, true, '8').siblingWords!;
    expect(words.items.filter(item => item.kind === 'statement')).toHaveLength(12);
    expect(words.items[0]!.source).toBe(latest.id);
    expect(words.items.every(item => JSON.parse(item.ownWords.split('; my words: ')[1]!).length <= 240)).toBe(true);
    expect(words.omitted).toBeGreaterThan(0);
    expect(Buffer.byteLength(JSON.stringify(currentActionFacts(f.journal.view, 2000, true, '8')))).toBeLessThan(32768);
    for (const turn of f.journal.view.order) turn.sentAt = 1000;
    expect(currentActionFacts(f.journal.view, 2000, true, '8').siblingWords!.items[0]!.source).toBe(latest.id);
    const grouped = f.journal.view.order[0]!;
    grouped.groupedInto = f.journal.view.order[1]!.id;
    expect(currentActionFacts(f.journal.view, 2000, true, '8').siblingWords!.items)
      .toContainEqual(expect.objectContaining({ kind: 'promise', source: grouped.id, state: 'open' }));
    latest.intent = 'Authorization: Bearer sk-test-abcdefghijklmnopqrstuvwxyz123456789';
    expect(JSON.stringify(currentActionFacts(f.journal.view, 2000, true, '8'))).not.toContain('sk-test-abcdefghijklmnopqrstuvwxyz123456789');
    f.journal.view.memory.push({ mode: 'forget', source: latest.id, quote: latest.intent, trigger: latest.id });
    expect(currentActionFacts(f.journal.view, 2000, true, '8').siblingWords!.items[0]!.ownWords).toContain('withheld');
    delete latest.sent;
    expect(currentActionFacts(f.journal.view, 2000, true, '8').siblingWords!.items.some(item => item.source === latest.id)).toBe(false);
  } finally { await f.close(); }
});

it.each(recordedBatchShapes.otherShapes)('refreshes sibling words with recorded $kind $id', async sample => {
  const f = fixture(true, true);
  try {
    siblingReply(f, 1, 'I will hold the restart until 5 pm.', 7, true);
    f.evidence({ recordedShape: sample });
    if (sample.kind === 'delivered-reply' || sample.kind === 'empty-reply-in-recorded-context') f.reply(sample.raw);
    f.worker.intake([siblingUpdate(f, 2, 'What about the restart?', 8)]); await f.worker.drain();
    const delivery = f.deliveries.at(-1)!.input.text;
    expect(delivery).toContain('I will hold the restart until 5 pm.');
    expect(delivery).toContain('siblingWords');
    expect(delivery).toContain('when I said it: 1969-12-31 16:00 PST (reply delivery); operator input received:');
    expect(delivery).toContain('1969-12-31 16:00 PST');
    expect(delivery).not.toContain('PRIVATE operator words');
    expect(f.state().topics['8']!.inputs[0]!.request.context).toContain(JSON.stringify(sample.raw));
    expect(f.journal.view.order.at(-1)!.sent).toBeDefined();
  } finally { await f.close(); }
});

it('four journal topics dispatch concurrently and each sends exactly one reply to its own topic', async () => {
  const f = fixture(false, false, 8);
  try {
    for (const topic of ['7', '8', '9', '10']) f.held.add(topic);
    f.worker.intake([7, 8, 9, 10].map(topic => update(topic, `Question in ${topic}`, topic)));
    const drain = f.worker.drain(); await until(() => f.deliveries.length === 4);
    expect(f.live()).toBe(4); f.held.clear(); await drain;
    expect(f.sent.map(row => row.thread).sort()).toEqual([10, 7, 8, 9]);
    await f.worker.drain(); expect(f.sent).toHaveLength(4);
  } finally { f.held.clear(); await f.close(); }
});

it.each(['capacity', 'quota'] as const)('%s wait sends an honest acknowledgement, then collects one answer when available', async cause => {
  const f = fixture(false, false, 8);
  try {
    f[cause](false); f.worker.intake([update(1, 'Please answer when you can.', 7)]);
    await f.worker.drain(); expect(f.deliveries).toHaveLength(0);
    expect(f.state().topics['7']!.inputs[0]!.state).toBe('queued');
    expect(f.journal.view.order[0]!.reserved).toBe(true);
    f.advance(7000); await f.worker.drain();
    expect(f.sent.map(row => row.text)).toEqual([REPLY_ACKNOWLEDGEMENT]);
    f[cause](true); await f.port.maintain(); await f.worker.drain(); await f.worker.drain();
    expect(f.sent).toHaveLength(2); expect(f.sent.every(row => row.thread === 7)).toBe(true);
    expect(f.deliveries).toHaveLength(1);
  } finally { await f.close(); }
});
