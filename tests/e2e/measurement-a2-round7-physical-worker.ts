import { existsSync, readFileSync } from 'node:fs';
import { createFactStore, authorAndAppend } from '../../src/facts/index.js';
import { canonical } from '../../src/index.js';
import { renderCurrentMeasurementRead } from '../../src/measurement/index.js';
import { measurementA2Fixture } from '../measurement/a2-fixture.js';
import { request } from '../measurement/a2-round4-review/common.js';
import { transportFixture } from '../transport/fixture.js';
import { privateKey, value } from '../facts/fixtures.js';

const [scenario, directory, mode] = process.argv.slice(2) as [
  'correction' | 'concurrent' | 'freshness', string, 'write' | 'read',
];
const raw = existsSync(`${directory}/facts.json`)
  ? JSON.parse(readFileSync(`${directory}/facts.json`, 'utf8'))
  : [];
const f = measurementA2Fixture(raw);
const factContext = { ...f.factContext,
  schemas: f.factContext.schemas.map(schema => schema.kind === 'measurement-observation'
    ? { ...schema, fields: { ...schema.fields, corrects: { kind: 'reference' as const } },
      optional: [...(schema.optional ?? []), 'corrects'] }
    : schema) };
const physical = transportFixture(directory);
const store = createFactStore(factContext, physical.storage);

function append(kind: string, body: any, at = 120, required: string[] = []): string {
  return value(authorAndAppend({ kind, schemaVersion: 1, machine: 'machine-a',
    principal: f.facts.alice, provenance: f.facts.alice.provenance,
    at: f.clock(at), body, required } as never, factContext, store, privateKey)).fact.id;
}

function body(observation: ReturnType<typeof f.planObservation>) {
  return { identity: observation.identity, measurement: observation.measurement,
    evidence: observation.evidence, producerContract: value(canonical(f.eventProducer)).bytes };
}

function read() {
  return renderCurrentMeasurementRead(request(f, value(store.readForProjection()),
    [f.eventProducer], { end: f.clock(200), evaluationClock: f.clock(200) }) as never, f.c);
}

function verdict(id: string, key: string, witnesses: string[], amount: number) {
  return f.admitEvidence(f.evidenceInput({ id, observedAt: f.clock(120),
    freshFor: 1_000_000,
    claim: { subject: key, predicate: 'quantity-resolved', value: { amount, witnesses } } }));
}

if (mode === 'write') {
  let first = f.planObservation({ subject: 'physical:round7', sourceEvent: 'physical:a',
    amount: 101, at: 100, contract: f.eventProducer });
  const second = f.planObservation({ subject: first.subject, sourceEvent: 'physical:b',
    amount: scenario === 'freshness' ? 101 : 109, at: 100, contract: f.eventProducer });
  if (scenario === 'freshness') {
    f.evidence.splice(f.evidence.findIndex(evidence => evidence.id === first.evidence.id), 1);
    const evidence = f.admitEvidence(f.evidenceInput({ id: first.sourceEvent,
      observedAt: f.clock(100), freshFor: 50, claim: first.evidence.claim }));
    first = { ...first, evidence, input: { ...first.input, evidence } };
  }
  const original = append('measurement-observation', body(first), 100);
  append('measurement-observation', body(second), 100);
  if (scenario !== 'freshness') {
    append('measurement-evidence', { evidence: verdict('physical:resolution', first.identity,
      [first.sourceEvent, second.sourceEvent], 105) });
    if (scenario === 'correction') {
      const corrected = f.planObservation({ subject: first.subject,
        sourceEvent: 'physical:a:new', amount: 109, at: 100, contract: f.eventProducer });
      append('measurement-observation', { ...body(corrected), corrects: original }, 140,
        [original]);
    } else {
      const evidence = verdict('physical:resolution:concurrent', first.identity,
        [first.sourceEvent, second.sourceEvent], 107);
      const wire = f.facts.wire({ kind: 'measurement-evidence', schemaVersion: 1,
        machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 },
        at: f.clock(120), predecessors: { inSegment: null,
          frontier: { 'machine-a': { epoch: 0, position: 1 } }, required: ['machine-a:0:1'] },
        body: { evidence } }, factContext);
      value(store.append(wire, { peer: 'machine-b' }));
    }
  }
}

process.stdout.write(JSON.stringify({ scenario, mode,
  facts: value(store.readForProjection()).entries.length, result: read() }));
