import {
  facts, got, measurementA2Fixture, m, no, ok, one, open as opened, peer, pp, privateKey,
  proj, request, root,
} from './a2-round4-review/common.js';

export type Round5Case = Readonly<{
  name: string;
  pass: boolean;
  actual?: unknown;
  exception?: string;
}>;

const cases: Round5Case[] = [];
function test(name: string, run: () => unknown, accept: (result: any) => boolean): void {
  try {
    const actual = run();
    cases.push({ name, pass: accept(actual), actual });
  } catch (error) {
    cases.push({ name, pass: false, exception: String(error) });
  }
}
function event(f: ReturnType<typeof measurementA2Fixture>, id: string, amount: number, at: number) {
  return f.planObservation({ subject: id, sourceEvent: `${id}:e`, amount, at,
    contract: f.eventProducer });
}

// F1: the current owner fold's conflict and taint survive read, peer, and burn consumers.
{
  const f = measurementA2Fixture();
  const originalObservation = event(f, 'contested', 59, 100);
  const original = f.persistObservation(originalObservation);
  const factContext = { ...f.factContext,
    schemas: f.factContext.schemas.map((schema: any) => schema.kind === 'measurement-observation'
      ? { ...schema, fields: { ...schema.fields, corrects: { kind: 'reference' as const } },
        optional: [...(schema.optional ?? []), 'corrects'] }
      : schema) };
  const store = facts.createFactStore(factContext, f.storage);
  const left = f.planObservation({ subject: originalObservation.subject,
    sourceEvent: 'contested:left', amount: 61, at: 100, contract: f.eventProducer });
  const right = f.planObservation({ subject: originalObservation.subject,
    sourceEvent: 'contested:right', amount: 67, at: 100, contract: f.eventProducer });
  const body = (observation: typeof left) => ({ identity: observation.identity,
    measurement: observation.measurement, evidence: observation.evidence,
    producerContract: got(one.canonical(f.eventProducer)).bytes, corrects: original });
  got(facts.authorAndAppend({ kind: 'measurement-observation', schemaVersion: 1,
    machine: 'machine-a', principal: f.facts.alice, provenance: f.facts.alice.provenance,
    at: f.clock(110), body: body(left), required: [original] }, factContext, store, privateKey));
  const remote = f.facts.wire({ kind: 'measurement-observation', schemaVersion: 1,
    machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 },
    at: f.clock(110), predecessors: { inSegment: null,
      frontier: { 'machine-a': { epoch: 0, position: 0 } }, required: [original] },
    body: body(right) }, factContext);
  got(store.append(remote, { peer: 'machine-b' }));
  const history = got(store.readForProjection());
  const read = request(f, history, [f.eventProducer]);
  test('read:concurrent-corrections-retain-conflict',
    () => m.renderCurrentMeasurementRead(read, f.c),
    result => ok(result) && got(result).partial
      && got(result).reason === 'source history contains conflict or taint');
  test('peer:concurrent-corrections-retain-conflict',
    () => m.mergeCurrentPeerMeasurements([peer(f, history)], pp(f), f.c),
    result => ok(result) && got(result).state === 'partial');

  const population = { start: f.clock(0), end: f.clock(200), evidenceHorizon: f.clock(200),
    censusComplete: true, collectorsComplete: true, attemptIdentities: [],
    observedExchangeIdentities: [], usageSupportedExchangeIdentities: [],
    provenNoExchangeIdentities: [], dispatchUncertainIdentities: [],
    conflictedAttemptIdentities: [], programmaticEventIdentities: [], samples: [],
    comparisonScopeAmount: 0 };
  const evidence = f.admitEvidence(f.evidenceInput({ id: 'population:contested-empty',
    observedAt: f.clock(200), freshFor: 1_000_000,
    claim: { subject: 'contested-empty', predicate: 'burn-window-population', value: population } }));
  got(facts.authorAndAppend({ kind: 'measurement-evidence', schemaVersion: 1,
    machine: 'machine-a', principal: f.facts.alice, provenance: f.facts.alice.provenance,
    at: f.clock(200), body: { evidence }, required: [] }, factContext, store, privateKey));
  const current = got(store.readForProjection());
  const window = got(m.createCurrentBurnWindow({ sourceHistory: current,
    window: { id: 'contested-empty', start: population.start, end: population.end,
      evidenceHorizon: population.evidenceHorizon, populationEvidence: evidence,
      censusComplete: true, collectorsComplete: true, observedExchanges: 0,
      usageSupportedExchanges: 0, attemptedDispatches: 0, provenNoExchange: 0,
      dispatchUncertain: 0, conflictedAttempts: 0, programmaticEvents: 0,
      samples: [], comparisonScopeAmount: 0 } }, f.c));
  test('burn:concurrent-corrections-cannot-prove-inactivity',
    () => m.evaluateCurrentBurn(f.burnPolicy(), opened, window, [], f.c),
    result => ok(result) && got(result).episode.state === 'open'
      && got(result).classification === 'incomplete');
}

// F2: a model observation without a Seven dispatch cannot establish complete membership.
{
  const f = measurementA2Fixture();
  f.persistObservation(f.planObservation({ subject: 'no-owner-attempt',
    sourceEvent: 'orphan-model:e', amount: 23, at: 100 }));
  const history = f.snapshot();
  test('read:unwitnessed-model-membership-is-not-complete',
    () => m.renderCurrentMeasurementRead(request(f, history, [f.producer]), f.c),
    result => no(result) || (ok(result) && got(result).partial));
}

// F3: a later disagreeing witness invalidates the old resolution without invalidating history.
{
  const f = measurementA2Fixture();
  const observations = [41, 45].map((amount, index) => f.planObservation({
    subject: 'resolved-event', sourceEvent: `resolution:w${index}`, amount, at: 100,
    contract: f.eventProducer }));
  observations.forEach(f.persistObservation);
  const evidence = f.admitEvidence(f.evidenceInput({ id: 'resolution:owner',
    observedAt: f.clock(110), freshFor: 1_000_000,
    claim: { subject: observations[0]!.identity, predicate: 'quantity-resolved',
      value: { amount: 43, witnesses: observations.map(row => row.sourceEvent) } } }));
  f.append('measurement-evidence', { evidence }, f.clock(110));
  const later = f.planObservation({ subject: 'resolved-event', sourceEvent: 'resolution:w2',
    amount: 49, at: 100, contract: f.eventProducer });
  f.persistObservation(later);
  const history = f.snapshot();
  test('resolution:later-disagreement-retains-uncertainty',
    () => m.resolveCurrentQuantity({ witnesses: [f.witness(later, history)],
      sourceHistory: history, evaluationClock: f.clock(200) }, f.c),
    result => ok(result) && got(result).state === 'unresolved' && got(result).amount === null);
  test('read:later-disagreement-retains-other-readable-history',
    () => m.renderCurrentMeasurementRead(request(f, history, [f.eventProducer]), f.c),
    result => ok(result) && got(result).partial && got(result).rows[0]?.amount === null);
}

// F4: derive model attribution from current signed Seven history, never an optional hint.
{
  const { judgmentFixture } = await import(`${root}/tests/judgment/fixture.ts`);
  const judgment = judgmentFixture();
  got(await judgment.door.judge(judgment.input, judgment.start()));
  const f = measurementA2Fixture();
  const register = { ...judgment.ctx.decode.register,
    entries: [...new Set([...judgment.ctx.decode.register.entries, ...f.types.register.entries])],
    subjects: { ...judgment.ctx.decode.register.subjects, ...f.types.register.subjects } };
  const observation = f.planObservation({ subject: `attempt:${judgment.input.id}:1`,
    sourceEvent: 'real-owner:model', amount: 53, at: 300 });
  const types = { ...judgment.ctx.decode, register,
    evidence: [...judgment.evidence, ...f.evidence],
    captures: { ...judgment.ctx.decode.captures, ...f.types.captures } };
  const factContext = { ...judgment.ctx, decode: types,
    schemas: [...judgment.ctx.schemas, ...f.factContext.schemas],
    captures: { ...judgment.ctx.captures, ...f.factContext.captures } };
  const store = facts.createFactStore(factContext, judgment.storage);
  got(facts.authorAndAppend({ kind: 'measurement-observation', schemaVersion: 1,
    machine: 'machine-a', principal: judgment.alice, provenance: judgment.alice.provenance,
    at: f.clock(300), body: { identity: observation.identity,
      measurement: observation.measurement, evidence: observation.evidence,
      producerContract: got(one.canonical(f.producer)).bytes }, required: [] },
  factContext, store, privateKey));
  const history = got(store.readForProjection());
  const context = { ...f.c, register, types };
  const joined = { ...f, c: context,
    readQuery: (input: any) => got(m.decodeMeasurementReadQuery({ ...f.readQuery(input),
      registerGeneration: register.generation.id }, context)) };
  const read = request(joined, history, [f.producer], { start: f.clock(0),
    end: f.clock(200), evaluationClock: f.clock(400) });
  test('read:owner-attribution-without-hint',
    () => m.renderCurrentMeasurementRead(read, context),
    result => ok(result) && got(result).rows[0]?.feature === 'judgment'
      && got(result).rows[0]?.model === 'model');
}

// F5: a sample using an incomparable clock is quarantined beside readable local data.
{
  const f = measurementA2Fixture();
  f.persistObservation(event(f, 'local-clock', 31, 100));
  const clock = got(one.decodeMeasurement('clock', { ...f.clock(110),
    subject: { ...f.clock(110).subject, instance: 'hardware:other' } }, f.types));
  const measurement = got(one.decodeMeasurement('programmatic-count', {
    type: 'Measurement', schemaVersion: 1,
    subject: { kind: 'programmatic-count', instance: 'foreign-clock' }, value: 37,
    unit: 'tokens', at: clock, by: 'probe' }, f.types));
  const evidence = f.admitEvidence(f.evidenceInput({ id: 'foreign-clock:e', observedAt: clock,
    freshFor: 1_000_000, claim: { subject: 'foreign-clock', predicate: 'event-observed',
      value: { amount: 37, category: 'input', sourceSample: 'foreign-clock', producer: 'probe',
        state: 'reported', occurrenceAt: clock, hardwareProfile: null } } }));
  const identity = got(one.canonical({ family: 'programmatic-event', subject: 'foreign-clock',
    sourceSample: 'foreign-clock', category: 'input', unit: 'tokens', relation: 'standalone',
    hardwareProfile: null })).hash;
  f.append('measurement-observation', { identity, measurement, evidence,
    producerContract: got(one.canonical(f.eventProducer)).bytes }, f.clock(110));
  test('read:incomparable-sample-is-partial',
    () => m.renderCurrentMeasurementRead(request(f, f.snapshot(), [f.eventProducer]), f.c),
    result => ok(result) && got(result).partial
      && got(result).rows.some((row: { amount: number | null }) => row.amount === 31));
}

// F6: stale evidence outside the interval is not an input to the bounded presentation.
{
  const f = measurementA2Fixture();
  let old = event(f, 'old', 17, 100);
  f.evidence.splice(f.evidence.findIndex((candidate: any) => candidate.id === old.evidence.id), 1);
  const evidence = f.admitEvidence(f.evidenceInput({ id: old.sourceEvent, observedAt: f.clock(100),
    freshFor: 50, claim: old.evidence.claim }));
  old = { ...old, evidence, input: { ...old.input, evidence } };
  f.persistObservation(old);
  f.persistObservation(event(f, 'in-window', 29, 300));
  const history = f.snapshot();
  test('read:out-of-window-expired',
    () => m.renderCurrentMeasurementRead(request(f, history, [f.eventProducer], {
      start: f.clock(200), end: f.clock(400), evaluationClock: f.clock(400) }), f.c),
    result => ok(result) && got(result).rows.length === 1 && got(result).rows[0]?.amount === 29);
}

// F7: peers contribute signed current heads before a covering owner resolution is selected.
for (const resolved of [false, true]) {
  const local = measurementA2Fixture();
  const first = event(local, 'shared-quantity', 83, 100);
  local.persistObservation(first);
  const localHistory = local.snapshot();
  const remote = measurementA2Fixture(local.rows);
  const second = remote.planObservation({ subject: first.subject,
    sourceEvent: 'peer-b:independent', amount: 89, at: 100, contract: remote.eventProducer });
  const wire = remote.facts.wire({ kind: 'measurement-observation', schemaVersion: 1,
    machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 },
    at: remote.clock(110), predecessors: { inSegment: null,
      frontier: { 'machine-a': { epoch: 0, position: 0 } }, required: ['machine-a:0:0'] },
    body: { identity: second.identity, measurement: second.measurement, evidence: second.evidence,
      producerContract: got(one.canonical(remote.eventProducer)).bytes } }, remote.factContext);
  got(remote.store.append(wire, { peer: 'machine-b' }));
  if (resolved) {
    const resolution = remote.admitEvidence(remote.evidenceInput({ id: 'peer:resolution',
      observedAt: remote.clock(120), freshFor: 1_000_000,
      claim: { subject: first.identity, predicate: 'quantity-resolved',
        value: { amount: 86, witnesses: [first.sourceEvent, second.sourceEvent] } } }));
    got(facts.authorAndAppend({ kind: 'measurement-evidence', schemaVersion: 1,
      machine: 'machine-a', principal: remote.facts.alice,
      provenance: remote.facts.alice.provenance, at: remote.clock(120),
      body: { evidence: resolution }, required: ['machine-a:0:0', 'machine-b:0:0'] },
    remote.factContext, remote.store, privateKey));
  }
  const remoteHistory = remote.snapshot();
  test(`peer-union:${resolved ? 'resolved' : 'disagreeing'}:current-prefix-and-later-history`,
    () => m.mergeCurrentPeerMeasurements([peer(local, localHistory),
      peer(remote, remoteHistory, 'machine-b')], pp(remote, ['machine-a', 'machine-b']), remote.c),
    result => ok(result) && got(result).state === (resolved ? 'complete' : 'partial')
      && (resolved ? got(result).members.join(',') === 'peer-b:independent,shared-quantity:e'
        : got(result).unresolved.length === 2));
}

export const round5Cases = cases;
