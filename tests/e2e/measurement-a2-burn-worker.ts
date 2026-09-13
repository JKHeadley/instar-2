import { existsSync, readFileSync } from 'node:fs';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { Evidence, Json, Measurement } from '../../src/index.js';
import { createMeasurementLedgerA2 } from '../../src/measurement/index.js';
import type { BurnWindow, QuantityState } from '../../src/measurement/index.js';
import { privateKey, value } from '../facts/fixtures.js';
import { measurementA2Fixture } from '../measurement/a2-fixture.js';
import { transportFixture } from '../transport/fixture.js';

const [directory, mode] = process.argv.slice(2);
if (!directory || !mode) throw new Error('directory and mode required');
const raw = existsSync(`${directory}/facts.json`)
  ? JSON.parse(readFileSync(`${directory}/facts.json`, 'utf8')) as unknown[] : [];
const f = measurementA2Fixture(raw);
const physical = transportFixture(directory);
const store = createFactStore(f.factContext, physical.storage);
const append = (kind: 'measurement-observation' | 'measurement-evidence', body: Json,
  at: ReturnType<typeof f.clock>) => value(authorAndAppend({ kind, schemaVersion: 1,
    machine: 'machine-a', principal: f.facts.alice as unknown as Json,
    provenance: f.facts.alice.provenance as unknown as Json, at: at as unknown as Json,
    body, required: [] }, f.factContext, store, privateKey));

if (mode === 'write') {
  for (const [id, start, end, target, comparison] of [
    ['base', 0, 200, 10, 90], ['high', 200, 400, 150, 50],
    ['low', 400, 600, 0, 20], ['next', 600, 800, 0, 20],
  ] as const) {
    const observations = [
      f.planObservation({ subject: `${id}:target`, sourceEvent: `${id}:target:input`,
        category: 'input', amount: target, at: start + 50, contract: f.eventProducer }),
      f.planObservation({ subject: `${id}:other`, sourceEvent: `${id}:other:input`,
        category: 'input', amount: comparison, at: start + 50, contract: f.eventProducer }),
    ];
    for (const observation of observations)
      append('measurement-observation', { identity: observation.identity,
        measurement: observation.measurement, evidence: observation.evidence } as unknown as Json,
      observation.at);
    const plan = f.persistBurnWindow({ id, start, end, comparisonScopeAmount: target + comparison,
      samples: [
        { identity: `${id}:target`, feature: 'feature-a', source: 'programmatic-event',
          observations: [observations[0]!] },
        { identity: `${id}:other`, feature: 'comparison', source: 'programmatic-event',
          observations: [observations[1]!] },
      ] });
    append('measurement-evidence', { evidence: plan.evidence } as unknown as Json, f.clock(end));
  }
  process.stdout.write(JSON.stringify({ state: 'written', facts: value(store.read()).length }));
} else {
  const history = value(store.readForProjection());
  const port = createMeasurementLedgerA2(f.c);
  const observationRows = history.entries.filter(row => row.fact.kind === 'measurement-observation');
  function quantityFor(key: string, evaluation: ReturnType<typeof f.clock>) {
    const row = observationRows.find(status => (status.body as unknown as { identity: string }).identity
      === key)!;
    const body = row.body as unknown as { measurement: Measurement; evidence: Evidence };
    const evidence = f.evidence.find(item => item.id === body.evidence.id)!;
    const claim = evidence.claim.value as { category: string; sourceSample: string;
      state: QuantityState };
    const witness = value(port.witness({ input: { contract: f.eventProducer,
      subjectInstance: body.measurement.subject.instance, sourceSample: claim.sourceSample,
      category: claim.category, measurement: body.measurement, evidence, sourceEvent: evidence.id,
      phase: 'final', predecessors: [], state: claim.state, hardwareProfile: null },
    sourceHistory: history }));
    return value(port.resolve({ witnesses: [witness], sourceHistory: history,
      evaluationClock: evaluation }));
  }
  function rebuildWindow(id: string): BurnWindow {
    const evidence = f.evidence.find(item => item.id === `population:${id}`)!;
    const claim = evidence.claim.value as Record<string, any>;
    const samples = (claim.samples as Array<Record<string, any>>).map(sample => ({
      identity: sample.identity as string, feature: sample.feature as string,
      source: sample.source as 'programmatic-event', selectionVersion: sample.selectionVersion as string,
      quantities: (sample.quantityKeys as string[]).map(key =>
        quantityFor(key, claim.evidenceHorizon)),
    }));
    return value(port.window({ sourceHistory: history, window: {
      id, start: claim.start, end: claim.end, evidenceHorizon: claim.evidenceHorizon,
      populationEvidence: evidence, censusComplete: claim.censusComplete,
      collectorsComplete: claim.collectorsComplete,
      observedExchanges: claim.observedExchangeIdentities.length,
      usageSupportedExchanges: claim.usageSupportedExchangeIdentities.length,
      attemptedDispatches: claim.attemptIdentities.length,
      provenNoExchange: claim.provenNoExchangeIdentities.length,
      dispatchUncertain: claim.dispatchUncertainIdentities.length,
      conflictedAttempts: claim.conflictedAttemptIdentities.length,
      programmaticEvents: claim.programmaticEventIdentities.length, samples,
      comparisonScopeAmount: claim.comparisonScopeAmount,
    } }));
  }
  const base = rebuildWindow('base');
  const high = rebuildWindow('high');
  const low = rebuildWindow('low');
  const next = rebuildWindow('next');
  const initial = { state: 'closed' as const, recoveryCount: 0, notified: false,
    investigation: null };
  const opened = value(port.burn(f.burnPolicy(), initial, high, [base]));
  const recovering = value(port.burn(f.burnPolicy(), opened.episode, low, [high]));
  const recovered = value(port.burn(f.burnPolicy(), recovering.episode, next, [low]));
  process.stdout.write(JSON.stringify({ state: 'rebuilt', facts: history.entries.length,
    opened: opened.episode.state, notified: opened.notify,
    firstRecovery: recovering.episode.recoveryCount,
    recovered: recovered.episode.state }));
}
