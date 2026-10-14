import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createConversationSessionPort, conversationSessionPrompt, conversationSessionPolicy, CONVERSATION_SESSION_LIMITS } from '../../src/assembly/production-conversation-session.js';
import type { ConversationSessionConfig, ConversationState } from '../../src/assembly/production-conversation-session.js';
import type { ConversationDelivery, ConversationWorker } from '../../src/assembly/conversation-harness-adapter.js';
import type { HarnessAdapterPort } from '../../src/assembly/contracts.js';
import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value } from '../facts/fixtures.js';

const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
function fixture(options: Partial<Pick<ConversationSessionConfig, 'maxCalls' | 'maxSteps' | 'maxResultBytes'>> = {}) {
  const f = assemblyRuntimeFixture();
  let clock = 1000, stopped = false, authorized = true, authority = 'existing-role', used: number | null = 0, dead = false, paused = false, finish = true;
  let state: ConversationState | null = null, answer = '{"answer":"hello"}', active: ConversationDelivery | null = null;
  let stopOK = true, releaseOK = true, stops = 0, releases = 0, refused = false;
  const launches: ConversationWorker[] = [], delivered: ConversationDelivery[] = [];
  const edges: (SessionWorkEdge | SessionWorkEdgeClose)[] = [], admissions: SessionWorkEdge[] = [], closed: string[] = [];
  const adapter: HarnessAdapterPort<2> = {
    describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false }),
    launch: async input => { const worker = { launch: `process-${launches.length}`, incarnation: input.incarnation, claim: input.claim };
      expect(edges[0]?.type).toBe('SessionWorkEdge'); launches.push(worker); dead = false; return worker; },
    deliver: async input => {
      expect(state?.inputs.find(row => row.request.operation === input.operation)?.state).toBe('dispatching');
      delivered.push(input); active = input; if (used !== null) used++;
      return { state: 'accepted', evidence: 'accepted' };
    },
    observe: async input => {
      if (dead || paused) return { observations: [{ kind: dead ? 'exit' : 'paused', evidence: 'physical' }], cursor: input.cursor, complete: true };
      if (!input.delivery || !finish) return { observations: [], cursor: input.cursor, complete: true };
      expect(input.delivery.operation).toBe(active?.operation);
      const observations = [{ kind: 'reply' as const, delivery: active!.operation, text: answer, digest: hash(answer) },
        { kind: 'turn-end' as const, delivery: active!.operation, state: 'completed' as const }];
      return { observations: observations.slice(input.cursor), cursor: 2, complete: true };
    },
    control: async () => { stops++; return { state: stopOK ? 'closed' : 'uncertain', evidence: 'stop' }; },
  };
  const config: ConversationSessionConfig = {
    conversation: 'operator-1', allowanceDeadline: 100000, authorized: () => authorized, currentAuthority: () => authority, store: { load: () => structuredClone(state), save: next => { state = structuredClone(next); } },
    createAdapter: () => adapter,
    io: { clearResult: () => {}, readResult: () => null, modelCalls: () => used, wait: async ms => { clock += ms; },
      prepareAdmission: (_claim, edge) => { admissions.push(edge); }, closeAdmission: claim => { closed.push(claim); },
      admissionState: () => ({ refused, openDelegations: [] }) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => { releases++; return releaseOK; } }) },
    context: f.c, now: () => clock, stopped: () => stopped, append: row => { edges.push(row); },
    parent: 'run-1', owner: 'machine-1', placement: 'local', transport: 'fake', workingScope: '/scope',
    resultDirectory: '/scope/results', artifact: 'artifact', incarnation: 'incarnation',
    deadlineMs: 2000, pollMs: 100, maxCalls: 6, maxSteps: 3, maxResultBytes: 65536, ...options,
  };
  const port = value(createConversationSessionPort(config));
  const request = (operation: string) => ({ operation, question: 'What do you remember?', context: '{"memory":"tea"}', authority: 'existing-role' });
  return { port, config, adapter, edges, admissions, launches, delivered, closed, request,
    state: () => structuredClone(state!), restore: (next: ConversationState) => { state = structuredClone(next); },
    answer: (text: string) => { answer = text; }, calls: (n: number | null) => { used = n; }, refuse: () => { refused = true; },
    exit: () => { dead = true; }, pause: () => { paused = true; }, finish: (next: boolean) => { finish = next; },
    grant: (next: string) => { authority = next; }, authorize: (next: boolean) => { authorized = next; }, stop: () => { stopped = true; }, advance: (ms: number) => { clock += ms; },
    stopFailure: () => { stopOK = false; }, releaseFailure: () => { releaseOK = false; },
    counts: () => ({ stops, releases }), restart: () => value(createConversationSessionPort(config)),
  };
}

it('two inputs share one process and one cumulative reservation; exact duplicates return the recorded result', async () => {
  const f = fixture(); const first = await f.port.run(f.request('one'));
  expect(first).toMatchObject({ state: 'complete', text: '{"answer":"hello"}' });
  f.answer('{"answer":"Tuesday"}');
  expect(await f.port.run(f.request('two'))).toMatchObject({ state: 'complete', text: '{"answer":"Tuesday"}' });
  expect(await f.port.run(f.request('one'))).toEqual(first);
  expect(f.launches).toHaveLength(1); expect(f.delivered).toHaveLength(2);
  expect(f.edges.filter(row => row.type === 'SessionWorkEdge' && !row.drawsOn)).toHaveLength(1);
  expect(f.state().inputs.map(row => row.cursor)).toEqual([2, 2]);
  expect(await f.port.close()).toMatchObject({ state: 'complete', calls: 2, reserved: 6 });
});

it('persists a busy arrival before waiting and drains in source order', async () => {
  const f = fixture();
  const one = f.port.run(f.request('one'));
  const two = f.port.run(f.request('two'));
  expect(f.state().inputs.map(row => row.request.operation)).toEqual(['one', 'two']);
  expect(f.state().inputs.every(row => row.state === 'queued')).toBe(true);
  expect((await one).state).toBe('complete'); expect((await two).state).toBe('complete');
  expect(f.delivered.map(row => row.operation)).toEqual(['one', 'two']); await f.port.close();
});

it('host restart drains queued input, retains duplicate outcomes and gives the new process fresh admission', async () => {
  const f = fixture(); const first = await f.port.run(f.request('one'));
  const request = f.request('two');
  f.restore({ ...f.state(), inputs: [...f.state().inputs, { request, digest: hash(JSON.stringify(request)), acceptedAt: 1200,
    state: 'queued', delivery: null, cursor: 0, reply: null, outcome: null, attempts: 0, retryAt: 0 }] });
  const next = f.restart(); await next.maintain();
  expect(await next.run(f.request('one'))).toEqual(first);
  expect(await next.run(request)).toMatchObject({ state: 'complete' });
  expect(f.delivered.map(row => row.operation)).toEqual(['one', 'two']);
  expect(f.launches[1]!.incarnation).not.toBe(f.launches[0]!.incarnation);
  expect(f.admissions.map(row => row.budget.calls)).toEqual([6, 5]);
  await next.close();
});

it('an unresolved dispatched input is never replayed after host restart; later queued input survives', async () => {
  const f = fixture(); await f.port.run(f.request('one'));
  f.restore({ ...f.state(), inputs: f.state().inputs.map(row => ({ ...row, state: 'accepted', outcome: null })) });
  const next = f.restart();
  expect(await next.run(f.request('two'))).toMatchObject({ state: 'complete' });
  expect(await next.run(f.request('one'))).toMatchObject({ state: 'uncertain' });
  expect(f.delivered.map(row => row.operation)).toEqual(['one', 'two']); await next.close();
});

it.each(['exit', 'turns', 'deadline', 'authority'] as const)('continues across %s with fresh identity and remaining allowance', async reason => {
  const f = fixture({ maxSteps: reason === 'turns' ? 1 : 3 });
  await f.port.run(f.request('one'));
  if (reason === 'exit') f.exit(); if (reason === 'deadline') f.advance(2000);
  if (reason === 'authority') f.grant('new-current-grant');
  const request = { ...f.request('two'), authority: reason === 'authority' ? 'new-current-grant' : 'existing-role' };
  expect(await f.port.run(request)).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(2);
  expect(f.launches[1]!.claim).not.toBe(f.launches[0]!.claim);
  expect(f.launches[1]!.incarnation).not.toBe(f.launches[0]!.incarnation);
  expect(f.admissions.map(row => row.budget.calls)).toEqual([6, 5]);
  expect(f.admissions[1]!.authority).toBe(request.authority);
  expect(f.closed).toContain(f.launches[0]!.claim); await f.port.close();
});

it('retiring an idle expired process keeps the conversation available', async () => {
  const f = fixture(); await f.port.run(f.request('one')); f.advance(2000); await f.port.maintain();
  expect(f.state().worker).toBe(null); expect(f.port.available()).toBe(true);
  expect((await f.port.run(f.request('two'))).state).toBe('complete'); await f.port.close();
});

it.each(['unknown', 'over', 'exhausted', 'refused'] as const)('does not replenish %s allowance', async mode => {
  const f = fixture(); await f.port.run(f.request('one'));
  if (mode === 'unknown') f.calls(null); if (mode === 'over') f.calls(7);
  if (mode === 'exhausted') f.calls(6); if (mode === 'refused') f.refuse();
  expect((await f.port.run(f.request('two'))).state).toBe('uncertain');
  expect(f.delivered).toHaveLength(1); await f.port.close();
});

it('stop prevents launch, and stops an active turn without dispatching queued input', async () => {
  const before = fixture(); before.stop();
  await expect(before.port.run(before.request('one'))).rejects.toThrow(/stop/);
  expect(before.launches).toHaveLength(0);
  const f = fixture(); f.finish(false); f.config.io.wait = async () => { f.stop(); };
  const one = f.port.run(f.request('one')), two = f.port.run(f.request('two'));
  expect((await one).state).toBe('uncertain'); expect((await two).state).toBe('uncertain');
  expect(f.delivered).toHaveLength(1); expect(f.state().inputs[1]!.state).toBe('queued'); await f.port.close();
});

it('close waits for admission and releases a late lease without launching', async () => {
  const f = fixture(); let release!: () => void; let entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  Object.assign(f.config.resources, { admit: async () => { entered(); await new Promise<void>(resolve => { release = resolve; });
    return { attach: async () => {}, release: async () => true }; } });
  const turn = f.port.run(f.request('one')); await ready;
  const closed = f.port.close(); release();
  expect((await turn).state).toBe('uncertain'); expect((await closed)?.state).toBe('uncertain');
  expect(f.launches).toHaveLength(0);
});

it('holds pending child work and never treats an empty reply as completed', async () => {
  const f = fixture(); f.answer(''); expect((await f.port.run(f.request('one'))).state).toBe('uncertain');
  await f.port.close();
  const g = fixture(); g.finish(false);
  expect((await g.port.run(g.request('one'))).detail).toMatch(/deadline/); await g.port.close();
});

it.each(['stop', 'release'] as const)('reports %s cleanup uncertainty and never starts its replacement', async problem => {
  const f = fixture(); await f.port.run(f.request('one'));
  if (problem === 'stop') f.stopFailure(); else f.releaseFailure();
  f.advance(2000);
  expect((await f.port.run(f.request('two'))).state).toBe('uncertain');
  expect(f.launches).toHaveLength(1); expect((await f.port.close())?.state).toBe('uncertain');
});

it('conflicting identity, escaped paths, invalid bounds and missing durable storage refuse', async () => {
  const f = fixture(); await f.port.run(f.request('one'));
  await expect(f.port.run({ ...f.request('one'), question: 'different' })).rejects.toThrow(/conflicts/);
  for (const patch of [{ maxCalls: 0 }, { maxCalls: 257 }, { maxSteps: 65 }, { pollMs: 0 }, { deadlineMs: 3600001 },
    { resultDirectory: '/scope/../elsewhere' }, { resultDirectory: '/outside' }, { conversation: '../escape' },
    { store: undefined as never }]) expect(createConversationSessionPort({ ...f.config, ...patch }).kind).toBe('Refused');
  await f.port.close();
});

it('keeps current context, host sending and the response envelope in the prompt', () => {
  const text = conversationSessionPrompt({ question: 'Look this up', context: '{"accounts":[]}' }, '/scope/result');
  expect(text).toContain('Do not send to the operator yourself'); expect(text).toContain('"accounts":[]');
  expect(text).toContain('wait for the next message'); expect(text).not.toContain('You have no tools');
});

it('an interrupted reservation cannot become a second liability after restart', async () => {
  const f = fixture(); await f.port.run(f.request('one'));
  f.restore({ ...f.state(), reserved: false, worker: null, claim: null });
  await expect(f.restart().maintain()).rejects.toThrow(/reservation interrupted/);
  expect(f.launches).toHaveLength(1);
});

it('an uncertain launch receipt is retired by its admitted claim before replacement', async () => {
  const f = fixture(); await f.port.run(f.request('one'));
  f.restore({ ...f.state(), worker: null });
  const next = f.restart(); await next.maintain();
  expect(f.counts().stops).toBe(1);
  expect((await next.run(f.request('two'))).state).toBe('complete');
  expect(f.launches).toHaveLength(2); await next.close();
});

it('a non-dispatched busy input stays queued and is retried by the host tick', async () => {
  const f = fixture(); const deliver = f.adapter.deliver;
  f.adapter.deliver = async () => ({ state: 'busy-not-dispatched', evidence: 'no bytes submitted' });
  expect((await f.port.run(f.request('one'))).detail).toContain('durably queued');
  expect(f.state().inputs[0]!.state).toBe('queued'); expect(f.delivered).toHaveLength(0);
  f.adapter.deliver = deliver; f.advance(200); await f.port.maintain();
  expect((await f.port.run(f.request('one'))).state).toBe('complete');
  expect(f.delivered).toHaveLength(1); await f.port.close();
});

it('graceful host shutdown retains queued work and the original allowance on reopen', async () => {
  const f = fixture(); await f.port.run(f.request('one')); await f.port.close();
  const next = f.restart();
  expect((await next.run(f.request('two'))).state).toBe('complete');
  expect(f.admissions.map(row => row.budget.calls)).toEqual([6, 5]); await next.close();
});

it('charges dispatched calls before transcript output and carries that exposure through host restart', async () => {
  const f = fixture(); await f.port.run(f.request('one'));
  f.port.reserveCall(f.state().claim!, 1);
  expect(f.state().spent).toBe(2); // one completed transcript call plus the in-flight dispatch
  f.calls(1);
  await f.port.close();
  const next = f.restart(); await next.run(f.request('two'));
  expect(f.admissions.map(row => row.budget.calls)).toEqual([6, 4]);
  expect(() => next.reserveCall('stale-claim', 1)).toThrow(/identity/);
  await next.close();
});

it('non-dispatched retries back off and stop at a finite ceiling without losing input', async () => {
  const f = fixture();
  f.adapter.deliver = async () => ({ state: 'busy-not-dispatched', evidence: 'no bytes submitted' });
  await f.port.run(f.request('one'));
  await f.port.maintain(); expect(f.state().inputs[0]!.attempts).toBe(1);
  f.advance(200); await f.port.maintain(); expect(f.state().inputs[0]!.attempts).toBe(2);
  f.advance(400); await f.port.maintain();
  expect(f.state().inputs[0]).toMatchObject({ attempts: 3, state: 'settled', outcome: { state: 'failed' } });
  expect(f.state().inputs[0]!.request).toEqual(f.request('one')); await f.port.close();
});

it('replacement receives current time and recorded prior outcomes without vendor history', async () => {
  const f = fixture({ maxSteps: 1 }); await f.port.run(f.request('one')); f.advance(20);
  await f.port.run(f.request('two'));
  expect(f.delivered[1]!.text).toContain('HOST CLOCK 1020');
  expect(f.delivered[1]!.text).toContain('RECORDED HOST TURN OUTCOMES');
  expect(f.delivered[1]!.text).toContain('hello'); await f.port.close();
});

it('the continuing host consumes real driver Stop receipts through the public adapter for two inputs', async () => {
  const { createSessionConversationAdapter } = await import('../../src/assembly/conversation-harness-adapter.js');
  const { createProductionSessionDriver } = await import('../../src/assembly/production-session-driver.js');
  const f = fixture(); let now = 1000, pane = '❯ ', live = false, path = '', entered = 0;
  let journal: import('../../src/assembly/production-session-driver.js').SessionJournal = { sessions: [], deliveries: [], resumes: {} };
  const files = new Map<string, string>();
  const receipts: { kind: 'turn-closed'; sessionId: string; at: number; receiptId: string }[] = [];
  const physical: import('../../src/assembly/production-session-driver.js').SessionIO = {
    exclusive: run => run(), load: () => journal, save: next => { journal = structuredClone(next); },
    sleep: ms => { now += ms; }, armDeadline: () => {}, transcriptExists: () => false, readInbox: () => receipts,
    tmux: args => {
      if (args[0] === 'new-session') { live = true; expect(args.join(' ')).toContain('Stop'); }
      if (args[0] === 'has-session') return { code: live ? 0 : 1, stdout: '' };
      if (args[0] === 'display-message') return { code: 0, stdout: '321:1000' };
      if (args[0] === 'capture-pane') return { code: 0, stdout: pane };
      if (args[0] === 'kill-session') live = false;
      if (args[0] === 'send-keys' && args.includes('Enter')) {
        entered++; pane = `reply ${entered}\n❯ `; files.set(path, `{"reply":"answer ${entered}"}`);
        receipts.push({ kind: 'turn-closed', sessionId: '12345678-1234-1234-1234-123456789abc', at: now, receiptId: `receipt-${entered}` });
      }
      return { code: 0, stdout: '' };
    },
  };
  const io = { ...f.config.io, clearResult: (next: string) => { path = next; files.delete(path); },
    readResult: (file: string) => files.get(file) ?? null, modelCalls: () => entered, wait: async (ms: number) => { now += ms; } };
  const port = value(createConversationSessionPort({ ...f.config, io, now: () => now,
    createAdapter: resolveDelivery => createSessionConversationAdapter({ io, resolveDelivery,
      createDriver: resolveIntake => createProductionSessionDriver({ operatorOwnUse: true, confinement: 'admitted',
        framework: 'claude-code', executable: '/fake', cwd: '/scope', home: '/h', configHome: '/h', context: f.config.context,
        io: physical, now: () => now, stopped: () => false, resolveIntake, maxSessions: 1, turnDeadlineMs: 2000,
        readyTimeoutMs: 1000, protectedSessions: [], requireTurnHook: true, hookScript: '/installed/stop.mjs', inboxDirectory: '/inbox',
        toolAdmission: { command: () => '/installed/tool-hook', timeoutSeconds: 2 },
        modelGate: claim => `http://127.0.0.1:1234/${'a'.repeat(32)}/${claim}` }) }) }));
  expect(await port.run(f.request('one'))).toMatchObject({ state: 'complete', text: '{"reply":"answer 1"}' });
  expect(await port.run(f.request('two'))).toMatchObject({ state: 'complete', text: '{"reply":"answer 2"}' });
  expect(journal.sessions).toHaveLength(1); expect(journal.deliveries.map(row => row.state)).toEqual(['accepted', 'accepted']);
  expect(f.state().inputs.map(row => row.cursor)).toEqual([2, 2]);
  await port.close(); expect(live).toBe(false);
});

it('process renewal never extends the already admitted parent lifetime', async () => {
  const f = fixture(); await f.port.run(f.request('one')); f.advance(100000);
  expect(f.port.available()).toBe(false); await f.port.maintain();
  expect(f.state().worker).toBeNull(); expect(f.launches).toHaveLength(1);
});

it.each(['gap', 'wrong-delivery', 'wrong-digest', 'oversize', 'open-child'] as const)('retains uncertainty for %s evidence', async problem => {
  const f = fixture({ maxResultBytes: problem === 'oversize' ? 2 : 65536 });
  if (problem === 'open-child') f.config.io.admissionState = () => ({ refused: false, openDelegations: [f.admissions[0]!] });
  const observe = f.adapter.observe;
  f.adapter.observe = async input => {
    const result = await observe(input);
    if (!input.delivery) return result;
    if (problem === 'gap') return { ...result, complete: false };
    return { ...result, observations: result.observations.map(event => event.kind !== 'reply' ? event : {
      ...event, ...(problem === 'wrong-delivery' ? { delivery: 'other-input' } : {}),
      ...(problem === 'wrong-digest' ? { digest: 'sha256:wrong' } : {}) }) };
  };
  expect((await f.port.run(f.request('one'))).state).toBe('uncertain');
  expect(f.state().inputs[0]!.request).toEqual(f.request('one')); await f.port.close();
});

it('idle grant withdrawal fences the old process but a validated renewal continues the same allowance', async () => {
  const f = fixture(); await f.port.run(f.request('one'));
  f.authorize(false); await f.port.maintain();
  expect(f.port.available()).toBe(false); expect(f.state().worker).toBeNull();
  expect(f.state().close).toBeNull();
  await expect(f.port.run(f.request('held'))).rejects.toThrow(/unavailable/);
  f.authorize(true); expect(f.port.available()).toBe(true);
  expect(await f.port.run({ ...f.request('two'), authority: 'renewed-signed-bytes' })).toMatchObject({ state: 'complete' });
  expect(f.admissions.map(edge => edge.budget.calls)).toEqual([6, 5]);
  expect(f.launches[1]!.claim).not.toBe(f.launches[0]!.claim);
  expect(f.edges.filter(edge => edge.type === 'SessionWorkEdge' && !edge.drawsOn)).toHaveLength(1);
  await f.port.close();
});

it('mid-turn grant withdrawal refuses new model charges and preserves unresolved input without replay', async () => {
  const f = fixture(); f.finish(false);
  f.config.io.wait = async () => { f.authorize(false); };
  expect(await f.port.run(f.request('one'))).toMatchObject({ state: 'uncertain', detail: 'conversation grant unavailable' });
  expect(() => f.port.reserveCall(f.launches[0]!.claim, 1)).toThrow(/grant unavailable/);
  await f.port.maintain(); f.authorize(true); f.finish(true);
  expect(await f.port.run(f.request('two'))).toMatchObject({ state: 'complete' });
  expect(await f.port.run(f.request('one'))).toMatchObject({ state: 'uncertain' });
  expect(f.delivered.map(item => item.operation)).toEqual(['one', 'two']); await f.port.close();
});

it('a validated grant change fences old model calls immediately and replaces the idle worker on the host tick', async () => {
  const f = fixture(); await f.port.run(f.request('one'));
  const oldClaim = f.launches[0]!.claim;
  f.grant('refreshed-signed-grant');
  expect(() => f.port.reserveCall(oldClaim, 1)).toThrow(/superseded/);
  await f.port.maintain(); expect(f.state().worker).toBeNull(); expect(f.state().close).toBeNull();
  expect(await f.port.run(f.request('two'))).toMatchObject({ state: 'complete' });
  expect(f.admissions[1]!.authority).toBe('refreshed-signed-grant');
  expect(f.admissions[1]!.budget.calls).toBe(5); await f.port.close();
});

it('a grant superseded during asynchronous resource admission cannot launch or charge the old claim', async () => {
  const f = fixture(); let released = false;
  Object.assign(f.config.resources, { admit: async () => {
    f.grant('new-grant');
    expect(() => f.port.reserveCall(f.state().claim!, 1)).toThrow(/superseded/);
    return { attach: async () => {}, release: async () => { released = true; return true; } };
  } });
  expect(await f.port.run(f.request('one'))).toMatchObject({ state: 'uncertain', detail: 'worker grant superseded' });
  expect(f.launches).toHaveLength(0); expect(f.state().spent).toBe(0); expect(released).toBe(true);
  await f.port.close();
});

it('an input arriving during idle retirement waits for exact stop before replacement', async () => {
  const f = fixture(); await f.port.run(f.request('one'));
  let release!: () => void;
  const control = f.adapter.control;
  f.adapter.control = async input => { await new Promise<void>(resolve => { release = resolve; }); return control(input); };
  const retirement = f.port.retireIdle();
  const next = f.port.run(f.request('two'));
  await Promise.resolve(); await Promise.resolve();
  expect(f.delivered).toHaveLength(1);
  f.adapter.control = control; release();
  expect(await retirement).toBe(true); expect(await next).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(2);
  await f.port.close();
});

it('the activation policy names the same topic cap and one shared allowance as the runner', () => {
  const policy = conversationSessionPolicy({ framing: 'fixture', framework: 'claude-code', model: 'fixture', launch: [] });
  expect(policy.limits).toEqual(CONVERSATION_SESSION_LIMITS);
  expect(policy.limits).toMatchObject({ maxSessions: 4, idleMs: 300000, maxCallsPerStep: 128 });
  expect(policy.admission.allowance).toBe(128);
});
