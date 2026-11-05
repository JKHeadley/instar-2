/**
 * Carryover row 03: the 1.x SessionRecovery ladder inside the production conversation port, fed by
 * the adapter's transcript observation. Each case is one decision boundary: the stall and error-loop
 * detectors over the worker's own transcript tail, the kill-to-queued-revival path behind the exact
 * no-replay floor, the P1/P2 child-work veto, the 3-attempt/15-minute ladder keyed per conversation
 * and durable across restart, the context-wall latch (first observation and transcript growth defer
 * with zero attempts spent, the 30-minute ceiling forces action), compaction before the grounded
 * replacement, a refused compaction retained as uncertain, and the 30-second observation cadence.
 * Offline over the public adapter contract; no live harness or channel proof is claimed.
 */
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import type { ConversationSessionConfig, ConversationState } from '../../src/assembly/production-conversation-session.js';
import type { ConversationDelivery, ConversationWorker } from '../../src/assembly/conversation-harness-adapter.js';
import type { HarnessAdapterPort, HarnessTranscriptEntry, HarnessTranscriptObservation } from '../../src/assembly/contracts.js';
import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value } from '../facts/fixtures.js';

const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const MINUTE = 60_000;

/** A transcript whose last assistant turn called `tool` at `at` and never received its result. */
const stalled = (at: number, tool = 'Read'): HarnessTranscriptEntry[] => [
  { type: 'user', timestampMs: at - 1000, message: { content: 'please read it' } },
  { type: 'assistant', timestampMs: at, message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tool-1', name: tool, input: { file_path: '/x' } }] } },
];
/** Three identical tool failures: the same normalized error, each answered, none progressing. */
const looping = (at: number): HarnessTranscriptEntry[] => [1, 2, 3].flatMap(n => [
  { type: 'assistant', timestampMs: at + n * 1000, message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `tool-${n}`, name: 'Bash', input: { command: 'npm test' } }] } },
  { type: 'user', timestampMs: at + n * 1000 + 500, message: { content: [{ type: 'tool_result', tool_use_id: `tool-${n}`, is_error: true, content: 'Error: ENOENT no such file' }] } },
]);

type Options = Partial<ConversationSessionConfig> & { transcript?: boolean; pollMs?: number };
function liveWorker(options: Options = {}) {
  const { transcript: withTranscript = true, pollMs = 100, ...rest } = options;
  const f = assemblyRuntimeFixture();
  let clock = 1000, stopped = false, state: ConversationState | null = null;
  let active: ConversationDelivery | null = null, finish: () => boolean = () => false, pending = 0, delegations: string[] = [];
  let entries: HarnessTranscriptEntry[] = [], size = 100, grow = false, paused: string | null = null, compaction: 'resumed' | 'replace-required' | 'refused' = 'resumed';
  const dead = new Set<string>();
  const launches: ConversationWorker[] = [], restores: unknown[] = [], delivered: ConversationDelivery[] = [], notices: { kind: string; detail: string }[] = [];
  const audits: Record<string, unknown>[] = [], edges: (SessionWorkEdge | SessionWorkEdgeClose)[] = [], controls: string[] = [];
  let transcriptReads = 0;
  const answer = '{"answer":"hello"}';
  const adapter: HarnessAdapterPort<2> = {
    describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false }),
    // A grounded replacement starts without the wall its predecessor hit.
    launch: async input => { const worker = { launch: `process-${launches.length}`, incarnation: input.incarnation, claim: input.claim }; launches.push(worker); if (input.restore) { restores.push(input.restore); paused = null; } return worker; },
    deliver: async input => { delivered.push(input); active = input; return { state: 'accepted', evidence: 'accepted' }; },
    observe: async input => {
      if (dead.has(input.launch)) return { observations: [{ kind: 'exit', evidence: 'retired' }], cursor: input.cursor, complete: true };
      if (!input.delivery) return { observations: [], cursor: input.cursor, complete: true };
      if (paused) return { observations: [{ kind: 'paused', evidence: 'idle at the wall', reason: paused }], cursor: input.cursor, complete: true };
      if (!finish()) return { observations: [], cursor: input.cursor, complete: true };
      const observations = [{ kind: 'reply' as const, delivery: active!.operation, text: answer, digest: hash(answer) },
        { kind: 'turn-end' as const, delivery: active!.operation, state: 'completed' as const }];
      return { observations: observations.slice(input.cursor), cursor: 2, complete: true };
    },
    control: async input => {
      controls.push(input.action);
      if (input.action === 'compact') {
        if (compaction === 'resumed') { paused = null; return { state: 'resumed', evidence: 'compaction receipt' }; }
        if (compaction === 'replace-required') { return { state: 'replace-required', evidence: 'idle compaction failed' }; }
        return { state: 'refused', evidence: 'compaction refused' };
      }
      dead.add(input.launch); return { state: 'closed', evidence: 'stop' };
    },
    ...(withTranscript ? { observeTranscript: async (): Promise<HarnessTranscriptObservation> => {
      transcriptReads++; if (grow) size += 10;
      return { sessionUuid: 'transcript-1', path: '/t.jsonl', size, mtime: size, entries };
    } } : {}),
  };
  const config: ConversationSessionConfig = {
    conversation: 'operator-1', allowanceDeadline: 10_000_000_000, authorized: () => true, currentAuthority: () => 'existing-role',
    store: { load: () => structuredClone(state), save: next => { state = structuredClone(next); } },
    createAdapter: () => adapter, contextRecoveryAllowed: () => true,
    io: { clearResult: () => {}, readResult: () => null, modelCalls: () => delivered.length, wait: async ms => { clock += ms; },
      prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, refusalReason: null, openDelegations: delegations, uncertainEffects: 0, toolPreparations: pending }) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: f.c, now: () => clock, stopped: () => stopped, append: row => { if (row.type !== 'SessionWorkCall') edges.push(row); },
    parent: 'run-1', owner: 'machine-1', placement: 'local', transport: 'fake', workingScope: '/scope', resultDirectory: '/scope/results',
    artifact: 'artifact', incarnation: 'incarnation', deadlineMs: 14_400_000, pollMs, maxCalls: 100, maxSteps: 64, maxResultBytes: 65536,
    notice: (kind, detail) => notices.push({ kind, detail }), audit: event => audits.push(event),
    revival: { settlingMs: 100 },
    ...rest,
  };
  const port = value(createConversationSessionPort(config));
  const request = (operation: string) => ({ operation, question: 'What do you remember?', context: '{"memory":"tea"}', authority: 'existing-role' });
  return { port, config, request, launches, restores, delivered, notices, audits, edges, controls,
    state: () => structuredClone(state!), restart: () => value(createConversationSessionPort(config)), now: () => clock,
    advance: (ms: number) => { clock += ms; }, reads: () => transcriptReads,
    transcript: (next: HarnessTranscriptEntry[]) => { entries = next; }, growing: (next: boolean) => { grow = next; },
    finishWhen: (next: () => boolean) => { finish = next; }, prepared: (count: number) => { pending = count; },
    delegations: (next: string[]) => { delegations = next; }, wall: (reason: string | null) => { paused = reason; },
    compaction: (next: typeof compaction) => { compaction = next; }, stop: () => { stopped = true; },
    attempts: () => state?.workerRecoveryState?.attempts ?? {}, events: (name: string) => audits.filter(row => row.event === name),
  };
}

it('a tool call stalled on the transcript tail retires the worker and queues its revival; the revival drains and the turn completes', async () => {
  const f = liveWorker();
  f.transcript(stalled(f.now()));
  f.finishWhen(() => f.launches.length >= 2);
  const outcome = await f.port.run(f.request('lost'));
  expect(outcome).toMatchObject({ state: 'complete', text: '{"answer":"hello"}' });
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(1);
  // The Read threshold is 60 seconds; checks run at the 30-second cadence, so the kill lands at the third check.
  expect(f.events('recovery:stall')).toHaveLength(1);
  expect(f.events('recovery:stall')[0]).toMatchObject({ attemptNumber: 1, transcript: 'transcript-1', stall: { lastToolName: 'Read' } });
  expect(f.events('recovery:stall')[0]!.stall).not.toHaveProperty('lastToolInput');
  expect(f.events('recovery')[0]).toMatchObject({ failureType: 'stall', recovered: true, attempt: 1 });
  expect(f.state().revivalQueue?.entries[0]).toMatchObject({ status: 'respawned', reason: expect.stringContaining('stall on Read for 1 min') });
  expect(f.attempts()['stall:operator-1']).toMatchObject({ count: 1 });
  expect(f.notices.map(n => n.kind)).toEqual(['resumed']);
  expect(f.state().inputs[0]).toMatchObject({ state: 'settled', workerRecovery: 'continued' });
  await f.port.close();
});

it('a stall whose worker prepared tools since dispatch is retired and the input settles uncertain: no automatic replay', async () => {
  const f = liveWorker();
  f.transcript(stalled(f.now()));
  f.finishWhen(() => { f.prepared(1); return false; });
  const outcome = await f.port.run(f.request('lost'));
  expect(outcome).toMatchObject({ state: 'uncertain' });
  expect(outcome.detail).toContain('prepared tools since dispatch');
  expect(f.launches).toHaveLength(1); expect(f.state().worker).toBeNull();
  expect(f.state().revivalQueue?.entries ?? []).toHaveLength(0);
  expect(f.events('recovery')[0]).toMatchObject({ failureType: 'stall', recovered: false });
  await f.port.close();
});

it('three identical tool failures are an error loop: the worker is retired and revived through the same queue', async () => {
  const f = liveWorker();
  f.transcript(looping(f.now()));
  f.finishWhen(() => f.launches.length >= 2);
  expect(await f.port.run(f.request('loop'))).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(2);
  expect(f.events('recovery:error_loop')[0]).toMatchObject({ attemptNumber: 1, loop: { loopCount: 3 } });
  expect(f.state().revivalQueue?.entries[0]).toMatchObject({ status: 'respawned', reason: expect.stringContaining('error loop: 3 identical failures') });
  expect(f.attempts()['loop:operator-1']).toMatchObject({ count: 1 });
  await f.port.close();
});

it('open child work vetoes a detector kill: the worker is producing real work and is kept', async () => {
  const f = liveWorker();
  f.transcript(stalled(f.now())); f.delegations(['child-1']);
  // The child closes after two and a half minutes; the turn ends on the next observation after three.
  f.finishWhen(() => { if (f.now() >= 1000 + 2.5 * MINUTE) f.delegations([]); return f.now() >= 1000 + 3 * MINUTE; });
  expect(await f.port.run(f.request('busy'))).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(1);
  expect(f.events('recovery:deferred').length).toBeGreaterThanOrEqual(1);
  expect(f.events('recovery')[0]).toMatchObject({ failureType: 'stall', recovered: false });
  expect(f.attempts()['stall:operator-1']).toMatchObject({ count: 1 });
  await f.port.close();
});

it('the ladder is per conversation and durable: a second stall inside the 15-minute cooldown keeps the worker across a host restart and tells the operator once', async () => {
  const f = liveWorker();
  f.transcript(stalled(f.now()));
  f.finishWhen(() => f.launches.length >= 2);
  expect(await f.port.run(f.request('first'))).toMatchObject({ state: 'complete' });
  expect(f.attempts()['stall:operator-1']).toMatchObject({ count: 1 });
  const next = f.restart();
  // A restarted host retires the prior host's worker and launches its own (the third launch); that
  // worker's transcript is new and stalls afresh, but the conversation's ladder is cooling down.
  const stallAt = f.now() + 2 * MINUTE;
  f.transcript(stalled(stallAt));
  f.finishWhen(() => f.notices.some(n => n.kind === 'recovery-exhausted') && f.now() >= stallAt + 3 * MINUTE);
  expect(await next.run(f.request('second'))).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(3);
  expect(f.notices.filter(n => n.kind === 'recovery-exhausted')).toHaveLength(1);
  expect(f.notices.at(-1)?.detail).toContain('exhausted or cooling down');
  expect(f.attempts()['stall:operator-1']).toMatchObject({ count: 1 });
  expect(f.events('recovery:stall')).toHaveLength(1);
  await next.close();
});

it('without a transcript observer the detectors never run and a quiet worker is kept', async () => {
  const f = liveWorker({ transcript: false });
  f.finishWhen(() => f.now() >= 1000 + 5 * MINUTE);
  expect(await f.port.run(f.request('quiet'))).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(1);
  expect(f.audits.filter(row => String(row.event).startsWith('recovery'))).toHaveLength(0);
  await f.port.close();
});

it('the transcript is observed at the 30-second cadence, not on every poll', async () => {
  const f = liveWorker();
  f.finishWhen(() => f.now() >= 1000 + 2 * MINUTE);
  expect(await f.port.run(f.request('cadence'))).toMatchObject({ state: 'complete' });
  expect(f.reads()).toBeGreaterThanOrEqual(4); expect(f.reads()).toBeLessThanOrEqual(6);
  await f.port.close();
});

it('a context wall defers compaction on its first observation and compacts once the transcript stays static, spending one attempt and clearing the latch', async () => {
  const f = liveWorker();
  f.wall('context-too-long');
  f.finishWhen(() => true);
  const started = f.now();
  const outcome = await f.port.run(f.request('wall'));
  expect(outcome).toMatchObject({ state: 'complete', contextRecovery: 'wall' });
  expect(f.controls).toEqual(['compact']);
  const event = f.events('recovery:context_exhaustion')[0]!;
  expect(event).toMatchObject({ attemptNumber: 1, ceilingReached: false, transcriptGrowth: 'static', matchedPattern: 'context-too-long' });
  expect(event.latchAgeMs).toBeGreaterThanOrEqual(100);
  expect(f.events('recovery:context_compacted')).toHaveLength(1);
  // The deferral is logged as its own non-attempt; the compaction is the recovery.
  expect(f.events('recovery').map(row => row.recovered)).toEqual([false, true]);
  expect(f.events('recovery').at(-1)).toMatchObject({ failureType: 'context_exhaustion', recovered: true, attempt: 1 });
  expect(f.attempts()['context:operator-1']).toMatchObject({ count: 1 });
  expect(f.state().workerRecoveryState?.wedgedSeen).toEqual({});
  expect(f.now() - started).toBeLessThan(MINUTE);
  await f.port.close();
});

it('a transcript that keeps growing at the wall defers compaction, spending no attempt, until the 30-minute ceiling forces it', async () => {
  const f = liveWorker({ pollMs: 5000 });
  f.wall('context-too-long'); f.growing(true);
  f.finishWhen(() => true);
  const started = f.now();
  expect(await f.port.run(f.request('wall'))).toMatchObject({ state: 'complete' });
  expect(f.controls).toEqual(['compact']);
  expect(f.now() - started).toBeGreaterThanOrEqual(30 * MINUTE);
  expect(f.events('recovery:context_exhaustion')[0]).toMatchObject({ attemptNumber: 1, ceilingReached: true, transcriptGrowth: 'grew' });
  expect(f.attempts()['context:operator-1']).toMatchObject({ count: 1 });
  await f.port.close();
});

it('a failed compaction kills the worker and launches the grounded replacement for the same accepted input', async () => {
  const f = liveWorker();
  f.wall('context-too-long'); f.compaction('replace-required');
  f.finishWhen(() => f.launches.length >= 2);
  const outcome = await f.port.run(f.request('wall'));
  expect(outcome).toMatchObject({ state: 'complete', contextRecovery: 'wall' });
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(1);
  expect(f.restores[0]).toMatchObject({ operation: 'wall' });
  expect(f.controls).toEqual(['compact', 'close']);
  expect(f.events('recovery').at(-1)).toMatchObject({ failureType: 'context_exhaustion', recovered: true });
  expect(f.state().inputs[0]).toMatchObject({ contextRecovery: 'continued' });
  await f.port.close();
});

it('a refused compaction settles the input uncertain and never launches a replacement', async () => {
  const f = liveWorker();
  f.wall('context-too-long'); f.compaction('refused');
  f.finishWhen(() => true);
  const outcome = await f.port.run(f.request('wall'));
  expect(outcome).toMatchObject({ state: 'uncertain' });
  expect(outcome.detail).toContain('compaction refused; no automatic replacement');
  expect(f.launches).toHaveLength(1); expect(f.state().worker).toBeNull();
  await f.port.close();
});

it('a context wall after the ladder is exhausted retains the input as uncertain instead of looping', async () => {
  const f = liveWorker({ recovery: { maxAttempts: 1 } });
  f.wall('context-too-long');
  f.finishWhen(() => true);
  expect(await f.port.run(f.request('first'))).toMatchObject({ state: 'complete' });
  f.wall('context-too-long');
  const outcome = await f.port.run(f.request('second'));
  expect(outcome).toMatchObject({ state: 'uncertain' });
  expect(outcome.detail).toContain('exhausted or in cooldown');
  expect(f.controls.filter(action => action === 'compact')).toHaveLength(1);
  await f.port.close();
});
