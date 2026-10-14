import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readAnswer } from './answer-reading.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';
import { createSessionConversationAdapter } from '../../src/assembly/conversation-harness-adapter.js';
import type { ConversationState } from '../../src/assembly/production-conversation-session.js';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createJournalWorker, openPreviewJournal, ModelNotStarted, ModelDisclosureRefused,
  createModelLaunchBoundary, type PreviewPorts } from './journal-test-worker.js';

// Execute the shipped host closure, substituting only its physical/model dependencies.
const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const signature = 'async ({ id, prepared, question, context: packet }) => {';
const body = host.split(`      model: ${signature}`)[1]!.split('\n      summaryCheck:')[0]!.trimEnd().replace(/,$/u, '');
const optionsBody = host.split('const conversationSessionOf = options => {')[1]!.split('\nconst sessionWorkOf')[0]!;
const mode = Function(`return options => {${optionsBody.replace(/;\s*$/u, '')}`)() as (options: Record<string, string>) => boolean;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const usage = { inputTokens: null, outputTokens: null, charge: null };
const update = (id: number, text: string) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });

function fixture(enabled = true, checkIntake = true, maxCalls = 200) {
  const root = mkdtempSync(join(tmpdir(), 'conversation-wiring-')); roots.push(root);
  const open = () => openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls, maxReplies: 20,
    maxTurns: 30, maxBytes: 262144, cursor: 0 });
  let journal = open();
  const f = assemblyRuntimeFixture();
  let now = 1000, launches = 0, calls = 0, fallback = 0, stopped = false, edges = 0;
  let destination = '', answer = JSON.stringify({ reply: 'A useful answer.', memory: [] });
  const files = new Map<string, string>(), delivered: string[] = [], sent: string[] = [];
  let state: ConversationState | null = null, busy = false;
  let sources: readonly unknown[] = [];
  let adapter: import('../../src/assembly/contracts.js').HarnessAdapterPort<2>;
  const adapt = (config: Omit<import('../../src/assembly/production-conversation-session.js').ConversationSessionConfig, 'store' | 'createAdapter'> & Pick<import('../../src/assembly/production-session-work.js').SessionWorkConfig, 'createDriver'>) => createConversationSessionPort({ ...config,
    store: { load: () => state, save: next => { state = structuredClone(next); } },
    createAdapter: resolveDelivery => {
      adapter = createSessionConversationAdapter({ createDriver: config.createDriver, io: config.io, resolveDelivery });
      const deliver = adapter.deliver;
      adapter.deliver = input => busy ? Promise.resolve({ state: 'busy-not-dispatched', evidence: 'proved busy' }) : deliver(input);
      return adapter;
    } });
  const openPort = () => value(adapt({ conversation: 'operator', allowanceDeadline: 9999999999999, authorized: () => true, currentAuthority: () => 'existing-role',
    createDriver: resolve => ({ owner: 'part-eight', launch: () => { launches++; return f.success('session:123:1'); },
      deliver: input => { if (checkIntake) expect(journal.view.order.some(turn => turn.id === input.intake && turn.reserved)).toBe(true);
        delivered.push(resolve(input.intake, input.digest)); calls++; files.set(destination, answer); return f.success('accepted'); },
      observe: () => f.success({ phase: 'output-observed', evidence: 'turn-closed:fake:1', detail: 'closed' }), stop: () => f.success(['123']) }),
    io: { clearResult: path => { destination = path; files.delete(path); }, readResult: path => files.get(path) ?? null,
      wait: async ms => { now += ms; }, modelCalls: () => calls, prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, openDelegations: [] }) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: f.c, now: () => now, stopped: () => stopped,
    append: record => { journal.append({ kind: 'session-work', record, at: now }); if (record.type === 'SessionWorkEdge' && !record.drawsOn) edges++; }, parent: 'runner', owner: 'machine',
    placement: 'local', transport: 'fake', workingScope: '/scope', resultDirectory: '/scope', artifact: 'worker',
    incarnation: 'one', deadlineMs: 10000, pollMs: 25, maxResultBytes: 65536, maxSteps: 8, maxCalls: 10 }));
  let port = openPort();
  const openModel = () => Function('journal', 'requireGroupDisclosure', 'toolsActive', 'toolTurnEligible', 'invokeTools',
    'invokeSubscription', 'recordedUsage', 'ModelDisclosureRefused', 'modelLaunch', 'conversationSession',
    'sessionWork', 'ModelNotStarted', 'conversationSessionAnswer', 'readAnswer', 'recordShape', 'shapesPath', `return (${signature}${body});`)(journal, async () => {}, () => false, () => false,
    () => { throw Error('unexpected tools fallback'); }, async () => { fallback++; return { state: 'complete', value: answer, usage }; },
    (input: unknown) => input, ModelDisclosureRefused, createModelLaunchBoundary(), enabled,
    { port, authority: 'existing-role' }, ModelNotStarted, conversationSessionAnswer, readAnswer, () => {}, '/unused') as PreviewPorts['model'];
  let model = openModel();
  const collectBody = host.split('      collectModel: async id => {')[1]!.split('\n      model:')[0]!.trimEnd().replace(/,$/u, '');
  const collectModel = (id: string) => Function('conversationSession', 'sessionWork', 'conversationSessionAnswer', 'recordShape', 'shapesPath',
    `return (async id => {${collectBody});`)(enabled, { port }, conversationSessionAnswer, () => {}, '/unused')(id);
  const openWorker = () => createJournalWorker(journal, { now: () => now, stopped: () => stopped,
    sources: () => sources, prepareModel: input => JSON.stringify({ ...input, responseContract: "decision-envelope-marker" }), model, collectModel,
    send: async input => { sent.push(input.expectedText); return sent.length; },
    checkOutbound: text => { if (text.includes('SECRET')) throw Error('credential'); } });
  let worker = openWorker();
  return { get journal() { return journal; }, get worker() { return worker; }, get model() { return model; }, get port() { return port; }, sent, delivered, edges: () => edges, counts: () => ({ launches, calls, fallback }),
    evidence: (value: unknown) => { sources = [value]; },
    busy: (value: boolean) => { busy = value; }, advance: (ms: number) => { now += ms; },
    state: () => state!, restore: (next: ConversationState) => { state = structuredClone(next); },
    restart: async (crash = false) => { if (!crash) await port.close(); journal.close(); journal = open(); port = openPort(); model = openModel(); worker = openWorker(); },
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
  const f = fixture(true, false);
  try {
    f.answer(row.output);
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
    const result = await f.model({ id: 'telegram:7654321:update:1', question: 'hello', context: '{}', prepared: '{}' });
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
      const result = await f.model({ id: `telegram:7654321:update:${n}`, question: 'hello', context: '{}', prepared: '{}' });
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
    expect(deferred.delivered).toHaveLength(1);
    expect(deferred.state().inputs[0]!.outcome).toMatchObject({ state: 'complete', text: row.output });
    expect(deferred.journal.view.order[0]!.modelState).toBe(immediate.journal.view.order[0]!.modelState);
    expect(deferred.sent).toEqual(immediate.sent);
    expect(deferred.journal.view.order[0]!.answerRetried).toBe(immediate.journal.view.order[0]!.answerRetried);
    if (row.frame === 595) expect(deferred.sent.join('\n')).toContain(JSON.parse(row.output).reply);
    await deferred.worker.drain(); expect(deferred.delivered).toHaveLength(1);
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
