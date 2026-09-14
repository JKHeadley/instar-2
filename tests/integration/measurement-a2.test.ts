import { expect, it } from 'vitest';
import {
  createMeasurementLedgerA2, decodeAggregateMeasurementsPolicy, decodeReadCachePolicy,
  measurementProjectionDefinition,
} from '../../src/measurement/index.js';
import type { ProjectionGeneration } from '../../src/projections/index.js';
import { value } from '../facts/fixtures.js';
import { captureRetentionProof, measurementA2Fixture } from '../measurement/a2-fixture.js';
import { judgmentFixture } from '../judgment/fixture.js';

function generationFor(f: ReturnType<typeof measurementA2Fixture>): ProjectionGeneration {
  const last = value(f.store.read()).at(-1)!;
  return { reference: f.c.register.generation,
    kinds: ['measurement-observation', 'measurement-evidence'],
    lineages: { 'machine-a': { head: last.segment, observedAt: null, closed: true } } };
}

it('P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted] full A2 port delegates attribution to current Part Seven facts', async () => {
  const judgment = judgmentFixture();
  value(await judgment.door.judge(judgment.input, judgment.start()));
  const f = measurementA2Fixture();
  const context = { ...f.c, register: judgment.ctx.decode.register,
    types: judgment.ctx.decode };
  const port = createMeasurementLedgerA2(context);
  expect(value(port.attribute({ attempt: `attempt:${judgment.input.id}:1`,
    claimed: { feature: 'forged', model: 'forged', machine: 'forged' },
    evaluationClock: judgment.now, sourceHistory: value(judgment.store.readForProjection()),
    candidates: [] }))).toMatchObject({ state: 'attributed', feature: 'judgment',
    model: 'model', machine: 'machine-a', run: judgment.input.run.id });
});

it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-37 [behavior:peer-union-window] P16-NF-38 [behavior:peer-completeness-clock] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge full A2 port binds quantities and peer completeness to one current owner history', () => {
  const f = measurementA2Fixture();
  const observation = f.planObservation({ subject: 'exchange:integration',
    sourceEvent: 'usage:integration', amount: 8, at: 100, contract: f.eventProducer });
  f.persistObservation(observation);
  const history = f.snapshot();
  const eventAggregate = { ...f.aggregatePolicyInput, id: 'aggregate:event',
    sourceKind: 'programmatic-count' };
  const context = f.withRegistered(eventAggregate);
  const port = createMeasurementLedgerA2(context);
  expect(Object.keys(port).sort()).toEqual(['aggregate', 'attribute', 'bindPeer', 'bindRead', 'burn',
    'cache', 'mergePeers', 'owner', 'read', 'resolve', 'window', 'witness']);
  const witness = value(port.witness({ input: observation.input, sourceHistory: history }));
  const quantity = value(port.resolve({ witnesses: [witness], sourceHistory: history,
    evaluationClock: f.clock(200) }));
  expect(quantity).toMatchObject({ state: 'resolved', amount: 8 });
  const binding = value(port.bindPeer(history));
  const aggregate = value(port.aggregate({
    policy: value(decodeAggregateMeasurementsPolicy(eventAggregate, context)),
    quantities: [quantity], unit: 'tokens', category: 'input', dimensions: ['feature'],
    producer: 'probe', scope: 'scope:ordinary', start: f.clock(0), end: f.clock(200),
    evaluationClock: f.clock(200), frontier: binding.frontierDigest,
  }));
  expect(aggregate).toMatchObject({ amount: 8, unresolved: [] });
  const peer = { peer: 'machine-a', state: 'admitted' as const, sourceHistory: history,
    ...binding, observedAt: f.clock(195), lastFrontier: null, quantities: [quantity] };
  expect(value(port.mergePeers([peer], { requiredPeers: ['machine-a'],
    evaluationClock: f.clock(200), maximumClockSkewMs: 10 }))).toMatchObject({
    state: 'complete', members: ['usage:integration'], unresolved: [],
  });
});

it('P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted] P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation] P16-NF-39 [behavior:all-identities-retention] P16-NF-40 [behavior:capture-retention] P16-NF-41 [behavior:bounded-cache-eviction] P16-NF-47 [behavior:privacy] P16-NF-48 [behavior:bounded-query] P16-NF-50 [behavior:historical-restart-rebuild] full A2 port renders bounded rows from its exact current all-identities fold', () => {
  const f = measurementA2Fixture();
  const observation = f.planObservation({ subject: 'exchange:read:integration',
    sourceEvent: 'usage:read:integration', amount: 6, at: 100, contract: f.eventProducer });
  f.persistObservation(observation);
  const history = f.snapshot();
  const port = createMeasurementLedgerA2(f.c);
  expect(value(port.attribute({ attempt: 'attempt:absent',
    claimed: { feature: 'invented', model: 'invented', machine: 'invented' },
    evaluationClock: f.clock(200), sourceHistory: history, candidates: [] }))).toMatchObject({
    state: 'unattributed', feature: null, model: null,
  });
  const generation = generationFor(f);
  const definition = value(measurementProjectionDefinition(generation, {
    'measurement-observation': { identity: 'identity', value: 'measurement', merge: 'set-union' },
  }, f.c));
  const binding = value(port.bindRead({ sourceHistory: history, sourceDefinition: definition,
    sourceGeneration: generation }));
  const query = f.readQuery({ ...binding, pageSize: 1 });
  const result = value(port.read({ sourceHistory: history, sourceDefinition: definition,
    sourceGeneration: generation, query, producers: [f.eventProducer], attributions: [],
    timedOut: false }));
  expect(result).toMatchObject({ totalCount: 1, partial: false,
    rows: [{ identity: observation.identity, amount: 6, state: 'reported' }] });
  expect(JSON.stringify(result)).not.toMatch(/prompt|response|command|environment/i);
  expect(captureRetentionProof().tombstone).toMatchObject({ status: 'tombstoned', bytes: null });
  const cache = value(port.cache(value(decodeReadCachePolicy(f.cachePolicyInput, f.c))));
  value(cache.put({ key: result.rows[0]!.identity, createdAt: f.clock(100),
    bytes: 'row', byteLength: 3 }));
  expect(value(cache.inspect())).toHaveLength(1);
});

it('P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] burn:unwitnessed-no-exchange-claim full A2 port refuses to treat an asserted inactive roster as owner evidence', () => {
  const f = measurementA2Fixture();
  const planned = f.persistBurnWindow({ id: 'inactive:integration', start: 0, end: 200,
    samples: [], attempts: ['dispatch:no-exchange'], observed: [], supported: [],
    noExchange: ['dispatch:no-exchange'], comparisonScopeAmount: 0 });
  const history = f.snapshot();
  const port = createMeasurementLedgerA2(f.c);
  const window = value(port.window({ window: planned.build(history), sourceHistory: history }));
  expect(value(port.burn(f.burnPolicy(), { state: 'closed', recoveryCount: 0,
    notified: false, investigation: null }, window, []))).toMatchObject({
    classification: 'incomplete', currentAmount: null, culprit: null,
    notify: false, openInvestigation: false,
    coverageDebt: ['eligible-sample-floor', 'owner-no-exchange:dispatch:no-exchange'],
  });
});
