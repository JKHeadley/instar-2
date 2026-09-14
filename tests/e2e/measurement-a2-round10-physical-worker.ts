import { existsSync, readFileSync } from 'node:fs';
import { createFactStore, authorAndAppend } from '../../src/facts/index.js';
import { canonical } from '../../src/index.js';
import * as measurementOperations from '../../src/measurement/index.js';
import { measurementA2Fixture } from '../measurement/a2-fixture.js';
import { value, privateKey } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { event, plan, request, open } from '../measurement/a2-round10-review/helpers.js';

const m: any = measurementOperations;
const F: any = measurementA2Fixture;
const got: any = value;

const [scenario, directory, mode] = process.argv.slice(2) as [
  'recovery-fresh' | 'recovery-expired' | 'clock-same' | 'clock-different',
  string,
  'write' | 'read',
];
const raw = existsSync(`${directory}/facts.json`)
  ? JSON.parse(readFileSync(`${directory}/facts.json`, 'utf8')) : [];
const f = F(raw);
const physical = transportFixture(directory);
const store = createFactStore(f.factContext, physical.storage);
const append = (kind: string, body: any, at: number) => got(authorAndAppend({
  kind, schemaVersion: 1, machine: 'machine-a', principal: f.facts.alice,
  provenance: f.facts.alice.provenance, at: f.clock(at), body, required: [],
} as never, f.factContext, store, privateKey));
const persist = (observation: any) => append('measurement-observation', {
  identity: observation.identity, measurement: observation.measurement,
  evidence: observation.evidence,
  producerContract: got(canonical(f.eventProducer)).bytes,
}, observation.at.value);
const expiry = scenario.includes('expired');

if (mode === 'write') {
  if (scenario.startsWith('recovery')) {
    for (let index = 0; index < 4; index++) {
      const observations = [
        event(f, `disk:${index}:t`, `disk:${index}:t`, index === 0 ? 10 : 0,
          index * 200 + 50, index === 1 && expiry ? 400 : 10_000),
        event(f, `disk:${index}:o`, `disk:${index}:o`, index === 0 ? 90 : 20,
          index * 200 + 50),
      ];
      observations.forEach(persist);
      const planned = plan(f, `disk:${index}`, index * 200, observations,
        ['feature-a', 'comparison'], index === 0 ? 100 : 20);
      append('measurement-evidence', { evidence: planned.evidence }, index * 200 + 200);
    }
  } else {
    persist(event(f, 'disk:clock:a', 'disk:clock:event', 7, 100));
    persist(event(f, 'disk:clock:b', 'disk:clock:event', 7,
      scenario.includes('different') ? 300 : 100));
  }
}

const history = got(store.readForProjection());
let result: any;
if (scenario.startsWith('recovery')) {
  const rawPolicy = { ...f.burnPolicyInput, id: 'burn:physical-three', recoveryWindows: 3 };
  const context = f.withRegistered(rawPolicy, f.c);
  f.c = context;
  const port = m.createMeasurementLedgerA2(context);
  const policy = got(m.decodeBurnPolicy(rawPolicy, context));
  function window(index: number) {
    const evidence = f.evidence.find((candidate: any) => candidate.id === `population:disk:${index}`);
    const claim = evidence.claim.value;
    const samples = claim.samples.map((sample: any) => ({ ...sample,
      quantities: sample.quantityKeys.map((key: string) => {
        const body: any = history.entries.find((status: any) =>
          status.fact.kind === 'measurement-observation' && status.body.identity === key)!.body;
        const observationEvidence = body.evidence;
        const observationClaim = observationEvidence.claim.value;
        const witness = got(port.witness({ sourceHistory: history, input: {
          contract: f.eventProducer,
          subjectInstance: body.measurement.subject.instance,
          sourceSample: observationClaim.sourceSample,
          category: observationClaim.category,
          measurement: body.measurement,
          evidence: observationEvidence,
          sourceEvent: observationEvidence.id,
          phase: 'final', predecessors: [], state: observationClaim.state,
          hardwareProfile: null,
        } }));
        return got(port.resolve({ witnesses: [witness], sourceHistory: history,
          evaluationClock: claim.evidenceHorizon }));
      }),
    })).map(({ quantityKeys: _quantityKeys, ...sample }: any) => sample);
    return got(port.window({ sourceHistory: history, window: {
      id: `disk:${index}`, start: claim.start, end: claim.end,
      evidenceHorizon: claim.evidenceHorizon, populationEvidence: evidence,
      censusComplete: claim.censusComplete, collectorsComplete: claim.collectorsComplete,
      observedExchanges: 0, usageSupportedExchanges: 0, attemptedDispatches: 0,
      provenNoExchange: 0, dispatchUncertain: 0, conflictedAttempts: 0,
      programmaticEvents: claim.programmaticEventIdentities.length,
      samples, comparisonScopeAmount: claim.comparisonScopeAmount,
    } }));
  }
  const windows = [0, 1, 2, 3].map(window);
  const sequence = [];
  let state: any = open;
  for (let index = 1; index <= 3; index++) {
    const evaluation = port.burn(policy, state, windows[index]!, [windows[0]!]);
    sequence.push(evaluation);
    state = got(evaluation).episode;
  }
  result = sequence;
} else {
  result = [
    m.renderCurrentMeasurementRead(request(f, history, [f.eventProducer], {
      start: f.clock(0), end: f.clock(200),
    }), f.c),
    m.renderCurrentMeasurementRead(request(f, history, [f.eventProducer], {
      start: f.clock(200), end: f.clock(400),
    }), f.c),
  ];
}

process.stdout.write(JSON.stringify({ scenario, facts: history.entries.length, result }));
