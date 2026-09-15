import { expect, it } from 'vitest';
import { decodeHarnessValidationFloor } from '../../src/harness-adapters/index.js';
import type { HarnessAdapterStateSnapshot } from '../../src/harness-adapters/contracts.js';
import {
  createMemoryHarnessAdapterStateStore,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import { value } from '../facts/fixtures.js';
import { round9PoisonPrefixFixture } from './a2-round9-fixture.js';

const SUBJECT_FIELDS = [
  'adapter',
  'artifact',
  'platform',
  'machine',
  'launch',
  'incarnation',
  'processIdentity',
] as const;

function changedValue(field: typeof SUBJECT_FIELDS[number], current: unknown): string {
  return field === 'artifact' ? `sha256:${'1'.repeat(64)}` : `foreign:${String(current)}`;
}

it('A2-UNIT R12-F1-RETAINED-CANDIDATE P13-NF-24 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 contradictory retained confirmations cannot disappear with the local poison event', () => {
  let scenarios = 0;
  for (const field of SUBJECT_FIELDS) {
    const seed = round9PoisonPrefixFixture();
    const loaded = seed.eventState.load() as HarnessAdapterStateSnapshot;
    const snapshot = { ...structuredClone(loaded),
      events: loaded.events.filter(event => event.id !== seed.poison.id) };
    const store = createMemoryHarnessAdapterStateStore(`r12:retained-candidate:${field}`);
    store.save(null, snapshot);
    for (const candidate of seed.eventState.loadPoisonCandidates()) store.appendPoisonCandidate(candidate as never);
    const original = seed.eventState.loadValidationFloors()[0] as Record<string, unknown>;
    store.appendValidationFloor(value(decodeHarnessValidationFloor({
      ...original,
      [field]: changedValue(field, original[field]),
    })));

    const evidence = seed.holder(store, seed.freshNine(seed.planPrefix));
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
}, 30_000);

it('A2-UNIT R12-F1-RETAINED-CANDIDATE-CONTROLS P13-NF-28 P13-NF-38 P13-NF-51 unchanged confirmation retains uncertainty for an older prefix and poison for full history', () => {
  const seed = round9PoisonPrefixFixture();
  const loaded = seed.eventState.load() as HarnessAdapterStateSnapshot;
  const snapshot = { ...structuredClone(loaded),
    events: loaded.events.filter(event => event.id !== seed.poison.id) };
  const store = createMemoryHarnessAdapterStateStore('r12:retained-candidate:controls');
  store.save(null, snapshot);
  for (const candidate of seed.eventState.loadPoisonCandidates()) store.appendPoisonCandidate(candidate as never);
  for (const floor of seed.eventState.loadValidationFloors()) store.appendValidationFloor(floor as never);

  expect(seed.holder(store, seed.freshNine(seed.planPrefix)).resume(seed.handle, 22))
    .toMatchObject({ state: 'unknown' });
  expect(seed.holder(store, seed.freshNine(seed.fullNine)).resume(seed.handle, 22))
    .toMatchObject({ state: 'poisoned' });
});
