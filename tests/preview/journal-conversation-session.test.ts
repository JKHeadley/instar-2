// @ts-ignore -- physical pool boundary is JavaScript.
import { createTopicLoginHandoff } from '../../scripts/topic-login-pool.mjs';
// @ts-ignore -- existing reviewed account pool is JavaScript.
import { createHarnessLoginPool } from './harness-login-pool.mjs';
import { createHash } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readAnswer } from './answer-reading.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';
import { createSessionConversationAdapter } from '../../src/assembly/conversation-harness-adapter.js';
import { createConversationTopicsPort, type ConversationTopicsState } from '../../src/assembly/conversation-topics.js';
import { parseReplyReviewVerdict, type ReplyCheckResult } from './reply-check.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createJournalWorker, openPreviewJournal, ModelNotStarted, ModelDisclosureRefused,
  createModelLaunchBoundary, type PreviewPorts } from './journal-test-worker.js';

// Execute the shipped host closure, substituting only its physical/model dependencies.
const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const signature = 'async ({ id, prepared, question, context: packet }) => {';
const body = host.split(`      model: ${signature}`)[1]!.split('\n      summaryCheck:')[0]!.trimEnd().replace(/,$/u, '');
const topicBody = host.split('topicOf: operation => {')[1]!.split('\n          },')[0]!;
const optionsBody = host.split('const conversationSessionOf = options => {')[1]!.split('\nconst sessionWorkOf')[0]!;
const mode = Function(`return options => {${optionsBody.replace(/;\s*$/u, '')}`)() as (options: Record<string, string>) => boolean;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const usage = { inputTokens: null, outputTokens: null, charge: null };
const update = (id: number, text: string) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });

function fixture(enabled = true, checkIntake = true, maxCalls = 200, authorityOrExtra: string | Partial<PreviewPorts> = 'existing-role', bot = '12345678') {
  const authority = typeof authorityOrExtra === 'string' ? authorityOrExtra : 'existing-role';
  const extra = typeof authorityOrExtra === 'string' ? {} : authorityOrExtra;
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'conversation-wiring-'))); roots.push(root);
  const open = () => openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot, chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls, maxReplies: 20,
    maxTurns: 30, maxBytes: 262144, cursor: 0 });
  let journal = open();
  const f = assemblyRuntimeFixture();
  let now = 1000, launches = 0, calls = 0, fallback = 0, stopped = false, edges = 0;
  let destination = '', answer = JSON.stringify({ reply: 'A useful answer.', memory: [] });
  const files = new Map<string, string>(), delivered: string[] = [], sent: string[] = [];
  let state: ConversationTopicsState | null = null, busy = false;
  let sources: readonly unknown[] = [];
  let turnBoundary: NonNullable<import('../../src/assembly/production-conversation-session.js').ConversationSessionConfig['prepareTurn']> = async () => true;
  const adapt = (config: Omit<import('../../src/assembly/production-conversation-session.js').ConversationSessionConfig, 'store' | 'createAdapter'> & Pick<import('../../src/assembly/production-session-work.js').SessionWorkConfig, 'createDriver'>) => createConversationTopicsPort({ ...config, maxSessions: 2, idleMs: 5000,
    topicOf: Function('journal', `return operation => {${topicBody}}`)(journal) as (operation: string) => string,
    store: { load: () => state, save: next => { state = structuredClone(next); } },
    createAdapter: (_topic, resolveDelivery) => {
      const adapter = createSessionConversationAdapter({ createDriver: config.createDriver, io: config.io, resolveDelivery });
      const deliver = adapter.deliver;
      adapter.deliver = input => busy ? Promise.resolve({ state: 'busy-not-dispatched', evidence: 'proved busy' }) : deliver(input);
      return adapter;
    } });
  const config: Parameters<typeof adapt>[0] = { prepareTurn: input => turnBoundary(input), conversation: 'operator', allowanceDeadline: 9999999999999, authorized: () => true, currentAuthority: () => authority,
    createDriver: resolve => ({ owner: 'part-eight', launch: () => { launches++; return f.success('session:123:1'); },
      deliver: input => { if (checkIntake) expect(journal.view.order.some(turn => (turn.id === input.intake || `${turn.id}:format-retry` === input.intake && turn.answerRetried) && turn.reserved)).toBe(true);
        delivered.push(resolve(input.intake, input.digest)); calls++; files.set(destination, answer); return f.success('accepted'); },
      observe: () => f.success({ phase: 'output-observed', evidence: 'turn-closed:fake:1', detail: 'closed' }), stop: () => f.success(['123']) }),
    io: { clearResult: path => { destination = path; files.delete(path); }, readResult: path => files.get(path) ?? null,
      wait: async ms => { now += ms; }, modelCalls: () => calls, prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, openDelegations: [] }) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: f.c, now: () => now, stopped: () => stopped,
    append: record => { journal.append({ kind: 'session-work', record, at: now }); if (record.type === 'SessionWorkEdge' && !record.drawsOn) edges++; }, parent: 'runner', owner: 'machine',
    placement: 'local', transport: 'fake', workingScope: '/scope', resultDirectory: '/scope', artifact: 'worker',
    incarnation: 'one', deadlineMs: 10000, pollMs: 25, maxResultBytes: 65536, maxSteps: 8, maxCalls: 10 };
  let port = value(adapt(config));
  let intercept: ((request: Parameters<typeof port.run>[0]) => ReturnType<typeof port.run>) | undefined;
  const openModel = () => Function('journal', 'requireGroupDisclosure', 'toolsActive', 'toolTurnEligible', 'invokeTools',
    'invokeSubscription', 'recordedUsage', 'ModelDisclosureRefused', 'modelLaunch', 'conversationSession',
    'sessionWork', 'ModelNotStarted', 'conversationSessionAnswer', 'readAnswer', 'recordShape', 'shapesPath', `return (${signature}${body});`)(journal, async () => {}, () => false, () => false,
    () => { throw Error('unexpected tools fallback'); }, async () => { fallback++; return { state: 'complete', value: answer, usage }; },
    (input: unknown) => input, ModelDisclosureRefused, createModelLaunchBoundary(), enabled,
    { get port() { return { ...port, run: intercept ?? port.run }; }, authority }, ModelNotStarted, conversationSessionAnswer, readAnswer, () => {}, '/unused') as PreviewPorts['model'];
  let model = openModel();
  const collectBody = host.split('      collectModel: async id => {')[1]!.split('\n      model:')[0]!.trimEnd().replace(/,$/u, '');
  const collectModel = (id: string) => Function('journal', 'conversationSession', 'sessionWork', 'conversationSessionAnswer', 'recordShape', 'shapesPath',
    `return (async id => {${collectBody});`)(journal, enabled, { port }, conversationSessionAnswer, () => {}, '/unused')(id);
  let prepare: ((input: unknown) => string) | undefined;
  const openWorker = () => createJournalWorker(journal, { now: () => now, stopped: () => stopped,
    sources: () => sources, prepareModel: input => prepare ? prepare(input) : JSON.stringify({ ...input, responseContract: "decision-envelope-marker" }), model, collectModel,
    send: async input => { sent.push(input.expectedText); return sent.length; },
    checkOutbound: text => { if (text.includes('SECRET')) throw Error('credential'); }, ...extra });
  let worker = openWorker();
  return { root, get journal() { return journal; }, get worker() { return worker; }, get model() { return model; }, get port() { return port; }, sent, delivered, edges: () => edges, counts: () => ({ launches, calls, fallback }),
    boundary: (next: typeof turnBoundary) => { turnBoundary = next; },
    evidence: (value: unknown) => { sources = [value]; },
    busy: (value: boolean) => { busy = value; }, advance: (ms: number) => { now += ms; },
    state: () => structuredClone(state!.topics.main!), topics: () => structuredClone(state!.topics), restore: (next: import('../../src/assembly/production-conversation-session.js').ConversationState) => { state = { ...state!, topics: { ...state!.topics, main: structuredClone(next) } }; },
    restart: async (crash = false) => { if (!crash) await port.close(); journal.close(); journal = open(); port = value(adapt(config)); model = openModel(); worker = openWorker(); },
    prepare: (next: typeof prepare) => { prepare = next; },
    replay: async () => {
      await port.close();
      journal.close();
      const reopened = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(61));
      try {
        const next = createJournalWorker(reopened, { now: () => now, stopped: () => stopped,
          model: async () => { throw Error('settled reply must not invoke a model'); },
          send: async input => { sent.push(input.expectedText); return sent.length; }, checkOutbound: () => {} });
        await next.drain();
        return reopened.view.order[0]!.sent;
      } finally { reopened.close(); }
    },
    intercept: (run: typeof intercept) => { intercept = run; },
    answer: (text: string) => { answer = text; }, stop: () => { stopped = true; },
    close: async () => { await port.close(); journal.close(); } };
}

it('defaults off, validates the single option, and never silently enables an absent activation', () => {
  expect(mode({})).toBe(false); expect(mode({ 'conversation-session': 'off' })).toBe(false);
  expect(mode({ 'conversation-session': 'on', 'session-work-activation': '/reviewed' })).toBe(true);
  expect(() => mode({ 'conversation-session': 'on' })).toThrow(/activation/);
  expect(() => mode({ 'conversation-session': 'maybe' })).toThrow(/on or off/);
});

it.each([false, true])('uses the shipped model route, mode=%s, and sends each durably admitted turn once', async enabled => {
  const f = fixture(enabled);
  try {
    f.worker.intake([update(1, 'First question')]); await f.worker.drain();
    f.answer(JSON.stringify({ reply: 'Second answer.', memory: [] }));
    f.worker.intake([update(2, 'Second question')]); await f.worker.drain(); await f.worker.drain();
    expect(f.sent).toEqual(['A useful answer.', 'Second answer.']);
    expect(f.counts()).toEqual(enabled ? { launches: 1, calls: 2, fallback: 0 } : { launches: 0, calls: 0, fallback: 2 });
    if (enabled) {
      expect(f.delivered[0]).toContain('First question');
      expect(f.delivered[0]).toContain('decision-envelope-marker');
      expect(f.delivered[1]).toContain('Second question'); expect(f.delivered[1]).toContain('A useful answer.');
      expect(f.delivered[0]).not.toContain('You have no tools');
      expect(f.edges()).toBe(1);
    }
  } finally { await f.close(); }
});

it('keeps summary/review/repair calls on their existing route and refuses a closed session without fallback', async () => {
  const f = fixture();
  try {
    await f.model({ id: 'summary:1', question: 'summarize', context: '{}', prepared: 'exact bytes' });
    expect(f.counts().fallback).toBe(1); expect(f.counts().launches).toBe(0);
    await f.port.close();
    await expect(f.model({ id: 'telegram:7654321:update:2', question: 'hello', context: '{}', prepared: '{}' }))
      .rejects.toBeInstanceOf(ModelNotStarted);
    expect(f.counts().fallback).toBe(1);
  } finally { await f.close(); }
});

it('keeps the outbound credential wall and durable stop in front of delivery', async () => {
  const f = fixture();
  try {
    f.answer(JSON.stringify({ reply: 'SECRET', memory: [] }));
    f.worker.intake([update(1, 'Question')]); await f.worker.drain();
    expect(f.sent).toEqual([]); expect(f.journal.view.order[0]?.held).toBe('outbound secret refused');
    f.worker.stop('operator');
    expect(() => f.worker.intake([update(2, 'Next')])).toThrow(/stopped/);
    expect(f.counts().calls).toBe(1);
  } finally { await f.close(); }
});

const recorded = JSON.parse(readFileSync(new URL('./fixtures/conversation-session-userwalk-2026-10-13.json', import.meta.url), 'utf8')) as {
  records: { frame: number; id: string; output: string }[] };
it.each(recorded.records)('reads the real user-walk output at frame $frame through the session result path', async row => {
  const f = fixture(true, false, 200, 'existing-role', row.id.split(':')[1]!);
  try {
    f.answer(row.output);
    f.worker.intake([update(Number(row.id.split(':').at(-1)), 'Recorded question')]);
    const result = await f.model({ id: row.id, question: 'Return the recorded answer shape', context: '{}', prepared: '{}' });
    expect(result).toMatchObject({ state: 'complete', usage });
    expect(typeof result).toBe('object');
    if (typeof result === 'string' || !('text' in result)) throw Error('recorded answer was not read');
    const raw = JSON.parse(row.output) as { reasoning: string; reply: unknown; dated: unknown[] };
    const answer = JSON.parse(result.text) as { reasoning?: unknown; reply: unknown; dated: unknown[] };
    expect(answer.reply).toEqual(raw.reply); expect(answer.dated).toEqual(raw.dated);
    expect(answer.reasoning).toBeUndefined(); expect(result).toMatchObject({ reason: raw.reasoning });
    expect(f.counts()).toEqual({ launches: 1, calls: 1, fallback: 0 });
  } finally { await f.close(); }
});

it('the journal refuses the whole session reservation before launch when the parent cap cannot hold it', async () => {
  const f = fixture(true, false, 9);
  try {
    f.worker.intake([update(1, 'hello')]);
    const result = await f.model({ id: 'telegram:12345678:update:1', question: 'hello', context: '{}', prepared: '{}' });
    expect(result).toEqual({ state: 'uncertain' });
    expect(f.counts()).toEqual({ launches: 0, calls: 0, fallback: 0 });
    expect(f.journal.view.calls).toBe(0);
    expect(f.sent).toEqual([]);
  } finally { await f.close(); }
});

it('a refused parent reservation never turns into an unreserved launch on a later input', async () => {
  const f = fixture(true, false, 9);
  try {
    for (const n of [1, 2]) {
      f.worker.intake([update(n, 'hello')]);
      const result = await f.model({ id: `telegram:12345678:update:${n}`, question: 'hello', context: '{}', prepared: '{}' });
      expect(result).toEqual({ state: 'uncertain' });
    }
    expect(f.counts()).toEqual({ launches: 0, calls: 0, fallback: 0 });
    expect(f.journal.view.calls).toBe(0);
  } finally { await f.close(); }
});

it.each([false, true])('the shipped grant refresh validates changed bytes before opening authorization (login pool=%s)', pool => {
  let bytes = JSON.stringify({ reference: 'same-grant', policy: 'old' });
  const initial = bytes;
  const selectBody = host.split('sessionWork = { select() {')[1]!.split('}, get authority()')[0]!;
  const activeBody = host.split('const sessionActive = ')[1]!.split('\n')[0]!;
  const getterBody = host.split('}, get authority() {')[1]!.split('}, port: take')[0]!;
  const build = Function('readFileSync', 'initial', 'sessionAdapter', 'requireAuthority', 'sha256', 'pool', `
    let sessionBytes = initial, sessionActivation = JSON.parse(initial);
    const conversationSession = true, sessionSetup = { activation: '/grant' }, profile = {}, options = {},
      journal = { view: { expires: 1000 } }, required = () => 'model', wallNow = () => 1,
      activationMatchesJournal = () => true, loginPool = pool, selectedSession = { index: 0 },
      loginRuntimes = new Map([[0, { live: () => false, sessionRecord: { reference: 'stale-pool-record' } }]]);
    const sessionActive = ${activeBody}
    const sessionWork = { select() {${selectBody}}, get authority() {${getterBody}} };
    return { select: () => sessionWork.select(), active: sessionActive, authority: () => sessionWork.authority };
  `);
  const seen: unknown[] = [];
  const route = build(() => bytes, initial, { validateActivation: (record: { policy: string }) => {
    seen.push(record); if (record.policy === 'invalid') throw Error('invalid grant');
  } }, () => {}, (text: string) => text, pool) as { select(): void; active(): boolean; authority(): string };
  expect(route.active()).toBe(true); const before = route.authority();
  bytes = JSON.stringify({ reference: 'same-grant', policy: 'new' });
  expect(route.active()).toBe(false); route.select(); expect(route.active()).toBe(true);
  expect(route.authority()).not.toBe(before); expect(route.authority()).not.toContain('stale-pool-record');
  bytes = JSON.stringify({ reference: 'same-grant', policy: 'invalid' });
  expect(() => route.select()).toThrow(/invalid grant/); expect(route.active()).toBe(false);
  expect(seen).toHaveLength(2);
});

const repairRecords = JSON.parse(readFileSync(new URL('./fixtures/repair-identity-copy-walk-2026-10-14.json', import.meta.url), 'utf8')) as {
  records: { operation: string; originalPrepared: string; retryPrepared: string; storedDigest: string;
    request: { operation: string; question: string; context: string; authority: string } }[] };
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
it.each(repairRecords.records)('replays the recorded packets for $operation with distinct durable repair identity', async row => {
  const f = fixture(true, false, 200, row.request.authority, row.operation.split(':')[1]!);
  try {
    expect(hash(JSON.stringify(row.request))).toBe(row.storedDigest);
    expect(hash(JSON.stringify({ ...row.request, question: row.retryPrepared }))).not.toBe(row.storedDigest);
    const input = { id: row.operation, question: 'recorded owner envelope', context: row.request.context, prepared: row.originalPrepared };
    const n = Number(row.operation.split(':').at(-1));
    f.worker.intake([update(n, 'Recorded question')]);
    f.journal.append({ kind: 'reserve', id: row.operation, prompt: row.originalPrepared, at: 1000 });
    const original = await f.model(input);
    // The real journal transition precedes invocation. Use the recorded bot/update identity.
    f.journal.append({ kind: 'format-retry', id: row.operation, role: 'answer', state: 'complete',
      failureClass: 'malformed', prompt: row.retryPrepared, at: 1001 });
    const retryEnvelope = JSON.parse(row.retryPrepared) as { messages: { role: string; content: string }[] };
    const wrapped = JSON.parse(retryEnvelope.messages.find(message => message.role === 'context')!.content) as { packet: unknown };
    const retry = { ...input, context: JSON.stringify(wrapped.packet), prepared: row.retryPrepared };
    expect(n).toBeGreaterThan(0);
    expect(await f.model(retry)).toMatchObject({ state: 'complete' });
    expect(f.state().inputs.map(input => input.request.operation)).toEqual([row.operation, `${row.operation}:format-retry`]);
    expect(f.state().inputs[0]!.digest).toBe(row.storedDigest);
    expect(f.state().inputs[1]!.request.question).toBe(row.retryPrepared);
    await f.restart();
    expect(await f.model(input)).toEqual(original);
    expect(await f.model(retry)).toMatchObject({ state: 'complete' });
    expect(f.counts().calls).toBe(2);
    // Changed bytes under either existing operation are still refused by the real host.
    await expect(f.port.run({ ...row.request, question: 'different' })).rejects.toThrow(/conflicts/);
    expect(await f.model({ ...retry, context: 'different' })).toEqual({ state: 'uncertain' });
    expect(f.counts().calls).toBe(2);
  } finally { await f.close(); }
});

it.each(['malformed', 'uncertain', 'throw'] as const)('delivers one honest outcome after a %s repair, retaining it on replay', async outcome => {
  const f = fixture();
  try {
    // Exercise the real reserve/format-retry journal transition and the shipped bridge.
    f.answer('not a decision');
    const run = f.port.run.bind(f.port);
    let attempted = 0;
    f.intercept(async request => { attempted++;
      if (request.operation.endsWith(':format-retry')) {
        if (outcome === 'throw') throw Error('request digest conflict');
        if (outcome === 'uncertain') return { state: 'uncertain', detail: 'turn incomplete', edge: 'edge', child: null };
      }
      return run(request);
    });
    f.worker.intake([update(1, 'Please answer.')]); await f.worker.drain(); await f.worker.drain();
    expect(attempted).toBe(2);
    expect(f.journal.view.order[0]!.answerRetried).toBe(true);
    expect(f.sent).toHaveLength(1);
    expect(f.sent[0]).toMatch(/couldn't|did not complete|could not/);
    await f.restart(); await f.worker.drain();
    expect(f.sent).toHaveLength(1); expect(attempted).toBe(2);
    expect(await f.replay()).toBe(1); expect(f.sent).toHaveLength(1);
  } finally { await f.close(); }
});

it('a successful format repair runs as a child and sends once across journal reopening', async () => {
  const f = fixture();
  try {
    f.answer('not a decision');
    const run = f.port.run.bind(f.port);
    f.intercept(async request => {
      if (request.operation.endsWith(':format-retry')) f.answer(JSON.stringify({ reply: 'Here is the finished reply.', memory: [] }));
      return run(request);
    });
    f.worker.intake([update(1, 'Please answer.')]); await f.worker.drain();
    expect(f.sent).toEqual(['Here is the finished reply.']);
    expect(f.state().inputs.map(input => input.request.operation)).toEqual([
      'telegram:12345678:update:1', 'telegram:12345678:update:1:format-retry']);
    expect(f.counts().calls).toBe(2);
    expect(await f.replay()).toBe(1); expect(f.sent).toHaveLength(1);
  } finally { await f.close(); }
});

const admissionRecords = JSON.parse(readFileSync(new URL('./fixtures/repair-admission-rewalk-2026-10-14.json', import.meta.url), 'utf8')) as {
  records: { case: string; frame: number; operation: string; question: string; originalPrepared: string; retryPrepared: string }[] };
it.each(admissionRecords.records)('admits the exact rewalk $case packets (repair frame $frame) through the topic coordinator and sends once', async row => {
  const f = fixture(true, true, 200, 'existing-role', row.operation.split(':')[1]!);
  try {
    let packets = 0;
    f.prepare(() => packets++ === 0 ? row.originalPrepared : row.retryPrepared);
    // The recorded repair was refused before worker execution. Simulate its answer;
    // the admission and repair packets, not a claimed live repair output, are replayed.
    f.answer('not a decision');
    const run = f.port.run.bind(f.port);
    f.intercept(async request => {
      if (request.operation === `${row.operation}:format-retry`) {
        expect(request.question).toBe(row.retryPrepared);
        f.answer(JSON.stringify({ reply: 'The repaired answer.', memory: [] }));
      } else expect(request.question).toBe(row.originalPrepared);
      return run(request);
    });
    f.worker.intake([update(Number(row.operation.split(':').at(-1)), row.question)]);
    await f.worker.drain();
    expect(packets).toBe(2);
    expect(f.delivered).toHaveLength(2);
    expect(f.delivered[0]).toContain(row.originalPrepared);
    expect(f.delivered[1]).toContain(row.retryPrepared);
    expect(f.sent).toEqual(['The repaired answer.']);
    const inputs = f.state().inputs;
    expect(inputs.map(input => input.request.operation)).toEqual([row.operation, `${row.operation}:format-retry`]);
    expect(inputs[0]!.digest).not.toBe(inputs[1]!.digest);
    expect(f.journal.view.turns.get(row.operation)?.sent).toBe(1);
    expect(f.journal.view.turns.has(`${row.operation}:format-retry`)).toBe(false);
    await expect(f.port.run({ ...inputs[0]!.request, question: 'changed bytes' })).rejects.toThrow(/conflicts/);
    await expect(f.port.run({ ...inputs[1]!.request, context: 'changed bytes' })).rejects.toThrow(/conflicts/);
    expect(() => f.journal.append({ kind: 'format-retry', id: row.operation, role: 'answer', state: 'complete',
      failureClass: 'malformed', prompt: row.retryPrepared, at: 1002 })).toThrow(/retry order/);
    await f.restart();
    await f.worker.drain();
    expect(await f.port.run(inputs[1]!.request)).toMatchObject({ state: 'complete' });
    expect(f.counts().calls).toBe(2);
    expect(await f.replay()).toBe(1);
    expect(f.sent).toEqual(['The repaired answer.']);
  } finally { await f.close(); }
});

it('refuses unreserved or invented suffixes and inherits only the reserved parent topic', async () => {
  const f = fixture();
  try {
    const operation = 'telegram:12345678:update:1';
    const request = { operation: `${operation}:format-retry`, question: 'repair', context: '{}', authority: 'existing-role' };
    await expect(f.port.run(request)).rejects.toThrow(/not durably admitted/);
    f.worker.intake([{ ...update(1, 'Question'), message: { ...update(1, 'Question').message, message_thread_id: 7 } }]);
    await expect(f.port.run(request)).rejects.toThrow(/not durably admitted/);
    f.journal.append({ kind: 'reserve', id: operation, prompt: 'original', at: 1000 });
    await expect(f.port.run(request)).rejects.toThrow(/not durably admitted/);
    f.journal.append({ kind: 'format-retry', id: operation, role: 'answer', state: 'complete',
      failureClass: 'malformed', prompt: 'repair', at: 1001 });
    for (const suffix of [':format-retry-2', ':format-retry:format-retry', ':other'])
      await expect(f.port.run({ ...request, operation: operation + suffix })).rejects.toThrow(/not durably admitted/);
    expect(f.counts().calls).toBe(0);
    expect(await f.port.run(request)).toMatchObject({ state: 'complete' });
    expect(Object.keys(f.topics())).toEqual(['7']);
    expect(f.topics()['7']!.inputs[0]!.request.operation).toBe(request.operation);
  } finally { await f.close(); }
});

const recordedShapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(recordedShapes.otherShapes)('executes a reserved repair carrying recorded $kind ($id) without creating another admission', async sample => {
  const f = fixture();
  try {
    const operation = 'telegram:12345678:update:1';
    f.worker.intake([update(1, 'Recorded shape replay')]);
    f.journal.append({ kind: 'reserve', id: operation, prompt: 'original', at: 1000 });
    f.journal.append({ kind: 'format-retry', id: operation, role: 'answer', state: 'complete',
      failureClass: 'malformed', prompt: 'repair', at: 1001 });
    // These are recorded outputs from different roles, intentionally presented to
    // the answer reader. Routing must not depend on the content or invent admission.
    f.answer(sample.raw);
    await f.model({ id: operation, question: 'Recorded shape replay', context: '{}', prepared: 'repair' });
    expect(f.counts()).toEqual({ launches: 1, calls: 1, fallback: 0 });
    expect(f.state().inputs.map(input => input.request.operation)).toEqual([`${operation}:format-retry`]);
    expect(f.journal.view.order).toHaveLength(1);
    expect(f.sent).toEqual([]);
  } finally { await f.close(); }
});

it.each(['same-host', 'queued-restart', 'completed-restart'] as const)('collects a deferred result through the ordinary answer/send path once (%s)', async mode => {
  const f = fixture(true, true, 11); // existing turn + parent reservation fill the cap; collection spends nothing
  try {
    f.busy(true); f.worker.intake([update(1, 'First question')]); await f.worker.drain();
    expect(f.sent).toEqual([]); expect(f.state().inputs[0]!.state).toBe('queued');
    expect(f.journal.view.order[0]).toMatchObject({ reserved: true });
    expect(f.journal.view.order[0]!.modelState).toBeUndefined();
    await f.worker.drain(); expect(f.delivered).toHaveLength(0);
    if (mode === 'queued-restart') await f.restart();
    f.busy(false); f.advance(200); await f.port.maintain();
    if (mode === 'completed-restart') await f.restart();
    const calls = f.journal.view.calls;
    await f.worker.drain(); await f.worker.drain(); await f.port.maintain();
    expect(f.sent).toEqual(['A useful answer.']); expect(f.delivered).toHaveLength(1);
    expect(f.journal.view.calls).toBe(calls);
    expect(f.journal.view.order[0]!.modelState).toBe('complete');
    expect(f.journal.view.order[0]!.noticeClass).toBeUndefined();
    await f.restart(); await f.worker.drain(); expect(f.sent).toHaveLength(1);
  } finally { await f.close(); }
});

it('an unresolved dispatched host turn is never replayed by the journal collector after restart', async () => {
  const f = fixture();
  try {
    f.busy(true); f.worker.intake([update(1, 'Question')]); await f.worker.drain();
    f.restore({ ...f.state(), inputs: f.state().inputs.map(row => ({ ...row, state: 'accepted', outcome: null })) });
    await f.restart(true); f.busy(false); f.advance(200); await f.port.maintain(); await f.worker.drain();
    expect(f.journal.view.order[0]!.modelState).toBe('uncertain');
    await f.worker.drain(); expect(f.delivered).toHaveLength(0); expect(f.sent).not.toContain('A useful answer.');
  } finally { await f.close(); }
});

it.each(recorded.records)('collects recorded frame $frame into the same consumer disposition as immediate delivery', async row => {
  const deferred = fixture(), immediate = fixture();
  try {
    for (const f of [deferred, immediate]) {
      f.advance(1791907200000 - 1000); f.answer(row.output);
      f.busy(f === deferred); f.worker.intake([update(1, JSON.parse(row.output).dated[0].quote)]); await f.worker.drain();
    }
    await deferred.restart(); deferred.busy(false); deferred.advance(200);
    await deferred.port.maintain(); await deferred.worker.drain();
    expect(deferred.delivered).toHaveLength(immediate.delivered.length);
    expect(deferred.state().inputs[0]!.outcome).toMatchObject({ state: 'complete', text: row.output });
    expect(deferred.journal.view.order[0]!.modelState).toBe(immediate.journal.view.order[0]!.modelState);
    expect(deferred.sent).toEqual(immediate.sent);
    expect(deferred.journal.view.order[0]!.answerRetried).toBe(immediate.journal.view.order[0]!.answerRetried);
    if (row.frame === 595) expect(deferred.sent.join('\n')).toContain(JSON.parse(row.output).reply);
    await deferred.worker.drain(); expect(deferred.delivered).toHaveLength(immediate.delivered.length);
  } finally { await deferred.close(); await immediate.close(); }
});

const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(shapes.otherShapes)('keeps recorded $kind ($id) in the original packet across deferred collection', async row => {
  const f = fixture();
  try {
    // Archived summary/Jev/review bytes are quoted evidence, never reclassified as answer output.
    // Delivered and empty historical reply bytes exercise the reply field, as in their original consumer tests.
    f.evidence({ recordedShape: row });
    if (row.kind === 'delivered-reply' || row.kind === 'empty-reply-in-recorded-context')
      f.answer(JSON.stringify({ reply: row.raw, memory: [] }));
    f.busy(true); f.worker.intake([update(1, 'Continue the conversation')]); await f.worker.drain();
    const packet = f.state().inputs[0]!.request.context;
    expect(packet).toContain(JSON.stringify(row.raw));
    await f.restart(); f.busy(false); f.advance(200); await f.port.maintain(); await f.worker.drain();
    expect(f.state().inputs[0]!.request.context).toBe(packet);
    expect(f.delivered).toHaveLength(1); expect(f.sent).toHaveLength(1); expect(f.sent[0]!.trim()).not.toBe('');
    expect(f.journal.view.order[0]!.failureClass).toBe(row.kind === 'empty-reply-in-recorded-context' ? 'empty' : undefined);
    await f.worker.drain(); expect(f.sent).toHaveLength(1);
  } finally { await f.close(); }
});

it('an older host result cannot settle a newer reserved packet, including after restart', async () => {
  const f = fixture();
  try {
    f.busy(true); f.worker.intake([update(1, 'Question')]); await f.worker.drain();
    f.journal.append({ kind: 'format-retry', id: f.journal.view.order[0]!.id, role: 'answer', state: 'complete',
      failureClass: 'malformed', prompt: 'a different exact packet', at: 1000 });
    await f.restart(); f.busy(false); f.advance(200); await f.port.maintain();
    const calls = f.journal.view.calls;
    await f.worker.drain(); await f.worker.drain();
    expect(f.state().inputs[0]!.outcome?.state).toBe('complete');
    expect(f.sent).toEqual([]); expect(f.delivered).toHaveLength(1); expect(f.journal.view.calls).toBe(calls);
    expect(f.journal.view.order[0]!.modelState).toBeUndefined();
  } finally { await f.close(); }
});

it('collects a queued reserved format repair under its child identity and sends only once', async () => {
  const f = fixture();
  try {
    f.answer('not a decision');
    const run = f.port.run.bind(f.port);
    f.intercept(async request => {
      if (request.operation.endsWith(':format-retry')) {
        f.busy(true); f.answer(JSON.stringify({ reply: 'Delayed repair answer.', memory: [] }));
      }
      return run(request);
    });
    f.worker.intake([update(1, 'Please answer')]); await f.worker.drain();
    expect(f.sent).toEqual([]);
    expect(f.state().inputs[1]!.state).toBe('queued');
    await f.restart(); f.busy(false); f.advance(200); await f.port.maintain();
    await f.worker.drain(); await f.worker.drain();
    expect(f.sent).toEqual(['Delayed repair answer.']);
    expect(f.delivered).toHaveLength(2);
    expect(await f.replay()).toBe(1); expect(f.sent).toHaveLength(1);
  } finally { await f.close(); }
});

it('sends at turn end before slow review, persists objections for the next turn, and never sends twice', async () => {
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const events: string[] = [];
  const f = fixture(true, true, 200, { replyReviewTiming: 'after-send',
    replyCheck: { elapsedMs: () => 0,
      jev: async () => { events.push('jev'); await delayed; return { value: {}, latencyMs: 1 }; },
      escalate: async () => { events.push('review'); return { verdict: 'violation', confidence: 1, latencyMs: 1, ruleIds: ['self_state_claim'],
        reason: 'The answer claims work without evidence.' }; } } });
  try {
    f.worker.intake([update(1, 'First question')]);
    const draining = f.worker.drain();
    for (let i = 0; i < 100 && !events.length; i++) await new Promise(resolve => setTimeout(resolve, 1));
    expect(f.sent).toEqual(['A useful answer.']); // The reviewer is still awaiting the injected slow path.
    expect(events).toEqual(['jev']);
    release(); await draining;
    expect(events).toEqual(['jev', 'review']);
    expect(f.journal.view.order[0]?.replyChecks?.at(-1)?.verdict).toBe('violation');
    expect(f.journal.view.order[0]?.afterSendReview).toBe(true);
    expect(f.journal.view.order[0]?.checked).toBeDefined();
    await f.worker.drain(); expect(f.sent).toHaveLength(1); expect(events).toHaveLength(2);
    f.worker.intake([update(2, 'Second question')]); await f.worker.drain();
    expect(f.delivered[1]).toContain('self_state_claim');
  } finally { release(); await f.close(); }
});

it.each(['SECRET', 'stop'] as const)('after-send review preserves the %s wall', async kind => {
  let reviews = 0;
  const f = fixture(true, true, 200, { replyReviewTiming: 'after-send', replyCheck: {
    elapsedMs: () => 0, jev: async () => { reviews++; return { value: {}, latencyMs: 0 }; },
    escalate: async () => ({ verdict: 'pass', confidence: 1, latencyMs: 1, ruleIds: [] }) } });
  try {
    if (kind === 'SECRET') f.answer(JSON.stringify({ reply: 'SECRET', memory: [] }));
    f.worker.intake([update(1, 'Question')]);
    if (kind === 'stop') f.stop();
    try { await f.worker.drain(); } catch { /* stop is an explicit refusal */ }
    expect(f.sent).toHaveLength(0); expect(reviews).toBe(0);
  } finally { await f.close(); }
});

it('reopens the post-send journal without repeating review or delivery', async () => {
  let reviews = 0;
  const f = fixture(true, true, 200, { replyReviewTiming: 'after-send', replyCheck: {
    elapsedMs: () => 0, jev: async () => { reviews++; return { value: {}, latencyMs: 0 }; },
    escalate: async () => ({ verdict: 'pass', confidence: 1, latencyMs: 1, ruleIds: [] }) } });
  f.worker.intake([update(1, 'Question')]); await f.worker.drain(); await f.close();
  const journal = openPreviewJournal(join(f.root, 'journal.encrypted'), new Uint8Array(32).fill(61));
  try {
    const worker = createJournalWorker(journal, { now: () => 2000, stopped: () => false,
      model: async () => { throw Error('unexpected model replay'); },
      send: async () => { throw Error('unexpected duplicate send'); }, checkOutbound: () => {},
      replyReviewTiming: 'after-send', replyCheck: { elapsedMs: () => 0,
        jev: async () => { throw Error('unexpected review replay'); },
        escalate: async () => { throw Error('unexpected review replay'); } } });
    await worker.drain();
    expect(reviews).toBe(1); expect(journal.view.order[0]?.afterSendReview).toBe(true);
    expect(journal.view.order[0]?.sent).toBe(1);
  } finally { journal.close(); }
});

it('sends under the exact answer/session cap and records unavailable review without exceeding it', async () => {
  let escalations = 0;
  const f = fixture(true, true, 11, { replyReviewTiming: 'after-send', replyCheck: { elapsedMs: () => 0,
    jev: async () => ({ value: {}, latencyMs: 0 }),
    escalate: async () => { escalations++; return { verdict: 'pass', confidence: 1, latencyMs: 1, ruleIds: [] }; } } });
  try {
    f.worker.intake([update(1, 'Question')]); await f.worker.drain();
    expect(f.sent).toEqual(['A useful answer.']);
    expect(f.journal.view.calls).toBeLessThanOrEqual(11); expect(escalations).toBe(0);
    expect(f.journal.view.order[0]?.replyChecks?.at(-1)?.verdict).toBe('unavailable');
  } finally { await f.close(); }
});

it('recovers an interrupted paid review as an unavailable signal without dispatching it again', async () => {
  const f = fixture();
  f.worker.intake([update(1, 'Question')]); await f.worker.drain();
  const id = f.journal.view.order[0]!.id;
  f.journal.append({ kind: 'reply-review-after-send', id, at: 1500 });
  f.journal.append({ kind: 'reply-jev-reserve', id, at: 1500 });
  await f.close(); // Crash boundary: the paid reservation exists, its result does not.
  const journal = openPreviewJournal(join(f.root, 'journal.encrypted'), new Uint8Array(32).fill(61));
  try {
    const worker = createJournalWorker(journal, { now: () => 2000, stopped: () => false,
      model: async () => { throw Error('unexpected answer'); },
      send: async () => { throw Error('duplicate send'); }, checkOutbound: () => {},
      replyReviewTiming: 'after-send', replyCheck: { elapsedMs: () => 0,
        jev: async () => { throw Error('paid call repeated'); },
        escalate: async () => { throw Error('paid call repeated'); } } });
    await worker.drain(); await worker.drain();
    expect(journal.view.order[0]?.replyChecks).toHaveLength(1);
    expect(journal.view.order[0]?.replyChecks?.[0]).toMatchObject({ verdict: 'unavailable', path: 'holding' });
    expect(journal.view.order[0]?.checked).toBeDefined();
    expect(journal.view.order[0]?.sent).toBe(1);
  } finally { journal.close(); }
});

async function recoverReview(results: ReplyCheckResult[], subscriptionReserved = false, shared = false) {
  const f = fixture(true, true, 200, shared ? { prepareModel: () => JSON.stringify({ messages: [{ role: 'context',
    content: JSON.stringify({ packet: { audience: { surface: 'telegram-group-topic', operatorOnlyVerified: false } } }) }] }) } : {});
  f.worker.intake([update(1, 'Question')]); await f.worker.drain();
  const id = f.journal.view.order[0]!.id;
  f.journal.append({ kind: 'reply-review-after-send', id, at: 1500 });
  f.journal.append({ kind: 'reply-jev-reserve', id, at: 1500 });
  if (subscriptionReserved || results.some(result => result.path === 'subscription')) {
    f.journal.append({ kind: 'reply-review-reserve', id, candidate: f.journal.view.order[0]!.intent!, at: 1500 });
    if (results.some(result => result.path === 'subscription'))
      f.journal.append({ kind: 'reply-review-state', id, state: 'complete', at: 1500 });
  }
  for (const result of results) f.journal.append({ kind: 'reply-check', id, result, at: 1501 });
  expect(f.journal.view.order[0]!.checked).toBeUndefined();
  const calls = f.journal.view.calls;
  await f.close(); // Crash after durable result, before its coherence projection.
  const journal = openPreviewJournal(join(f.root, 'journal.encrypted'), new Uint8Array(32).fill(61));
  try {
    const worker = createJournalWorker(journal, { now: () => 2000, stopped: () => false,
      model: async () => { throw Error('unexpected model replay'); },
      send: async () => { throw Error('unexpected duplicate send'); }, checkOutbound: () => {},
      replyReviewTiming: 'after-send', replyCheck: { elapsedMs: () => 0,
        jev: async () => { throw Error('unexpected review replay'); },
        escalate: async () => { throw Error('unexpected review replay'); } } });
    await worker.drain(); await worker.drain();
    expect(journal.view.calls).toBe(calls);
    expect(journal.view.order[0]!.sent).toBe(1);
    expect(journal.view.order[0]!.checked).toBeDefined();
    const probe = worker.probe('What should inform the next answer?');
    if ('reason' in probe) throw Error(probe.reason);
    return { checks: journal.view.order[0]!.replyChecks!, findings: journal.view.order[0]!.checked!, packet: probe.context };
  } finally { journal.close(); }
}

it.each(['pass', 'violation', 'unavailable'] as const)('recovers a durable terminal %s without replacing it or spending again', async verdict => {
  const result: ReplyCheckResult = { verdict, ruleIds: verdict === 'violation' ? ['self_state_claim'] : [],
    path: 'subscription', confidence: 1, latencyMs: 1, reason: 'The answer claims completed work without evidence.' };
  const recovered = await recoverReview([result]);
  expect(recovered.checks).toEqual([result]);
  expect(recovered.packet).not.toContain('retrospective review interrupted');
  if (verdict !== 'pass') {
    expect(JSON.stringify(recovered.findings)).toContain(result.reason);
    expect(recovered.packet).toContain(result.reason);
  }
  if (verdict === 'violation') expect(recovered.packet).toContain('self_state_claim');
});

it('a Jev pass is terminal unless a contextual review was reserved and lost', async () => {
  const result: ReplyCheckResult = { verdict: 'pass', ruleIds: [], path: 'jev', confidence: 1, latencyMs: 1 };
  expect((await recoverReview([result])).checks).toEqual([result]);
  const interrupted = await recoverReview([result], true);
  expect(interrupted.checks).toHaveLength(2);
  expect(interrupted.packet).toContain('retrospective review interrupted');
  const audienceReviewMissing = await recoverReview([result], false, true);
  expect(audienceReviewMissing.checks).toHaveLength(2);
  expect(audienceReviewMissing.packet).toContain('retrospective review interrupted');
});

it('retains a terminal holding result instead of adding another interruption', async () => {
  const result: ReplyCheckResult = { verdict: 'unavailable', ruleIds: ['defers_work'], path: 'holding',
    confidence: null, latencyMs: 0, reason: 'review cap refused' };
  expect((await recoverReview([result])).checks).toEqual([result]);
});

const reviewArchive = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
  import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
it.each(reviewArchive.otherShapes)('recovery preserves recorded $kind ($id) at the review boundary', async row => {
  if (row.kind === 'jev-unsure') {
    const result = JSON.parse(row.raw) as ReplyCheckResult;
    const recovered = await recoverReview([result], true);
    expect(recovered.checks[0]).toEqual(result);
    expect(recovered.checks.at(-1)).toMatchObject({ verdict: 'unavailable', ruleIds: result.ruleIds });
    expect(recovered.packet).toContain('quits_on_self');
    expect(recovered.packet).toContain('parks_on_user');
    return;
  }
  // Recorded writer, uncertain/undecided and delivered/empty shapes are not completed review verdicts.
  // Use the shipped readers to retain that distinction, then recover the durable outcome without relabeling it.
  const read = readAnswer(row.raw, { wrapped: 'refuse', object: true });
  let result: ReplyCheckResult;
  try {
    result = { ...parseReplyReviewVerdict(read.ok ? read.value : row.raw,
      ['defers_work', 'self_state_claim', 'breaks_preference']), path: 'subscription', confidence: 1, latencyMs: 1 };
  } catch {
    result = { verdict: 'unavailable', ruleIds: [], path: 'subscription', confidence: null,
      latencyMs: 1, reason: 'recorded output is not a reply-review verdict' };
  }
  expect(result.verdict).toBe(row.kind === 'reply-review' ? 'violation' : 'unavailable');
  const recovered = await recoverReview([result]);
  expect(recovered.checks).toEqual([result]);
  expect(recovered.packet).toContain(result.reason);
  expect(recovered.packet).not.toContain('retrospective review interrupted');
  if (row.kind === 'reply-review') expect(recovered.packet).toContain('breaks_preference');
});

it('keeps a known Jev objection when a later paid review was interrupted', async () => {
  const result: ReplyCheckResult = { verdict: 'violation', ruleIds: ['defers_work'], path: 'jev', confidence: 0.99,
    latencyMs: 1, reason: 'The answer promises later work.' };
  const recovered = await recoverReview([result], true);
  expect(recovered.checks).toHaveLength(2);
  expect(recovered.packet).toContain('defers_work');
  expect(recovered.packet).toContain(result.reason);
  expect(recovered.packet).toContain('retrospective review interrupted');
});


it('the journal sends each answer once across a real pool boundary and host/journal reopening', async () => {
  const f = fixture();
  const entries = ['a', 'b'].map((name, index) => ({ index, profile: {
    reference: name, expectedAccount: `${name}@example.invalid`, configDirectory: `/fixture-${name}` } }));
  let pressure = false, poolState: unknown, topicState: unknown;
  const pool = createHarnessLoginPool({ configuration: { entries, identity: 'fixture-journal', threshold: 95, current: () => true },
    statePath: 'unused', now: () => 1000, validate: () => {},
    readText: () => { const error = new Error('absent') as Error & { code: string }; error.code = 'ENOENT'; throw error; },
    write: (_path: string, next: unknown) => { poolState = structuredClone(next); }, usage: () => ({ version: 1,
      accounts: entries.map(entry => ({ email: entry.profile.expectedAccount, configHome: entry.profile.configDirectory,
        lastQuota: { measuredAt: new Date(1000).toISOString(), fiveHour: { utilizationPct: pressure && entry.index === 0 ? 99 : 10, resetsAt: new Date(100000).toISOString() },
          sevenDay: { utilizationPct: pressure && entry.index === 0 ? 99 : 10, resetsAt: new Date(100000).toISOString() } } })) }) });
  const handoff = createTopicLoginHandoff({ topic: 'main', pool, entries,
    store: { load: () => topicState ?? null, save: (next: unknown) => { topicState = structuredClone(next); } },
    physical: () => ({ load: () => ({ resumes: {} }) }), project: '/fixture', framework: 'claude-code', admit: async () => {} });
  f.boundary(handoff.prepareTurn);
  try {
    f.worker.intake([update(1, 'First question')]); await f.worker.drain();
    pressure = true;
    f.worker.intake([update(2, 'Second question')]); await f.worker.drain();
    expect(handoff.current().index).toBe(1); expect(pool.state.handoffs).toHaveLength(1);
    expect(poolState).toBeDefined(); expect(f.sent).toHaveLength(2); expect(f.delivered).toHaveLength(2);
    expect(f.counts().launches).toBe(2);
    await f.restart(); await f.worker.drain();
    f.worker.intake([update(1, 'First question'), update(2, 'Second question')]); await f.worker.drain();
    expect(f.sent).toHaveLength(2); expect(f.delivered).toHaveLength(2);
    expect(pool.state.handoffs).toHaveLength(1); expect(await f.replay()).toBe(1); expect(f.sent).toHaveLength(2);
  } finally { await f.close(); }
});
