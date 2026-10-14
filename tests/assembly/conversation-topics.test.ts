import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createConversationTopicsPort } from '../../src/assembly/conversation-topics.js';
import type { ConversationTopicsConfig, ConversationTopicsState } from '../../src/assembly/conversation-topics.js';
import type { HarnessInputDelivery, HarnessWorkerHandle } from '../../src/assembly/contracts.js';
import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value } from '../facts/fixtures.js';
const digest = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 1));
async function until(test: () => boolean) { for (let i = 0; i < 500 && !test(); i++) await tick(); expect(test()).toBe(true); }

function fixture(maxSessions = 2, maxCalls = 6, resourceCap = 16) {
  let state: ConversationTopicsState | null = null, now = 1000, live = 0, peak = 0, stopped = false, authorized = true, saveFails = false;
  const held = new Set<string>(), launches: { topic: string; worker: HarnessWorkerHandle }[] = [];
  const delivered: { topic: string; input: HarnessInputDelivery }[] = [], closed: string[] = [];
  const edges: (SessionWorkEdge | SessionWorkEdgeClose)[] = [];
  const config: ConversationTopicsConfig = {
    context: assemblyRuntimeFixture().c, conversation: 'operator', topicOf: operation => operation.split(':')[0]!,
    allowanceDeadline: 100000, authorized: () => authorized, currentAuthority: () => 'grant',
    maxSessions, idleMs: 500, deadlineMs: 2000, pollMs: 25, maxSteps: 3, maxCalls, maxResultBytes: 65536,
    now: () => now, stopped: () => stopped, parent: 'run', owner: 'machine', placement: 'local', transport: 'fake',
    workingScope: '/scope', resultDirectory: '/scope/results', artifact: 'artifact', incarnation: 'boot',
    store: { load: () => structuredClone(state), save: next => { if (saveFails) throw Error('disk'); state = structuredClone(next); } },
    append: row => { edges.push(row); },
    resources: { admit: async () => { if (live >= resourceCap) return null; live++; peak = Math.max(peak, live); return { attach: async () => {}, release: async () => { live--; return true; } }; } },
    io: { modelCalls: () => { throw Error('must not count another topic transcript'); }, wait: tick,
      readResult: () => null, clearResult: () => {}, prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, openDelegations: [] }) },
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
        if (!input.delivery || held.has(topic)) return { observations: [], cursor: input.cursor, complete: true };
        const text = `answer in ${topic}`;
        return { observations: [{ kind: 'reply', delivery: input.delivery.operation, text, digest: digest(text) },
          { kind: 'turn-end', delivery: input.delivery.operation, state: 'completed' }], cursor: input.cursor + 2, complete: true };
      },
      control: async input => { closed.push(input.claim); return { state: 'closed', evidence: 'fake' }; },
    }),
  };
  let port = value(createConversationTopicsPort(config));
  const request = (operation: string) => ({ operation, question: 'hello', context: 'shared memory: Wren; own topic history', authority: 'grant' });
  return { get port() { return port; }, config, request, held, launches, delivered, closed, edges,
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
  const f = fixture(1); f.held.add('7');
  const a = f.port.run(f.request('7:a')); await until(() => f.delivered.length === 1);
  const b = f.port.run(f.request('8:b'));
  await until(() => !!f.state().topics['8']?.inputs.length);
  expect(f.counts().peak).toBe(1); expect(f.delivered).toHaveLength(1);
  f.held.delete('7'); await a; await b;
  expect(f.closed).toContain(f.launches[0]!.worker.claim); expect(f.counts().peak).toBe(1);
  await f.port.run(f.request('7:c'));
  expect(f.launches.map(row => row.topic)).toEqual(['7', '8', '7']);
  expect(f.launches[2]!.worker.claim).not.toBe(f.launches[0]!.worker.claim);
  expect(f.delivered[2]!.input.text).not.toContain('answer in 7');
  expect(f.state().topics['7']!.inputs[0]!.outcome?.text).toBe('answer in 7');
  expect(f.delivered[2]!.input.text).toContain('shared memory: Wren');
  await f.port.close();
});

it('idle maintenance retires a worker without resetting its spent allowance or cursor', async () => {
  const f = fixture(); await f.port.run(f.request('main:a'));
  f.advance(499); await f.port.maintain(); expect(f.counts().live).toBe(1);
  f.advance(1); await f.port.maintain(); expect(f.counts().live).toBe(0);
  expect(f.state().topics.main?.spent).toBe(1);
  await f.port.run(f.request('main:b')); expect(f.launches).toHaveLength(2);
  expect(f.state().topics.main?.inputs[0]?.cursor).toBe(2); await f.port.close();
});

it('every topic and restart draws from the same allowance; the cap never multiplies', async () => {
  const f = fixture(2, 2);
  await Promise.all([f.port.run(f.request('7:a')), f.port.run(f.request('8:b'))]);
  expect(Object.values(f.state().topics).reduce((sum, row) => sum + row.spent, 0)).toBe(2);
  await f.port.close(); f.restart();
  expect(await f.port.run(f.request('9:c'))).toMatchObject({ state: 'uncertain' });
  expect(f.delivered).toHaveLength(2);
  expect(f.edges.filter(row => row.type === 'SessionWorkEdge' && !row.drawsOn)).toHaveLength(1);
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
  const f = fixture(2, 6, 1);
  await f.port.run(f.request('7:a'));
  expect(await f.port.run(f.request('8:b'))).toMatchObject({ state: 'complete' });
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
