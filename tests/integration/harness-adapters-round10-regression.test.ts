import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { HarnessValidationFloor } from '../../src/harness-adapters/index.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { round9PoisonPrefixFixture } from '../harness-adapters/a2-round9-fixture.js';

it('A2-INTEGRATION R10-F4 P13-NF-01 P13-NF-28 P13-NF-51 exact confirmed-event replay stays duplicate while first confirmation remains immutable', () => {
  let scenarios = 0;
  for (const backend of ['memory', 'file'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r10-duplicate-${backend}-`));
    const state = backend === 'file'
      ? createHarnessAdapterFileState(join(directory, 'events')) as HarnessEvidenceStateStorePort
      : undefined;
    const fixture = round9PoisonPrefixFixture(state ? { eventState: state } : {});
    expect(fixture.evidence.resume(fixture.handle, 22)).toMatchObject({ state: 'poisoned' });
    expect(fixture.evidence.admit(fixture.poison)).toMatchObject({ disposition: 'duplicate' });

    fixture.ten.owner.time(23);
    expect(fixture.evidence.admit(fixture.poison)).toMatchObject({ disposition: 'duplicate' });
    const currentNine = fixture.freshNine(fixture.fullNine);
    currentNine.time(23);
    const reconstructed = fixture.holder(fixture.eventState, currentNine);
    expect(reconstructed.admit(fixture.poison)).toMatchObject({ disposition: 'duplicate' });
    expect(reconstructed.resume(fixture.handle, 23)).toMatchObject({ state: 'poisoned' });
    expect(fixture.eventState.loadValidationFloors()).toEqual([
      expect.objectContaining({ confirmedAt: 22 }),
    ]);
    scenarios++;
  }
  expect(scenarios).toBe(2);
});

it('A2-INTEGRATION R10-F3 P13-NF-01 P13-NF-28 P13-NF-38 P13-NF-51 file custody refuses every malformed validation-floor field and boundary before persistence', () => {
  const fixture = round9PoisonPrefixFixture();
  const floor = fixture.eventState.loadValidationFloors()[0] as HarnessValidationFloor;
  let scenarios = 0;
  const refuse = (candidate: unknown, label: string) => {
    const directory = mkdtempSync(join(tmpdir(), 'p13-a2-r10-floor-refusal-'));
    const store = createHarnessAdapterFileState(join(directory, 'events')) as HarnessEvidenceStateStorePort;
    expect(() => store.appendValidationFloor(candidate as HarnessValidationFloor), label).toThrow();
    expect(store.loadValidationFloors(), label).toEqual([]);
    scenarios++;
  };

  for (const field of Object.keys(floor)) {
    for (const mode of ['missing', 'wrong-type', 'extra'] as const) {
      const malformed: Record<string, unknown> = { ...floor };
      if (mode === 'missing') delete malformed[field];
      if (mode === 'wrong-type') malformed[field] = typeof malformed[field] === 'string' ? 123 : 'wrong';
      if (mode === 'extra') malformed.extra = true;
      refuse(malformed, `${field}/${mode}`);
    }
  }
  for (const [field, invalid] of [
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, Number.NaN]
      .map(value => ['schemaVersion', value] as const),
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, Number.NaN]
      .map(value => ['confirmedAt', value] as const),
    ['schemaVersion', 2] as const,
    ['type', 'AnotherRecord'] as const,
    ['purpose', 'AnotherPurpose'] as const,
    ['artifact', 'sha256:bad'] as const,
    ['eventHash', 'sha256:bad'] as const,
  ]) refuse({ ...floor, [field]: invalid }, `${field}/${String(invalid)}`);

  expect(scenarios).toBe(87);
});
