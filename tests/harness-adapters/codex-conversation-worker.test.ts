import { describe, expect, it } from 'vitest';
import { createConversationSessionPort, type ConversationState } from '../../src/assembly/production-conversation-session.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createHash } from 'node:crypto';
import { createCodexConversationWorker } from '../../src/harness-adapters/index.js';
import { createProductionConversationAdapter, type ProductionSessionConfig, type SessionJournal } from '../../src/assembly/production-session-driver.js';
import type { HarnessInputDelivery } from '../../src/assembly/contracts.js';
import type { SessionProtocolIO } from '../../src/harness-adapters/index.js';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionProtocolIO } from '../../scripts/session-protocol-io.mjs';
import threadConfig from './fixtures/codex-thread-config-0.156.1.json' with { type: 'json' };
import captured from './fixtures/codex-app-server-0.156.1.json' with { type: 'json' };
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
function fixture(run: { events: readonly { method: string; params: unknown }[] } = captured.runs[0]!,
  configuration: Partial<ProductionSessionConfig> = {}) {
  const terminals = run.events.filter(event => event.method === 'turn/completed').map(event => event.params as { threadId: string; turn: { id: string } });
  let frames: unknown[] = [], live = true, stopped = false, turn = 0, file: string | null = null, cache = true, hold = false;
  let journal: SessionJournal = { sessions: [], deliveries: [], resumes: {} };
  const calls: { method: string; params: Readonly<Record<string, unknown>> }[] = [], opens: Parameters<SessionProtocolIO['open']>[0][] = [];
  const deliveries = new Map<string, HarnessInputDelivery>();
  const transport: SessionProtocolIO = {
    async open(input) { opens.push(input); live = true; return { identity: opens.length === 1 ? 'protocol:123:nonce' : `protocol:123:nonce-${opens.length}`,
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
    ...configuration,
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
  it('restores the exact accepted input after confirmed closure with its original deadline', async () => {
    const f = fixture(); f.hold = true;
    const adapter = f.make(), first = await adapter.launch(f.spec), delivery = f.delivery(first);
    await adapter.deliver(delivery);
    await f.transport.close(first.claim, first.incarnation, first.launch);
    await adapter.control({ ...first, action: 'close', authority: 'grant', reason: 'lost worker' });
    f.hold = false;
    const next = await adapter.launch({ ...f.spec, claim: 'claim2', incarnation: 'inc2',
      restore: { operation: delivery.operation, digest: delivery.digest, deadline: 500 } });
    expect(f.opens[1]!.deadline).toBe(500);
    expect(f.calls.filter(call => call.method === 'turn/start')).toHaveLength(2);
    const restored = { ...delivery, ...next };
    expect((await adapter.observe({ ...next, delivery: restored, cursor: 0, limit: 16 })).observations).toEqual([
      { kind: 'reply', delivery: delivery.operation, text: 'LOCAL_PROTOCOL_OK', digest: hash('LOCAL_PROTOCOL_OK') },
      { kind: 'turn-end', delivery: delivery.operation, state: 'completed' },
    ]);
    await expect(adapter.deliver(restored)).rejects.toThrow(/already submitted/);
  });

  it.each(['live', 'digest', 'deadline', 'unsubmitted'] as const)('does not restore %s protocol input', async mode => {
    const f = fixture(), adapter = f.make(), first = await adapter.launch(f.spec), delivery = f.delivery(first);
    if (mode !== 'unsubmitted') await adapter.deliver(delivery);
    if (mode !== 'live') await adapter.control({ ...first, action: 'close', authority: 'grant', reason: 'retire' });
    await expect(adapter.launch({ ...f.spec, claim: 'claim2', incarnation: 'inc2', restore: {
      operation: delivery.operation, digest: mode === 'digest' ? 'wrong' : delivery.digest, deadline: mode === 'deadline' ? 1 : 500,
    } })).rejects.toThrow(/restor/);
    expect(f.opens).toHaveLength(1);
  });

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
    expect(batch.acknowledgedAt, example.id).toBe(1);
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


it('recorded protocol completion permits idle cleanup, while open turns and changed fingerprints refuse', async () => {
  const run = captured.runs[0]!;
  const terminal = run.events.findIndex(event => event.method === 'turn/completed');
  const f = fixture({ ...run, events: run.events.slice(0, terminal + 1) });
  const adapter = f.make(), worker = await adapter.launch(f.spec);
  expect(await adapter.observeIdle!(worker)).toBeNull();
  await adapter.deliver(f.delivery(worker));
  const evidence = await adapter.observeIdle!(worker); expect(evidence).toMatch(/^sha256:/);
  expect(await adapter.control({ ...worker, action: 'close', authority: 'grant', reason: 'idle cleanup', idleEvidence: 'stale' }))
    .toMatchObject({ state: 'refused' });
  expect(await adapter.observeIdle!(worker)).toBe(evidence);
  expect(await adapter.control({ ...worker, action: 'close', authority: 'grant', reason: 'idle cleanup', idleEvidence: evidence! }))
    .toMatchObject({ state: 'closed' });
  const busy = fixture({ ...run, events: run.events.slice(0, terminal + 1) }); busy.hold = true;
  const busyAdapter = busy.make(), busyWorker = await busyAdapter.launch(busy.spec);
  await busyAdapter.deliver(busy.delivery(busyWorker));
  expect(await busyAdapter.observeIdle!(busyWorker)).toBeNull();
});

it('carryover 08 reconstructs a completed Codex turn from durable physical frames without another request', async () => {
  const root = mkdtempSync(join(tmpdir(), 'conversation-capture-recovery-'));
  const f = fixture(), physical = createSessionProtocolIO(root);
  const transport = { ...physical, open: (launch: Parameters<SessionProtocolIO['open']>[0]) => physical.open({ ...launch,
    executable: process.execPath, args: [fileURLToPath(new URL('./fixtures/protocol-process.mjs', import.meta.url))],
    cwd: root, deadline: Date.now() + 10000, requestTimeoutMs: 1000 }) };
  try {
    const first = f.make(transport), worker = await first.launch(f.spec), delivery = f.delivery(worker);
    await first.deliver(delivery);
    await physical.close(worker.claim, worker.incarnation, worker.launch);
    const restartedPhysical = createSessionProtocolIO(root);
    const restarted = f.make(restartedPhysical);
    const recovered = await restarted.observe({ ...worker, delivery, cursor: 0, limit: 16 });
    expect(recovered.observations).toEqual([
      { kind: 'reply', delivery: delivery.operation, text: 'LOCAL_PROTOCOL_OK', digest: hash('LOCAL_PROTOCOL_OK') },
      { kind: 'turn-end', delivery: delivery.operation, state: 'completed' },
    ]);
    expect((await restarted.observe({ ...worker, delivery, cursor: 2, limit: 16 })).observations).toEqual([]);
    await expect(restarted.deliver(delivery)).rejects.toThrow();
  } finally { await physical.close('claim1', 'inc1'); rmSync(root, { recursive: true, force: true }); }
});

it.each(['complete', 'empty', 'missing-end', 'missing-response', 'duplicate-request', 'wrong-input', 'wrong-worker', 'missing-capture', 'legacy'] as const)(
  'carryover 08 Codex recovery checks %s evidence without dispatch', async mode => {
    const run = captured.runs[0]!;
    const f = fixture(), original = f.make(), worker = await original.launch(f.spec), delivery = f.delivery(worker);
    await original.deliver(delivery);
    const start = f.calls.find(call => call.method === 'turn/start')!;
    const request = { direction: 'request', frame: { id: 3, ...start } };
    const response = { direction: 'response', frame: { id: 3, result: { turn: { id: f.terminals[0]!.turn.id } } } };
    const events = run.events.filter(event => mode !== 'missing-end' || event.method !== 'turn/completed');
    const replay = events.map(event => ({ direction: 'response', frame: mode === 'empty'
      ? JSON.parse(JSON.stringify(event, (key, value) => key === 'text' ? '' : value)) : event }));
    f.transport.capture = () => {
      if (mode === 'missing-capture') throw Error('missing capture');
      return [request, ...(mode === 'duplicate-request' ? [request] : []),
        ...(mode === 'missing-response' ? [] : [response]), ...replay];
    };
    if (mode === 'legacy') { const { protocolDeliveries: _bindings, ...legacy } = f.journal; f.config.io.save(legacy); }
    await original.control({ ...worker, action: 'close', authority: 'grant', reason: 'restart' });
    const next = f.make(), count = f.calls.length;
    const query = { ...worker, delivery: mode === 'wrong-input' ? { ...delivery, text: 'changed' } : delivery, cursor: 0, limit: 16,
      ...(mode === 'wrong-worker' ? { incarnation: 'other' } : {}) };
    if (mode === 'complete') expect((await next.observe(query)).observations[0]).toMatchObject({ kind: 'reply', text: 'LOCAL_PROTOCOL_OK' });
    else if (mode === 'empty') expect((await next.observe(query)).observations).toEqual([{ kind: 'turn-end', delivery: delivery.operation, state: 'no-reply' }]);
    else await expect(next.observe(query)).rejects.toThrow();
    expect(f.calls.length).toBe(count);
  });

it.each([false, true])('carryover 08 proves a prepared Codex bootstrap unsent only when no turn request exists: dispatched=%s', async dispatched => {
  const f = fixture(), original = f.make(), worker = await original.launch(f.spec), delivery = f.delivery(worker);
  await original.deliver(delivery);
  const request = f.calls.find(call => call.method === 'turn/start')!;
  f.transport.capture = target => {
    expect(target.requireClosed).toBe(true);
    return [{ direction: 'request', frame: { method: 'initialize' } },
      ...(dispatched ? [{ direction: 'request', frame: { id: 3, ...request } }] : [])];
  };
  await original.control({ ...worker, action: 'close', authority: 'grant', reason: 'restart' });
  expect(await f.make().notDispatched!(delivery)).toBe(!dispatched);
});

it('carryover 08 reconstructs recorded summary, verdict and reply shapes after adapter loss', async () => {
  const historical = JSON.parse(readFileSync(new URL('../preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
  for (const sample of historical.otherShapes) {
    const run = JSON.parse(JSON.stringify(captured.runs[0], (key, value) => key === 'text' ? sample.raw : value));
    const f = fixture(run), original = f.make(), worker = await original.launch(f.spec), delivery = f.delivery(worker, sample.id);
    await original.deliver(delivery);
    f.transport.capture = () => [
      { direction: 'request', frame: { id: 3, ...f.calls.find(call => call.method === 'turn/start')! } },
      { direction: 'response', frame: { id: 3, result: { turn: { id: f.terminals[0]!.turn.id } } } },
      ...run.events.map((frame: unknown) => ({ direction: 'response', frame })),
    ];
    await original.control({ ...worker, action: 'close', authority: 'grant', reason: 'restart' });
    const count = f.calls.length;
    const batch = await f.make().observe({ ...worker, delivery, cursor: 0, limit: 16 });
    if (sample.raw.trim()) expect(batch.observations[0], sample.id).toMatchObject({ kind: 'reply', text: sample.raw });
    else expect(batch.observations, sample.id).toEqual([{ kind: 'turn-end', delivery: sample.id, state: 'no-reply' }]);
    expect(f.calls.length).toBe(count);
  }
});

it.each(['untyped', 'typed', 'missing-response', 'wrong-response'])('Codex ACK custody with delayed completion, %s', async mode => {
  const typed = mode !== 'untyped';
  const uncertain = mode === 'missing-response' || mode === 'wrong-response';
  const createHost = createConversationSessionPort;
  let clock = 1000, state: ConversationState | null = null, completed = false;
  const f = fixture(captured.runs[0]!, { now: () => clock, turnDeadlineMs: 1_000_000 }); f.hold = true;
  const transport: SessionProtocolIO = { close: f.transport.close, async open(spec) {
    const connection = await f.transport.open(spec);
    return { ...connection, async request(method, params) {
      const response = await connection.request(method, params);
      if (method === 'turn/start' && mode === 'missing-response') throw Error('injected RPC response loss');
      if (method === 'turn/start' && mode === 'wrong-response') return { turn: { id: null } };
      return response;
    }, drain() {
      const events = [...connection.drain()];
      if (clock >= 651000 && !completed) {
        completed = true;
        events.push(captured.runs[0]!.events.find(event => event.method === 'turn/completed')!);
      }
      return events;
    } };
  } };
  const host = value(createHost({
    conversation: 'ack-parity', allowanceDeadline: 2_000_000, authorized: () => true, currentAuthority: () => 'grant',
    store: { load: () => state, save: next => { state = next; } },
    createAdapter: resolve => f.make(transport, resolve),
    io: { ...f.io, modelCalls: () => 1, wait: async ms => { clock += ms; }, prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, openDelegations: [], uncertainEffects: 0 }) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: assemblyRuntimeFixture().c, now: () => clock, stopped: () => false, append: () => {},
    parent: 'parent', owner: 'machine', placement: 'local', transport: 'protocol', workingScope: '/scope',
    resultDirectory: '/scope/results', artifact: 'artifact', incarnation: 'inc',
    deadlineMs: 1_000_000, pollMs: 5000, maxCalls: 6, maxSteps: 3, maxResultBytes: 65536,
  }));
  const result = await host.run({ operation: 'one', question: 'continue', context: '', authority: 'grant',
    ...(typed ? { inbox: { type: 'request' as const, priority: 'normal' as const, createdAt: 1000, ttlMs: 1_500_000 } } : {}) });
  expect(f.calls.filter(call => call.method === 'turn/start')).toHaveLength(1);
  try {
    if (uncertain) {
      expect(result).toMatchObject({ state: 'uncertain' });
      expect((state as ConversationState | null)!.inputs[0]!.inbox?.acknowledgedAt).toBeUndefined();
      expect(await host.run({ operation: 'one', question: 'continue', context: '', authority: 'grant',
        inbox: { type: 'request', priority: 'normal', createdAt: 1000, ttlMs: 1_500_000 } })).toEqual(result);
      expect(f.calls.filter(call => call.method === 'turn/start')).toHaveLength(1);
      return;
    }
    expect(result, JSON.stringify({ clock, result })).toMatchObject({ state: 'complete', text: 'LOCAL_PROTOCOL_OK' });
    expect(clock).toBe(651000);
    expect((state as ConversationState | null)!.inputs[0]!.inbox?.acknowledgedAt).toBe(1000);
  }
  finally { await host.close(); }
});

it('ACK observation binds the submitted operation, digest and worker even while the turn is open', async () => {
  let clock = 1000;
  const f = fixture(captured.runs[0]!, { now: () => clock }); f.hold = true;
  const adapter = f.make(), worker = await adapter.launch(f.spec), delivery = f.delivery(worker);
  expect(await adapter.observe({ ...worker, delivery: null, cursor: 0, limit: 16 })).not.toHaveProperty('acknowledgedAt');
  await adapter.deliver(delivery); clock = 651000;
  const query = { ...worker, delivery, cursor: 0, limit: 16 };
  expect(await adapter.observe(query)).toMatchObject({ acknowledgedAt: 1000, observations: [] });
  for (const altered of [{ ...delivery, operation: 'another' }, { ...delivery, digest: hash('wrong') },
    { ...delivery, incarnation: 'stale' }])
    await expect(adapter.observe({ ...query, delivery: altered })).rejects.toThrow(/another input|stale/);
  expect(await adapter.observe({ ...worker, delivery: null, cursor: 0, limit: 16 })).not.toHaveProperty('acknowledgedAt');
  await adapter.control({ ...worker, action: 'close', authority: 'grant', reason: 'test complete' });
});
