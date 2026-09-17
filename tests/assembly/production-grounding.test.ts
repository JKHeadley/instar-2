// @ts-nocheck -- real owner prerequisite replacement for the six mapped seam assertions.
import { vi } from 'vitest'; vi.setConfig({ testTimeout: 120000 });
import { canonical } from '../../src/index.js';
import { factId } from '../../src/facts/index.js';
import { json } from '../facts/fixtures.js';
import { createLiveInputAssemblyFixture } from './live-input-owner-fixture.js';
import './production-grounding-evidence.mjs';
import { expect, it } from 'vitest';
import { compareAssemblyRecords, contextDeliveryIdFor, createConfinedContextDeliveryDriver } from '../../src/assembly/index.js';
import type { AssemblyHistoryReadPort, AssemblyRuntimePort, ContextDeliverySpecification, HarnessLaunchSpec } from '../../src/assembly/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { paired } from '../rungraph/astra-production-grounding-fixture.js';

const hash = (character: string) => `sha256:${character.repeat(64)}` as const;
const fact = (id: string, kind: string) => ({ id, kind, schemaVersion: 1, machine: 'machine-a' }) as never;

function seam() {
  const f = createLiveInputAssemblyFixture(undefined, { minimal: true });
  const p = f.groundingFor({ scope: 'scope:minimal' });
  const request = { run: { head: 'candidate', pending: [] }, worker: 'w', harness: 'native', reason: 'start',
    execution: value(f.deps.admission.execution(f.id, f.lease)) };
  let prior: any;
  const events: string[] = [];
  const driver = {
    owner: 'part-ten' as const,
    deliver: (spec: ContextDeliverySpecification, effect: any) => {
      events.push(`live:${f.launch.id}`, `deliver:${spec.reason}`);
      return p.driver.deliver(spec, effect);
    },
    observe: (spec: ContextDeliverySpecification, operation: string) => {
      events.push(`live:${f.launch.id}`, `observe:${spec.reason}`);
      return p.driver.observe(spec, operation);
    },
  };
  const make = (reason: ContextDeliverySpecification['reason'], label: string, previousDelivery = '', control = '') => {
    if (prior) {
      const state = value(f.effects.transport.inspect()).filter((row: any) => row.record.type === 'AdmissionReservation'
        && row.record.operation === prior.operation).at(-1)!.record.state;
      if (state === 'dispatch-claimed') {
        value(p.driver.deliver(prior, { operation: prior.operation, claim: prior.claim }));
        value(p.driver.observe(prior, prior.operation));
      }
      const message = f.effects.message(f.id, label), capture = value(f.owners.host.capture(value(canonical(message)).bytes));
      f.append('next-inbound', json({ capture }));
    }
    const candidate = value<any>(p.sample(request, f.deps.clock())).specification;
    const controlObservation = control ? f.append('note', json({ identity: control, amount: '0' })).fact.id : '';
    // The signed envelope identity is known from the local append position. This
    // fixture exercises the original equality assertion with real signed bytes.
    const next = value(f.store.read()).at(-1)!.segment;
    prior = { ...candidate, id: factId({ machine: 'machine-a', epoch: next.epoch, position: next.position + 1 }),
      reason, previousDelivery, controlObservation };
    return prior as ContextDeliverySpecification;
  };
  return { f, launch: f.launch, make, add: (spec: ContextDeliverySpecification) => value(p.runtime.recordContextDelivery(spec)),
    get written() { return value(p.runtime.inspectCurrent()).filter((r: any) => r.record.type === 'HarnessObservation').map((r: any) => r.record); },
    events, driver };
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
  value<any>(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
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
