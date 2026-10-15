import { describe, expect, it } from 'vitest';
import { createConversationSessionPort, type ConversationState } from '../../src/assembly/production-conversation-session.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createHash } from 'node:crypto';
import { createCodexConversationWorker } from '../../src/harness-adapters/codex-conversation-worker.js';
import { createProductionConversationAdapter, type ProductionSessionConfig, type SessionJournal } from '../../src/assembly/production-session-driver.js';
import type { HarnessInputDelivery } from '../../src/assembly/contracts.js';
import type { SessionProtocolIO } from '../../src/harness-adapters/session-protocol.js';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionProtocolIO } from '../../scripts/session-protocol-io.mjs';
import threadConfig from './fixtures/codex-thread-config-0.156.1.json' with { type: 'json' };
import captured from './fixtures/codex-app-server-0.156.1.json' with { type: 'json' };
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
function fixture(run = captured.runs[0]!) {
  const terminals = run.events.filter(event => event.method === 'turn/completed').map(event => event.params as { threadId: string; turn: { id: string } });
  let frames: unknown[] = [], live = true, stopped = false, turn = 0, file: string | null = null, cache = true, hold = false;
  let journal: SessionJournal = { sessions: [], deliveries: [], resumes: {} };
  const calls: { method: string; params: Readonly<Record<string, unknown>> }[] = [], opens: Parameters<SessionProtocolIO['open']>[0][] = [];
  const deliveries = new Map<string, HarnessInputDelivery>();
  const transport: SessionProtocolIO = {
    async open(input) { opens.push(input); live = true; return { identity: 'protocol:123:nonce',
      async request(method, params) { calls.push({ method, params });
        if (method === 'thread/start' || method === 'thread/resume') return { thread: { id: terminals[0]!.threadId } };
        if (method === 'turn/start') { frames.push(...run.events.filter(event => !hold || event.method !== 'turn/completed')); return { turn: { id: terminals[turn++]!.turn.id } }; }
        return {};
      }, notify(method, params) { calls.push({ method, params }); },
      drain() { const result = frames; frames = []; return result; }, alive: () => live, async close() { live = false; } }; },
    async close() { live = false; },
  };
  const config: ProductionSessionConfig = { operatorOwnUse: true, confinement: 'admitted', framework: 'codex-cli',
    executable: '/owned/worker', cwd: '/scope', home: '/owned/home', configHome: '/owned/profile', model: 'gpt-5.6-sol',
    context: {} as ProductionSessionConfig['context'], now: () => 1, stopped: () => stopped, resolveIntake: () => '',
    maxSessions: 2, turnDeadlineMs: 1000, readyTimeoutMs: 100, protectedSessions: [],
    toolAdmission: { command: (_claim, phase) => `/owned/admit ${phase}`, timeoutSeconds: 1 },
    modelGate: () => `http://127.0.0.1:1234/${'a'.repeat(32)}/claim`,
    connectors: () => ({ servers: ['account'], config: '{}', launch: { account: { command: '/owned/connector', args: ['account-ref'] } } }),
    continuation: () => ({ text: 'complete prior history', source: 'journal:previous' }),
    io: { exclusive: run => run(), tmux: () => ({ code: 0, stdout: '' }), sleep: () => {}, load: () => journal,
      save: value => { journal = value; }, readInbox: () => [], transcriptExists: () => cache, armDeadline: () => {} },
  };
  const io = { clearResult: () => { file = null; }, readResult: () => file };
  const make = (selectedTransport = transport, resolveDelivery = (operation: string) => deliveries.get(operation)) => createCodexConversationWorker({ configuration: () => config, transport: selectedTransport, io, resumeKey: 'topic:one', resolveDelivery });
  const spec = { operation: 'launch', claim: 'claim1', incarnation: 'inc1', artifact: 'artifact', workingScope: '/scope' };
  const delivery = (worker: Awaited<ReturnType<ReturnType<typeof make>['launch']>>, operation = 'input1') => {
    const text = `owner message ${operation}`; const value = { ...worker, operation, text, digest: hash(text), resultPath: '/scope/result', maxBytes: 65536 };
    deliveries.set(operation, value); return value;
  };
  return { make, config, io, transport, calls, opens, spec, delivery, terminals,
    set hold(value: boolean) { hold = value; }, set stopped(value: boolean) { stopped = value; }, set cache(value: boolean) { cache = value; },
    set file(value: string | null) { file = value; }, get journal() { return journal; },
  };
}
describe('registered continuing protocol worker', () => {
  it('replays the recorded two-turn binary capture with exact input/reply binding and prepared accounts', async () => {
    const f = fixture(), adapter = f.make(), worker = await adapter.launch(f.spec);
    for (const operation of ['input1', 'input2']) {
      const delivery = f.delivery(worker, operation); expect((await adapter.deliver(delivery)).state).toBe('accepted');
      const batch = await adapter.observe({ ...worker, delivery, cursor: 0, limit: 16 });
      expect(batch.observations).toEqual([{ kind: 'reply', delivery: operation, text: 'LOCAL_PROTOCOL_OK', digest: hash('LOCAL_PROTOCOL_OK') },
        { kind: 'turn-end', delivery: operation, state: 'completed' }]);
      expect((await adapter.observe({ ...worker, delivery, cursor: batch.cursor, limit: 16 })).observations).toEqual([]);
    }
    expect(f.calls.filter(call => call.method === 'thread/start')).toHaveLength(1);
    expect(f.calls.find(call => call.method === 'thread/start')!.params.config).toEqual(threadConfig.accepted.config);
    expect(f.calls.filter(call => call.method === 'turn/start')).toHaveLength(2);
    expect(f.opens[0]!.env.CODEX_HOME).toBe('/owned/profile');
    expect(f.opens[0]!.args.join(' ')).toContain('hooks.PreToolUse');
    expect(f.opens[0]!.args.join(' ')).toContain('hooks.PostToolUse');
    expect(f.opens[0]!.args.join(' ')).toContain('model_providers.instar-gate');
    expect(f.opens[0]!.args.join(' ')).toContain('mcp_servers.account');
    expect(f.journal.resumes['topic:one']).toBe(f.terminals[0]!.threadId);
  });
  it.each(['initialize', 'thread/start', 'thread/resume'])('retires a failed %s launch and reuses the adapter through the common host', async method => {
    const f = fixture();
    if (method === 'thread/resume') f.config.io.save({ ...f.journal, resumes: { 'topic:one': f.terminals[0]!.threadId } });
    let fail = true, released = 0, physicalCloses = 0;
    let state: ConversationState | null = null;
    const transport: SessionProtocolIO = { close: f.transport.close, async open(spec) {
      const connection = await f.transport.open(spec);
      return { ...connection, async request(name, params) {
        if (fail && name === method) { fail = false; throw Error('injected launch failure'); }
        return connection.request(name, params);
      }, async close() { physicalCloses++; await connection.close(); } };
    } };
    let adapter: ReturnType<typeof f.make>;
    const host = value(createConversationSessionPort({
      conversation: 'recovery', allowanceDeadline: 100000, authorized: () => true, currentAuthority: () => 'grant',
      store: { load: () => state, save: next => { state = next; } },
      createAdapter: resolve => (adapter = f.make(transport, resolve)),
      io: { ...f.io, modelCalls: () => 0, wait: async () => {}, prepareAdmission: () => {}, closeAdmission: () => {},
        admissionState: () => ({ refused: false, openDelegations: [] }) },
      resources: { admit: async () => ({ attach: async () => {}, release: async () => { released++; return true; } }) },
      context: assemblyRuntimeFixture().c, now: () => 1, stopped: () => false, append: () => {},
      parent: 'parent', owner: 'machine', placement: 'local', transport: 'protocol', workingScope: '/scope',
      resultDirectory: '/scope/results', artifact: 'artifact', incarnation: 'inc',
      deadlineMs: 2000, pollMs: 100, maxCalls: 6, maxSteps: 3, maxResultBytes: 65536,
    }));
    const request = (operation: string) => ({ operation, question: 'continue', context: '', authority: 'grant' });
    expect((await host.run(request('first'))).state).toBe('uncertain');
    expect(physicalCloses).toBe(1);
    expect(released).toBe(1);
    expect((state as ConversationState | null)?.claim).toBeNull();
    expect(await host.run(request('next'))).toMatchObject({ state: 'complete', text: 'LOCAL_PROTOCOL_OK' });
    expect(f.opens).toHaveLength(2);
    const worker = (state as ConversationState | null)!.worker!;
    await expect(adapter!.control({ ...worker, incarnation: 'stale', action: 'close', authority: 'grant', reason: 'test' })).rejects.toThrow('stale');
    await host.close(); expect(released).toBe(2);
  });
  it('does not clear an unconfirmed failed-launch connection', async () => {
    const f = fixture();
    const adapter = f.make({ close: async () => { throw Error('stop unconfirmed'); }, async open(spec) {
      const connection = await f.transport.open(spec);
      return { ...connection, request: async () => { throw Error('initialize failed'); },
        close: async () => { throw Error('stop unconfirmed'); } };
    } });
    await expect(adapter.launch(f.spec)).rejects.toThrow('stop unconfirmed');
    await expect(adapter.control({ ...f.spec, launch: '', action: 'close', authority: 'grant', reason: 'retire' })).rejects.toThrow('stale');
    await expect(adapter.control({ ...f.spec, launch: 'protocol:123:nonce', action: 'close', authority: 'grant', reason: 'retire' })).rejects.toThrow('stop unconfirmed');
  });
  it('checkpoint survives adapter replacement and a new admission claim without replay', async () => {
    const f = fixture(), a = f.make(), first = await a.launch(f.spec);
    await a.control({ ...first, action: 'close', authority: 'grant', reason: 'restart' });
    const b = f.make(); await b.launch({ ...f.spec, claim: 'claim2', incarnation: 'inc2' });
    expect(f.calls.filter(call => call.method === 'thread/resume').at(-1)?.params.threadId).toBe(f.terminals[0]!.threadId);
    expect(f.calls.some(call => call.method === 'turn/start')).toBe(false);
    expect(f.calls.find(call => call.method === 'thread/resume')!.params.config).toEqual(threadConfig.accepted.config);
  });
  it('cache miss restores agent-owned context and never replays an old turn', async () => {
    const f = fixture(), a = f.make(), first = await a.launch(f.spec);
    await a.control({ ...first, action: 'close', authority: 'grant', reason: 'restart' }); f.cache = false;
    const b = f.make(), second = await b.launch({ ...f.spec, claim: 'claim2', incarnation: 'inc2' });
    await b.deliver(f.delivery(second));
    expect(JSON.stringify(f.calls.filter(call => call.method === 'turn/start')[0]!.params)).toContain('complete prior history');
    expect(f.calls.filter(call => call.method === 'turn/start')).toHaveLength(1);
  });
  it('recorded failed turns cannot release a reply, including a result artifact', async () => {
    const f = fixture(captured.runs[1]!), a = f.make(), worker = await a.launch(f.spec), delivery = f.delivery(worker);
    await a.deliver(delivery); f.file = 'must not escape';
    expect((await a.observe({ ...worker, delivery, cursor: 0, limit: 16 })).observations).toEqual([
      { kind: 'turn-end', delivery: delivery.operation, state: 'no-reply' }]);
  });
  it('keeps a busy input undispatched, interrupts the exact open turn, and rejects another incarnation', async () => {
    const f = fixture(); f.hold = true;
    const a = f.make(), worker = await a.launch(f.spec), d = f.delivery(worker);
    await a.deliver(d);
    expect((await a.deliver(f.delivery(worker, 'queued'))).state).toBe('busy-not-dispatched');
    await expect(a.observe({ ...worker, incarnation: 'other', delivery: d, cursor: 0, limit: 16 })).rejects.toThrow('stale');
    expect((await a.control({ ...worker, action: 'close', authority: 'grant', reason: 'stop' })).state).toBe('closed');
    expect(f.calls.find(call => call.method === 'turn/interrupt')?.params).toEqual({ threadId: f.terminals[0]!.threadId, turnId: f.terminals[0]!.turn.id });
    expect(f.calls.filter(call => call.method === 'turn/start')).toHaveLength(1);
  });
  it('stopped and changed-digest inputs cannot dispatch', async () => {
    const f = fixture(), a = f.make(), worker = await a.launch(f.spec), d = f.delivery(worker);
    await expect(a.deliver({ ...d, text: 'changed' })).rejects.toThrow('durable delivery');
    f.stopped = true; await expect(a.deliver(d)).rejects.toThrow('stopped');
    expect(f.calls.filter(call => call.method === 'turn/start')).toHaveLength(0);
  });
  it('uses the existing Claude mapping without constructing a protocol transport', () => {
    const f = fixture(); let created = 0;
    const adapter = createProductionConversationAdapter({ configuration: () => ({ ...f.config, framework: 'claude-code' }),
      transport: () => { throw Error('default route touched protocol'); }, createDriver: () => { created++; return {} as never; },
      io: f.io as never, resolveDelivery: () => undefined });
    expect(adapter.describe()).toEqual({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false });
    expect(created).toBe(1);
  });
});

it('preserves recorded proof-room writer, Jev, review and delivered-reply bytes through the new adapter', async () => {
  const cascade = JSON.parse(readFileSync(new URL('../preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8'));
  const overcap = JSON.parse(readFileSync(new URL('../preview/fixtures/proofroom-summary-overcap-2026-09-30.json', import.meta.url), 'utf8'));
  type Raw = { id: string; raw: string | null };
  type Row = { kind: string; id?: string; body?: string; result?: { verdict?: string } };
  const rows = cascade.rows as Row[];
  const historical = JSON.parse(readFileSync(new URL('../preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
  // The fixtures retain their journal provenance and update ids. No semantic verdict is
  // made here: the transport must preserve the exact bytes, including "undecided".
  const examples = [...cascade.writer, ...cascade.review, ...cascade.jevFaithfulness,
    ...overcap.writer, ...overcap.jevFaithfulness, ...historical.otherShapes] as Raw[];
  for (const row of rows.filter(row => row.kind === 'intent' && typeof row.body === 'string')) examples.push({ id: row.id!, raw: row.body! });
  for (const example of examples) {
    const text = example.raw ?? '';
    const run = JSON.parse(JSON.stringify(captured.runs[0], (key, value) => key === 'text' ? text : value));
    const f = fixture(run), adapter = f.make(), worker = await adapter.launch(f.spec), delivery = f.delivery(worker, example.id);
    await adapter.deliver(delivery);
    const batch = await adapter.observe({ ...worker, delivery, cursor: 0, limit: 16 });
    if (text.trim()) expect(batch.observations[0], example.id).toMatchObject({ kind: 'reply', text, delivery: example.id });
    else expect(batch.observations, example.id).toEqual([{ kind: 'turn-end', delivery: example.id, state: 'no-reply' }]);
  }
  expect(examples.some(row => row.raw === null)).toBe(true); // recorded uncertain/empty writer results
  expect(examples.length).toBeGreaterThan(30);
});

it('continues across a real replay-process restart through the installed physical port', async () => {
  const root = mkdtempSync(join(tmpdir(), 'conversation-restart-'));
  const f = fixture();
  const physical = createSessionProtocolIO(root);
  const transport: SessionProtocolIO = { close: physical.close,
    open: launch => physical.open({ ...launch, executable: process.execPath,
      args: [fileURLToPath(new URL('./fixtures/protocol-process.mjs', import.meta.url))],
      cwd: root, deadline: Date.now() + 10000, requestTimeoutMs: 1000 }) };
  try {
    const first = f.make(transport), worker = await first.launch(f.spec), d = f.delivery(worker);
    await first.deliver(d);
    expect((await first.observe({ ...worker, delivery: d, cursor: 0, limit: 16 })).observations[0]).toMatchObject({ kind: 'reply', text: 'LOCAL_PROTOCOL_OK' });
    await first.control({ ...worker, action: 'close', authority: 'grant', reason: 'process restart' });
    const second = f.make(transport), resumed = await second.launch({ ...f.spec, claim: 'claim2', incarnation: 'inc2' });
    expect(resumed.launch).not.toBe(worker.launch);
    const next = f.delivery(resumed, 'second'); await second.deliver(next);
    expect((await second.observe({ ...resumed, delivery: next, cursor: 0, limit: 16 })).observations[0]).toMatchObject({ kind: 'reply', delivery: 'second' });
    expect(f.journal.resumes.claim2).toBe(f.journal.resumes.claim1);
    await second.control({ ...resumed, action: 'close', authority: 'grant', reason: 'test complete' });
  } finally {
    await physical.close('claim1', 'inc1'); await physical.close('claim2', 'inc2');
    rmSync(root, { recursive: true, force: true });
  }
});
