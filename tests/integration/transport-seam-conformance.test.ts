import { expect, it } from 'vitest';
import { canonical, consumeResult, decodeMeasurement } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody, factId, signEnvelope } from '../../src/facts/index.js';
import { createBoundedDueScanPort, decodeLoopPolicy, decodeMissedRangeRecord } from '../../src/transport/index.js';
import type { FenceToken, MissedRangeInput, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const pressureScope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const loopRef = (loop: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
const verdict = (result: unknown) => consumeResult(result as never, { Success: () => 'ACCEPT',
  Refused: refusal => `REFUSE: ${refusal.detail}` });
const rejects = (result: unknown, detail?: string) => {
  const text = verdict(result); expect(text).toMatch(/^REFUSE:/); if (detail) expect(text).toContain(detail); return text;
};
type Fixture = ReturnType<typeof transportLoopFixture>;
function setup(overrides: Partial<SharedBreakerLoopPolicy> = {}) {
  const f = transportLoopFixture(), token = value(f.api.acquire('lease:review', '', 1000));
  const policy = Object.keys(overrides).length === 0 ? f.sharedPolicy : value(decodeLoopPolicy({ ...f.sharedPolicy,
    id: `policy:review:${value(canonical(overrides)).hash}`, ...overrides }, f.c)) as SharedBreakerLoopPolicy;
  f.registerPolicy(policy);
  const input = { command: 'schedule:review', fence: token, currentOwnerRun: f.run, policy,
    episodeKey: 'episode:one', operationFamily: 'recovery', pressureScope, sourceVector: f.vector };
  const loop = value(f.api.scheduleEpisode(input)); return { f, token, policy, input, loop };
}
function attempt(s: ReturnType<typeof setup>, id: string, extra: Record<string, unknown> = {}) {
  return s.f.api.admitLoopAttempt({ command: `admit:${id}`, fence: s.token, episode: loopRef(s.loop), attempt: id,
    holderFamily: 'sentinel', worker: `worker:${id}`, machine: 'machine-a', resource: 1,
    sourceVector: s.f.vector, ...extra });
}
function outcome(s: ReturnType<typeof setup>, id: string, kind: 'accepted' | 'failed' = 'failed',
  extra: Record<string, unknown> = {}) {
  return s.f.api.recordLoopOutcome({ command: `outcome:${id}`, fence: s.token, episode: loopRef(s.loop), attempt: id,
    kind, failureClass: kind === 'failed' ? 'transport' : '', completion: s.f.appendOutcome(kind, id),
    jitterPermille: 1000, restoration: [], sourceVector: s.f.vector, ...extra });
}
function open(s: ReturnType<typeof setup>) {
  s.f.advance(1); value(attempt(s, 'open:a')); value(outcome(s, 'open:a'));
  s.f.advance(2); value(attempt(s, 'open:b')); s.loop = value(outcome(s, 'open:b')); return s;
}
function signedNext(f: Fixture, record: SharedLoopRecord | Record<string, unknown>) {
  const facts = value(f.store.read()), last = facts.at(-1)!;
  const segment = { machine: f.host.machine, epoch: last.segment.epoch, position: last.segment.position + 1 };
  const required = [...new Set([last.id, ...last.predecessors.required])];
  const wire = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment),
    kind: `transport-${record.type as string}`, schemaVersion: 1, at: f.host.current().clock,
    machine: f.host.machine, principal: f.host.principal, provenance: f.host.principal.provenance,
    segment, prevInSegment: last.contentHash, predecessors: { inSegment: last.id, frontier: {}, required },
    body: { record } }, privateKey);
  const ctx = { ...f.ctx, facts: [...f.ctx.facts, ...facts] };
  return { wire, ctx, frame: value(decodeEnvelope(wire, ctx, 'replication')) };
}
function missed() {
  const s = setup();
  const page = value(createBoundedDueScanPort(s.f.host, s.f.spine, s.f.c).page({ scan: 'scan', generation: 'g1',
    orderedKeys: ['job:one'], cursor: null, maxItems: 1, maxDuration: 10 }));
  const result = s.f.appendResult();
  const input: MissedRangeInput = { parentDuty: s.f.parentDuty, episode: loopRef(s.loop), scanCursor: page.cursor,
    jobInstance: 'job:one', packageDigest: `sha256:${'d'.repeat(64)}`, calendarPolicy: 'every-10',
    asOf: s.f.clock(130), currentLateness: value(decodeMeasurement('duration', { type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'duration', instance: 'job:one' }, value: 0, unit: 'ms', at: s.f.clock(130), by: 'probe' },
    s.f.host.current().decode)),
    priorExpansionCursor: s.f.clock(100), missedBoundary: s.f.clock(130), catchUpPolicy: 'none',
    dispositions: [110, 120, 130].map(n => ({ scheduledInstant: s.f.clock(n), kind: 'missed-no-execution' as const, result })),
    catchUpRun: null };
  return { ...s, page, input };
}

it('SLB-REFS-14 V02 V03 V04 V08 re-resolves policy, Run, vector positions and generation policy facts', () => {
  const f = transportLoopFixture(), token = value(f.api.acquire('lease:refs', '', 1000));
  const absentParent = { ...f.parentDuty, id: 'run:absent' };
  const absentPolicy = value(decodeLoopPolicy({ ...f.sharedPolicy, id: 'policy:absent', parentDuty: absentParent }, f.c));
  rejects(f.api.scheduleEpisode({ command: 'schedule:absent', fence: token, currentOwnerRun: absentParent,
    policy: absentPolicy as SharedBreakerLoopPolicy, episodeKey: 'absent', operationFamily: 'recovery',
    pressureScope, sourceVector: f.vector }), 'policy fact');

  const s = setup(); s.f.advance(1);
  rejects(attempt(s, 'empty-vector', { sourceVector: [] }), 'source vector');
  rejects(attempt(s, 'missing-vector', { sourceVector: [{ machine: 'machine-a', epoch: 99, position: 99 }] }));
  value(s.f.api.release('release:refs', s.token)); s.f.generation('generation:2');
  s.token = value(s.f.api.acquire('lease:g2', s.f.head(), 1000));
  rejects(attempt(s, 'old-generation'), 'pinned generation');
  s.f.revalidatePolicy(); value(attempt(s, 'new-generation'));
});

it('SLB-BUDGET-15 V09 stable parent identity prevents pressure-scope budget evasion', () => {
  const s = setup({ parentAttemptBudget: 1 }); s.f.advance(1);
  value(attempt(s, 'budget:a')); value(outcome(s, 'budget:a', 'accepted'));
  s.loop = value(s.f.api.scheduleEpisode({ ...s.input, command: 'schedule:other-scope', episodeKey: 'episode:two',
    operationFamily: 'caller-selected-alternate-family', pressureScope: { ...pressureScope, machine: 'machine-b' } })); s.f.advance(1);
  rejects(attempt(s, 'budget:b'), 'shared parent budget');
});

it('SLB-REPLAY-16 V13 V14 V34 replay and replication refuse forged closure, counters and unwitnessed completion', () => {
  const scheduled = setup();
  const close = signedNext(scheduled.f, { ...scheduled.loop, command: 'forged:close', predecessor: scheduled.f.head(),
    state: 'closed', transition: 'closed' });
  rejects(decodeHistoricalBody(close.frame, close.ctx, close.ctx.decode));
  rejects(scheduled.f.store.append(close.wire, { peer: 'machine-a' }));

  const counted = setup(); counted.f.advance(1); value(attempt(counted, 'counted:a'));
  counted.loop = value(outcome(counted, 'counted:a'));
  const counters = signedNext(counted.f, { ...counted.loop, command: 'forged:counters', predecessor: counted.f.head(),
    failureCount: 0, rollingAttempts: 0, rollingResource: 0, outcomeWindowDigest: `sha256:${'0'.repeat(64)}` });
  rejects(decodeHistoricalBody(counters.frame, counters.ctx, counters.ctx.decode));

  const pending = setup(); pending.f.advance(1); pending.loop = value(attempt(pending, 'pending:a'));
  const fakeOutcome = { attempt: 'pending:a', kind: 'accepted', failureClass: '', observedAt: pending.f.clock(101),
    jitterPermille: 1000, restoration: [], sourceVector: pending.f.vector };
  const completion = signedNext(pending.f, { ...pending.loop, command: 'forged:completion', predecessor: pending.f.head(),
    state: 'waiting', transition: 'outcome-recorded', pending: '', pendingAttempts: [], outcomeLog: [fakeOutcome],
    outcomeWindowDigest: value(canonical([fakeOutcome])).hash });
  rejects(pending.f.store.append(completion.wire, { peer: 'machine-a' }));
});

it('SLB-CLOSURE-17 V15 V33 restoration references are actual fresh Part Nine facts and rechecked at promotion', () => {
  const absent = open(setup({ halfOpenTrials: 1 })); absent.f.advance(20); value(attempt(absent, 'trial:absent'));
  rejects(outcome(absent, 'trial:absent', 'accepted', { restoration: [{ owner: 'part-nine',
    name: 'VerificationAssessment', id: 'assessment:absent' }] }), 'assessment unavailable');

  const s = open(setup()); let available = true, calls = 0;
  Object.assign(s.f.host, { restorationEvidence: { owner: 'part-nine', verify: (input: { reference: unknown }) =>
    s.f.result(() => { calls++; if (!available) throw new Error('assessment unavailable'); return input.reference; }) } });
  s.f.advance(20); value(attempt(s, 'trial:one'));
  s.loop = value(outcome(s, 'trial:one', 'accepted', { restoration: [{ owner: 'part-nine',
    name: 'VerificationAssessment', id: 'assessment:expires' }] }));
  available = false; value(attempt(s, 'trial:two'));
  rejects(outcome(s, 'trial:two', 'accepted'), 'assessment unavailable');
  expect(calls).toBeGreaterThanOrEqual(2);
  expect((value(s.f.api.inspect()).at(-1)!.record as SharedLoopRecord).pendingAttempts).toEqual(['trial:two']);
});

it('SLB-CLOCK-18 V07 comparable shared clocks never move backward', () => {
  const s = setup(); s.f.advance(1); value(attempt(s, 'clock:a'));
  Object.assign(s.f.host, { loopClock: { owner: 'part-ten', now: () => s.f.clock(99) } });
  rejects(outcome(s, 'clock:a', 'accepted'), 'backward');
});

it('SLB-BOUNDS-19 V11 V39 total concurrency bounds half-open and a zero parent-attempt budget admits no work', () => {
  rejects(decodeLoopPolicy({ ...transportLoopFixture().sharedPolicy, concurrency: 1, halfOpenConcurrency: 2 },
    transportLoopFixture().c), 'total concurrent-work cap');
  const s = setup({ parentAttemptBudget: 0 }); s.f.advance(1);
  rejects(attempt(s, 'zero-budget'), 'shared parent budget');
  expect((value(s.f.api.inspect()).at(-1)!.record as SharedLoopRecord).attempts).toBe(0);
});

it('SLB-MISSED-21 V21 V22 V26 resolves member Runs, cursor roster and catch-up admissions against owner history', () => {
  const s = missed();
  rejects(s.f.api.recordMissedRange({ ...s.input, dispositions: s.input.dispositions.map(value => ({
    scheduledInstant: value.scheduledInstant, kind: 'existing-run' as const,
    run: { owner: 'part-five', name: 'Run', id: 'run:absent' } })) }), 'Run admission');
  const unrelated = value(createBoundedDueScanPort(s.f.host, s.f.spine, s.f.c).page({ scan: 'unrelated',
    generation: 'unrelated:g', orderedKeys: ['different-job'], cursor: null, maxItems: 1, maxDuration: 10 }));
  rejects(s.f.api.recordMissedRange({ ...s.input, scanCursor: unrelated.cursor }), 'roster');
  rejects(s.f.api.recordMissedRange({ ...s.input, catchUpPolicy: 'latest',
    catchUpRun: { owner: 'part-five', name: 'Run', id: 'run:unwitnessed-catchup' },
    dispositions: s.input.dispositions.map((value, index) => index === 2 ? { scheduledInstant: value.scheduledInstant,
      kind: 'catch-up-run' as const, run: { owner: 'part-five' as const, name: 'Run' as const,
        id: 'run:unwitnessed-catchup' } } : value) }), 'Run admission');
});

it('SLB-MISSED-REPLAY-22 V28 V29 V37 refuses signed and read-time missed records with absent dependencies', () => {
  const s = missed(), reference = value(s.f.api.recordMissedRange(s.input));
  const record = value(s.f.api.readMissedRange(reference)).record;
  rejects(decodeMissedRangeRecord({ ...record, first: s.f.clock(120), last: s.f.clock(110),
    orderedMembersDigest: `sha256:${'0'.repeat(64)}` }, s.f.c));
  const receiver = transportLoopFixture();
  const { catchUpRun: _omitted, ...wireRecord } = record;
  const replay = signedNext(receiver, wireRecord);
  rejects(decodeHistoricalBody(replay.frame, replay.ctx, replay.ctx.decode));
  rejects(receiver.store.append(replay.wire, { peer: 'machine-a' }));
  rejects(receiver.api.readMissedRange(reference), 'unavailable');
});

it('SLB-MISSED-STABLE-23 V27 boundary-plus-one cannot mint a second catch-up identity', () => {
  const s = missed(), run = s.f.admittedRun(130);
  const first: MissedRangeInput = { ...s.input, catchUpPolicy: 'latest', catchUpRun: run,
    dispositions: s.input.dispositions.map((value, index) => index === 2
      ? { scheduledInstant: value.scheduledInstant, kind: 'catch-up-run' as const, run } : value) };
  value(s.f.api.recordMissedRange(first));
  const changedRun = { owner: 'part-five' as const, name: 'Run' as const, id: 'run:second-catchup' };
  const next: MissedRangeInput = { ...first, asOf: s.f.clock(131),
    currentLateness: value(decodeMeasurement('duration', { ...first.currentLateness, value: 1, at: s.f.clock(131) },
      s.f.host.current().decode)), catchUpRun: changedRun,
    dispositions: first.dispositions.map((value, index) => index === 2
      ? { scheduledInstant: value.scheduledInstant, kind: 'catch-up-run' as const, run: changedRun } : value) };
  rejects(s.f.api.recordMissedRange(next), 'completed missed member');
});
