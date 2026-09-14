import * as measurementOperations from '../../../src/measurement/index.js';
import * as ownerOperations from '../../../src/index.js';
import { measurementA2Fixture } from '../a2-fixture.js';
import { value } from '../../facts/fixtures.js';

const m: any = measurementOperations;
const one: any = ownerOperations;
const F: any = measurementA2Fixture;
const got: any = value;

const ok = (result: any) => result?.kind === 'Success';
const no = (result: any) => result?.kind === 'Refused' && typeof result.reason === 'string';
const open = { state: 'open', recoveryCount: 0, notified: true,
  investigation: 'review:existing' } as const;

function event(f: any, id: string, subject: string, amount: number, at: number,
  ttl = 10_000) {
  const planned = f.planObservation({ subject, sourceEvent: id, amount, at,
    contract: f.eventProducer });
  f.evidence.splice(f.evidence.findIndex((evidence: any) => evidence.id === id), 1);
  const evidence = f.admitEvidence(f.evidenceInput({ id, observedAt: f.clock(at),
    freshFor: ttl, claim: planned.evidence.claim }));
  return { ...planned, evidence, input: { ...planned.input, evidence } };
}

function plan(f: any, id: string, start: number, observations: any[], features: string[],
  total: number) {
  return f.persistBurnWindow({ id, start, end: start + 200,
    samples: observations.map((observation, index) => ({ identity: observation.subject,
      feature: features[index], source: 'programmatic-event', observations: [observation] })),
    comparisonScopeAmount: total });
}

function win(f: any, planned: any, history: any) {
  return got(m.createCurrentBurnWindow({ window: planned.build(history),
    sourceHistory: history }, f.c));
}

function request(f: any, history: any, producers = [f.eventProducer], extra: any = {}): any {
  const lineages: any = {};
  for (const row of history.entries)
    lineages[row.fact.machine] = { head: row.fact.segment, observedAt: null, closed: true };
  const sourceGeneration = { reference: f.c.register.generation,
    kinds: [...new Set(history.entries.map((row: any) => row.fact.kind))], lineages };
  const sourceDefinition = got(m.measurementProjectionDefinition(sourceGeneration,
    history.entries.some((row: any) => row.fact.kind === 'measurement-observation')
      ? { 'measurement-observation': { identity: 'identity', value: 'measurement',
        merge: 'set-union' } } : {}, f.c));
  const bind = got(m.bindCurrentMeasurementReadSource({ sourceHistory: history,
    sourceGeneration, sourceDefinition }, f.c));
  return { sourceHistory: history, sourceGeneration, sourceDefinition,
    query: f.readQuery({ ...bind, ...extra }), producers, attributions: [], timedOut: false };
}

export { m, one, F, got, event, plan, win, request, open, ok, no };
