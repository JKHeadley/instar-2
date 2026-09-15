import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { refused, value } from '../intake/fixtures.js';
// @ts-expect-error The production restart acceptance boundary is executable JavaScript by design.
import { bootProductionSliceAssembly, sliceConfig } from '../../scripts/slice-assembly.mjs';

it('R6-F4 V39/V40 restart lifecycle cuts real dependency admission until matching recovery', () => {
  const boot = bootProductionSliceAssembly({ home: mkdtempSync(join(tmpdir(), 'p11-r6-lifecycle-')),
    config: sliceConfig({ profile: 'reply' }), restartRecovery: true });
  const coordinator = boot.coordinator;
  const route = coordinator.references.find((row: { name: string }) => row.name === 'dependency:route');
  const input = { name: 'route', fact: route.fact, completeness: route.completeness, missing: route.missing };
  expect((value(coordinator.handles.dependencyAdmission.admit(input)) as { current: boolean }).current).toBe(true);
  value(coordinator.handles.lifecycle.cut('route'));
  refused(coordinator.handles.dependencyAdmission.admit(input), 'cut');
  value(coordinator.handles.lifecycle.recover('route'));
  expect((value(coordinator.handles.dependencyAdmission.admit(input)) as { current: boolean }).current).toBe(true);
}, 120_000);
