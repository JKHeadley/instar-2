import { createHash } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readAnswer } from './answer-reading.js';
import { createSessionConversationAdapter } from '../../src/assembly/conversation-harness-adapter.js';
import { createConversationTopicsPort, type ConversationTopicsState } from '../../src/assembly/conversation-topics.js';
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

function fixture(enabled = true, checkIntake = true, maxCalls = 200, authority = 'existing-role', bot = '12345678') {
  const root = mkdtempSync(join(tmpdir(), 'conversation-wiring-')); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot, chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls, maxReplies: 20,
    maxTurns: 30, maxBytes: 262144, cursor: 0 });
  const f = assemblyRuntimeFixture();
  let now = 1000, launches = 0, calls = 0, fallback = 0, stopped = false, edges = 0;
  let destination = '', answer = JSON.stringify({ reply: 'A useful answer.', memory: [] });
  const files = new Map<string, string>(), delivered: string[] = [], sent: string[] = [];
  let state: ConversationTopicsState | null = null;
  const adapt = (config: Omit<import('../../src/assembly/production-conversation-session.js').ConversationSessionConfig, 'store' | 'createAdapter'> & Pick<import('../../src/assembly/production-session-work.js').SessionWorkConfig, 'createDriver'>) => createConversationTopicsPort({ ...config, maxSessions: 2, idleMs: 5000,
    topicOf: Function('journal', `return operation => {${topicBody}}`)(journal) as (operation: string) => string,
    store: { load: () => state, save: next => { state = structuredClone(next); } },
    createAdapter: (_topic, resolveDelivery) => createSessionConversationAdapter({ createDriver: config.createDriver, io: config.io, resolveDelivery }) });
  const config: Parameters<typeof adapt>[0] = { conversation: 'operator', allowanceDeadline: 9999999999999, authorized: () => true, currentAuthority: () => authority,
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
  const model = Function('journal', 'requireGroupDisclosure', 'toolsActive', 'toolTurnEligible', 'invokeTools',
    'invokeSubscription', 'recordedUsage', 'ModelDisclosureRefused', 'modelLaunch', 'conversationSession',
    'sessionWork', 'ModelNotStarted', 'readAnswer', 'recordShape', 'shapesPath', `return (${signature}${body});`)(journal, async () => {}, () => false, () => false,
    () => { throw Error('unexpected tools fallback'); }, async () => { fallback++; return { state: 'complete', value: answer, usage }; },
    (input: unknown) => input, ModelDisclosureRefused, createModelLaunchBoundary(), enabled,
    { get port() { return { ...port, run: intercept ?? port.run }; }, authority }, ModelNotStarted, readAnswer, () => {}, '/unused') as PreviewPorts['model'];
  let prepare: ((input: unknown) => string) | undefined;
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => stopped,
    prepareModel: input => prepare ? prepare(input) : JSON.stringify({ ...input, responseContract: "decision-envelope-marker" }), model,
    send: async input => { sent.push(input.expectedText); return sent.length; },
    checkOutbound: text => { if (text.includes('SECRET')) throw Error('credential'); } });
  return { journal, worker, model, port, sent, delivered, prepare: (next: typeof prepare) => { prepare = next; },
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
    restart: () => { port = value(adapt(config)); }, state: () => structuredClone(state!.topics.main!), topics: () => structuredClone(state!.topics), edges: () => edges, counts: () => ({ launches, calls, fallback }),
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
    f.restart();
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
    f.restart(); await f.worker.drain();
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
    f.restart();
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
