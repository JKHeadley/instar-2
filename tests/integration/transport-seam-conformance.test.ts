import { afterEach, expect, it } from 'vitest';
import { canonical, consumeResult, decodeMeasurement } from '../../src/index.js';
import { createFactStore, decodeEnvelope, decodeHistoricalBody, factId, prepareSnapshot, signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createBoundedDueScanPort, decodeLoopPolicy, decodeMissedRangeRecord } from '../../src/transport/index.js';
import type { FenceToken, MissedRangeInput, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/index.js';
import { deriveVerificationAssessment } from '../../src/verification/index.js';
import type { VerificationAssessment, VerificationPlan, VerificationRequest } from '../../src/verification/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

// This file intentionally exercises many synchronous signed-history rebuilds.
// Yield between cases so Vitest's worker can service its fixed progress RPC.
afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

const pressureScope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const loopRef = (loop: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
const verdict = (result: unknown) => consumeResult(result as never, { Success: () => 'ACCEPT',
  Refused: refusal => `REFUSE: ${refusal.detail}` });
const rejects = (result: unknown, detail?: string) => {
  const text = verdict(result); expect(text).toMatch(/^REFUSE:/); if (detail) expect(text).toContain(detail); return text;
};
type Fixture = ReturnType<typeof transportLoopFixture>;
function setup(overrides: Partial<SharedBreakerLoopPolicy> = {}, fixture?: Fixture) {
  const f = fixture ?? transportLoopFixture(), token = value(f.api.acquire('lease:review', '', 1000));
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
function appendPartialRestoration(s: ReturnType<typeof setup>) {
  const completeFact = s.f.assessmentFact('assessment:witnessed-review')!;
  const complete = (completeFact.body as unknown as { record: VerificationAssessment }).record;
  const requestFact = s.f.ctx.facts.find(fact =>
    (fact.body as { record?: { type?: unknown; id?: unknown } }).record?.type === 'VerificationRequest'
      && (fact.body as { record?: { id?: unknown } }).record?.id === complete.request)!;
  const request = (requestFact.body as unknown as { record: VerificationRequest }).record;
  const planFact = s.f.ctx.facts.find(fact =>
    (fact.body as { record?: { type?: unknown; id?: unknown } }).record?.type === 'VerificationPlan'
      && (fact.body as { record?: { id?: unknown } }).record?.id === request.plan)!;
  const plan = (planFact.body as unknown as { record: VerificationPlan }).record;
  const assessment = value(deriveVerificationAssessment({ request, plan, evidence: [], observer: s.f.alice.id,
    vectorDigest: complete.vectorDigest, knownLineages: complete.knownLineages, captureStatuses: [], taints: [],
    now: s.f.host.current().clock, predecessors: [requestFact.id], decode: s.f.ctx.decode }, s.f.c));
  expect(assessment.missingEvidence.length).toBeGreaterThan(0);
  const stored = value(s.f.store.read()), last = stored.at(-1)!;
  const segment = { machine: s.f.host.machine, epoch: last.segment.epoch, position: last.segment.position + 1 };
  const wire = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment),
    kind: 'verification-VerificationAssessment', schemaVersion: 1, machine: s.f.host.machine,
    principal: s.f.alice, provenance: s.f.alice.provenance, at: s.f.host.current().clock, segment,
    prevInSegment: last.contentHash, predecessors: { inSegment: last.id, frontier: {}, required: [requestFact.id] },
    body: { record: assessment } }, privateKey);
  value(s.f.store.append(wire, { peer: s.f.host.machine }));
  const reference = { owner: 'part-nine' as const, name: 'VerificationAssessment' as const, id: assessment.id };
  const original = s.f.host.restorationEvidence!;
  Object.assign(s.f.host, { restorationEvidence: { owner: 'part-nine',
    verify: (input: Parameters<typeof original.verify>[0]) => input.reference.id !== assessment.id
      ? original.verify(input) : s.f.result(() => {
        const current = value(deriveVerificationAssessment({ request, plan, evidence: [], observer: s.f.alice.id,
          vectorDigest: complete.vectorDigest, knownLineages: complete.knownLineages, captureStatuses: [], taints: [],
          now: s.f.host.current().clock, predecessors: [requestFact.id], decode: s.f.ctx.decode }, s.f.c));
        expect(current).toEqual(assessment);
        return { reference, operation: current.operation, operationDigest: current.operationDigest,
          missingEvidence: current.missingEvidence, captureStatuses: current.captureStatuses, taints: current.taints,
          predicates: current.predicates.map(({ predicate, verdict }) => ({ predicate, verdict })),
          validFrom: current.validFrom, validUntil: current.validUntil };
      }) } });
  return reference;
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
function mutateLast(s: ReturnType<typeof setup>, transform: (record: SharedLoopRecord) => SharedLoopRecord) {
  const stored = value(s.f.store.read());
  const fact = stored.filter(value => value.kind === 'transport-LoopRecord').at(-1)!;
  const wires = s.f.storage.read() as readonly FactEnvelope[];
  const wire = wires.find(value => value.id === fact.id)!;
  const ctx = { ...s.f.ctx, facts: [...s.f.ctx.facts, ...stored.filter(value => value.id !== fact.id)] };
  const altered = signEnvelope({ ...wire,
    body: { record: transform((fact.body as unknown as { record: SharedLoopRecord }).record) } }, privateKey);
  const prefix = wires.filter(value => value.id !== fact.id);
  const replica = createFactStore(s.f.ctx, { owner: 'part-ten', read: () => prefix,
    append: (bytes, expected) => s.f.result(() => {
      expect(prefix.at(-1)?.contentHash ?? null).toBe(expected);
      prefix.push(JSON.parse(bytes) as FactEnvelope); return { kind: 'local-durable' as const };
    }) });
  return { ctx, altered, frame: value(decodeEnvelope(altered, ctx, 'replication')),
    replicate: () => replica.append(altered, { peer: s.f.host.machine }) };
}
function missed(options: Readonly<{ existingInstants?: readonly number[]; catchUpInstants?: readonly number[] }> = {}) {
  const existing = options.existingInstants ?? [110, 120, 130];
  const catchUp = options.catchUpInstants ?? [];
  const s = setup({}, transportLoopFixture(undefined, undefined, undefined, options));
  const page = value(createBoundedDueScanPort(s.f.host, s.f.spine, s.f.c).page({ scan: 'scan', generation: 'g1',
    orderedKeys: ['job:one'], cursor: null, maxItems: 1, maxDuration: 10 }));
  const result = s.f.appendResult();
  const input: MissedRangeInput = { parentDuty: s.f.parentDuty, episode: loopRef(s.loop), scanCursor: page.cursor,
    jobInstance: 'job:one', packageDigest: `sha256:${'d'.repeat(64)}`, calendarPolicy: 'every-10',
    asOf: s.f.clock(130), currentLateness: value(decodeMeasurement('duration', { type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'duration', instance: 'job:one' }, value: 0, unit: 'ms', at: s.f.clock(130), by: 'probe' },
    s.f.host.current().decode)),
    priorExpansionCursor: s.f.clock(100), missedBoundary: s.f.clock(130),
    catchUpPolicy: catchUp.length > 0 ? 'latest' : 'none',
    dispositions: [110, 120, 130].map(n => catchUp.includes(n)
      ? ({ scheduledInstant: s.f.clock(n), kind: 'catch-up-run' as const, run: s.f.catchUpRun(n) })
      : existing.includes(n) ? ({ scheduledInstant: s.f.clock(n), kind: 'existing-run' as const, run: s.f.admittedRun(n) })
        : ({ scheduledInstant: s.f.clock(n), kind: 'missed-no-execution' as const, result })),
    catchUpRun: catchUp.length > 0 ? s.f.catchUpRun(catchUp.at(-1)!) : null };
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

it('SLB-SCOPE-25 V19 derives caller scope proposals through the governed pressure binding', () => {
  const s = open(setup()), original = s.loop;
  s.loop = value(s.f.api.scheduleEpisode({ ...s.input, command: 'schedule:caller-scope', episodeKey: 'caller-scope',
    pressureScope: { ...pressureScope, machine: 'caller-machine-b' } }));
  expect(s.loop.pressureKey).toBe(original.pressureKey);
  expect(s.loop.pressureScope).toEqual(pressureScope);
  s.f.advance(1); rejects(attempt(s, 'scope:cooldown'), 'cooldown');
}, 10000);

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

it('SLB-OUTCOME-26 V08 V09 derives result meaning and exact attempt binding from signed completion evidence', () => {
  const wrong = setup(); wrong.f.advance(1); value(attempt(wrong, 'actual:failed'));
  const failed = wrong.f.appendOutcome('failed', 'actual:failed');
  rejects(outcome(wrong, 'actual:failed', 'accepted', { completion: failed }), 'classification');

  const reused = setup(); reused.f.advance(1); value(attempt(reused, 'bound:a')); value(attempt(reused, 'bound:b'));
  const completion = reused.f.appendOutcome('accepted', 'bound:a');
  rejects(outcome(reused, 'bound:b', 'accepted', { completion }), 'bound to this loop attempt');
});

it('SLB-ADMISSION-27 V22 V23 recomputes signed budget and half-open admission decisions', () => {
  const budget = setup({ parentAttemptBudget: 1 }); budget.f.advance(1);
  const admitted = value(attempt(budget, 'signed:a'));
  const added = { ...admitted.attemptLog[0]!, id: 'signed:forged', resource: 999 };
  const forgedBudget = signedNext(budget.f, { ...admitted, command: 'signed:budget', predecessor: budget.f.head(),
    attempts: 2, episodeAttempts: 2, pendingAttempts: ['signed:a', 'signed:forged'],
    attemptLog: [...admitted.attemptLog, added], rollingAttempts: 0, rollingResource: 0 });
  rejects(decodeHistoricalBody(forgedBudget.frame, forgedBudget.ctx, forgedBudget.ctx.decode));
  rejects(budget.f.store.append(forgedBudget.wire, { peer: 'machine-a' }));

  const cooldown = open(setup()), early = { ...cooldown.loop.attemptLog[0]!, id: 'signed:early',
    admittedAt: cooldown.loop.transitionAt, mode: 'half-open' as const };
  const forgedTrial = signedNext(cooldown.f, { ...cooldown.loop, command: 'signed:cooldown', predecessor: cooldown.f.head(),
    state: 'half-open', transition: 'half-opened', attempts: 3, episodeAttempts: 3, pending: 'signed:early',
    pendingAttempts: ['signed:early'], attemptLog: [...cooldown.loop.attemptLog, early], halfOpenAdmitted: 99 });
  rejects(decodeHistoricalBody(forgedTrial.frame, forgedTrial.ctx, forgedTrial.ctx.decode));
  rejects(cooldown.f.store.append(forgedTrial.wire, { peer: 'machine-a' }));
}, 10000);

it('SLB-TRANSITION-38 V10 V11 V12 reconstructs every signed admission and stop field on replay and replication', () => {
  const check = (mutation: ReturnType<typeof mutateLast>) => {
    rejects(decodeHistoricalBody(mutation.frame, mutation.ctx, mutation.ctx.decode));
    rejects(mutation.replicate());
  };

  const counted = setup(); counted.f.advance(1); value(attempt(counted, 'complete:first'));
  value(outcome(counted, 'complete:first')); counted.f.advance(2); value(attempt(counted, 'complete:second'));
  check(mutateLast(counted, record => ({ ...record, failureCount: 0,
    outcomeWindowDigest: value(canonical([])).hash })));

  const stopped = setup({ maxAttempts: 1 }); stopped.f.advance(1); value(attempt(stopped, 'stop:first'));
  value(outcome(stopped, 'stop:first', 'accepted')); stopped.f.advance(1); value(attempt(stopped, 'stop:bound'));
  check(mutateLast(stopped, record => ({ ...record, rollingAttempts: 0, rollingResource: 0,
    nextEligible: stopped.f.clock(0), nextWake: 0, breakerOpenCount: 999 })));

  const episode = setup(); episode.f.advance(1); value(attempt(episode, 'episode:bound'));
  check(mutateLast(episode, record => ({ ...record,
    attemptLog: record.attemptLog.map(entry => ({ ...entry, episode: 'loop:invented' })) })));
});

it('SLB-ROLLING-39 V21 recomputes expired rolling counters on the normal stopped transition', () => {
  const s = setup({ maxDuration: 10, budgetWindow: 5 });
  s.f.advance(1); value(attempt(s, 'rolling:expired')); value(outcome(s, 'rolling:expired', 'accepted'));
  s.f.advance(10);
  expect(value(attempt(s, 'rolling:stop'))).toMatchObject({ state: 'stopped', transition: 'stopped',
    attempts: 1, episodeAttempts: 1, rollingAttempts: 0, rollingResource: 0 });
});

it('SLB-ZERO-CAP-40 V13 accepts finite zero work caps and refuses every attempted admission', () => {
  const f = transportLoopFixture();
  const policy = value(decodeLoopPolicy({ ...f.sharedPolicy, id: 'policy:zero-work',
    concurrency: 0, halfOpenTrials: 0, halfOpenConcurrency: 0 }, f.c)) as SharedBreakerLoopPolicy;
  f.registerPolicy(policy);
  const token = value(f.api.acquire('lease:zero-work', '', 1000));
  const loop = value(f.api.scheduleEpisode({ command: 'schedule:zero-work', fence: token,
    currentOwnerRun: f.run, policy, episodeKey: 'zero-work', operationFamily: 'recovery',
    pressureScope, sourceVector: f.vector }));
  f.advance(1);
  rejects(f.api.admitLoopAttempt({ command: 'admit:zero-work', fence: token, episode: loopRef(loop),
    attempt: 'zero-work', holderFamily: 'sentinel', worker: 'worker:zero', machine: 'machine-a',
    resource: 0, sourceVector: f.vector }), 'concurrent work cap');
  expect((value(f.api.inspect()).at(-1)!.record as SharedLoopRecord).attempts).toBe(0);
});

it('SLB-CLOSURE-17 V15 V33 restoration references are actual fresh Part Nine facts and rechecked at promotion', () => {
  const absent = open(setup({ halfOpenTrials: 1 })); absent.f.advance(20); value(attempt(absent, 'trial:absent'));
  rejects(outcome(absent, 'trial:absent', 'accepted', { restoration: [{ owner: 'part-nine',
    name: 'VerificationAssessment', id: 'assessment:absent' }] }), 'evidence is absent');

  const partial = open(setup({ halfOpenTrials: 1 })); partial.f.advance(20); value(attempt(partial, 'trial:partial'));
  rejects(outcome(partial, 'trial:partial', 'accepted', { restoration: [{ owner: 'part-nine',
    name: 'VerificationAssessment', id: 'assessment:one' }] }), 'subject differs');

  const s = open(setup()); let available = true, calls = 0;
  const originalRestoration = s.f.host.restorationEvidence!;
  Object.assign(s.f.host, { restorationEvidence: { owner: 'part-nine', verify: (input: Parameters<typeof originalRestoration.verify>[0]) =>
    s.f.result(() => { calls++; if (!available) throw new Error('assessment unavailable'); return value(originalRestoration.verify(input)); }) } });
  s.f.advance(20); value(attempt(s, 'trial:one'));
  s.loop = value(outcome(s, 'trial:one', 'accepted', {
    restoration: [s.f.restorationReference('assessment:witnessed-review')] }));
  value(attempt(s, 'trial:two'));
  const completion = s.f.appendOutcome('accepted', 'trial:two'); available = false;
  rejects(outcome(s, 'trial:two', 'accepted', { completion }), 'assessment unavailable');
  expect(calls).toBeGreaterThanOrEqual(2);
  available = true;
  expect((value(s.f.api.inspect()).at(-1)!.record as SharedLoopRecord).pendingAttempts).toEqual(['trial:two']);
}, 20000);

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
  const result = s.f.appendResult('result:erase-existing');
  rejects(s.f.api.recordMissedRange({ ...s.input, dispositions: [110, 120, 130].map(value => ({
    scheduledInstant: s.f.clock(value), kind: 'missed-no-execution' as const, result })) }), 'already admitted');
  rejects(s.f.api.recordMissedRange({ ...s.input, dispositions: s.input.dispositions.map(value => ({
    scheduledInstant: value.scheduledInstant, kind: 'existing-run' as const,
    run: { owner: 'part-five', name: 'Run', id: 'run:absent' } })) }), 'already admitted');
  const unrelated = value(createBoundedDueScanPort(s.f.host, s.f.spine, s.f.c).page({ scan: 'unrelated',
    generation: 'unrelated:g', orderedKeys: ['different-job'], cursor: null, maxItems: 1, maxDuration: 10 }));
  rejects(s.f.api.recordMissedRange({ ...s.input, scanCursor: unrelated.cursor }), 'roster');
  rejects(s.f.api.recordMissedRange({ ...s.input, catchUpPolicy: 'latest',
    catchUpRun: { owner: 'part-five', name: 'Run', id: 'run:unwitnessed-catchup' },
    dispositions: s.input.dispositions.map((value, index) => index === 2 ? { scheduledInstant: value.scheduledInstant,
      kind: 'catch-up-run' as const, run: { owner: 'part-five' as const, name: 'Run' as const,
        id: 'run:unwitnessed-catchup' } } : value) }), 'already admitted');
});

it('SLB-STATUS-29 V26 refuses promotion from unavailable required parent input while retaining history', () => {
  const s = setup(); s.f.advance(1);
  const opening = s.f.ctx.facts.find(fact => (fact.body as { capture?: { reference?: string } }).capture?.reference === 'message:1')!;
  const old = s.f.ctx.captures['message:1']!;
  Object.assign(s.f.ctx, { captures: { ...s.f.ctx.captures,
    'message:1': { ...old, status: 'expired', bytes: null } } });
  expect(value(prepareSnapshot([opening], s.f.ctx)).entries[0]!.taint).toContain('evidence-unavailable');
  rejects(attempt(s, 'unavailable:parent'), 'unavailable');
});

it('SLB-SIBLING-28 V18 consumes either half-open completion order across restart without reopening reachability', () => {
  const run = (order: readonly ('sibling:a' | 'sibling:b')[]) => {
    const s = open(setup({ halfOpenConcurrency: 2 })); s.f.advance(20);
    value(attempt(s, 'sibling:a')); value(attempt(s, 'sibling:b'));
    const completions = { 'sibling:a': s.f.appendOutcome('accepted', 'sibling:a'),
      'sibling:b': s.f.appendOutcome('failed', 'sibling:b') };
    const apply = (id: 'sibling:a' | 'sibling:b') => s.f.api.recordLoopOutcome({ command: `outcome:${id}`,
      fence: s.token, episode: loopRef(s.loop), attempt: id, kind: id === 'sibling:a' ? 'accepted' : 'failed',
      failureClass: id === 'sibling:a' ? '' : 'transport', completion: completions[id], jitterPermille: 1000,
      restoration: [], sourceVector: s.f.vector });
    s.loop = value(apply(order[0]!));
    const restarted = transportLoopFixture(s.f.directory);
    restarted.time(s.f.host.loopClock!.now().value);
    s.f = restarted; s.loop = value(restarted.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
    s.loop = value(apply(order[1]!));
    return s.loop;
  };
  const acceptedFirst = run(['sibling:a', 'sibling:b']), failedFirst = run(['sibling:b', 'sibling:a']);
  expect(acceptedFirst).toMatchObject({ state: 'open-breaker', transition: 'reopened', pendingAttempts: [] });
  expect(failedFirst).toMatchObject({ state: 'open-breaker', pendingAttempts: [] });
  expect(failedFirst.outcomeWindowDigest).toBe(acceptedFirst.outcomeWindowDigest);
}, 20000);

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
  const s = missed({ existingInstants: [110, 120], catchUpInstants: [130] });
  const first: MissedRangeInput = s.input;
  value(s.f.api.recordMissedRange(first));
  const changedRun = { owner: 'part-five' as const, name: 'Run' as const, id: 'run:second-catchup' };
  const next: MissedRangeInput = { ...first, asOf: s.f.clock(131),
    currentLateness: value(decodeMeasurement('duration', { ...first.currentLateness, value: 1, at: s.f.clock(131) },
      s.f.host.current().decode)), catchUpRun: changedRun,
    dispositions: first.dispositions.map((value, index) => index === 2
      ? { scheduledInstant: value.scheduledInstant, kind: 'catch-up-run' as const, run: changedRun } : value) };
  rejects(s.f.api.recordMissedRange(next), 'completed missed member');
});

it('SLB-THRESHOLD-31 V11 opens at the counted threshold while preserving an admitted sibling and refuses more work', () => {
  const s = setup({ failureThreshold: 1 }); s.f.advance(1);
  value(attempt(s, 'threshold:failed')); value(attempt(s, 'threshold:pending'));
  s.loop = value(outcome(s, 'threshold:failed'));
  expect(s.loop).toMatchObject({ state: 'open-breaker', transition: 'opened', failureCount: 1,
    pendingAttempts: ['threshold:pending'] });
  rejects(attempt(s, 'threshold:must-not-run'), 'cooldown');
});

it('SLB-CLASS-32 V12 derives failure class from the attempt-bound signed completion under the pinned policy', () => {
  const unwitnessed = setup({ failureThreshold: 1 }); unwitnessed.f.advance(1);
  value(attempt(unwitnessed, 'class:unwitnessed'));
  rejects(outcome(unwitnessed, 'class:unwitnessed', 'failed', {
    failureClass: 'caller-supplied-escape' }), 'failure class');

  const legitimate = setup({ failureThreshold: 1 }); legitimate.f.advance(1);
  value(attempt(legitimate, 'class:non-counted'));
  const completion = legitimate.f.appendOutcome('failed', 'class:non-counted', 'application');
  const recorded = value(outcome(legitimate, 'class:non-counted', 'failed', {
    failureClass: 'application', completion }));
  expect(recorded).toMatchObject({ state: 'waiting', failureCount: 0, totalFailures: 0 });
});

it('SLB-ACTIVE-POLICY-35 V13 refuses a conflicting decoded policy before coalescing an active episode', () => {
  const s = setup();
  const conflicting = value(decodeLoopPolicy({ ...s.policy, id: 'policy:active-conflict',
    parentAttemptBudget: 1 }, s.f.c)) as SharedBreakerLoopPolicy;
  s.f.registerPolicy(conflicting);
  rejects(s.f.api.scheduleEpisode({ ...s.input, command: 'schedule:active-conflict', policy: conflicting }),
    'conflicting shared pressure policy');
  expect(value(s.f.api.scheduleEpisode({ ...s.input, command: 'schedule:active-coalesce' }))).toEqual(s.loop);
});

it('SLB-MISSED-RECHECK-34 V14 re-resolves roster/range dependencies before returning an identical replay', () => {
  const s = missed({ existingInstants: [] });
  const reference = value(s.f.api.recordMissedRange(s.input));
  expect(value(s.f.api.recordMissedRange(s.input))).toEqual(reference);
  const calendar = s.f.host.calendarExpansion!;
  Object.assign(s.f.host, { calendarExpansion: { ...calendar,
    roster: () => s.f.result(() => { throw new Error('roster temporarily unavailable'); }) } });
  rejects(s.f.api.recordMissedRange(s.input), 'roster');
});

it('SLB-HISTORY-33 V22 V37 reconstructs every initial schedule field from signed policy and owner evidence', () => {
  const s = setup(), stored = value(s.f.store.read());
  const fact = stored.find(value => value.kind === 'transport-LoopRecord')!;
  const original = s.f.storage.read().find(value => (value as { id?: string }).id === fact.id) as Record<string, unknown>;
  const context = { ...s.f.ctx, facts: [...s.f.ctx.facts, ...stored.filter(value => value.id !== fact.id)] };
  const altered = (record: SharedLoopRecord) => {
    const wire = signEnvelope({ ...original, body: { record } }, privateKey);
    return decodeHistoricalBody(value(decodeEnvelope(wire, context, 'replication')), context, context.decode);
  };
  rejects(altered({ ...s.loop, nextWake: s.loop.transitionAt.value,
    nextEligible: s.loop.transitionAt }), 'initial shared loop counters');
  rejects(altered({ ...s.loop, run: 'run:not-the-witnessed-owner' }), 'witnessed current owner');
});

it('SLB-RESTORE-30 V26 requires a current Part Nine assessment with signed request, plan and Evidence support', () => {
  const unsupported = open(setup({ halfOpenTrials: 1 })); unsupported.f.advance(20);
  value(attempt(unsupported, 'restore:unsupported'));
  const fake = unsupported.f.assessmentFact('assessment:expires')!;
  const fakeRecord = (fake.body as { record: { id: string } }).record;
  rejects(outcome(unsupported, 'restore:unsupported', 'accepted', { restoration: [{ owner: 'part-nine',
    name: 'VerificationAssessment', id: fakeRecord.id }] }), 'VerificationRequest');
  expect(unsupported.f.ctx.facts.some(fact => fact.id === fake.id)).toBe(true);

  const witnessed = open(setup({ halfOpenTrials: 1 })); witnessed.f.advance(20);
  value(attempt(witnessed, 'restore:witnessed'));
  const closed = value(outcome(witnessed, 'restore:witnessed', 'accepted', {
    restoration: [witnessed.f.restorationReference('assessment:witnessed-review')] }));
  expect(closed).toMatchObject({ state: 'closed', transition: 'closed' });
}, 20000);

it('SLB-SIGNED-CLOCK-43 V15 V17 refuses correctly signed loop records with unregistered clocks on replay and replication', () => {
  const s = setup();
  const mutation = mutateLast(s, record => {
    const invalid = (clock: SharedLoopRecord['transitionAt']) => ({ ...clock,
      unit: 'bogus-unit', by: 'unregistered' }) as unknown as SharedLoopRecord['transitionAt'];
    return { ...record, transitionAt: invalid(record.transitionAt), nextEligible: invalid(record.nextEligible),
      breakerFirstOpened: invalid(record.breakerFirstOpened) };
  });
  rejects(decodeHistoricalBody(mutation.frame, mutation.ctx, mutation.ctx.decode), 'unit');
  rejects(mutation.replicate(), 'unit');
});

it('SLB-GENERATION-COMPLETE-44 V14 resolves completion against the admission-pinned generation after rollover', () => {
  const s = setup();
  value(s.f.api.release('release:generation-complete', s.token));
  s.f.generation('generation:2');
  s.token = value(s.f.api.acquire('lease:generation-complete:g2', s.f.head(), 1000));
  s.f.revalidatePolicy(); s.f.advance(1);
  value(attempt(s, 'generation:complete'));
  expect(value(outcome(s, 'generation:complete', 'accepted'))).toMatchObject({
    state: 'waiting', policyGeneration: { id: 'generation:2' }, pendingAttempts: [],
  });
});

it('SLB-PARTIAL-RESTORATION-45 V18 retains an authentic partial assessment without promoting closure', () => {
  const s = open(setup({ halfOpenTrials: 1 })); s.f.advance(20);
  value(attempt(s, 'partial:trial'));
  const reference = appendPartialRestoration(s);
  const retained = value(outcome(s, 'partial:trial', 'accepted', { restoration: [reference] }));
  expect(retained).toMatchObject({ state: 'half-open', transition: 'outcome-recorded', pendingAttempts: [] });
  expect(retained.outcomeLog.at(-1)!.restoration).toEqual([reference]);
  expect(retained.closureEvidence).toEqual([]);
});

it('SLB-DELAYED-RESTORATION-46 V19 closes by an evidence-only successor without rewriting the passing completion', () => {
  const s = open(setup({ halfOpenTrials: 1 })); s.f.advance(20);
  value(attempt(s, 'delayed:trial'));
  const completion = s.f.appendOutcome('accepted', 'delayed:trial');
  const passing = value(outcome(s, 'delayed:trial', 'accepted', { completion }));
  expect(passing.state).toBe('half-open');
  const closed = value(outcome(s, 'delayed:trial', 'accepted', {
    command: 'closure:delayed:new-evidence', completion,
    restoration: [s.f.restorationReference('assessment:witnessed-review')],
  }));
  expect(closed).toMatchObject({ state: 'closed', transition: 'closed', outcomeLog: passing.outcomeLog });
  expect(closed.closureEvidence).toHaveLength(1);
});
