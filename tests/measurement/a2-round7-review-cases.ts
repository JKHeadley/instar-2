import {
  facts, got, measurementA2Fixture as F, m, no, ok, one, privateKey, request,
} from './a2-round4-review/common.js';

export type Round7Case = Readonly<{
  name: string;
  pass: boolean;
  actual?: unknown;
  exception?: string;
}>;

const cases: Round7Case[] = [];

function test(name: string, run: () => unknown, expected: (result: any) => boolean): void {
  try {
    const actual = run();
    cases.push({ name, pass: expected(actual), actual });
  } catch (error) {
    cases.push({ name, pass: false, exception: String(error) });
  }
}

function event(f: ReturnType<typeof F>, id: string, amount: number, at = 100) {
  return f.planObservation({ subject: 'subject:round7', sourceEvent: id, amount, at,
    contract: f.eventProducer });
}

function resolve(f: ReturnType<typeof F>, observations: readonly ReturnType<typeof event>[],
  sourceHistory: ReturnType<ReturnType<typeof F>['snapshot']>, at = 200) {
  return m.resolveCurrentQuantity({ witnesses: observations.map(observation =>
    f.witness(observation, sourceHistory)), sourceHistory, evaluationClock: f.clock(at) }, f.c);
}

function resolution(f: ReturnType<typeof F>, key: string, witnesses: readonly string[],
  id = 'round7:resolution', amount = 105, at = 120) {
  const evidence = f.admitEvidence(f.evidenceInput({ id, observedAt: f.clock(at),
    freshFor: 1_000_000,
    claim: { subject: key, predicate: 'quantity-resolved', value: { amount, witnesses } } }));
  f.append('measurement-evidence', { evidence }, f.clock(at));
  return evidence;
}

// Reviewer F1: the resolution was valid at its causal frontier. A later Part Two
// correction replaces one named witness, so that former verdict becomes history and
// the corrected current witnesses resolve on their own.
{
  const f = F();
  const first = event(f, 'correction:a', 101);
  const second = event(f, 'correction:b', 109);
  const original = f.persistObservation(first);
  f.persistObservation(second);
  resolution(f, first.identity, [first.sourceEvent, second.sourceEvent]);
  test('correction:resolved-before-control',
    () => m.renderCurrentMeasurementRead(request(f, f.snapshot(), [f.eventProducer]), f.c),
    result => ok(result) && got(result).rows[0]?.amount === 105);

  const factContext = { ...f.factContext,
    schemas: f.factContext.schemas.map((schema: any) =>
      schema.kind === 'measurement-observation'
      ? { ...schema, fields: { ...schema.fields, corrects: { kind: 'reference' as const } },
        optional: [...(schema.optional ?? []), 'corrects'] }
      : schema) };
  const store = facts.createFactStore(factContext, f.storage);
  const corrected = event(f, 'correction:a:new', 109);
  got(facts.authorAndAppend({ kind: 'measurement-observation', schemaVersion: 1,
    machine: 'machine-a', principal: f.facts.alice,
    provenance: f.facts.alice.provenance, at: f.clock(140),
    body: { identity: corrected.identity, measurement: corrected.measurement,
      evidence: corrected.evidence,
      producerContract: got(one.canonical(f.eventProducer)).bytes, corrects: original },
    required: [original] }, factContext, store, privateKey));
  const sourceHistory = got(store.readForProjection());
  test('correction:current-agreement-remains-readable',
    () => m.renderCurrentMeasurementRead(request(f, sourceHistory, [f.eventProducer]), f.c),
    result => ok(result) && got(result).rows[0]?.amount === 109);
  test('correction:quantity-ignores-former-resolution',
    () => resolve(f, [corrected, second], sourceHistory),
    result => ok(result) && got(result).state === 'resolved' && got(result).amount === 109);
}

// Reviewer F2: concurrent, causally valid owner verdicts remain inspectable as
// uncertainty. Both verdicts and both witnesses stay in the read evidence manifest.
{
  const f = F();
  const first = event(f, 'competing:a', 101);
  const second = event(f, 'competing:b', 109);
  [first, second].forEach(f.persistObservation);
  resolution(f, first.identity, [first.sourceEvent, second.sourceEvent],
    'competing:left', 105);
  const competing = f.admitEvidence(f.evidenceInput({ id: 'competing:right',
    observedAt: f.clock(120), freshFor: 1_000_000,
    claim: { subject: first.identity, predicate: 'quantity-resolved',
      value: { amount: 107, witnesses: [first.sourceEvent, second.sourceEvent] } } }));
  const wire = f.facts.wire({ kind: 'measurement-evidence', schemaVersion: 1,
    machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 },
    at: f.clock(120), predecessors: { inSegment: null,
      frontier: { 'machine-a': { epoch: 0, position: 1 } }, required: ['machine-a:0:1'] },
    body: { evidence: competing } }, f.factContext);
  got(f.store.append(wire, { peer: 'machine-b' }));
  const sourceHistory = f.snapshot();
  test('resolution:concurrent-owner-verdicts-retain-uncertainty',
    () => resolve(f, [first, second], sourceHistory),
    result => ok(result) && got(result).state === 'unresolved'
      && got(result).amount === null && got(result).witnesses.length === 2);
  test('read:concurrent-owner-verdicts-retain-history',
    () => m.renderCurrentMeasurementRead(request(f, sourceHistory, [f.eventProducer]), f.c),
    result => ok(result) && got(result).partial && got(result).rows[0]?.amount === null
      && got(result).rows[0]?.state === 'conflicted'
      && got(result).rows[0]?.evidenceManifest.map((evidence: any) => evidence.id).sort()
        .join(',') === 'competing:a,competing:b,competing:left,competing:right');
}

// Reviewer F3: expiry quarantines one witness's vote, not the entire quantity.
for (const stale of [false, true]) {
  const f = F();
  let first = event(f, 'freshness:a', 101);
  const second = event(f, 'freshness:b', 101);
  if (stale) {
    f.evidence.splice(f.evidence.findIndex((evidence: any) =>
      evidence.id === first.evidence.id), 1);
    const evidence = f.admitEvidence(f.evidenceInput({ id: first.sourceEvent,
      observedAt: f.clock(100), freshFor: 50, claim: first.evidence.claim }));
    first = { ...first, evidence, input: { ...first.input, evidence } };
  }
  [first, second].forEach(f.persistObservation);
  const sourceHistory = f.snapshot();
  test(`freshness:${stale}:read-one-acceptable-witness`,
    () => m.renderCurrentMeasurementRead(request(f, sourceHistory, [f.eventProducer], {
      end: f.clock(200), evaluationClock: f.clock(200),
    }), f.c),
    result => ok(result) && got(result).rows.length === 1
      && got(result).rows[0]?.amount === 101
      && got(result).rows[0]?.evidenceManifest.map((evidence: any) => evidence.id).sort()
        .join(',') === 'freshness:a,freshness:b');
  if (stale) test('freshness:true:quantity-one-acceptable-witness',
    () => resolve(f, [first, second], sourceHistory),
    result => ok(result) && got(result).state === 'resolved'
      && got(result).amount === 101 && got(result).witnesses.length === 2);
}

test('malformed:unpersisted-witness-still-refuses', () => {
  const f = F();
  const observation = event(f, 'malformed:unpersisted', 101);
  return m.createCurrentQuantityWitness({ input: observation.input,
    sourceHistory: f.snapshot() }, f.c);
}, no);

export const round7Cases = cases;
