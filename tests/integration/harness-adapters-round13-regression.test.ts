import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import type { HarnessAdapterStateSnapshot } from '../../src/harness-adapters/contracts.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { witnessedEvent } from '../harness-adapters/fixture.js';
import { round9PoisonPrefixFixture } from '../harness-adapters/a2-round9-fixture.js';

it('A2-INTEGRATION R13-F1-JOINT-RECONNECT P13-NF-25 P13-NF-29 P13-NF-38 file-backed owner views refuse release, expiry, and probe failure during reconnect reads', () => {
  let scenarios = 0;
  for (const invalidation of ['release', 'expiry', 'probe-failed'] as const) {
    const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r13-${invalidation}-`));
    const retained = createHarnessAdapterFileState(join(directory, 'events')) as HarnessEvidenceStateStorePort;
    retained.save(null, fixture.eventState.load() as HarnessAdapterStateSnapshot);
    for (const floor of fixture.eventState.loadValidationFloors()) retained.appendValidationFloor(floor as never);
    for (const candidate of fixture.eventState.loadPoisonCandidates()) retained.appendPoisonCandidate(candidate as never);
    const peer = fixture.holder(retained, fixture.freshNine(fixture.fullNine));
    let reads = 0;
    const state: HarnessEvidenceStateStorePort = Object.freeze({
      ...retained,
      load() {
        reads++;
        if (reads === 2) {
          if (invalidation === 'release') fixture.six.api.release('r13:integration:release', fixture.fence);
          if (invalidation === 'expiry') fixture.six.advance(501);
          if (invalidation === 'probe-failed') {
            peer.admit(witnessedEvent(fixture.ten, 'probe-failed', {
              id: 'r13:integration:failed',
              sourceEvidence: ['r13:integration:failed-observation'],
              launch: fixture.handle.launch,
              incarnation: fixture.handle.incarnation,
              sourceClock: 22,
              observedAt: 22,
              streamState: 'closed',
            }));
          }
        }
        return retained.load();
      },
    });
    const evidence = fixture.holder(state, fixture.freshNine(fixture.fullNine));
    expect(sameMachineReconnectCandidate({
      launch: fixture.handle.launch,
      machine: fixture.handle.machine,
      incarnation: fixture.handle.incarnation,
      fence: fixture.fence,
      now: 22,
      evidence,
      authority: fixture.six.api,
    }, fixture.handles), invalidation).toMatchObject({ disposition: 'refused', handle: null });
    scenarios++;
  }
  expect(scenarios).toBe(3);
}, 60_000);

it('A2-INTEGRATION R13-F1-JOINT-RECONNECT-CONTROL P13-NF-25 P13-NF-29 P13-NF-38 stable file-backed evidence still reconnects', () => {
  const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-r13-control-'));
  const state = createHarnessAdapterFileState(join(directory, 'events')) as HarnessEvidenceStateStorePort;
  state.save(null, fixture.eventState.load() as HarnessAdapterStateSnapshot);
  const evidence = fixture.holder(state, fixture.freshNine(fixture.fullNine));
  expect(sameMachineReconnectCandidate({
    launch: fixture.handle.launch,
    machine: fixture.handle.machine,
    incarnation: fixture.handle.incarnation,
    fence: fixture.fence,
    now: 22,
    evidence,
    authority: fixture.six.api,
  }, fixture.handles)).toMatchObject({ disposition: 'reconnect', handle: fixture.handle });
});
