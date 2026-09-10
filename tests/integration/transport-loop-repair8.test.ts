import { afterEach, expect, it } from 'vitest';
import { canonical, consumeResult, decode, decodeMeasurement } from '../../src/index.js';
import { authorAndAppend, createFactStore, factId, prepareSnapshot, signEnvelope } from '../../src/facts/index.js';
import { createRunGraph, recordFromWire, recordWire } from '../../src/rungraph/index.js';
import { createBoundedDueScanPort, decodeLoopPolicy } from '../../src/transport/index.js';
import type { SharedLoopRecord } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportFixture as legacyFixture } from '../transport/fixture.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

const scope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' };
const reference = (loop: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
const verdict = (result: any): any => consumeResult(result, {
  Success: (accepted: any) => ({ kind: 'ACCEPT', value: accepted }),
  Refused: (refusal: any) => ({ kind: 'REFUSE', detail: refusal.detail }),
} as any);
const refused = (result: any) => expect(verdict(result)).toMatchObject({ kind: 'REFUSE' });

function setup(overrides: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  const fixture = transportLoopFixture(undefined, undefined, undefined, options);
  const policy: any = value(decodeLoopPolicy({ ...fixture.sharedPolicy, id: 'repair8-policy', ...overrides }, fixture.c));
  fixture.registerPolicy(policy);
  const token = value(fixture.api.acquire('repair8-lease', '', 1000));
  const loop = value(fixture.api.scheduleEpisode({ command: 'repair8-schedule', fence: token,
    currentOwnerRun: fixture.run, policy, episodeKey: 'repair8-episode', operationFamily: 'recovery',
    pressureScope: scope, sourceVector: fixture.vector }));
  return { fixture, policy, token, loop };
}

function admit(state: ReturnType<typeof setup>, attempt: string) {
  return state.fixture.api.admitLoopAttempt({ command: `repair8-admit:${attempt}`, fence: state.token,
    episode: reference(state.loop), attempt, holderFamily: 'sentinel', worker: `worker:${attempt}`,
    machine: 'machine-a', resource: 1, sourceVector: state.fixture.vector });
}

function finish(state: ReturnType<typeof setup>, attempt: string, kind: 'accepted' | 'failed' = 'failed') {
  return state.fixture.api.recordLoopOutcome({ command: `repair8-finish:${attempt}`, fence: state.token,
    episode: reference(state.loop), attempt, kind, failureClass: kind === 'failed' ? 'transport' : '',
    completion: state.fixture.appendOutcome(kind, attempt), jitterPermille: 1000, restoration: [],
    sourceVector: state.fixture.vector });
}

it('SLB-LEGACY-REPLICATION-66 V17 refuses a signed legacy record carrying unwitnessed shared metadata during Part Two replication', () => {
  const fixture = legacyFixture(), token = value(fixture.api.acquire('legacy-lease', '', 500));
  value(fixture.api.schedule('legacy-schedule', token, fixture.run, fixture.policy));
  const wires = fixture.storage.read() as any[], wire = wires.at(-1)!, prefix = wires.slice(0, -1);
  const altered = signEnvelope({ ...wire,
    body: { record: { ...wire.body.record, pressureKey: 'pressure:unwitnessed' } } }, privateKey);
  const store = createFactStore(fixture.ctx, { owner: 'part-ten', read: () => prefix,
    append: (bytes: string, expected: string | null) => fixture.result(() => {
      expect(prefix.at(-1)?.contentHash ?? null).toBe(expected);
      prefix.push(JSON.parse(bytes)); return { kind: 'local-durable' };
    }) });
  expect(verdict(store.append(altered, { peer: fixture.host.machine })).kind).toBe('REFUSE');
});

it('SLB-EXECUTABLE-ADMISSION-67 V14 V18 binds reserve, claim and consume to an admitted shared attempt across ordinary, half-open, cooldown and zero-budget cases', () => {
  {
    const state = setup(); state.fixture.advance(1); value(admit(state, 'ordinary'));
    const reservation = value(state.fixture.api.reserve(state.fixture.input(state.token, { attempt: 'ordinary' })));
    const claim = value(state.fixture.api.claim('ordinary-claim', state.token, reservation.operation));
    expect(value(state.fixture.api.consume(claim, state.token)).state).toBe('consumed');
  }
  {
    const state = setup({ failureThreshold: 1, halfOpenTrials: 1 }); state.fixture.advance(1);
    value(admit(state, 'failure')); value(finish(state, 'failure'));
    refused(state.fixture.api.reserve(state.fixture.input(state.token, { attempt: 'unwitnessed-cooldown' })));
    state.fixture.advance(20); value(admit(state, 'half-open'));
    const reservation = value(state.fixture.api.reserve(state.fixture.input(state.token, { attempt: 'half-open' })));
    const claim = value(state.fixture.api.claim('half-open-claim', state.token, reservation.operation));
    expect(value(state.fixture.api.consume(claim, state.token)).attempt).toBe('half-open');
  }
  {
    const state = setup({ parentAttemptBudget: 0, parentResourceBudget: 0 }); state.fixture.advance(1);
    refused(admit(state, 'zero-budget'));
    refused(state.fixture.api.reserve(state.fixture.input(state.token, { attempt: 'zero-budget' })));
  }
});

it('SLB-LOCALE-ORDER-68 V21 orders non-ASCII attempt identities by canonical bytes', () => {
  const state = setup({ failureThreshold: 1 }); state.fixture.advance(1);
  value(admit(state, 'ä')); value(admit(state, 'z'));
  const completions = { 'ä': state.fixture.appendOutcome('failed', 'ä'), z: state.fixture.appendOutcome('accepted', 'z') };
  let loop = value(state.fixture.api.recordLoopOutcome({ command: 'locale-outcome:ä', fence: state.token,
    episode: reference(state.loop), attempt: 'ä', kind: 'failed', failureClass: 'transport', completion: completions['ä'],
    jitterPermille: 1000, restoration: [], sourceVector: state.fixture.vector }));
  loop = value(state.fixture.api.recordLoopOutcome({ command: 'locale-outcome:z', fence: state.token,
    episode: reference(state.loop), attempt: 'z', kind: 'accepted', failureClass: '', completion: completions.z,
    jitterPermille: 1000, restoration: [], sourceVector: state.fixture.vector }));
  expect(loop.outcomeLog.map(outcome => outcome.attempt)).toEqual(['z', 'ä']);
  expect(loop.failureCount).toBe(1);
  expect(value(canonical(loop.outcomeLog)).hash).toBe(loop.outcomeWindowDigest);
});

it('SLB-MISSED-TERMINAL-69 V16 accepts a causally linked missed-range successor retaining a genuinely completed member Run', () => {
  const state = setup({}, { existingInstants: [120] }), fixture = state.fixture;
  const cursor = value(createBoundedDueScanPort(fixture.host, fixture.spine, fixture.c).page({ scan: 'scan',
    generation: 'g1', orderedKeys: ['job:one'], cursor: null, maxItems: 1, maxDuration: 10 })).cursor;
  const proof = fixture.appendResult();
  const missedInput: any = { parentDuty: fixture.parentDuty, episode: reference(state.loop), scanCursor: cursor,
    jobInstance: 'job:one', packageDigest: `sha256:${'d'.repeat(64)}`, calendarPolicy: 'every-10',
    asOf: fixture.clock(130), currentLateness: value(decodeMeasurement('duration', { type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'duration', instance: 'job:one' }, value: 0, unit: 'ms', at: fixture.clock(130), by: 'probe' }, fixture.host.current().decode)),
    priorExpansionCursor: fixture.clock(100), missedBoundary: fixture.clock(130), catchUpPolicy: 'none',
    dispositions: [110, 120, 130].map(at => at === 120
      ? { scheduledInstant: fixture.clock(at), kind: 'existing-run', run: fixture.admittedRun(at) }
      : { scheduledInstant: fixture.clock(at), kind: 'missed-no-execution', result: proof }), catchUpRun: null };
  const original = value(fixture.api.recordMissedRange(missedInput));
  const runReference = fixture.admittedRun(120);
  const all = () => [...fixture.ctx.facts, ...value(fixture.store.read())];
  const runFact: any = all().find((fact: any) => fact.kind === 'run-opening' && fact.body.run === runReference.id)!;
  const run: any = recordFromWire(runFact.body.record);
  const append = (kind: string, body: any, required: string[] = []) => value(authorAndAppend({ kind, schemaVersion: 1,
    machine: fixture.host.machine, principal: fixture.host.principal as any,
    provenance: fixture.host.principal.provenance as any, at: fixture.host.current().clock as any,
    body, required }, fixture.ctx, fixture.store, privateKey));
  const store = { ...fixture.store, read: () => fixture.result(() => all()),
    readForProjection: () => prepareSnapshot(all(), { ...fixture.ctx, facts: all() }) };
  const deps: any = { ...fixture.deps, context: { ...fixture.deps.context, facts: fixture.ctx }, store,
    generation: () => ({ reference: fixture.host.current().generation, kinds: fixture.ctx.schemas.map(schema => schema.kind),
      lineages: Object.fromEntries([...new Map(all().map(fact => [fact.machine, fact])).values()]
        .map(fact => [fact.machine, { head: { epoch: fact.segment.epoch, position: fact.segment.position }, observedAt: 100, closed: false }])) }),
    writer: { owner: 'part-ten', append: (kind: string, id: string, record: any, required: string[]) =>
      fixture.result(() => append(kind, { run: id, record: recordWire(record) }, required)) },
    admission: { ...fixture.deps.admission, verify: (ref: any) => fixture.result(() => ref) } };
  const graph = value(createRunGraph(deps)), ready = value(graph.read(runReference.id));
  const evidence: any = value(decode('Evidence', fixture.evidenceInput({ id: 'repair8-completion',
    claim: { subject: run.exitTest.subject, predicate: `exit:${run.exitTest.check}:${run.exitTest.version}`,
      value: run.exitTest.acceptance }, freshFor: 1000 }), fixture.ctx.decode));
  const evidenceFact = append('evidence-record', { evidence }).fact;
  const resultFact = append('result-record', { result: value(decode('Result', { type: 'Result', schemaVersion: 1,
    kind: 'Success', value: 'completed job', capacity: { kind: 'none' } }, fixture.ctx.decode)) }).fact;
  const factReference = (fact: any) => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
  const exit: any = { type: 'RunExit', schemaVersion: 1, id: 'repair8-exit', run: runReference.id, expected: ready.head,
    proposer: run.owner, standing: run.opening, frontier: ready.source.foldedThrough, at: fixture.host.current().clock,
    kind: 'completed', exitTest: run.exitTest, check: factReference(evidenceFact),
    evidence: [{ type: 'Evidence', id: evidence.id, fact: factReference(evidenceFact), field: 'evidence' }],
    result: { type: 'Result', id: 'repair8-result', fact: factReference(resultFact), field: 'result' }, settledOperations: [] };
  const proposal: any = { type: 'RunTransition', schemaVersion: 1, id: 'repair8-propose', run: runReference.id,
    expected: ready.head, trigger: factReference(evidenceFact), kind: 'propose-exit', from: 'ready', to: 'closing',
    responsible: run.owner, standing: run.opening, ownership: fixture.lease, generation: run.generation,
    at: fixture.host.current().clock, blockedOn: { kind: 'nothing' }, nextWake: run.nextWake, exit };
  const closing = value(graph.transition(proposal));
  expect(verdict(graph.transition({ ...proposal, id: 'repair8-close', expected: closing.head, kind: 'close',
    from: 'closing', to: 'completed', exit: { ...exit, id: 'repair8-exit-terminal', expected: closing.head } }))).toMatchObject({
      kind: 'ACCEPT', value: { state: 'completed' },
    });
  expect(verdict(fixture.api.recordMissedRange(missedInput)).kind).toBe('ACCEPT');
  const nextRun = fixture.admitScheduledRun(110);
  const successor = verdict(fixture.api.recordMissedRange({ ...missedInput, asOf: fixture.clock(131),
    currentLateness: value(decodeMeasurement('duration', { ...missedInput.currentLateness, value: 1,
      at: fixture.clock(131) }, fixture.host.current().decode)), dispositions: missedInput.dispositions.map((entry: any, index: number) =>
      index === 0 ? { scheduledInstant: entry.scheduledInstant, kind: 'existing-run', run: nextRun } : entry) }));
  expect(successor.kind).toBe('ACCEPT');
  expect(value(fixture.api.readMissedRange(original)).record.dispositions[1]).toMatchObject({ run: runReference });
});
