import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal } from '../preview/journal.js';
import { createConversationTopicsPort } from '../../src/assembly/conversation-topics.js';
import type { ConversationTopicsConfig, ConversationTopicsState } from '../../src/assembly/conversation-topics.js';
import type { HarnessInputDelivery, HarnessWorkerHandle } from '../../src/assembly/contracts.js';
import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { nestedSessionWorkEdge, nestedSessionWorkClose } from '../../src/assembly/production-session-work.js';
// @ts-expect-error the shipped admission checkpoint is JavaScript
import { createAdmissionGate } from '../preview/admission-gate.mjs';
// @ts-expect-error the production encrypted custody store is JavaScript
import { createConversationHostStore } from '../../scripts/conversation-host-store.mjs';
const renewalRoots: string[] = [];
afterEach(() => { for (const root of renewalRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const digest = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 1));
async function until(test: () => boolean) { for (let i = 0; i < 500 && !test(); i++) await tick(); expect(test()).toBe(true); }

function fixture(maxSessions = 2, maxCalls = 6, resourceCap = 16, lifetime = 2000) {
  let state: ConversationTopicsState | null = null, now = 1000, live = 0, peak = 0, stopped = false, authorized = true, saveFails = false;
  let batchOutput: string | undefined, evidenceUnreadable = false;
  const refusedClose = new Set<string>(), failedClose = new Set<string>();
  const exited = new Set<string>(), held = new Set<string>(), launches: { topic: string; worker: HarnessWorkerHandle }[] = [];
  const delivered: { topic: string; input: HarnessInputDelivery }[] = [], closed: string[] = [];
  const edges: (SessionWorkEdge | SessionWorkEdgeClose)[] = [];
  const config: ConversationTopicsConfig = {
    context: assemblyRuntimeFixture().c, conversation: 'operator', topicOf: operation => operation.split(':')[0]!,
    allowanceDeadline: Math.max(100000, lifetime * 2), authorized: () => authorized, currentAuthority: () => 'grant',
    maxSessions, idleMs: lifetime === 2000 ? 500 : lifetime, deadlineMs: lifetime, pollMs: 25, maxSteps: 3, maxCalls, maxResultBytes: 65536,
    now: () => now, stopped: () => stopped, parent: 'run', owner: 'machine', placement: 'local', transport: 'fake',
    workingScope: '/scope', resultDirectory: '/scope/results', artifact: 'artifact', incarnation: 'boot',
    store: { load: () => structuredClone(state), save: next => { if (saveFails) throw Error('disk'); state = structuredClone(next); } },
    append: row => { edges.push(row); },
    recoveryEdges: () => { if (evidenceUnreadable) throw Error('unreadable journal'); return edges; },
    resources: { admit: async () => { if (live >= resourceCap) return null; live++; peak = Math.max(peak, live); return { attach: async () => {}, release: async () => { live--; return true; } }; } },
    io: { modelCalls: () => { throw Error('must not count another topic transcript'); }, wait: tick,
      readResult: () => null, clearResult: () => {}, prepareAdmission: (_claim, edge) => { expect(edge.topic).toMatch(/^(?:main|[1-9][0-9]*)$/u);
        expect(nestedSessionWorkEdge(edge, { id: 'nested-check', tool: 'Task' }, now).topic).toBe(edge.topic); }, closeAdmission: () => {},
      admissionState: () => ({ refused: false, openDelegations: [], uncertainEffects: 0 }) },
    createAdapter: topic => ({
      describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false }),
      launch: async input => { const worker = { launch: `worker-${launches.length}`, claim: input.claim, incarnation: input.incarnation };
        launches.push({ topic, worker }); return worker; },
      deliver: async input => {
        expect(state?.topics[topic]?.inputs.find(row => row.request.operation === input.operation)?.state).toBe('dispatching');
        port.reserveCall(input.claim, state!.topics[topic]!.claimCalls + 1);
        delivered.push({ topic, input }); return { state: 'accepted', evidence: 'fake' };
      },
      observe: async input => {
        if (!input.delivery && exited.has(topic)) return { observations: [{ kind: 'exit', evidence: 'exited:worker-exit' }], cursor: input.cursor + 1, complete: true };
        if (!input.delivery || held.has(topic)) return { observations: [], cursor: input.cursor, complete: true };
        const ids = state!.topics[topic]!.inputs.find(row => row.request.operation === input.delivery!.operation)!.batch ?? [];
        const text = batchOutput ?? (ids.length > 1 ? JSON.stringify({ results: ids.map(operation => ({ operation, answer: { reply: `answer to ${operation}`, memory: [] } })) }) : `answer in ${topic}`);
        return { observations: [{ kind: 'reply', delivery: input.delivery.operation, text, digest: digest(text) },
          { kind: 'turn-end', delivery: input.delivery.operation, state: 'completed' }], cursor: input.cursor + 2, complete: true };
      },
      observeIdle: async input => held.has(topic) || exited.has(topic) ? null : `idle:${input.launch}:${state!.topics[topic]!.turns}`,
      control: async input => {
        if (input.idleEvidence && failedClose.has(topic)) throw Error('actuator failed');
        if (input.idleEvidence && refusedClose.has(topic)) return { state: 'refused', evidence: 'new activity; kept' };
        closed.push(input.claim); return { state: 'closed', evidence: 'fake' }; },
    }),
  };
  let port = value(createConversationTopicsPort(config));
  const request = (operation: string) => ({ operation, question: 'hello', context: 'shared memory: Wren; own topic history', authority: 'grant' });
  return { get port() { return port; }, config, request, held, exited, refusedClose, failedClose, launches, delivered, closed, edges,
    batchOutput: (text: string) => { batchOutput = text; },
    unreadableEvidence: () => { evidenceUnreadable = true; },
    state: () => state!, counts: () => ({ live, peak }), advance: (ms: number) => { now += ms; },
    stop: () => { stopped = true; }, revoke: () => { authorized = false; }, failSave: () => { saveFails = true; },
    restart: (allowanceDeadline = config.allowanceDeadline) => { port = value(createConversationTopicsPort({ ...config, allowanceDeadline })); } };
}

it('two topics run concurrently with separate queues, cursors and claims under one reservation', async () => {
  const f = fixture(); f.held.add('7'); f.held.add('8');
  const a = f.port.run(f.request('7:a')), b = f.port.run(f.request('8:b'));
  await until(() => f.delivered.length === 2);
  expect(f.counts()).toEqual({ live: 2, peak: 2 });
  expect(new Set(f.launches.map(row => row.worker.claim)).size).toBe(2);
  expect(f.edges.filter(row => row.type === 'SessionWorkEdge' && !row.drawsOn)).toHaveLength(1);
  f.held.delete('8'); expect(await b).toMatchObject({ state: 'complete', text: 'answer in 8' });
  expect(f.state().topics['7']?.inputs[0]?.cursor).toBe(0);
  f.held.delete('7'); expect(await a).toMatchObject({ state: 'complete', text: 'answer in 7' });
  expect(f.state().topics['7']?.inputs[0]?.cursor).toBe(2);
  expect(await f.port.run(f.request('7:a'))).toMatchObject({ state: 'complete' });
  expect(f.delivered).toHaveLength(2); await f.port.close();
});

it('the cap queues durably, retires an idle topic and resumes it with a fresh identity and saved history', async () => {
  const f = fixture(1, 6, 16, 600000); f.held.add('7');
  const a = f.port.run(f.request('7:a')); await until(() => f.delivered.length === 1);
  const b = f.port.run(f.request('8:b'));
  await until(() => !!f.state().topics['8']?.inputs.length);
  expect(f.counts().peak).toBe(1); expect(f.delivered).toHaveLength(1);
  f.held.delete('7'); await a; await b;
  f.advance(30000); await f.port.maintain(); f.advance(30000); await f.port.maintain();
  expect(f.closed).toContain(f.launches[0]!.worker.claim); expect(f.counts().peak).toBe(1);
  await f.port.run(f.request('7:c'));
  f.advance(30000); await f.port.maintain(); f.advance(30000); await f.port.maintain();
  expect(f.launches.map(row => row.topic)).toEqual(['7', '8', '7']);
  expect(f.launches[2]!.worker.claim).not.toBe(f.launches[0]!.worker.claim);
  expect(f.delivered[2]!.input.text).not.toContain('answer in 7');
  expect(f.state().topics['7']!.inputs[0]!.outcome?.text).toBe('answer in 7');
  expect(f.delivered[2]!.input.text).toContain('shared memory: Wren');
  await f.port.close();
});

it('idle maintenance retires a worker without resetting its spent allowance or cursor', async () => {
  const f = fixture(2, 6, 16, 600000); Object.assign(f.config, { idleMs: 500 }); await f.port.run(f.request('main:a'));
  f.advance(499); await f.port.maintain(); expect(f.counts().live).toBe(1);
  f.advance(1); await f.port.maintain(); expect(f.counts().live).toBe(1);
  f.advance(120000); await f.port.maintain(); expect(f.counts().live).toBe(1);
  f.advance(30000); await f.port.maintain(); expect(f.counts().live).toBe(0);
  expect(f.state().topics.main?.spent).toBe(1);
  await f.port.run(f.request('main:b')); expect(f.launches).toHaveLength(2);
  expect(f.state().topics.main?.inputs[0]?.cursor).toBe(2); await f.port.close();
});

it('every topic shares one allowance, renewed only after exhaustion and idle retirement', async () => {
  const f = fixture(2, 2);
  await Promise.all([f.port.run(f.request('7:a')), f.port.run(f.request('8:b'))]);
  expect(Object.values(f.state().topics).reduce((sum, row) => sum + row.spent, 0)).toBe(2);
  await f.port.close(); f.restart();
  expect(await f.port.run(f.request('9:c'))).toMatchObject({ state: 'complete' });
  expect(f.delivered).toHaveLength(3);
  expect(f.edges.filter(row => row.type === 'SessionWorkEdge' && !row.drawsOn)).toHaveLength(2);
  expect(f.edges.find(row => row.id === 'operator:allowance:renew')).toMatchObject({ calls: 2, reserved: 2 });
  await f.port.close();
});

it('per-topic FIFO survives an idle replacement and rejects changed bytes under the same operation', async () => {
  const f = fixture(); f.held.add('7');
  const a = f.port.run(f.request('7:a')); await until(() => f.delivered.length === 1);
  const b = f.port.run(f.request('7:b')); await tick(); expect(f.delivered).toHaveLength(1);
  f.held.delete('7'); await Promise.all([a, b]);
  expect(f.delivered.map(row => row.input.operation)).toEqual(['7:a', '7:b']);
  await expect(f.port.run({ ...f.request('7:a'), question: 'changed' })).rejects.toThrow(/conflict/);
  await f.port.close();
});

it('stop cancels active and capacity-waiting work without launching the queued topic', async () => {
  const f = fixture(1); f.held.add('7');
  const a = f.port.run(f.request('7:a')); await until(() => f.delivered.length === 1);
  const b = f.port.run(f.request('8:b')); await until(() => !!f.state().topics['8']);
  f.stop(); await f.port.close(); await Promise.all([a, b]);
  expect(f.launches).toHaveLength(1); expect(f.counts().live).toBe(0);
  expect(f.port.available()).toBe(false);
});

it('a failed durable save cannot forward another call', async () => {
  const f = fixture(); await f.port.run(f.request('7:a')); const claim = f.launches[0]!.worker.claim;
  f.failSave(); expect(() => f.port.reserveCall(claim, 2)).toThrow('disk');
  expect(f.state().topics['7']?.spent).toBe(1);
});

it('a withdrawn grant and an unknown claim cannot spend the shared allowance', async () => {
  const f = fixture(); await f.port.run(f.request('7:a'));
  expect(() => f.port.reserveCall('foreign', 1)).toThrow(/unknown/);
  f.revoke(); expect(() => f.port.reserveCall(f.launches[0]!.worker.claim, 2)).toThrow(/grant/);
  await f.port.close();
});

it('invalid caps and malformed group custody refuse explicitly instead of resetting liability', () => {
  const f = fixture();
  expect(createConversationTopicsPort({ ...f.config, maxSessions: 0 }).kind).toBe('Refused');
  expect(createConversationTopicsPort({ ...f.config, idleMs: 0 }).kind).toBe('Refused');
  expect(createConversationTopicsPort({ ...f.config, store: { load: () => ({ version: 1, conversation: 'operator' }) as ConversationTopicsState, save: () => {} } }).kind).toBe('Refused');
});

it('upgrades group custody in place: retires the old worker, splits queues and preserves unknown work and liability', async () => {
  const f = fixture();
  await f.port.run(f.request('7:a')); await f.port.run(f.request('8:b'));
  const original = structuredClone(f.state()); await f.port.close();
  const pending = { ...original.topics['8']!.inputs[0]!, request: f.request('8:c'), state: 'queued' as const,
    digest: digest(JSON.stringify(f.request('8:c'))), delivery: null, cursor: 0, reply: null, outcome: null, attempts: 0, retryAt: 0 };
  const legacy = { ...original.topics['7']!, conversation: 'operator', spent: 2,
    inputs: [...original.topics['7']!.inputs, { ...original.topics['8']!.inputs[0]!, state: 'accepted' as const, outcome: null }, pending] };
  const load = f.config.store.load;
  f.config.store.load = () => legacy; f.restart(); f.config.store.load = load;
  await f.port.maintain();
  expect(f.state().legacyImported).toBe(true);
  expect(f.state().legacy?.inputs).toHaveLength(3);
  expect(f.state().topics['7']?.inputs[0]?.outcome?.state).toBe('complete');
  expect(f.state().topics['8']?.inputs[0]?.outcome).toMatchObject({ state: 'uncertain', detail: expect.stringContaining('no automatic replay') });
  expect(f.delivered.map(row => row.input.operation)).toEqual(['7:a', '8:b', '8:c']);
  expect(f.closed).toContain(legacy.claim);
  expect(f.state().legacy!.spent + Object.values(f.state().topics).reduce((sum, row) => sum + row.spent, 0)).toBe(3);
  expect(f.edges.filter(row => row.type === 'SessionWorkEdge' && !row.drawsOn)).toHaveLength(1);
  await f.port.close(); f.restart(); await f.port.maintain();
  expect(f.delivered).toHaveLength(3); await f.port.close();
});

it('reclaims an idle topic when the installation resource ceiling is tighter than the topic cap', async () => {
  const f = fixture(2, 6, 1, 600000);
  await f.port.run(f.request('7:a'));
  expect(await f.port.run(f.request('8:b'))).toMatchObject({ state: 'queued' });
  f.advance(30000); await f.port.maintain(); f.advance(30000); await f.port.maintain();
  expect((await f.port.collect('8:b'))?.outcome).toMatchObject({ state: 'complete' });
  expect(f.counts().peak).toBe(1); expect(f.launches.map(row => row.topic)).toEqual(['7', '8']);
  await f.port.close();
});

it.each([200000, 50000])('reopened and new topics keep the earlier installation deadline (%s)', async allowanceDeadline => {
  const f = fixture(); await f.port.run(f.request('7:a')); await f.port.close();
  f.restart(allowanceDeadline);
  const deadline = Math.min(100000, allowanceDeadline);
  f.advance(deadline - 1001);
  expect(f.port.available()).toBe(true);
  expect(await f.port.run(f.request('8:b'))).toMatchObject({ state: 'complete' });
  expect(f.state().topics['8']!.edge!.budget.deadline).toBe(deadline);
  f.advance(1); expect(f.port.available()).toBe(false);
  expect(() => f.port.reserveCall(f.state().topics['8']!.claim!, 2)).toThrow(/lifetime/);
  await expect(f.port.run(f.request('9:c'))).rejects.toThrow(/unavailable/);
  expect(await f.port.collect('7:a')).toMatchObject({ outcome: { state: 'complete' } });
  expect(await f.port.collect('8:b')).toMatchObject({ outcome: { state: 'complete' } });
  expect(await f.port.collect('9:absent')).toBeNull();
  await f.port.maintain(); expect(f.counts().live).toBe(0);
});


it('three waiting messages share the next turn and retain three terminal outcomes in intake order', async () => {
  const f = fixture(); f.held.add('7');
  const first = f.port.run(f.request('7:first'));
  await until(() => f.delivered.length === 1);
  const waiting = ['7:two', '7:three', '7:four'].map(id => f.port.run(f.request(id)));
  await until(() => f.state().topics['7']!.inputs.length === 4);
  f.held.delete('7'); await Promise.all([first, ...waiting]);
  expect(f.delivered.map(row => row.input.operation)).toEqual(['7:first', '7:two']);
  expect(f.state().topics['7']!.inputs.slice(1).map(row => row.outcome?.text))
    .toEqual(['7:two', '7:three', '7:four'].map(id => JSON.stringify({ reply: `answer to ${id}`, memory: [] })));
  expect(f.state().topics['7']!.turns).toBe(2);
  const saved = structuredClone(f.state());
  await f.port.close(); f.restart(); await f.port.maintain();
  expect(f.delivered).toHaveLength(2);
  expect(f.state().topics['7']!.inputs.map(row => row.outcome)).toEqual(saved.topics['7']!.inputs.map(row => row.outcome));
  await f.port.close();
});

it('recovers a closed batch before its terminal snapshot without dispatching any member twice', async () => {
  const f = fixture();
  const ids = ['7:one', '7:two', '7:three'];
  await f.port.runBatch(ids.map(f.request));
  const complete = structuredClone(f.state());
  const interrupted = { ...complete, topics: { ...complete.topics, '7': { ...complete.topics['7']!,
    inputs: complete.topics['7']!.inputs.map(row => ({ ...row, state: 'accepted' as const, outcome: null, reply: null, cursor: 0 })) } } };
  const load = f.config.store.load;
  f.config.store.load = () => interrupted; f.restart(); f.config.store.load = load;
  await f.port.maintain();
  expect(f.delivered).toHaveLength(1);
  expect(f.state().topics['7']!.inputs.map(row => row.outcome?.text))
    .toEqual(complete.topics['7']!.inputs.map(row => row.outcome?.text));
  await f.port.close();
});


it.each([
  '{}',
  JSON.stringify({ results: [{ operation: '7:one', answer: { reply: 'one' } }] }),
  JSON.stringify({ results: [{ operation: '7:two', answer: { reply: 'two' } }, { operation: '7:one', answer: { reply: 'one' } }] }),
  JSON.stringify({ results: [{ operation: '7:one', answer: { reply: 'one' } }, { operation: '7:one', answer: { reply: 'duplicate' } }] }),
])('a malformed or misattributed batch cannot partially settle as success: %s', async output => {
  const f = fixture(); f.batchOutput(output);
  const results = await f.port.runBatch(['7:one', '7:two'].map(f.request));
  expect(results.every(result => result.state === 'uncertain')).toBe(true);
  expect(f.state().topics['7']!.inputs.every(row => row.state === 'settled' && row.outcome?.state === 'uncertain')).toBe(true);
  await f.port.close(); f.restart(); await f.port.maintain(); expect(f.delivered).toHaveLength(1); await f.port.close();
});

it('a batch cannot borrow another topic identity or bypass stop', async () => {
  const f = fixture();
  await expect(f.port.runBatch(['7:one', '8:two'].map(f.request))).rejects.toThrow(/one topic/);
  expect(f.delivered).toHaveLength(0); f.stop();
  await expect(f.port.runBatch(['7:one', '7:two'].map(f.request))).rejects.toThrow(/unavailable/);
  expect(f.delivered).toHaveLength(0);
});

it('an invalid recovered batch settles uncertain and does not wedge later input', async () => {
  const f = fixture(); await f.port.runBatch(['7:one', '7:two'].map(f.request));
  const complete = structuredClone(f.state());
  const interrupted = { ...complete, topics: { ...complete.topics, '7': { ...complete.topics['7']!,
    inputs: complete.topics['7']!.inputs.map(row => ({ ...row, state: 'accepted' as const, outcome: null, reply: null, cursor: 0 })) } } };
  const load = f.config.store.load;
  f.config.store.load = () => interrupted; f.restart(); f.config.store.load = load; f.batchOutput('{}');
  await f.port.maintain();
  expect(f.state().topics['7']!.inputs.every(row => row.outcome?.state === 'uncertain')).toBe(true);
  expect(f.delivered).toHaveLength(1);
  expect((await f.port.run(f.request('7:later'))).state).toBe('complete');
  await f.port.close();
});

// A process restart constructs a fresh, empty admission gate. It must neither block
// other topics nor reopen a claim whose tools might already have executed.
it.each(['complete', 'missing', 'unreadable', 'open-child', 'uncertain-child', 'wrong-parent', 'bad-receipt'] as const)(
  'fresh real admission gate recovers a batch with %s durable evidence', async evidence => {
    const f = fixture();
    const makeGate = () => createAdmissionGate({ append: (row: SessionWorkEdge | SessionWorkEdgeClose) => f.edges.push(row),
      effects: {}, stopped: () => false, now: () => 1000 });
    let gate = await makeGate();
    f.config.io.prepareAdmission = (claim, edge) => { gate.open(claim, { framework: 'claude-code', allowance: edge.budget.calls, edge }); };
    f.config.io.admissionState = claim => gate.state(claim);
    f.config.io.closeAdmission = claim => { gate.close(claim); };
    try {
      await f.port.runBatch(['7:one', '7:two'].map(f.request));
      const complete = structuredClone(f.state()), old = complete.topics['7']!;
      const process = f.edges.find((row): row is SessionWorkEdge => row.type === 'SessionWorkEdge' && row.id === `${old.claim}:process`)!;
      const child = nestedSessionWorkEdge(process, { id: 'child-1', tool: 'Task' }, 1000);
      f.edges.push(child);
      if (evidence !== 'open-child') f.edges.push(nestedSessionWorkClose(child,
        evidence === 'uncertain-child' ? 'uncertain' : 'complete', 'recorded child result', 'receipt:child', 3, 1001));
      if (evidence === 'missing') f.edges.splice(0);
      if (evidence === 'wrong-parent') f.edges.splice(f.edges.indexOf(process), 1, { ...process, parent: 'other' });
      if (evidence === 'unreadable') f.unreadableEvidence();
      await gate.stop(); gate = await makeGate();
      expect(gate.state(old.claim)).toBeNull();
      const load = f.config.store.load;
      f.config.store.load = () => ({ ...complete, topics: { ...complete.topics, '7': { ...old,
        inputs: old.inputs.map(row => ({ ...row, state: 'accepted', outcome: null, reply: null, cursor: 0 })) } } });
      f.restart(); f.config.store.load = load;
      if (evidence === 'bad-receipt') f.batchOutput('{}');
      await f.port.maintain();
      expect(gate.state(old.claim)).toBeNull(); // Recovery never reopens the old allowance.
      expect(f.closed).toContain(old.claim);
      expect(f.delivered).toHaveLength(1);
      expect(f.state().topics['7']!.inputs.map(row => row.outcome?.state)).toEqual(
        evidence === 'complete' ? ['complete', 'complete'] : ['uncertain', 'uncertain']);
      if (evidence === 'complete') expect(f.state().topics['7']!.inputs.map(row => row.outcome?.text))
        .toEqual(old.inputs.map(row => row.outcome?.text));
      expect((await f.port.run(f.request('8:later'))).state).toBe('complete');
      expect((await f.port.run(f.request('7:later'))).state).toBe('complete');
      expect(f.delivered.map(row => row.input.operation)).toEqual(['7:one', '8:later', '7:later']);
    } finally { await f.port.close(); await gate.stop(); }
  });

it('retains the waiting batch until the topic handoff is ready, then uses its new authority', async () => {
  const f = fixture(); let ready = false, preparations = 0, authority = 'previous grant';
  const topicConfig: NonNullable<ConversationTopicsConfig['topicConfig']> = () => ({ io: f.config.io, resources: f.config.resources,
    authorized: () => true, currentAuthority: () => authority,
    prepareTurn: async () => { preparations++; if (ready) authority = 'replacement grant'; return ready; },
    createAdapter: resolve => f.config.createAdapter('7', resolve) });
  Object.assign(f.config, { topicConfig });
  const a = f.port.run(f.request('7:a')), b = f.port.run(f.request('7:b'));
  await until(() => preparations > 0 && f.state().topics['7']?.inputs.length === 2);
  expect(f.delivered).toHaveLength(0);
  expect(f.state().topics['7']!.inputs.map(row => row.state)).toEqual(['queued', 'queued']);
  expect(await a).toMatchObject({ state: 'queued' });
  expect(await b).toMatchObject({ state: 'queued' });
  ready = true; await f.port.maintain();
  expect(await f.port.run(f.request('7:a'))).toMatchObject({ state: 'complete' });
  expect(await f.port.run(f.request('7:b'))).toMatchObject({ state: 'complete' });
  expect(f.delivered).toHaveLength(1);
  expect(f.state().topics['7']!.inputs[0]!.batch).toEqual(['7:a', '7:b']);
  expect(f.edges.filter(row => row.type === 'SessionWorkEdge').every(row => row.authority === 'replacement grant')).toBe(true);
  expect(f.state().topics['7']!.spent).toBe(1);
  await f.port.close();
});

it('four busy topics all receive workers when measured headroom exists', async () => {
  const f = fixture(8); Object.assign(f.config, { capacity: async () => ({ admit: true, memoryPressure: false }) });
  for (const topic of ['7', '8', '9', '10']) f.held.add(topic);
  const runs = [...f.held].map(topic => f.port.run(f.request(`${topic}:a`)));
  await until(() => f.delivered.length === 4);
  expect(f.counts()).toEqual({ live: 4, peak: 4 });
  f.held.clear(); await Promise.all(runs); await f.port.close();
});

it('low CPU headroom preserves input queued, then drains without resubmission', async () => {
  const f = fixture(8); let room = false;
  Object.assign(f.config, { capacity: async () => ({ admit: room, memoryPressure: false }) });
  expect(await f.port.run(f.request('7:a'))).toMatchObject({ state: 'queued' });
  expect(f.state().topics['7']!.inputs[0]).toMatchObject({ state: 'queued', delivery: null, attempts: 0 });
  expect(f.launches).toHaveLength(0);
  room = true; await f.port.maintain();
  expect(await f.port.collect('7:a')).toMatchObject({ outcome: { state: 'complete' } });
  expect(f.delivered).toHaveLength(1); await f.port.close();
});

it('idle context survives six minutes and two hours, with the same worker on return', async () => {
  const f = fixture(8, 6, 16, 14_400_000);
  await f.port.run(f.request('7:a')); f.advance(360000); await f.port.maintain();
  expect(f.counts().live).toBe(1);
  f.advance(7_200_000); await f.port.maintain();
  await f.port.run(f.request('7:b')); expect(f.launches).toHaveLength(1);
  await f.port.close();
});

it('memory pressure retires the oldest idle worker, never a busy worker', async () => {
  const f = fixture(8, 6, 16, 600000); let pressure = false;
  Object.assign(f.config, { capacity: async () => ({ admit: !pressure, memoryPressure: pressure }) });
  await f.port.run(f.request('7:a')); f.advance(1);
  await f.port.run(f.request('8:a')); f.advance(1);
  f.held.add('9'); const busy = f.port.run(f.request('9:a'));
  await until(() => f.delivered.length === 3);
  // Refresh 7, so 8 is LRU despite map insertion order.
  await f.port.run(f.request('7:b')); pressure = true;
  await f.port.maintain(); expect(f.closed).toEqual([]);
  f.advance(30000); await f.port.maintain(); expect(f.closed).toEqual([]);
  f.advance(30000); await f.port.maintain();
  expect(f.closed).toEqual([f.launches[1]!.worker.claim]);
  expect(f.counts().live).toBe(2);
  f.held.clear(); await busy; await f.port.close();
});

it('a replacement also waits for headroom while a healthy retained worker can still answer', async () => {
  const f = fixture(8); let room = true;
  Object.assign(f.config, { capacity: async () => ({ admit: room, memoryPressure: false }) });
  await f.port.run(f.request('7:a')); room = false;
  expect(await f.port.run(f.request('7:b'))).toMatchObject({ state: 'complete' });
  f.advance(2000);
  expect(await f.port.run(f.request('7:c'))).toMatchObject({ state: 'queued' });
  expect(f.launches).toHaveLength(1);
  room = true; await f.port.maintain();
  expect(await f.port.collect('7:c')).toMatchObject({ outcome: { state: 'complete' } });
  expect(f.launches).toHaveLength(2); await f.port.close();
});

it('an observed idle exit cannot replace a worker without current capacity', async () => {
  const f = fixture(); let room = true;
  Object.assign(f.config, { capacity: async () => ({ admit: room, memoryPressure: !room }) });
  await f.port.run(f.request('7:a'));
  room = false; f.exited.add('7');
  expect(await f.port.run(f.request('7:b'))).toMatchObject({ state: 'queued' });
  expect(f.launches).toHaveLength(1); expect(f.delivered).toHaveLength(1);
  expect(f.state().topics['7']!.inputs[1]).toMatchObject({ state: 'queued', delivery: null, attempts: 0 });
  room = true; f.exited.clear(); await f.port.maintain();
  expect(await f.port.collect('7:b')).toMatchObject({ outcome: { state: 'complete' } });
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(2);
  await f.port.maintain(); expect(f.delivered).toHaveLength(2); await f.port.close();
});

it('capacity is measured after a busy slot wait and queued input drains when it returns', async () => {
  const f = fixture(1, 6, 16, 600000); let room = true, waiting = false;
  Object.assign(f.config, { capacity: async () => ({ admit: room, memoryPressure: !room }) });
  f.held.add('7'); const first = f.port.run(f.request('7:a'));
  await until(() => f.delivered.length === 1);
  f.config.io.wait = async () => { waiting = true; await tick(); };
  const second = f.port.run(f.request('8:b'));
  await until(() => waiting);
  room = false; f.held.clear(); await first;
  expect(await second).toMatchObject({ state: 'queued' });
  expect(f.launches).toHaveLength(1); expect(f.delivered).toHaveLength(1);
  expect(f.state().topics['8']!.inputs[0]).toMatchObject({ state: 'queued', delivery: null, attempts: 0 });
  room = true; f.advance(30000); await f.port.maintain(); f.advance(30000); await f.port.maintain();
  expect(await f.port.collect('8:b')).toMatchObject({ outcome: { state: 'complete' } });
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(2);
  await f.port.maintain(); expect(f.delivered).toHaveLength(2); await f.port.close();
});

const recordedCapacityShapes = JSON.parse(readFileSync(new URL('../preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(recordedCapacityShapes.otherShapes)('capacity wait preserves recorded $kind ($id) before dispatch', async sample => {
  const f = fixture(8); let room = false;
  Object.assign(f.config, { capacity: async () => ({ admit: room, memoryPressure: false }) });
  const request = { ...f.request('7:recorded'), context: JSON.stringify({ recorded: sample.raw }) };
  expect(await f.port.run(request)).toMatchObject({ state: 'queued' });
  expect(f.state().topics['7']!.inputs[0]!.request).toEqual(request);
  expect(f.delivered).toHaveLength(0);
  room = true; await f.port.maintain();
  expect(f.delivered).toHaveLength(1); expect(f.delivered[0]!.input.text).toContain(request.context);
  await f.port.maintain(); expect(f.delivered).toHaveLength(1); await f.port.close();
});

it.each(recordedCapacityShapes.otherShapes)('capacity recovery preserves topic-local grounding for recorded $kind ($id)', async sample => {
  const f = fixture(8); let room = false;
  const snapshots: { topic: string; text: string }[] = [];
  const topicConfig: NonNullable<ConversationTopicsConfig['topicConfig']> = topic => ({
    io: f.config.io, resources: f.config.resources, authorized: f.config.authorized,
    currentAuthority: f.config.currentAuthority,
    createAdapter: resolve => {
      const adapter = f.config.createAdapter(topic, resolve);
      return { ...adapter, deliver: async input => {
        snapshots.push({ topic, text: input.text }); return adapter.deliver(input);
      } };
    },
  });
  Object.assign(f.config, { topicConfig, capacity: async () => ({ admit: room, memoryPressure: false }) });
  for (const topic of ['7', '8']) {
    const request = { ...f.request(`${topic}:recorded`), context: JSON.stringify({ topic, recorded: sample.raw }) };
    expect(await f.port.run(request)).toMatchObject({ state: 'queued' });
    expect(f.state().topics[topic]!.inputs[0]!.request).toEqual(request);
  }
  expect(snapshots).toHaveLength(0); expect(f.delivered).toHaveLength(0);
  room = true; await f.port.maintain();
  expect(snapshots).toHaveLength(2);
  for (const topic of ['7', '8']) {
    const delivered = f.delivered.find(row => row.topic === topic)!;
    expect(snapshots.find(row => row.topic === topic)?.text).toBe(delivered.input.text);
    expect(delivered.input.text).toContain(JSON.stringify({ topic, recorded: sample.raw }));
    expect(await f.port.collect(`${topic}:recorded`)).toMatchObject({ outcome: { state: 'complete' } });
  }
  await f.port.maintain(); expect(f.delivered).toHaveLength(2); await f.port.close();
});

// The review reproduction also covers the retry after reclaiming an idle topic.
it.each([false, true])('physical lease wait rechecks headroom (retry=%s)', async retry => {
  const f = fixture(2, 6, 16, 600000); let room = true, entered = false, calls = 0;
  Object.assign(f.config, { capacity: async () => ({ admit: room, memoryPressure: !room }) });
  if (retry) await f.port.run(f.request('8:resident'));
  const before = f.delivered.length;
  let resume!: () => void;
  const waiting = new Promise<void>(resolve => { resume = resolve; });
  const admit = f.config.resources.admit;
  Object.assign(f.config.resources, { admit: async () => {
    calls++;
    if (retry && f.counts().live > 0) return null;
    entered = true; await waiting; return admit();
  } });
  const request = f.request('7:physical');
  let pending = f.port.run(request);
  if (retry) {
    expect(await pending).toMatchObject({ state: 'queued' });
    f.advance(30000); await f.port.maintain();
    f.advance(30000); pending = f.port.run(request);
  }
  await until(() => entered);
  const reservation = structuredClone(f.state().edge);
  const input = structuredClone(f.state().topics['7']!.inputs[0]!);
  room = false; resume();
  expect(await pending).toMatchObject({ state: 'queued' });
  expect(f.launches).toHaveLength(before); expect(f.delivered).toHaveLength(before);
  expect(f.counts().live).toBe(0);
  expect(f.state().edge).toEqual(reservation);
  expect(f.state().topics['7']).toMatchObject({ spent: 0, worker: null, claim: null, reserved: true });
  expect(f.state().topics['7']!.inputs[0]).toMatchObject({ request, digest: input.digest, state: 'queued', delivery: null, attempts: 0 });
  room = true; await f.port.maintain();
  expect(await f.port.collect(request.operation)).toMatchObject({ outcome: { state: 'complete' } });
  expect(f.launches).toHaveLength(before + 1); expect(f.delivered).toHaveLength(before + 1);
  expect(f.state().edge).toEqual(reservation);
  await f.port.maintain(); expect(f.delivered).toHaveLength(before + 1);
  await f.port.close(); expect(f.counts().live).toBe(0);
});

it('an unreadable post-admission capacity sample releases the unused lease', async () => {
  const f = fixture();
  Object.assign(f.config, { capacity: async () => { throw Error('measurement unavailable'); } });
  expect(await f.port.run(f.request('7:a'))).toMatchObject({ state: 'uncertain' });
  expect(f.launches).toHaveLength(0); expect(f.delivered).toHaveLength(0);
  expect(f.counts().live).toBe(0); await f.port.close();
});

it.each([false, true])('review: physical lease wait uses current headroom %s', async roomAfterWait => {
  const f = fixture(); let room = true, entered = false;
  let releaseWait!: () => void;
  const waitForLease = new Promise<void>(resolve => { releaseWait = resolve; });
  const originalAdmit = f.config.resources.admit;
  Object.assign(f.config, { capacity: async () => ({ admit: room, memoryPressure: !room }) });
  Object.assign(f.config.resources, { admit: async () => {
    entered = true; await waitForLease; return originalAdmit();
  } });
  const pending = f.port.run(f.request('7:a'));
  await until(() => entered);
  room = roomAfterWait; releaseWait();
  const result = await pending;
  const evidence = { state: result.state, launches: f.launches.length, deliveries: f.delivered.length, live: f.counts().live };
  await f.port.close();
  expect(evidence).toEqual(roomAfterWait
    ? { state: 'complete', launches: 1, deliveries: 1, live: 1 }
    : { state: 'queued', launches: 0, deliveries: 0, live: 0 });
});


it.each(['refused', 'failed'] as const)('pool cleanup handles %s closure without confusing refusal and unexplained failure', async mode => {
  const f = fixture(8, 6, 16, 600000); let pressure = false;
  Object.assign(f.config, { idleMs: 100, capacity: async () => ({ admit: true, memoryPressure: pressure }) });
  await f.port.run(f.request('7:a')); await f.port.run(f.request('8:a'));
  if (mode === 'refused') f.refusedClose.add('7'); else f.failedClose.add('7');
  pressure = true; f.advance(100); await f.port.maintain();
  f.advance(30000); await f.port.maintain(); f.advance(30000); await f.port.maintain();
  // Both idle expiry and pressure were due; one reason must not reset the other's grace.
  expect(f.closed).toEqual(mode === 'refused' ? [f.launches[1]!.worker.claim] : []);
  if (mode === 'failed') {
    expect(f.port.idleCleanupStatus?.().join(' ')).toContain('uncertain');
    f.advance(30000); await f.port.maintain(); expect(f.closed).toEqual([]);
  }
  await f.port.close();
});

it.each([[1, 16], [2, 1]])('expiry preserves slot/resource pressure confirmation (slots=%s, resources=%s)', async (slots, resources) => {
  const f = fixture(slots, 6, resources, 600000);
  Object.assign(f.config, { idleMs: 500 });
  await f.port.run(f.request('7:a'));
  expect(await f.port.run(f.request('8:b'))).toMatchObject({ state: 'queued' });
  f.advance(30000); await f.port.maintain();
  expect(f.closed).toHaveLength(0); // Confirmed, but separate grace still holds.
  expect((await f.port.collect('8:b'))?.outcome).toMatchObject({ state: 'queued' });
  f.advance(30000); await f.port.maintain();
  expect((await f.port.collect('8:b'))?.outcome).toMatchObject({ state: 'complete' });
  await f.port.close();
});

// Recorded incident: live-answer-fail-1019-PROGRESS.md, updates 969390599/600.
// Both roots had main=113, topic 3=15, allowance=128, no attempt on the next input.
async function exhaustedIncident() {
  const f = fixture(2, 128);
  await f.port.run(f.request('main:969390598')); await f.port.run(f.request('3:probe'));
  await f.port.close();
  const old = structuredClone(f.state());
  f.config.store.save({ ...old, topics: { ...old.topics,
    main: { ...old.topics.main!, spent: 113 }, '3': { ...old.topics['3']!, spent: 15 } } });
  f.restart(); return f;
}

it('loads the recorded 128/128 incident and renews without losing custody or replaying old replies', async () => {
  const f = await exhaustedIncident();
  const inputs = Object.values(f.state().topics).flatMap(row => row.inputs);
  expect(await f.port.run(f.request('main:969390600'))).toMatchObject({ state: 'complete' });
  expect(f.state().edge?.id).toBe('operator:allowance:1');
  expect(f.state().topics.main!.spent).toBe(1);
  expect(f.state().topics['3']!.spent).toBe(0);
  for (const input of inputs) expect(await f.port.collect(input.request.operation)).toEqual({ request: input.request, outcome: input.outcome });
  await f.port.close(); f.restart();
  expect(await f.port.run(f.request('main:969390600'))).toMatchObject({ state: 'complete' });
  expect(f.delivered).toHaveLength(3);
  expect(await f.port.run(f.request('3:next'))).toMatchObject({ state: 'complete' });
  expect(f.edges.filter(row => row.type === 'SessionWorkEdge' && !row.drawsOn)).toHaveLength(2);
  await f.port.close();
});

it.each(['before-append', 'after-append', 'before-reset'] as const)('renewal reconciles a crash %s against journal evidence', async crash => {
  const f = await exhaustedIncident();
  const append = f.config.append, save = f.config.store.save;
  let injected = false;
  const crashingAppend: ConversationTopicsConfig['append'] = row => {
    if (row.id === 'operator:allowance:renew' && !injected && crash !== 'before-reset') {
      injected = true;
      if (crash === 'after-append') append(row);
      throw Error('simulated crash');
    }
    append(row);
  };
  Object.assign(f.config, { append: crashingAppend });
  f.config.store.save = next => {
    if (crash === 'before-reset' && next.allowanceEpoch === 1 && !injected) { injected = true; throw Error('simulated crash'); }
    save(next);
  };
  f.restart();
  await expect(f.port.run(f.request('main:969390600'))).rejects.toThrow('simulated crash');
  Object.assign(f.config, { append }); f.config.store.save = save; f.restart();
  expect(await f.port.run(f.request('main:969390600'))).toMatchObject({ state: 'complete' });
  expect(f.edges.filter(row => row.id === 'operator:allowance:renew')).toHaveLength(1);
  expect(f.delivered).toHaveLength(3); await f.port.close();
});

it('concurrent arrivals renew once and stale claims cannot spend the new allowance', async () => {
  const f = await exhaustedIncident(); const oldClaim = f.launches[0]!.worker.claim;
  const results = await Promise.all([f.port.run(f.request('main:new')), f.port.run(f.request('3:new'))]);
  expect(results.map(row => row.state)).toEqual(['complete', 'complete']);
  expect(f.edges.filter(row => row.id === 'operator:allowance:renew')).toHaveLength(1);
  expect(() => f.port.reserveCall(oldClaim, 2)).toThrow(/unknown/);
  expect(Object.values(f.state().topics).reduce((sum, row) => sum + row.spent, 0)).toBe(2);
  await f.port.close();
});

it.each(['stop', 'grant', 'deadline', 'retirement'] as const)('does not renew across the %s floor', async floor => {
  const f = await exhaustedIncident();
  if (floor === 'stop') f.stop();
  if (floor === 'grant') f.revoke();
  if (floor === 'deadline') f.advance(100000);
  if (floor === 'retirement') {
    const create = f.config.createAdapter;
    const createAdapter: ConversationTopicsConfig['createAdapter'] = (topic, resolve) => ({ ...create(topic, resolve), control: async () => ({ state: 'refused', evidence: 'not closed' }) });
    Object.assign(f.config, { createAdapter });
    // Retain a claim to prove failed physical retirement cannot reset accounting.
    const state = f.state(); f.config.store.save({ ...state, topics: { ...state.topics,
      main: { ...state.topics.main!, claim: 'old-claim', incarnation: 'old', authority: 'grant' } } });
    f.restart();
  }
  await f.port.run(f.request('main:new')).catch(() => {});
  expect(f.state().allowanceEpoch).toBeUndefined();
  expect(f.edges.filter(row => row.id === 'operator:allowance:renew')).toHaveLength(0);
  expect(f.delivered).toHaveLength(2);
});

it.each(['confirmed', 'worker-unconfirmed', 'lease-unconfirmed'] as const)(
  'renewal after maintenance closes a deadline-halted topic: %s retirement', async retirement => {
    const f = fixture(2, 2);
    const create = f.config.createAdapter;
    Object.assign(f.config, { createAdapter: (topic: string, resolve: Parameters<typeof create>[1]) => ({
      ...create(topic, resolve),
      ...(topic === 'main' && retirement === 'worker-unconfirmed'
        ? { control: async () => ({ state: 'refused' as const, evidence: 'closure unconfirmed' }) } : {}),
    }) });
    if (retirement === 'lease-unconfirmed') {
      const admit = f.config.resources.admit;
      const admitWithoutRelease: typeof admit = async (...args) => {
        const lease = await admit(...args);
        return lease && { ...lease, release: async () => false };
      };
      Object.assign(f.config.resources, { admit: admitWithoutRelease });
    }
    f.held.add('main');
    const pending = f.port.run(f.request('main:a'));
    await until(() => f.delivered.length === 1);
    f.advance(2000);
    expect(await pending).toMatchObject({ state: 'uncertain' });
    await f.port.maintain();
    const halted = structuredClone(f.state().topics.main!);
    expect(halted.halt?.reason).toBe('deadline');
    expect(halted.close).not.toBeNull();
    if (retirement === 'confirmed') {
      expect(halted.worker).toBeNull(); expect(halted.claim).toBeNull();
      expect(f.counts().live).toBe(0);
    }
    expect(await f.port.run(f.request('3:c'))).toMatchObject({ state: 'complete' });
    const renewed = await f.port.run(f.request('3:d'));
    if (retirement === 'confirmed') {
      expect(renewed).toMatchObject({ state: 'complete' });
      expect(f.state().allowanceEpoch).toBe(1);
      expect(f.state().topics.main!.halt).toEqual(halted.halt);
      expect(f.state().topics.main!.inputs).toEqual(halted.inputs);
      expect(await f.port.run(f.request('main:a'))).toEqual(halted.inputs[0]!.outcome);
      expect(f.delivered.map(row => row.input.operation)).toEqual(['main:a', '3:c', '3:d']);
    } else {
      expect(renewed).toMatchObject({ state: 'uncertain' });
      expect(f.state().allowanceEpoch).toBeUndefined();
      expect(f.edges.some(row => row.id === 'operator:allowance:renew')).toBe(false);
    }
    await f.port.close();
  },
);

it('an exhausted allowance does not renew while another topic still runs', async () => {
  const f = fixture(2, 1); f.held.add('7');
  const pending = f.port.run(f.request('7:busy')); await until(() => f.delivered.length === 1);
  expect(await f.port.run(f.request('8:new'))).toMatchObject({ state: 'uncertain' });
  expect(f.state().allowanceEpoch).toBeUndefined();
  f.held.clear(); await pending;
  expect(await f.port.run(f.request('8:later'))).toMatchObject({ state: 'complete' });
  expect(f.state().allowanceEpoch).toBe(1); await f.port.close();
});

it.each(recordedCapacityShapes.otherShapes)('renewal dispatches preserved recorded $kind ($id)', async sample => {
  const f = await exhaustedIncident();
  const request = { ...f.request('main:969390600'), context: sample.raw };
  await f.port.run(request);
  expect(f.state().allowanceEpoch).toBe(1);
  expect(f.delivered.at(-1)!.input.text).toContain(sample.raw);
  await f.port.close();
});

it.each([128, 7500])('renewal uses the real journal budget and survives reopen (already reserved=%s)', async reserved => {
  const f = await exhaustedIncident();
  const root = mkdtempSync(join(tmpdir(), 'allowance-renew-')); renewalRoots.push(root);
  const open = () => openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 7500, maxReplies: 30,
    maxTurns: 30, maxBytes: 262144, cursor: 0 });
  let journal = open();
  const custodyPath = join(root, 'conversation.json'), key = new Uint8Array(32).fill(62);
  const custody = createConversationHostStore(custodyPath, key);
  custody.save(f.state());
  const save = f.config.store.save;
  Object.assign(f.config, { store: { load: () => custody.load(), save: (next: ConversationTopicsState) => {
    custody.save(next); save(next);
  } } });
  const edge = f.state().edge!;
  if (reserved > 128) journal.append({ kind: 'session-work', record: { ...edge, id: 'prior-reservations',
    budget: { ...edge.budget, calls: reserved - 128 } }, at: 1000 });
  for (const record of f.edges) journal.append({ kind: 'session-work', record, at: 1000 });
  const append: ConversationTopicsConfig['append'] = record => { journal.append({ kind: 'session-work', record, at: 1000 }); f.edges.push(record); };
  Object.assign(f.config, { append });
  Object.assign(f.config, { recoveryEdges: () => journal.sessionWorkRecords() }); f.restart();
  try {
    const result = await f.port.run(f.request('main:969390600'));
    expect(result.state).toBe(reserved === 128 ? 'complete' : 'uncertain');
    expect(f.delivered).toHaveLength(reserved === 128 ? 3 : 2);
    expect(journal.view.calls).toBe(reserved === 128 ? 256 : 7500);
    journal.close(); journal = open();
    expect(journal.view.calls).toBe(reserved === 128 ? 256 : 7500);
    expect(journal.sessionWorkRecords().filter(row => row.id === 'operator:allowance:renew')).toHaveLength(1);
    if (reserved === 128) {
      await f.port.close();
      f.config.store.load = () => createConversationHostStore(custodyPath, key).load(); f.restart();
      expect(await f.port.run(f.request('3:after-restart'))).toMatchObject({ state: 'complete' });
      expect(journal.view.calls).toBe(256);
      await f.port.close();
    } else {
      expect(result.detail).toContain('call cap');
      expect(f.state().reserved).toBe(false);
      expect(createConversationTopicsPort(f.config).kind).toBe('Refused');
    }
  } finally { journal.close(); }
});

it('renewal preserves the original parent deadline even when restarted with a later one', async () => {
  const f = await exhaustedIncident();
  f.restart(200000);
  await f.port.run(f.request('main:new'));
  expect(f.state().edge!.budget.deadline).toBe(100000);
  expect(f.state().allowanceDeadline).toBe(100000);
  await f.port.close(); f.restart(300000); f.advance(100000);
  expect(f.port.available()).toBe(false);
  await f.port.close();
});
