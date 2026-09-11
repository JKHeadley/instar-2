import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { HarnessObservation } from '../../src/assembly/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { refused, value } from '../facts/fixtures.js';
import { adapterFixture, digest } from '../harness-adapters/fixture.js';

function deliveryObservation(h: ReturnType<typeof adapterFixture>, id = 'delivery:1') {
  return value(h.f.runtime.record('HarnessObservation', {
    ...assemblyInput('HarnessObservation'), id, launch: h.spec.id, run: h.spec.run, step: h.spec.step,
    input: h.spec.input, incarnation: h.spec.incarnation, phase: 'input-accepted', observedAt: 20,
  })) as HarnessObservation;
}

for (const platform of ['claude-code', 'codex'] as const) describe(`${platform} shared harness contract`, () => {
  it('P13-NF-03 P13-NF-05 P13-NF-06 P13-NF-08 LOCAL-BOUNDARY-ARM exposes one advisory four-method port without claiming an Eight effect', () => {
    const h = adapterFixture(platform);
    expect(h.package).toMatchObject({ owner: 'part-thirteen', family: 'session-harness' });
    expect(h.package.adapter.owner).toBe('part-ten');
    expect(h.package.adapter.describe()).toEqual({
      artifact: digest('4'), platform, contextModes: ['advisory'], outputModes: ['framed'],
      interruptionModes: [], custodyModes: ['machine-local-scoped-handles'],
      observationModes: ['instrumented-boundary'], conformance: `conformance:${platform}`,
    });
    refused(h.package.adapter.launch({ ...h.spec, artifactDigest: digest('f') } as typeof h.spec,
      'operation:launch', 'claim:launch'), 'another exact adapter artifact');
    expect(h.calls.launch).toBe(0);
  });

  it('P13-NF-15 LOCAL-BOUNDARY-ARM retains the driver-returned process identity without claiming process-origin conformance', () => {
    const h = adapterFixture(platform);
    const launched = value(h.package.adapter.launch(h.spec, 'operation:launch', 'claim:launch'));
    expect(launched.phase).toBe('launched');
    expect(launched.boundaryEvidence).toBe('process:1');
    expect(h.calls.launch).toBe(1);
    expect(h.handles.lookup(h.spec.id).handle).toMatchObject({
      processIdentity: 'process:1', launchOperation: 'operation:launch', launchClaim: 'claim:launch',
      incarnation: h.spec.incarnation, artifactDigest: h.spec.artifactDigest,
    });
    const repeated = value(h.package.adapter.launch(h.spec, 'operation:launch', 'claim:launch'));
    expect(repeated.phase).toBe('uncertain');
    expect(repeated.detail).toContain('observe the original attempt');
    expect(h.calls.launch).toBe(1);
  });

  it('P13-BOUNDARY-DELIVERY delivers only the landed immutable input and never conflates acceptance with consumption', () => {
    const h = adapterFixture(platform);
    value(h.package.adapter.launch(h.spec, 'operation:launch', 'claim:launch'));
    const accepted = value(h.package.adapter.deliver({ launch: h.spec.id, intake: h.spec.input,
      digest: h.spec.inputDigest, incarnation: h.spec.incarnation, operation: 'operation:deliver' }));
    expect(accepted.phase).toBe('input-accepted');
    expect(h.calls.deliver).toBe(1);
    refused(h.package.adapter.deliver({ launch: h.spec.id, intake: 'intake:later',
      digest: digest('d'), incarnation: h.spec.incarnation, operation: 'operation:later' }), 'immutable original launch input');
    refused(h.package.adapter.deliver({ launch: h.spec.id, intake: h.spec.input,
      digest: h.spec.inputDigest, incarnation: 'incarnation:stale', operation: 'operation:stale' }), 'stale process incarnation');
    expect(h.calls.deliver).toBe(1);
  });

  it('P13-NF-30 P13-NF-32 observation rejects terminal appearance and accepts only exact signed Ten consumption evidence', () => {
    const h = adapterFixture(platform);
    value(h.package.adapter.launch(h.spec, 'operation:launch', 'claim:launch'));
    const delivery = deliveryObservation(h);
    h.observeAs('context-consumed', 'prompt:disappeared');
    refused(h.package.adapter.observe({ launch: h.spec.id, delivery: delivery.id, operation: 'operation:observe' }),
      'terminal appearance');

    const source = value(h.f.runtime.record('HarnessObservation', {
      ...assemblyInput('HarnessObservation'), id: 'model-context:exact', launch: h.spec.id,
      run: h.spec.run, step: h.spec.step, input: h.spec.input, incarnation: h.spec.incarnation,
      sourceEvidence: ['provider:model-request:1'], boundaryEvidence: 'provider:model-request:1',
      contextDigests: h.spec.contextManifest.map(row => row.digest), generation: 'generation:fixture',
      phase: 'context-consumed', observedAt: 20,
    })) as HarnessObservation;
    h.observeAs('context-consumed', source.id);
    const consumed = value(h.package.adapter.observe({ launch: h.spec.id, delivery: delivery.id, operation: 'operation:observe:2' }));
    expect(consumed).toEqual(source);
  });
});

it('P13-BOUNDARY-TUPLE adapter families share semantics without borrowing another tuple result', () => {
  const observations: HarnessObservation[] = [];
  for (const platform of ['claude-code', 'codex', 'future'] as const) {
    const h = adapterFixture(platform);
    observations.push(value(h.package.adapter.launch(h.spec, 'operation:launch', `claim:${platform}`)));
  }
  expect(observations.map(row => row.phase)).toEqual(['launched', 'launched', 'launched']);
  expect(observations[0]!.boundaryEvidence).toBe('process:1');
  expect(observations[1]!.boundaryEvidence).toBe('process:1');
  expect(observations[2]!.boundaryEvidence).toBe('process:1');
  expect(consumeResult).toBeTypeOf('function');
});
