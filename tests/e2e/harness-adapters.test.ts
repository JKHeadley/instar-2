import { expect, it } from 'vitest';
import {
  createClaudeCodeHarnessAdapter,
  restoreRuntimeHandleHolder,
} from '../../src/harness-adapters/index.js';
import { refused, value } from '../facts/fixtures.js';
import { adapterFixture } from '../harness-adapters/fixture.js';

it('P13-NF-24 P13-NF-25 P13-NF-28 P13-NF-39 durable restart cuts restore the exact local handle and never relaunch or blind-repeat', () => {
  const seed = adapterFixture('claude-code');
  value(seed.package.adapter.launch(seed.spec, 'operation:launch', 'claim:launch'));
  const snapshot = value(seed.handles.snapshot('snapshot:after-launch', 30));
  const durableBytes = JSON.stringify(snapshot);

  const restoredHandles = restoreRuntimeHandleHolder({ snapshot: JSON.parse(durableBytes), adapter: seed.id,
    machine: 'machine-a', maxHandles: 4, context: seed.f.c });
  const restarted = createClaudeCodeHarnessAdapter({
    id: seed.id, artifact: seed.spec.artifactDigest, conformance: 'conformance:claude-code', machine: 'machine-a',
    driver: seed.driver, handles: restoredHandles, context: seed.f.c, clock: () => 50,
    generation: () => 'generation:fixture',
  });
  const accepted = value(restarted.adapter.deliver({ launch: seed.spec.id, intake: seed.spec.input,
    digest: seed.spec.inputDigest, incarnation: seed.spec.incarnation, operation: 'operation:deliver' }));
  expect(accepted.phase).toBe('input-accepted');
  expect(seed.calls).toEqual({ launch: 1, deliver: 1, observe: 0 });

  const secondSnapshot = value(restoredHandles.snapshot('snapshot:after-delivery', 60));
  const resumedHandles = restoreRuntimeHandleHolder({ snapshot: JSON.parse(JSON.stringify(secondSnapshot)), adapter: seed.id,
    machine: 'machine-a', maxHandles: 4, context: seed.f.c });
  const resumed = createClaudeCodeHarnessAdapter({
    id: seed.id, artifact: seed.spec.artifactDigest, conformance: 'conformance:claude-code', machine: 'machine-a',
    driver: seed.driver, handles: resumedHandles, context: seed.f.c, clock: () => 70,
    generation: () => 'generation:fixture',
  });
  expect(value(resumed.adapter.observe({ launch: seed.spec.id, delivery: 'delivery:1', operation: 'operation:observe' })).phase)
    .toBe('output-observed');
  expect(seed.calls).toEqual({ launch: 1, deliver: 1, observe: 1 });

  expect(() => restoreRuntimeHandleHolder({ snapshot: { ...secondSnapshot, handles: undefined }, adapter: seed.id,
    machine: 'machine-a', maxHandles: 4, context: seed.f.c })).toThrow(/custody unknown/);
  const empty = restoreRuntimeHandleHolder({ snapshot: { ...secondSnapshot, id: 'snapshot:empty', handles: [] }, adapter: seed.id,
    machine: 'machine-a', maxHandles: 4, context: seed.f.c });
  const withoutCustody = createClaudeCodeHarnessAdapter({
    id: seed.id, artifact: seed.spec.artifactDigest, conformance: 'conformance:claude-code', machine: 'machine-a',
    driver: seed.driver, handles: empty, context: seed.f.c, clock: () => 80, generation: () => 'generation:fixture',
  });
  refused(withoutCustody.adapter.observe({ launch: seed.spec.id, delivery: 'delivery:1', operation: 'operation:blind' }),
    'blind fallback');
  expect(seed.calls.launch).toBe(1);
});
