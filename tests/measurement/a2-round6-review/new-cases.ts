import {
  facts, got, measurementA2Fixture as F, m, ok, one, open as opened, privateKey,
  request,
} from '../a2-round4-review/common.js';

export type Round6Case = Readonly<{
  name: string;
  pass: boolean;
  actual?: unknown;
  exception?: string;
}>;

export const round6HeldPeerCases = [
  'mixed:true:peer-resolved-state',
  'mixed:false:peer-resolved-state',
  'peer-correction:later-replica-control',
  'peer-correction:union-drops-superseded-prefix',
].map(name => ({
  name,
  disposition: 'NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge' as const,
}));

const cases: Round6Case[] = [];
function test(name: string, run: () => unknown, accept: (result: any) => boolean): void {
  try {
    const actual = run();
    cases.push({ name, pass: accept(actual), actual });
  } catch (error) {
    cases.push({ name, pass: false, exception: String(error) });
  }
}

function event(f: ReturnType<typeof F>, id: string, amount: number, at: number) {
  return f.planObservation({ subject: id, sourceEvent: `${id}:e`, amount, at,
    contract: f.eventProducer });
}

// A resolved amount and its reported state/evidence are selected as one verdict.
for (const missingFirst of [true, false]) {
  const f = F();
  const missing = f.planObservation({ subject: 'mixed',
    sourceEvent: missingFirst ? 'a-missing' : 'z-missing', amount: 0, at: 100,
    contract: f.eventProducer, state: 'missing' });
  const reported = f.planObservation({ subject: 'mixed',
    sourceEvent: missingFirst ? 'z-reported' : 'a-reported', amount: 73, at: 100,
    contract: f.eventProducer });
  [missing, reported].forEach(f.persistObservation);
  const history = f.snapshot();
  test(`mixed:${missingFirst}:quantity-control`, () => m.resolveCurrentQuantity({
    witnesses: [f.witness(missing, history), f.witness(reported, history)],
    sourceHistory: history, evaluationClock: f.clock(200),
  }, f.c), result => ok(result) && got(result).state === 'resolved'
    && got(result).amount === 73);
  test(`mixed:${missingFirst}:read-resolved-state`,
    () => m.renderCurrentMeasurementRead(request(f, history, [f.eventProducer]), f.c),
    result => ok(result) && got(result).rows.length === 1
      && got(result).rows[0].state === 'reported'
      && got(result).rows[0].amount === 73
      && got(result).rows[0].evidence.id === reported.evidence.id);
}

// A concurrent witness outside an older resolution is uncertainty, not malformed history.
{
  const f = F();
  const rows = [81, 85].map((amount, index) => f.planObservation({
    subject: 'concurrent-resolution', sourceEvent: `w:${index}`, amount, at: 100,
    contract: f.eventProducer,
  }));
  rows.forEach(f.persistObservation);
  const evidence = f.admitEvidence(f.evidenceInput({ id: 'resolve:old',
    observedAt: f.clock(120), freshFor: 1_000_000,
    claim: { subject: rows[0]!.identity, predicate: 'quantity-resolved',
      value: { amount: 83, witnesses: rows.map(row => row.sourceEvent) } } }));
  f.append('measurement-evidence', { evidence }, f.clock(120));
  const before = f.snapshot();
  test('resolution:pre-concurrent-positive',
    () => m.renderCurrentMeasurementRead(request(f, before, [f.eventProducer]), f.c),
    result => ok(result) && got(result).rows[0].amount === 83);

  const concurrent = f.planObservation({ subject: rows[0]!.subject,
    sourceEvent: 'w:concurrent', amount: 89, at: 100, contract: f.eventProducer });
  const wire = f.facts.wire({ kind: 'measurement-observation', schemaVersion: 1,
    machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 },
    at: f.clock(130), predecessors: { inSegment: null,
      frontier: { 'machine-a': { epoch: 0, position: 1 } }, required: ['machine-a:0:1'] },
    body: { identity: concurrent.identity, measurement: concurrent.measurement,
      evidence: concurrent.evidence,
      producerContract: got(one.canonical(f.eventProducer)).bytes } }, f.factContext);
  got(f.store.append(wire, { peer: 'machine-b' }));
  const history = f.snapshot();
  test('resolution:concurrent-witness-retains-uncertainty',
    () => m.resolveCurrentQuantity({ witnesses: [f.witness(concurrent, history)],
      sourceHistory: history, evaluationClock: f.clock(200) }, f.c),
    result => ok(result) && got(result).state === 'unresolved'
      && got(result).witnesses.length === 3);
  test('read:concurrent-witness-retains-history',
    () => m.renderCurrentMeasurementRead(request(f, history, [f.eventProducer]), f.c),
    result => ok(result) && got(result).partial && got(result).rows[0].amount === null);
}

// Deterministic property sweep: every composition of current witnesses, lawful correction,
// concurrent owner verdicts, and per-witness freshness returns an honest quantity/read state.
// Thirteen arrival/id schedules across the sixteen semantic combinations give 208 cases.
test('resolution:property:any-current-witness-set-with-later-resolution-never-refuses', () => {
  const outcomes: string[] = [];
  for (const corrected of [false, true]) {
    for (const competingResolution of [false, true]) {
      for (const staleWitness of [false, true]) {
        for (const agreeingCurrentWitnesses of [false, true]) {
          for (let schedule = 0; schedule < 13; schedule++) {
        const f = F();
        let first = f.planObservation({ subject: `property:${schedule}`,
          sourceEvent: schedule % 2 === 0 ? 'z:first' : 'a:first', amount: 81, at: 100,
          contract: f.eventProducer });
        const second = f.planObservation({ subject: first.subject,
          sourceEvent: schedule % 2 === 0 ? 'a:second' : 'z:second',
          amount: agreeingCurrentWitnesses ? 81 : 85, at: 100,
          contract: f.eventProducer });
        if (staleWitness) {
          f.evidence.splice(f.evidence.findIndex((evidence: any) =>
            evidence.id === first.evidence.id), 1);
          const evidence = f.admitEvidence(f.evidenceInput({ id: first.sourceEvent,
            observedAt: f.clock(100), freshFor: 50, claim: first.evidence.claim }));
          first = { ...first, evidence, input: { ...first.input, evidence } };
        }
        const arrival = schedule % 2 === 0 ? [first, second] : [second, first];
        let original = '';
        for (const observation of arrival) {
          const fact = f.persistObservation(observation);
          if (observation.sourceEvent === first.sourceEvent) original = fact;
        }
        const resolution = f.admitEvidence(f.evidenceInput({ id: 'property:resolution',
          observedAt: f.clock(120), freshFor: 1_000_000,
          claim: { subject: first.identity, predicate: 'quantity-resolved',
            value: { amount: 83, witnesses: [first.sourceEvent, second.sourceEvent] } } }));
        f.append('measurement-evidence', { evidence: resolution }, f.clock(120));

        let competingWire: ReturnType<typeof f.facts.wire> | null = null;
        if (competingResolution) {
          const evidence = f.admitEvidence(f.evidenceInput({ id: 'property:resolution:other',
            observedAt: f.clock(120), freshFor: 1_000_000,
            claim: { subject: first.identity, predicate: 'quantity-resolved',
              value: { amount: 87, witnesses: [first.sourceEvent, second.sourceEvent] } } }));
          competingWire = f.facts.wire({ kind: 'measurement-evidence', schemaVersion: 1,
            machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 },
            at: f.clock(120), predecessors: { inSegment: null,
              frontier: { 'machine-a': { epoch: 0, position: 1 } },
              required: ['machine-a:0:1'] }, body: { evidence } }, f.factContext);
          if (schedule % 3 !== 0) got(f.store.append(competingWire, { peer: 'machine-b' }));
        }

        let current = [first, second];
        let sourceHistory;
        if (corrected) {
          const factContext = { ...f.factContext,
            schemas: f.factContext.schemas.map((schema: any) =>
              schema.kind === 'measurement-observation'
              ? { ...schema,
                fields: { ...schema.fields, corrects: { kind: 'reference' as const } },
                optional: [...(schema.optional ?? []), 'corrects'] }
              : schema) };
          const store = facts.createFactStore(factContext, f.storage);
          const replacement = f.planObservation({ subject: first.subject,
            sourceEvent: `property:replacement:${schedule}`,
            amount: agreeingCurrentWitnesses ? second.measurement.value : 89,
            at: 100, contract: f.eventProducer });
          got(facts.authorAndAppend({ kind: 'measurement-observation', schemaVersion: 1,
            machine: 'machine-a', principal: f.facts.alice,
            provenance: f.facts.alice.provenance, at: f.clock(140),
            body: { identity: replacement.identity, measurement: replacement.measurement,
              evidence: replacement.evidence,
              producerContract: got(one.canonical(f.eventProducer)).bytes,
              corrects: original }, required: [original] }, factContext, store, privateKey));
          if (competingWire && schedule % 3 === 0)
            got(store.append(competingWire, { peer: 'machine-b' }));
          sourceHistory = got(store.readForProjection());
          current = [replacement, second];
        } else {
          if (competingWire && schedule % 3 === 0)
            got(f.store.append(competingWire, { peer: 'machine-b' }));
          sourceHistory = f.snapshot();
        }
        const quantity = m.resolveCurrentQuantity({ witnesses: current.map(observation =>
          f.witness(observation, sourceHistory)), sourceHistory,
        evaluationClock: f.clock(200) }, f.c);
        if (!ok(quantity)) return { valid: false, refused: quantity, outcomes };
        const read = m.renderCurrentMeasurementRead(
          request(f, sourceHistory, [f.eventProducer]), f.c);
        if (!ok(read)) return { valid: false, refused: read, outcomes };
        const row = got(read).rows[0];
        outcomes.push(`${got(quantity).state}:${row?.state ?? 'unavailable'}`);
          }
        }
      }
    }
  }
  return { valid: outcomes.length === 208
    && outcomes.every(state => ['resolved:reported', 'unresolved:conflicted',
      'unavailable:unavailable'].includes(state)), outcomes };
}, result => result.valid === true);

// Baseline failures retain the full failed condition and raw population evidence.
for (const complete of [true, false]) {
  const f = F();
  function plan(id: string, start: number, amount: number, censusComplete: boolean) {
    const target = event(f, `${id}:a`, amount, start + 50);
    const comparison = event(f, `${id}:b`, 100, start + 50);
    [target, comparison].forEach(f.persistObservation);
    return f.persistBurnWindow({ id, start, end: start + 200, censusComplete,
      samples: [
        { identity: target.subject, feature: 'feature-a', source: 'programmatic-event',
          observations: [target] },
        { identity: comparison.subject, feature: 'comparison', source: 'programmatic-event',
          observations: [comparison] },
      ], comparisonScopeAmount: amount + 100 });
  }
  const baseline = plan('baseline', 0, 10, complete);
  const current = plan('current', 200, 150, true);
  const history = f.snapshot();
  const window = (planned: ReturnType<typeof f.persistBurnWindow>) => got(
    m.createCurrentBurnWindow({ window: planned.build(history), sourceHistory: history }, f.c));
  test(`burn:baseline-${complete}-evidence-disclosed`,
    () => m.evaluateCurrentBurn(f.burnPolicy(), opened, window(current), [window(baseline)], f.c),
    result => ok(result) && (complete ? got(result).confidence === 'adequate'
      : got(result).confidence === 'insufficient-evidence'
        && got(result).coverageDebt.some((entry: string) => entry.includes('baseline:baseline')
          && entry.includes('failed=census-incomplete')
          && entry.includes('censusComplete=false')
          && entry.includes('observedExchanges=0')
          && entry.includes('programmaticEvents=2'))));
}

export const round6NewCases = cases;
