import { expect, it } from 'vitest';
import {
  createClaudeCodeHarnessAdapter,
  createMemoryHarnessAdapterStateStore,
  restoreRuntimeHandleHolder,
} from '../../src/harness-adapters/index.js';
import { refused, value } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { adapterFixture } from '../harness-adapters/fixture.js';

it('P13-NF-24 P13-NF-25 P13-NF-28 local handle snapshot restart refuses blind fallback without claiming Eight retry behavior', () => {
  const seed = adapterFixture('claude-code');
  value(seed.package.adapter.launch(seed.spec, 'operation:launch', 'claim:launch'));
  const snapshot = value(seed.handles.snapshot('snapshot:after-launch', 30));
  const durableBytes = JSON.stringify(snapshot);

  const restoredHandles = restoreRuntimeHandleHolder({ snapshot: JSON.parse(durableBytes), adapter: seed.id,
    machine: 'machine-a', maxHandles: 4, maxAttempts: 16, context: seed.f.c, state: seed.state });
  const restarted = createClaudeCodeHarnessAdapter({
    id: seed.id, artifact: seed.spec.artifactDigest, conformance: 'conformance:claude-code', machine: 'machine-a',
    platform: 'claude-code',
    driver: seed.driver, handles: restoredHandles, context: seed.f.c, clock: () => 50,
    generation: () => 'generation:fixture',
  });
  const accepted = value(restarted.adapter.deliver({ launch: seed.spec.id, intake: seed.spec.input,
    digest: seed.spec.inputDigest, incarnation: seed.spec.incarnation, operation: 'operation:deliver' }));
  expect(accepted.phase).toBe('input-accepted');
  value(seed.f.runtime.record('HarnessObservation', {
    ...assemblyInput('HarnessObservation'), id: 'delivery:1', launch: seed.spec.id, run: seed.spec.run,
    step: seed.spec.step, input: seed.spec.input, incarnation: seed.spec.incarnation,
    phase: 'input-accepted', observedAt: 50,
  }));
  expect(seed.calls).toEqual({ launch: 1, deliver: 1, observe: 0 });

  const secondSnapshot = value(restoredHandles.snapshot('snapshot:after-delivery', 60));
  const resumedHandles = restoreRuntimeHandleHolder({ snapshot: JSON.parse(JSON.stringify(secondSnapshot)), adapter: seed.id,
    machine: 'machine-a', maxHandles: 4, maxAttempts: 16, context: seed.f.c, state: seed.state });
  const resumed = createClaudeCodeHarnessAdapter({
    id: seed.id, artifact: seed.spec.artifactDigest, conformance: 'conformance:claude-code', machine: 'machine-a',
    platform: 'claude-code',
    driver: seed.driver, handles: resumedHandles, context: seed.f.c, clock: () => 70,
    generation: () => 'generation:fixture',
  });
  expect(value(resumed.adapter.observe({ launch: seed.spec.id, delivery: 'delivery:1', operation: 'operation:observe' })).phase)
    .toBe('output-observed');
  expect(seed.calls).toEqual({ launch: 1, deliver: 1, observe: 1 });

  expect(() => restoreRuntimeHandleHolder({ snapshot: { ...secondSnapshot, handles: undefined }, adapter: seed.id,
    machine: 'machine-a', maxHandles: 4, maxAttempts: 16, context: seed.f.c,
    state: createMemoryHarnessAdapterStateStore('bad-snapshot') })).toThrow(/custody unknown/);
  const empty = restoreRuntimeHandleHolder({ snapshot: { ...secondSnapshot, id: 'snapshot:empty', handles: [] }, adapter: seed.id,
    machine: 'machine-a', maxHandles: 4, maxAttempts: 16, context: seed.f.c,
    state: createMemoryHarnessAdapterStateStore('empty-snapshot') });
  const withoutCustody = createClaudeCodeHarnessAdapter({
    id: seed.id, artifact: seed.spec.artifactDigest, conformance: 'conformance:claude-code', machine: 'machine-a',
    platform: 'claude-code',
    driver: seed.driver, handles: empty, context: seed.f.c, clock: () => 80, generation: () => 'generation:fixture',
  });
  refused(withoutCustody.adapter.observe({ launch: seed.spec.id, delivery: 'delivery:1', operation: 'operation:blind' }),
    'blind fallback');
  expect(seed.calls.launch).toBe(1);
});
