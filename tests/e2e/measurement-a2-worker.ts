import { existsSync, readFileSync } from 'node:fs';
import {
  createMeasurementLedgerA2, decodeReadCachePolicy, measurementProjectionDefinition,
} from '../../src/measurement/index.js';
import type { Evidence, Json, Measurement } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { ProjectionGeneration } from '../../src/projections/index.js';
import { privateKey, value } from '../facts/fixtures.js';
import { measurementA2Fixture } from '../measurement/a2-fixture.js';
import { transportFixture } from '../transport/fixture.js';

const [directory, mode] = process.argv.slice(2);
if (!directory || !mode) throw new Error('directory and mode required');
const die = (name: string) => {
  if (process.env.ASTRA_CUT === name) process.kill(process.pid, 'SIGKILL');
};
const raw = existsSync(`${directory}/facts.json`)
  ? JSON.parse(readFileSync(`${directory}/facts.json`, 'utf8')) as unknown[] : [];
const f = measurementA2Fixture(raw);
const physical = transportFixture(directory);
const store = createFactStore(f.factContext, physical.storage);

if (mode === 'write') {
  const observation = f.planObservation({ subject: 'exchange:restart',
    sourceEvent: 'usage:restart', amount: 13, at: 100, contract: f.eventProducer });
  die('before-append');
  value(authorAndAppend({ kind: 'measurement-observation', schemaVersion: 1,
    machine: 'machine-a', principal: f.facts.alice as unknown as Json,
    provenance: f.facts.alice.provenance as unknown as Json,
    at: observation.at as unknown as Json,
    body: { identity: observation.identity, measurement: observation.measurement,
      evidence: observation.evidence } as unknown as Json,
    required: [] }, f.factContext, store, privateKey));
  die('after-append');
}

const history = value(store.readForProjection());
if (history.entries.length === 0) {
  process.stdout.write(JSON.stringify({ state: 'no-committed-observation',
    pending: existsSync(`${directory}/facts.pending`),
    lock: existsSync(`${directory}/append.lock`) }));
} else {
  const body = history.entries.find(row => row.fact.kind === 'measurement-observation')!
    .body as unknown as { measurement: Measurement; evidence: Evidence };
  const evidence = f.evidence.find(row => row.id === body.evidence.id)!;
  const claim = evidence.claim.value as { category: string; sourceSample: string;
    state: 'reported' };
  const port = createMeasurementLedgerA2(f.c);
  const witness = value(port.witness({ input: { contract: f.eventProducer,
    subjectInstance: body.measurement.subject.instance, sourceSample: claim.sourceSample,
    category: claim.category, measurement: body.measurement, evidence,
    sourceEvent: evidence.id, phase: 'final', predecessors: [], state: claim.state,
    hardwareProfile: null }, sourceHistory: history }));
  const quantity = value(port.resolve({ witnesses: [witness], sourceHistory: history,
    evaluationClock: f.clock(200) }));
  const peerBinding = value(port.bindPeer(history));
  const peer = value(port.mergePeers([{ peer: 'machine-a', state: 'admitted',
    sourceHistory: history, ...peerBinding, observedAt: f.clock(195), lastFrontier: null,
    quantities: [quantity] }], { requiredPeers: ['machine-a'], evaluationClock: f.clock(200),
    maximumClockSkewMs: 10 }));
  const last = history.entries.at(-1)!.fact;
  const generation: ProjectionGeneration = { reference: f.c.register.generation,
    kinds: ['measurement-observation', 'measurement-evidence'],
    lineages: { 'machine-a': { head: last.segment, observedAt: null, closed: true } } };
  const definition = value(measurementProjectionDefinition(generation, {
    'measurement-observation': { identity: 'identity', value: 'measurement',
      merge: 'set-union' },
  }, f.c));
  die('before-fold');
  const binding = value(port.bindRead({ sourceHistory: history, sourceDefinition: definition,
    sourceGeneration: generation }));
  const read = value(port.read({ sourceHistory: history, sourceDefinition: definition,
    sourceGeneration: generation, query: f.readQuery(binding), producers: [f.eventProducer],
    attributions: [], timedOut: false }));
  die('after-fold');
  const cache = value(port.cache(value(decodeReadCachePolicy(f.cachePolicyInput, f.c))));
  value(cache.put({ key: 'restart', createdAt: f.clock(100), bytes: 'row', byteLength: 3 }));
  process.stdout.write(JSON.stringify({ state: 'rebuilt', quantity: quantity.amount,
    peer: peer.state, rows: read.totalCount, readHash: read.sourceHistoryDigest,
    cache: value(cache.inspect()).length,
    pending: existsSync(`${directory}/facts.pending`),
    lock: existsSync(`${directory}/append.lock`) }));
}
