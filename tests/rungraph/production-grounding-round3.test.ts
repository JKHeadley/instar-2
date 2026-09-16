import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import { registerProductionGroundedGraph } from '../../src/rungraph/index.js';
import { bootProductionAssembly, contextDeliveryIdFor, createAssemblyRuntime, createAssemblySpine } from '../../src/assembly/index.js';
import { privateKey } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { installProduction, productionBindingSet, productionComposition } from '../assembly/production-fixture.js';
import { digest, setup, value, json } from './astra-production-grounding-fixture.js';
import { effectFixture } from './astra-rereview-real-owner-fixture.js';

const result = (r: any): any => consumeResult(r, {
  Success: value => ({ accepted: true, value }) as any,
  Refused: refusal => ({ accepted: false, detail: refusal.detail }) as any,
});

it('R1 F2 kind-labelled substitute schemas do not qualify as owner-admitted evidence', () => {
  const text = { kind: 'text' as const, maxLength: 2048 };
  const f = setup(undefined, undefined, { fields: { intent: { kind: 'constitutional', type: 'Intent' },
    owner: { kind: 'constitutional', type: 'VerifiedPrincipal' }, capture: { kind: 'capture' } }, extra: {
    'effect-OperationDefinition': { id: text },
    'transport-AdmissionReservation': { operation: text, state: text, digest: text, run: text },
    'transport-Lease': { run: text, incarnation: text },
  }, body: ({ intent, owner, hash }) => json({ intent, owner, capture: { reference: 'message:1', hash } }) });
  expect((f.ctx.ownedBodies ?? []).some(row => row.owner === 'part-eight')).toBe(false);
  const spine = createAssemblySpine(f.assemblyHost, { context: f.ctx, privateKey }, f.store);
  const runtime = createAssemblyRuntime({ host: f.assemblyHost, spine } as any);
  const operation = `operation:${digest(['substitute', f.id, 'attempt:1'])}`;
  const claim = f.append('transport-AdmissionReservation', json({ operation, state: 'dispatch-claimed',
    digest: f.ctx.captures['message:1']!.hash, run: f.id })).fact;
  const execution = f.append('transport-Lease', json({ run: f.id, incarnation: 'incarnation:one' })).fact;
  const launch = value(runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'), run: f.id,
    input: f.opening.id, inputDigest: f.ctx.captures['message:1']!.hash, incarnation: 'incarnation:one' }));
  const launchFact = value(runtime.inspect()).find(row => row.record.id === launch.id)!.fact;
  const specification = { type: 'ContextDeliverySpecification', schemaVersion: 1,
    id: contextDeliveryIdFor(launchFact.id, operation), predecessors: [], dependencyFacts: [], launch: launchFact.id,
    run: f.id, step: 'step:substitute', input: f.opening.id, inputDigest: f.ctx.captures['message:1']!.hash,
    incarnation: launch.incarnation, harness: launch.harness, artifactDigest: launch.artifactDigest, machine: launch.machine,
    generation: f.run.generation.id, executionContext: execution.id,
    contextManifest: [{ class: 'message', reference: 'message:1', digest: f.ctx.captures['message:1']!.hash }],
    reason: 'initial', operation, claim: claim.id, previousDelivery: '', controlObservation: '' };
  expect(result(runtime.recordContextDelivery(specification))).toMatchObject({ accepted: false });
});

it('R4 F8 marked production boot refuses a flat graph even after public registration', () => {
  const f = assemblyRuntimeFixture();
  const binding = { ...productionBindingSet(), productionGrounding: { implementation: 'context-delivery-v1' as const } };
  const installed = installProduction(f, binding), base = productionComposition(f, installed.binding), legacy = setup();
  const ready = value(legacy.graph.open(legacy.run));
  expect(value(legacy.graph.ground(legacy.id, 'w', 'h', 'start', legacy.lease)).kind).toBe('session-grounding');
  expect(ready.state).toBe('ready');
  const graph = registerProductionGroundedGraph(legacy.graph);
  const production = { ...base, productionGrounding: { owner: 'part-ten' as const, implementation: 'context-delivery-v1' as const },
    run: { ...base.run, port: graph } };
  expect(result(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, installed.binding.scope)))
    .toMatchObject({ accepted: false });
});

it('R5 F9 contract map refuses named passing titles when the named behavior failed', async () => {
  // @ts-expect-error The contract checker is an executable ESM script.
  const { checkProductionGroundingAssemblyEvidence } = await import('../../scripts/check-assembly-contracts.mjs');
  const rows = [['assembly', 'PG-P10-SIGNED-DELIVERY PG-P10-TYPED-REFUSALS'],
    ['integration', 'PG-INTEGRATION-PRODUCTION-BINDING'], ['e2e', 'PG-E2E-INITIAL-LIVE-REPLAY']];
  const report = { success: true, testResults: rows.map(([tier, name]) => ({
    name: `${process.cwd()}/tests/${tier}/production-grounding.test.ts`,
    assertionResults: [{ fullName: `${name} placeholder`, status: 'passed' }],
  })) };
  expect(() => checkProductionGroundingAssemblyEvidence(report)).toThrow();
});

it('R8 F2 real Six admitted operation identity is accepted as the specification operation', () => {
  const f = effectFixture(), request = f.prepare();
  const reserved: any = value(f.transport.inspect()).filter((row: any) => row.record.type === 'AdmissionReservation').at(-1)!;
  value(f.transport.claim('grounding-claim', f.fence, reserved.record.operation));
  const claim: any = value(f.transport.inspect()).filter((row: any) => row.record.type === 'AdmissionReservation').at(-1)!;
  expect(claim.record.state).toBe('dispatch-claimed');
  const spine = createAssemblySpine(f.assemblyHost, { context: f.ctx, privateKey }, f.store);
  const runtime = createAssemblyRuntime({ host: f.assemblyHost, spine } as any);
  const capture = value(f.host.capture(value(canonical(f.message)).bytes));
  expect(capture.hash).toBe(request.digest);
  const intake = value(authorAndAppend({ kind: 'review-intake', schemaVersion: 1, machine: f.host.machine,
    principal: json(f.host.principal), provenance: json(f.host.principal.provenance), at: json(f.now),
    body: json({ capture }), required: [] }, f.ctx, f.store, privateKey)).fact;
  const launch = value(runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'), run: f.run.id,
    input: intake.id, inputDigest: capture.hash, incarnation: f.host.incarnation }));
  const launchFact = value(runtime.inspect()).find(row => row.record.id === launch.id)!.fact;
  const lease = value(f.transport.inspect()).find((row: any) => row.record.type === 'Lease')!.fact;
  const specification = { type: 'ContextDeliverySpecification', schemaVersion: 1,
    id: contextDeliveryIdFor(launchFact.id, claim.record.operation), predecessors: [], dependencyFacts: [],
    launch: launchFact.id, run: launch.run, step: 'step:actual', input: intake.id, inputDigest: capture.hash,
    incarnation: launch.incarnation, harness: launch.harness, artifactDigest: launch.artifactDigest, machine: launch.machine,
    generation: f.host.current().decode.register.generation.id, executionContext: lease.id,
    contextManifest: [{ class: 'message', reference: capture.reference, digest: capture.hash }], reason: 'initial',
    operation: claim.record.operation, claim: claim.fact.id, previousDelivery: '', controlObservation: '' };
  const actual = result(runtime.recordContextDelivery(specification));
  expect(actual, JSON.stringify(actual)).toMatchObject({ accepted: true });
}, 30_000);
