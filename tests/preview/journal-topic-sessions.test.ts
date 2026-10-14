import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConversationTopicsPort } from '../../src/assembly/conversation-topics.js';
import type { ConversationTopicsState } from '../../src/assembly/conversation-topics.js';
import type { HarnessInputDelivery } from '../../src/assembly/contracts.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';
import { readAnswer } from './answer-reading.js';
import { createJournalWorker, openPreviewJournal, ModelNotStarted, ModelDisclosureRefused, createModelLaunchBoundary,
  type PreviewPorts } from './journal-test-worker.js';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 1));
async function until(test: () => boolean) { for (let i = 0; i < 1000 && !test(); i++) await tick(); expect(test()).toBe(true); }
const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const signature = 'async ({ id, prepared, question, context: packet }) => {';
const body = source.split(`      model: ${signature}`)[1]!.split('\n      summaryCheck:')[0]!.trimEnd().replace(/,$/u, '');
const topicOfBody = source.split('topicOf: operation => {')[1]!.split('\n          },')[0]!;
const update = (id: number, text: string, thread?: number) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    ...(thread === undefined ? {} : { message_thread_id: thread, is_topic_message: true }) } });
function fixture(forum = false) {
  const root = mkdtempSync(join(tmpdir(), 'topic-session-journal-')); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot: '12345678', chat: forum ? '-7654321' : '7654321', operator: '7654321', ...(forum ? { forum: true } : {}), grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 200, maxReplies: 30,
    maxTurns: 30, maxBytes: 262144, cursor: 0 });
  const topicOf = Function('journal', `return operation => {${topicOfBody}}`)(journal) as (operation: string) => string;
  let evidence: unknown = null, replyOverride: string | undefined, batchFailure: Error | undefined;
  let now = 1000, state: ConversationTopicsState | null = null, live = 0;
  const held = new Set<string>(), deliveries: { topic: string; input: HarnessInputDelivery }[] = [];
  const launches: string[] = [], sent: { text: string; thread: number | undefined; update: number }[] = [];
  const port = value(createConversationTopicsPort({
    context: assemblyRuntimeFixture().c, conversation: 'operator', topicOf,
    allowanceDeadline: 9999999999999, authorized: () => true, currentAuthority: () => 'grant',
    maxSessions: 2, idleMs: 500, deadlineMs: 2000, pollMs: 25, maxSteps: 3, maxCalls: 10, maxResultBytes: 65536,
    now: () => now, stopped: () => journal.view.stop !== null, parent: 'run', owner: 'machine', placement: 'local', transport: 'fake',
    workingScope: '/scope', resultDirectory: '/scope/results', artifact: 'artifact', incarnation: 'boot',
    store: { load: () => state, save: next => { state = structuredClone(next); } },
    append: record => journal.append({ kind: 'session-work', record, at: now }),
    resources: { admit: async () => { live++; return { attach: async () => {}, release: async () => { live--; return true; } }; } },
    io: { modelCalls: () => 0, wait: tick, readResult: () => null, clearResult: () => {},
      prepareAdmission: () => {}, closeAdmission: () => {}, admissionState: () => ({ refused: false, openDelegations: [] }) },
    createAdapter: topic => ({
      describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false }),
      launch: async input => { launches.push(topic); return { launch: `worker-${launches.length}`, claim: input.claim, incarnation: input.incarnation }; },
      deliver: async input => {
        expect(journal.view.turns.get(input.operation)?.reserved).toBe(true);
        port.reserveCall(input.claim, state!.topics[topic]!.claimCalls + 1);
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
  const worker = createJournalWorker(journal, { topicConcurrency: 2, groupDisclosure: async () => true, now: () => now, stopped: () => false, model, modelBatch: async inputs => { if (batchFailure) throw batchFailure; return modelBatch(inputs); }, collectModel,
    sources: () => evidence ? [evidence] : [],
    prepareModel: input => JSON.stringify(input), checkOutbound: () => {},
    send: async input => { sent.push({ text: input.expectedText, thread: input.thread, update: input.update }); return sent.length; } });
  return { journal, worker, held, deliveries, launches, sent, port, live: () => live, state: () => state!,
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
  const f = fixture();
  try {
    f.evidence({ recordedShape: sample });
    if (sample.kind === 'delivered-reply' || sample.kind === 'empty-reply-in-recorded-context') f.reply(sample.raw);
    f.worker.intake([update(1, 'Continue this conversation.', 7), update(2, 'And this next message.', 7)]);
    await f.worker.drain();
    expect(f.deliveries[0]!.input.text).toContain('exactly one {operation, answer}');
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
