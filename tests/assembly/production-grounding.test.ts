import { expect, it } from 'vitest';
import { compareAssemblyRecords, contextDeliveryIdFor, createConfinedContextDeliveryDriver } from '../../src/assembly/index.js';
import type { AssemblyHistoryReadPort, AssemblyRuntimePort, ContextDeliverySpecification, HarnessLaunchSpec } from '../../src/assembly/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { paired } from '../rungraph/astra-production-grounding-fixture.js';

const hash = (character: string) => `sha256:${character.repeat(64)}` as const;
const fact = (id: string, kind: string) => ({ id, kind, schemaVersion: 1, machine: 'machine-a' }) as never;

function seam() {
  const f = factsFixture(), launch = assemblyInput('HarnessLaunchSpec');
  const make = (reason: ContextDeliverySpecification['reason'], operation: string, previousDelivery = '', controlObservation = '') => ({
    type: 'ContextDeliverySpecification', schemaVersion: 1, id: contextDeliveryIdFor(launch.id, operation), predecessors: [], dependencyFacts: [],
    launch: launch.id, run: launch.run, step: `step:${operation}`, input: `intake:${operation}`, inputDigest: hash('a'),
    incarnation: launch.incarnation, harness: launch.harness, artifactDigest: launch.artifactDigest, machine: launch.machine,
    generation: 'generation:fixture', executionContext: 'execution:1',
    contextManifest: [{ class: 'message', reference: `capture:${operation}`, digest: hash('b') }],
    reason, operation, claim: `claim:${operation}`, previousDelivery, controlObservation,
  }) as unknown as ContextDeliverySpecification;
  const records = new Map<string, HarnessLaunchSpec | ContextDeliverySpecification>([[launch.id, launch]]);
  const rows = new Map<string, any>();
  const add = (record: HarnessLaunchSpec | ContextDeliverySpecification) => {
    records.set(record.id, record); rows.set(record.id, { fact: fact(record.id, `assembly-${record.type}`), record,
      taint: [], conflicts: [], completeness: 'complete' });
  };
  add(launch);
  const history: AssemblyHistoryReadPort = { owner: 'part-ten', current: () => f.success([...rows.values()]),
    lookup: reference => f.success(rows.get(reference) ?? null), resolve: () => f.success({ admitted: true, completeness: 'complete', facts: [], conflicts: [], missing: [] }),
    resolveContextDelivery: () => f.success({ admitted: true, completeness: 'complete', facts: [], conflicts: [], missing: [] }) };
  const written: any[] = [];
  const runtime = { owner: 'part-ten', record: (_name: string, input: unknown) => { written.push(input); return f.success(input); },
    inspect: () => f.success([]), inspectCurrent: () => f.success([]), resolve: () => f.success({ admitted: true, completeness: 'complete', facts: [], conflicts: [], missing: [] }),
    admit: () => { throw new Error('not used'); } } as unknown as AssemblyRuntimePort;
  const events: string[] = [];
  const driver = createConfinedContextDeliveryDriver({ history, runtime, context: f.c, clock: () => 100,
    liveProcess: { owner: 'part-ten', resolve: candidate => { events.push(`live:${candidate.id}`); return f.success({ launch: candidate.id,
      run: candidate.run, incarnation: candidate.incarnation, harness: candidate.harness, artifactDigest: candidate.artifactDigest,
      machine: candidate.machine, processIdentity: 'pid:42:start:1' }); } },
    execution: { owner: 'part-eight', deliver: input => { events.push(`deliver:${input.specification.reason}`); return f.success('effect:accepted'); },
      observe: input => { events.push(`observe:${input.specification.reason}`); return f.success({ phase: 'context-consumed', evidence: 'effect:consumed', detail: 'boundary instrumented' }); } } });
  return { f, launch, make, add, written, events, driver };
}

it('PRODUCTION-GROUNDING P10-NF-10 P10-NF-11 P10-NF-13 confined initial and live-input delivery re-resolve one launch and retain predecessor order', () => {
  const s = seam(), initial = s.make('initial', 'operation:initial'); s.add(initial);
  expect(value(s.driver.deliver(initial, { operation: initial.operation, claim: initial.claim })).contextDelivery).toBe(initial.id);
  expect(value(s.driver.observe(initial, initial.operation)).phase).toBe('context-consumed');
  const live = s.make('live-input', 'operation:live', initial.id); s.add(live);
  expect(value(s.driver.deliver(live, { operation: live.operation, claim: live.claim })).step).toBe(live.step);
  expect(value(s.driver.observe(live, live.operation)).contextDigests).toEqual(live.contextManifest.map(row => row.digest));
  expect(s.events).toEqual([`live:${s.launch.id}`, 'deliver:initial', `live:${s.launch.id}`, 'observe:initial',
    `live:${s.launch.id}`, 'deliver:live-input', `live:${s.launch.id}`, 'observe:live-input']);
  expect(new Set(s.written.map(row => row.contextDelivery))).toEqual(new Set([initial.id, live.id]));
});

it('PG-P10-TYPED-REFUSALS refuses adapter mutation, claim replay, incarnation replacement, conflicts, and held compaction', () => {
  const s = seam(), initial = s.make('initial', 'operation:initial'); s.add(initial);
  refused(s.driver.deliver({ ...initial, input: 'adapter-minted' } as ContextDeliverySpecification,
    { operation: initial.operation, claim: initial.claim }), 'construct or alter');
  refused(s.driver.deliver(initial, { operation: initial.operation, claim: 'claim:replayed' }), 'claim differs');
  refused(s.driver.deliver({ ...initial, incarnation: 'minted' } as ContextDeliverySpecification,
    { operation: initial.operation, claim: initial.claim }), 'construct or alter');
  const compaction = s.make('compaction', 'operation:compact', initial.id, 'control:compact'); s.add(compaction);
  refused(s.driver.deliver(compaction, { operation: compaction.operation, claim: compaction.claim }),
    'NON-EXECUTABLE-UNTIL-live-path-unit-compaction');
  const changed = { ...initial, inputDigest: hash('c') };
  const comparison = value(compareAssemblyRecords('ContextDeliverySpecification', initial, changed, s.f.c));
  expect(comparison.equal).toBe(false); expect(comparison.conflict?.kind).toBe('immutable-disagreement');
});

it('PG-P10-SIGNED-DELIVERY records and resolves exact signed typed delivery evidence', () => {
  const f = paired();
  value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const delivered = f.last();
  expect(delivered.spec.operation).not.toBe(delivered.spec.claim);
  expect(delivered.spec.operation).toMatch(/^operation:sha256:[a-f0-9]{64}$/);
  const claim = value(f.history.lookup(delivered.spec.claim)) as any;
  expect(claim.fact.kind).toBe('transport-AdmissionReservation');
  const request = value(f.history.lookup(claim.fact.body.record.request)) as any;
  expect(request.fact.kind).toBe('effect-EffectRequest');
  expect((value(f.history.lookup(request.fact.body.record.definition)) as any).fact.kind).toBe('effect-OperationDefinition');
  expect((value(f.history.lookup(delivered.observation.boundaryEvidence)) as any).fact.kind).toBe('effect-OperationObservation');
  expect(value(f.runtime.resolve(delivered.spec)).admitted).toBe(true);
});
