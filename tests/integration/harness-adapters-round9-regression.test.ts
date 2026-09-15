import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { round9PoisonPrefixFixture } from '../harness-adapters/a2-round9-fixture.js';

it('A2-INTEGRATION A2-R7-01 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 reconstructed Part Two custody retains the confirmed-poison validation floor across older Nine prefixes', () => {
  let scenarios = 0;
  for (const mode of ['full', 'probe-prefix', 'plan-prefix'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r9-${mode}-`));
    const path = join(directory, 'events.json');
    const fixture = round9PoisonPrefixFixture({ eventState: createHarnessAdapterFileState(path) });
    const nine = fixture.freshNine(mode === 'full' ? fixture.fullNine
      : mode === 'probe-prefix' ? fixture.probePrefix : fixture.planPrefix);
    const holder = fixture.holder(createHarnessAdapterFileState(path), nine);
    expect(holder.resume(fixture.handle, 22), mode).toMatchObject({
      state: mode === 'full' ? 'poisoned' : 'unknown',
    });
    expect(sameMachineReconnectCandidate({
      launch: fixture.handle.launch,
      machine: fixture.handle.machine,
      incarnation: fixture.handle.incarnation,
      fence: fixture.fence,
      now: 22,
      evidence: holder,
      authority: fixture.six.api,
    }, fixture.handles), mode).toMatchObject({ disposition: 'refused', handle: null });
    scenarios++;
  }

  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-r9-never-confirmed-'));
  const path = join(directory, 'events.json');
  const neighbor = round9PoisonPrefixFixture({
    confirmPoison: false,
    eventState: createHarnessAdapterFileState(path),
  });
  expect(neighbor.holder(createHarnessAdapterFileState(path), neighbor.freshNine(neighbor.fullNine))
    .resume(neighbor.handle, 22)).toMatchObject({ state: 'eligible' });
  scenarios++;
  expect(scenarios).toBe(4);
}, 30_000);
