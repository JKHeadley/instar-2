import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { decodeHarnessValidationFloor } from '../../src/harness-adapters/index.js';
import type { HarnessAdapterStateSnapshot } from '../../src/harness-adapters/contracts.js';
import { sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { value } from '../facts/fixtures.js';
import { round9PoisonPrefixFixture } from '../harness-adapters/a2-round9-fixture.js';

const SUBJECT_FIELDS = [
  'adapter',
  'artifact',
  'platform',
  'machine',
  'launch',
  'incarnation',
  'processIdentity',
] as const;

it('A2-INTEGRATION R12-F1-FILE-RETAINED-CANDIDATE P13-NF-24 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 file-backed confirmation is checked against its retained candidate before subject filtering', () => {
  let scenarios = 0;
  for (const field of SUBJECT_FIELDS) {
    const seed = round9PoisonPrefixFixture();
    const original = seed.eventState.loadValidationFloors()[0] as Record<string, unknown>;
    const snapshot = structuredClone(seed.eventState.load()) as HarnessAdapterStateSnapshot;
    const withoutLocalPoison = { ...snapshot,
      events: snapshot.events.filter(event => event.id !== seed.poison.id) };
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r12-candidate-${field}-`));
    const path = join(directory, 'events');
    const writer = createHarnessAdapterFileState(path) as HarnessEvidenceStateStorePort;
    writer.save(null, withoutLocalPoison as never);
    for (const candidate of seed.eventState.loadPoisonCandidates()) writer.appendPoisonCandidate(candidate as never);
    writer.appendValidationFloor(value(decodeHarnessValidationFloor({
      ...original,
      [field]: field === 'artifact'
        ? `sha256:${'1'.repeat(64)}`
        : `foreign:${String(original[field])}`,
    })));

    const reader = createHarnessAdapterFileState(path) as HarnessEvidenceStateStorePort;
    const evidence = seed.holder(reader, seed.freshNine(seed.planPrefix));
    expect(evidence.resume(seed.handle, 22), field).toMatchObject({ state: 'unknown' });
    expect(sameMachineReconnectCandidate({
      launch: seed.handle.launch,
      machine: seed.handle.machine,
      incarnation: seed.handle.incarnation,
      fence: seed.fence,
      now: 22,
      evidence,
      authority: seed.six.api,
    }, seed.handles), field).toMatchObject({ disposition: 'refused', handle: null });
    scenarios++;
  }
  expect(scenarios).toBe(7);
}, 60_000);
