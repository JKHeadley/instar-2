import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { decodeHarnessValidationFloor } from '../../src/harness-adapters/index.js';
import {
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { value } from '../facts/fixtures.js';
import { round9PoisonPrefixFixture } from '../harness-adapters/a2-round9-fixture.js';

it('A2-INTEGRATION R11-F2-FLOOR-FILE-MISMATCH P13-NF-01 P13-NF-28 P13-NF-38 P13-NF-51 seven contradictory floor subjects refuse reconnect', () => {
  const fixture = round9PoisonPrefixFixture();
  const original = fixture.eventState.loadValidationFloors()[0] as Record<string, unknown>;
  let scenarios = 0;
  for (const field of ['adapter', 'artifact', 'platform', 'machine', 'launch', 'incarnation', 'processIdentity'] as const) {
    const mutated = value(decodeHarnessValidationFloor({ ...original,
      [field]: field === 'artifact' ? `sha256:${'1'.repeat(64)}` : `foreign:${String(original[field])}` }));
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r11-floor-${field}-`));
    const store = createHarnessAdapterFileState(join(directory, 'events')) as HarnessEvidenceStateStorePort;
    store.save(null, fixture.eventState.load() as never);
    store.appendValidationFloor(mutated);

    const holder = fixture.holder(store, fixture.freshNine(fixture.probePrefix));
    expect(holder.resume(fixture.handle, 22), field).toMatchObject({ state: 'unknown' });
    expect(sameMachineReconnectCandidate({
      launch: fixture.handle.launch,
      machine: fixture.handle.machine,
      incarnation: fixture.handle.incarnation,
      fence: fixture.fence,
      now: 22,
      evidence: holder,
      authority: fixture.six.api,
    }, fixture.handles), field).toMatchObject({ disposition: 'refused', handle: null });
    scenarios++;
  }
  expect(scenarios).toBe(7);
}, 60_000);
