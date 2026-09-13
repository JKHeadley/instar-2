import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createMeasurementLedgerA2, decodeReadCachePolicy, measurementProjectionDefinition,
} from '../../src/measurement/index.js';
import type { Evidence, Measurement } from '../../src/index.js';
import type { BurnWindow, QuantityWitnessInput } from '../../src/measurement/index.js';
import type { ProjectionGeneration } from '../../src/projections/index.js';
import { value } from '../facts/fixtures.js';
import { measurementA2Fixture } from '../measurement/a2-fixture.js';

const [directory, mode, cut = 'none'] = process.argv.slice(2);
if (!directory || !mode) throw new Error('directory and mode required');
const target = join(directory, 'measurement-facts.json');
const temporary = `${target}.next`;
const die = (name: string) => {
  if (cut === name) process.kill(process.pid, 'SIGKILL');
};

if (mode === 'write') {
  const f = measurementA2Fixture();
  const observation = f.planObservation({ subject: 'exchange:restart',
    sourceEvent: 'usage:restart', amount: 13, at: 100 });
  f.persistObservation(observation);
  f.persistBurnWindow({ id: 'inactive:restart', start: 0, end: 200, samples: [],
    attempts: ['dispatch:no-exchange'], noExchange: ['dispatch:no-exchange'],
    comparisonScopeAmount: 0 });
  const bytes = JSON.stringify(f.rows);
  die('before-write');
  const descriptor = openSync(temporary, 'w');
  writeSync(descriptor, bytes);
  die('after-write');
  fsyncSync(descriptor);
  closeSync(descriptor);
  die('after-file-sync');
  renameSync(temporary, target);
  die('after-rename');
  const directoryDescriptor = openSync(dirname(target), 'r');
  fsyncSync(directoryDescriptor);
  closeSync(directoryDescriptor);
  die('after-directory-sync');
  process.stdout.write(JSON.stringify({ state: 'committed' }));
} else if (!existsSync(target)) {
  process.stdout.write(JSON.stringify({ state: 'empty' }));
} else {
  const rawRows = JSON.parse(readFileSync(target, 'utf8')) as unknown[];
  const f = measurementA2Fixture(rawRows);
  const history = f.snapshot();
  const port = createMeasurementLedgerA2(f.c);
  const observationBody = (rawRows.find(row =>
    (row as { kind?: string }).kind === 'measurement-observation') as {
      body: { measurement: Measurement; evidence: Evidence };
    }).body;
  const measurement = observationBody.measurement;
  const evidence = f.evidence.find(row => row.id === observationBody.evidence.id)!;
  const claim = evidence.claim.value as { category: string; sourceSample: string; state: 'reported' };
  const input: QuantityWitnessInput = { contract: f.producer,
    subjectInstance: measurement.subject.instance, sourceSample: claim.sourceSample,
    category: claim.category, measurement, evidence, sourceEvent: evidence.id,
    phase: 'final', predecessors: [], state: claim.state, hardwareProfile: null };
  const witness = value(port.witness({ input, sourceHistory: history }));
  const quantity = value(port.resolve({ witnesses: [witness], sourceHistory: history,
    evaluationClock: f.clock(200) }));
  const peerBinding = value(port.bindPeer(history));
  const pool = value(port.mergePeers([{ peer: 'machine-a', state: 'admitted', sourceHistory: history,
    ...peerBinding, observedAt: f.clock(195), lastFrontier: null, quantities: [quantity] }], {
    requiredPeers: ['machine-a'], evaluationClock: f.clock(200), maximumClockSkewMs: 10,
  }));
  const facts = value(f.store.read());
  const last = facts.at(-1)!;
  const generation: ProjectionGeneration = { reference: f.c.register.generation,
    kinds: ['measurement-observation', 'measurement-evidence'],
    lineages: { 'machine-a': { head: last.segment, observedAt: null, closed: true } } };
  const definition = value(measurementProjectionDefinition(generation, {
    'measurement-observation': { identity: 'identity', value: 'measurement', merge: 'set-union' },
  }, f.c));
  const readBinding = value(port.bindRead({ sourceHistory: history, sourceDefinition: definition,
    sourceGeneration: generation }));
  const read = value(port.read({ sourceHistory: history, sourceDefinition: definition,
    sourceGeneration: generation, query: f.readQuery(readBinding), producers: [f.producer],
    attributions: [], timedOut: false }));
  const population = f.evidence.find(row => row.id === 'population:inactive:restart')!;
  const populationClaim = population.claim.value as Record<string, any>;
  const window: BurnWindow = { id: 'inactive:restart', start: populationClaim.start,
    end: populationClaim.end, evidenceHorizon: populationClaim.evidenceHorizon,
    populationEvidence: population, censusComplete: populationClaim.censusComplete,
    collectorsComplete: populationClaim.collectorsComplete,
    observedExchanges: populationClaim.observedExchangeIdentities.length,
    usageSupportedExchanges: populationClaim.usageSupportedExchangeIdentities.length,
    attemptedDispatches: populationClaim.attemptIdentities.length,
    provenNoExchange: populationClaim.provenNoExchangeIdentities.length,
    dispatchUncertain: populationClaim.dispatchUncertainIdentities.length,
    conflictedAttempts: populationClaim.conflictedAttemptIdentities.length,
    programmaticEvents: populationClaim.programmaticEventIdentities.length,
    samples: [], comparisonScopeAmount: populationClaim.comparisonScopeAmount };
  const admittedWindow = value(port.window({ window, sourceHistory: history }));
  const burn = value(port.burn(f.burnPolicy(), { state: 'closed', recoveryCount: 0,
    notified: false, investigation: null }, admittedWindow, []));
  const cache = value(port.cache(value(decodeReadCachePolicy(f.cachePolicyInput, f.c))));
  value(cache.put({ key: 'restart', createdAt: f.clock(100), bytes: 'row', byteLength: 3 }));
  process.stdout.write(JSON.stringify({ state: 'rebuilt', quantity: quantity.amount,
    peer: pool.state, rows: read.totalCount, readHash: read.sourceHistoryDigest,
    burn: burn.classification, cache: value(cache.inspect()).length }));
}
