import { canonical, decode, decodeMeasurement } from '../../src/index.js';
import type { Clock, Evidence, Json, Measurement } from '../../src/index.js';
import { authorAndAppend, createFactStore, redactCapture } from '../../src/facts/index.js';
import type { CapturedContent, FactContext, FactSnapshot, SegmentStoragePort } from '../../src/facts/index.js';
import {
  createCurrentQuantityWitness, decodeBurnPolicy, decodeMeasurementReadQuery,
  resolveCurrentQuantity,
} from '../../src/measurement/index.js';
import type {
  BurnPolicy, BurnWindow, MeasurementDecodeContext, MeasurementProducerContract,
  MeasurementReadQuery, QuantityState, QuantityWitnessInput, ResolvedQuantity,
} from '../../src/measurement/index.js';
import { factsFixture, json, privateKey, refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';

export interface PlannedObservation {
  readonly subject: string;
  readonly sourceEvent: string;
  readonly category: string;
  readonly amount: number;
  readonly at: Clock;
  readonly measurement: Measurement;
  readonly evidence: Evidence;
  readonly input: QuantityWitnessInput;
  readonly identity: string;
}

export function measurementA2Fixture(seedRows: readonly unknown[] = []) {
  const facts = factsFixture();
  const measurement = measurementFixture();
  const entries = [...new Set([...measurement.types.register.entries,
    ...facts.ctx.decode.register.entries, 'quantity-resolved', 'burn-window-population'])];
  const register = {
    ...measurement.types.register,
    entries,
    sites: { ...measurement.types.register.sites, ...facts.ctx.decode.register.sites },
    keys: { ...measurement.types.register.keys, ...facts.ctx.decode.register.keys },
  };
  const types = { ...measurement.types, register };
  const c: MeasurementDecodeContext = {
    ...measurement.c, register, types,
  };
  const schemas = [
    {
      ...facts.schema,
      kind: 'measurement-observation',
      fields: {
        identity: { kind: 'text' as const, maxLength: 128 },
        measurement: { kind: 'constitutional' as const, type: 'Measurement' as const },
        evidence: { kind: 'constitutional' as const, type: 'Evidence' as const },
        producerContract: { kind: 'text' as const, maxLength: 65_536 },
      },
      optional: ['producerContract'],
    },
    {
      ...facts.schema,
      kind: 'measurement-evidence',
      fields: { evidence: { kind: 'constitutional' as const, type: 'Evidence' as const } },
    },
  ];
  const captures: Record<string, CapturedContent> = {};
  const factContext: FactContext = {
    ...facts.ctx,
    decode: types,
    schemas,
    captures,
  };
  const rows: unknown[] = structuredClone([...seedRows]);
  const storage: SegmentStoragePort = {
    owner: 'part-ten',
    read: () => rows,
    append(bytes, expectedHead) {
      const actual = rows.length === 0 ? null
        : (rows.at(-1) as { contentHash: string }).contentHash;
      if (actual !== expectedHead) throw new Error('fixture compare-head mismatch');
      rows.push(JSON.parse(bytes));
      return facts.success({ kind: 'local-durable' as const });
    },
  };
  function admitEvidence(input: unknown): Evidence {
    const evidence = value(decode('Evidence', input, types));
    measurement.evidence.push(evidence);
    const text = measurement.captures[evidence.capture.reference];
    captures[evidence.capture.reference] = {
      hash: evidence.capture.hash,
      bytes: text ?? null,
      status: text === undefined ? 'missing' : 'available',
      byteLength: Buffer.byteLength(text ?? ''),
    };
    return evidence;
  }

  for (const raw of rows) {
    const body = (raw as { body?: { evidence?: unknown } }).body;
    if (body?.evidence) admitEvidence(body.evidence);
  }
  const store = createFactStore(factContext, storage);

  function append(kind: 'measurement-observation' | 'measurement-evidence', body: Json,
    at: Clock = measurement.now): string {
    return value(authorAndAppend({ kind, schemaVersion: 1, machine: 'machine-a',
      principal: facts.alice as unknown as Json,
      provenance: facts.alice.provenance as unknown as Json,
      at: at as unknown as Json, body, required: [] }, factContext, store, privateKey)).fact.id;
  }

  function planObservation(options: Readonly<{
    subject: string;
    sourceEvent: string;
    category?: string;
    amount: number;
    at: number;
    claimOccurrenceAt?: number;
    state?: QuantityState;
    predecessors?: readonly string[];
    contract?: MeasurementProducerContract;
    hardwareProfile?: string | null;
  }>): PlannedObservation {
    const contract = options.contract ?? measurement.producer;
    const category = options.category ?? 'input';
    const at = measurement.clock(options.at);
    const state = options.state ?? 'reported';
    const amount = state === 'reported' ? options.amount : 0;
    const constitutional = value(decodeMeasurement(contract.subjectKind, {
      type: 'Measurement', schemaVersion: 1,
      subject: { kind: contract.subjectKind, instance: options.subject },
      value: amount,
      unit: contract.categories.find(row => row.name === category)!.unit,
      at,
      by: contract.producer,
    }, types));
    const evidence = admitEvidence(measurement.evidenceInput({
      id: options.sourceEvent,
      observedAt: at,
      freshFor: 1_000_000,
      source: contract.producer,
      claim: {
        subject: options.subject,
        predicate: contract.evidencePredicate,
        value: {
          amount: state === 'reported' ? options.amount : null,
          category,
          sourceSample: options.subject,
          producer: contract.producer,
          state,
          occurrenceAt: measurement.clock(options.claimOccurrenceAt ?? options.at),
          hardwareProfile: options.hardwareProfile ?? null,
        },
      },
    }));
    const relation = contract.categories.find(row => row.name === category)!.relation;
    const identity = value(canonical({ family: contract.family, subject: options.subject,
      sourceSample: options.subject, category, unit: constitutional.unit, relation,
      hardwareProfile: options.hardwareProfile ?? null,
      ...(contract.family === 'resource' ? { sampleAt: at } : {}) })).hash;
    const input: QuantityWitnessInput = {
      contract,
      subjectInstance: options.subject,
      sourceSample: options.subject,
      category,
      measurement: constitutional,
      evidence,
      sourceEvent: options.sourceEvent,
      phase: options.predecessors?.length ? 'correction' : 'final',
      predecessors: options.predecessors ?? [],
      state,
      hardwareProfile: options.hardwareProfile ?? null,
    };
    return { subject: options.subject, sourceEvent: options.sourceEvent, category,
      amount: options.amount, at, measurement: constitutional, evidence, input, identity };
  }

  function persistObservation(observation: PlannedObservation): string {
    return append('measurement-observation', json({ identity: observation.identity,
      measurement: observation.measurement, evidence: observation.evidence,
      producerContract: value(canonical(observation.input.contract)).bytes }), observation.at);
  }

  function snapshot(): FactSnapshot {
    return value(store.readForProjection());
  }

  function witness(observation: PlannedObservation, sourceHistory: FactSnapshot) {
    return value(createCurrentQuantityWitness({ input: observation.input, sourceHistory }, c));
  }

  function quantity(observations: readonly PlannedObservation[], sourceHistory: FactSnapshot,
    evaluationAt = 900): ResolvedQuantity {
    return value(resolveCurrentQuantity({
      witnesses: observations.map(row => witness(row, sourceHistory)),
      sourceHistory,
      evaluationClock: measurement.clock(evaluationAt),
    }, c));
  }

  function populationEvidence(id: string, claim: unknown, at: Clock): Evidence {
    const evidence = admitEvidence(measurement.evidenceInput({ id: `population:${id}`,
      observedAt: at, freshFor: 1_000_000,
      claim: { subject: id, predicate: 'burn-window-population', value: claim },
    }));
    append('measurement-evidence', json({ evidence }), at);
    return evidence;
  }

  function burnPolicy(): BurnPolicy {
    return value(decodeBurnPolicy(measurement.burnPolicyInput, c));
  }

  function persistBurnWindow(options: Readonly<{
    id: string;
    start: number;
    end: number;
    samples: readonly Readonly<{
      identity: string;
      feature: string;
      source?: 'model-exchange' | 'programmatic-event';
      observations: readonly PlannedObservation[];
    }>[];
    censusComplete?: boolean;
    collectorsComplete?: boolean;
    attempts?: readonly string[];
    observed?: readonly string[];
    supported?: readonly string[];
    noExchange?: readonly string[];
    uncertain?: readonly string[];
    conflicted?: readonly string[];
    events?: readonly string[];
    comparisonScopeAmount: number;
  }>) {
    const start = measurement.clock(options.start);
    const end = measurement.clock(options.end);
    const model = options.samples.filter(row => (row.source ?? 'model-exchange') === 'model-exchange')
      .map(row => row.identity);
    const events = options.events ?? options.samples
      .filter(row => row.source === 'programmatic-event').map(row => row.identity);
    const attempts = options.attempts ?? model;
    const observed = options.observed ?? model;
    const supported = options.supported ?? model;
    const noExchange = options.noExchange ?? [];
    const uncertain = options.uncertain ?? [];
    const conflicted = options.conflicted ?? [];
    const claim = {
      start, end, evidenceHorizon: end,
      censusComplete: options.censusComplete ?? true,
      collectorsComplete: options.collectorsComplete ?? true,
      attemptIdentities: attempts,
      observedExchangeIdentities: observed,
      usageSupportedExchangeIdentities: supported,
      provenNoExchangeIdentities: noExchange,
      dispatchUncertainIdentities: uncertain,
      conflictedAttemptIdentities: conflicted,
      programmaticEventIdentities: events,
      samples: options.samples.map(sample => ({ identity: sample.identity, feature: sample.feature,
        source: sample.source ?? 'model-exchange', selectionVersion: 'v1',
        quantityKeys: [...new Set(sample.observations.map(row => row.identity))].sort() })),
      comparisonScopeAmount: options.comparisonScopeAmount,
    };
    const evidence = populationEvidence(options.id, claim, end);
    return {
      evidence,
      build(sourceHistory: FactSnapshot): BurnWindow {
        const samples = options.samples.map(sample => {
          const grouped = new Map<string, PlannedObservation[]>();
          for (const observation of sample.observations) {
            const bucket = grouped.get(observation.category) ?? [];
            bucket.push(observation);
            grouped.set(observation.category, bucket);
          }
          return { identity: sample.identity, feature: sample.feature,
            source: sample.source ?? 'model-exchange' as const, selectionVersion: 'v1',
            quantities: [...grouped.values()].map(group => quantity(group, sourceHistory, options.end)) };
        });
        return { id: options.id, start, end, evidenceHorizon: end, populationEvidence: evidence,
          censusComplete: options.censusComplete ?? true,
          collectorsComplete: options.collectorsComplete ?? true,
          observedExchanges: observed.length, usageSupportedExchanges: supported.length,
          attemptedDispatches: attempts.length, provenNoExchange: noExchange.length,
          dispatchUncertain: uncertain.length, conflictedAttempts: conflicted.length,
          programmaticEvents: events.length, samples,
          comparisonScopeAmount: options.comparisonScopeAmount };
      },
    };
  }

  function readQuery(overrides: Record<string, unknown>): MeasurementReadQuery {
    return value(decodeMeasurementReadQuery({
      type: 'MeasurementReadQuery', schemaVersion: 2, id: 'read:a2',
      start: measurement.clock(0), end: measurement.clock(1_000),
      evaluationClock: measurement.clock(1_000), clockBasis: 'utc', dimensions: ['family'],
      pageSize: 100, cursor: null, sort: 'source-time', maxExportBytes: 65_536,
      detailHorizonMs: 10_000, sourceHistoryDigest: 'pending',
      sourceProjectionDigest: 'pending', frontier: 'pending',
      registerGeneration: register.generation.id, ...overrides,
    }, c));
  }

  return { ...measurement, facts, c, types, factContext, storage, rows, store,
    append, admitEvidence, planObservation, persistObservation, snapshot, witness, quantity,
    populationEvidence, burnPolicy, persistBurnWindow, readQuery };
}

export type MeasurementA2Fixture = ReturnType<typeof measurementA2Fixture>;

/** Exercises Part Two's real capture-retention port for P16's retention arm. */
export function captureRetentionProof() {
  const f = factsFixture();
  const bytes = 'private measurement evidence';
  const reference = 'capture:p16-retention';
  const hash = f.capture(bytes, reference);
  const schema = { ...f.schema, kind: 'redaction', standing: 'operator' as const,
    causallyBound: true,
    fields: { reference: { kind: 'text' as const, maxLength: 128 },
      reason: { kind: 'text' as const, maxLength: 128 } } };
  const base = { ...f.ctx, schemas: [f.schema, schema] };
  const grantFact = f.fact({}, base);
  const fact = f.next(grantFact, { kind: 'redaction', predecessors: { inSegment: grantFact.id,
    frontier: {}, required: [grantFact.id] }, body: { reference,
    reason: 'erasure-obligation' } }, base);
  const context = { ...base, facts: [grantFact, fact], grants: [{ factId: grantFact.id, grant: f.g }],
    captures: { [reference]: {
    hash, bytes, status: 'available' as const, byteLength: Buffer.byteLength(bytes),
  } } };
  const pin = { reference, factId: fact.id, kind: 'unresolved-judgment' as const };
  const protectedDetail = refused(redactCapture(fact, context, f.clock(1_000), 10, [pin]),
    'protected');
  const tombstone = value(redactCapture(fact, context, f.clock(1_000), 10, []));
  return { protectedDetail, tombstone };
}
