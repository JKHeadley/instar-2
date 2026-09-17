import { expect, it } from 'vitest';
import { bootProductionAssembly, createProductionGroundingReader } from '../../src/assembly/index.js';
import { createRunGraph, isProductionGroundedRunGraph } from '../../src/rungraph/index.js';
import { groundedAssemblyRuntimeFixture, genuineProductionComposition, installProduction } from './genuine-production-fixture.js';
import { value, refused } from '../facts/fixtures.js';
it('PG-R4B genuine common-owner production boot and native ground/start', () => {
  const f = groundedAssemblyRuntimeFixture(), installed = installProduction(f), production = genuineProductionComposition(f, installed.binding);
  const coordinator = value(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, installed.binding.scope));
  expect(isProductionGroundedRunGraph(production.run.port, installed.binding.scope)).toBe(true);
  expect(coordinator.handles.run.port).toBe(production.run.port);
  const ready = value(production.run.port.open(f.run));
  const ground = value(production.run.port.ground(f.id, 'w', 'native', 'start', f.lease));
  expect(ground.kind).toBe('session-grounding');
  expect(value(production.run.port.read(f.id)).pending).toHaveLength(0);
  expect(value(production.run.port.transition(f.start(ready, ground))).pending).toHaveLength(1);
  expect(f.owners.events.filter((e: string) => e === 'deliver')).toHaveLength(1);
}, 120000);

import { realTenFixture } from './real-context-delivery-fixture.js';
import { createFactStore } from '../../src/facts/index.js';
it('PG-R4B Six authority restart cannot resurrect or reclaim a consumed context operation', () => {
  const f = realTenFixture(), spec = value<any>(f.runtime.recordContextDelivery(f.spec()));
  value(f.driver.deliver(spec, { operation: spec.operation, claim: spec.claim }));
  const original = value<any[]>(f.effects.transport.inspect()).find(row => row.fact.id === spec.claim)!;
  const store = createFactStore(f.ctx, f.storage);
  f.effects.recreate(store);
  refused(f.effects.transport.claim('restart-claim', f.effects.fence, spec.operation));
  refused(f.effects.transport.consume({ ...original.record }, f.effects.fence));
  const request = value<any[]>(f.effects.api.inspect()).find(row => row.record.type === 'EffectRequest')!.record;
  refused(f.effects.executor.admit(request, f.effects.fence));
  expect(value<any[]>(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
    && row.record.operation === spec.operation).at(-1)!.record.state).toBe('consumed');
  expect(f.calls()).toBe(1);
}, 120000);

it('PG-R4B factory credentials reject composition replacement and foreign store transplants', () => {
  const f = groundedAssemblyRuntimeFixture(), installed = installProduction(f), production = genuineProductionComposition(f, installed.binding);
  const foreign = createFactStore(f.ctx, f.storage);
  refused(bootProductionAssembly({ ...f.composition, spine: { ...f.spine, store: foreign }, production }, installed.manifest.id, installed.binding.scope));
  f.composition.spine = { ...f.spine };
  expect(isProductionGroundedRunGraph(production.run.port, installed.binding.scope)).toBe(false);
  refused(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, installed.binding.scope));
}, 120000);

import { effectFixture } from '../rungraph/production-grounding-adjudication-owner-fixture.js';
import { decodeOutboundMessage } from '../../src/effects/index.js';
it('PG-R4B Eight context delivery revalidates the registered host authority for its own governed feature', () => {
  const f = effectFixture(undefined, 'executor:1', {}, 'context-delivery');
  const current = f.host.current;
  f.host.current = feature => ({ ...current(), authority: feature === 'harness-live-input' ? current().authority : [] });
  const request = f.prepare();
  value(f.api.dispatch(request, f.fence));
  expect(f.calls()).toBe(1);
  expect(value(f.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation').at(-1)!.record).toMatchObject({ state: 'consumed' });
}, 30000);

it('PG-R4B explicit captured input is an Eight context role and cannot decorate an ordinary reply', () => {
  const f = effectFixture(undefined, 'executor:1', {}, 'context-delivery');
  const capture = value(f.host.capture('separately captured inbound bytes'));
  const context = { input: { fact: f.pending.id, ...capture }, manifest: [{ class: 'message', reference: capture.reference, digest: capture.hash }] };
  const message = value(decodeOutboundMessage({ ...f.message, context }, f.host));
  expect(message.context).toEqual(context);
  expect(message.purpose).toBe('context-delivery');
  refused(decodeOutboundMessage({ ...message, purpose: 'ordinary-reply' }, f.host));
  refused(decodeOutboundMessage({ ...message, context: { ...context, input: { ...context.input, fact: 'other-input' } } }, f.host));
}, 30000);
