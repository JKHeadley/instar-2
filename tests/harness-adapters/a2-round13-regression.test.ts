import { expect, it } from 'vitest';
import { sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
import { witnessedEvent } from './fixture.js';
import { round9PoisonPrefixFixture } from './a2-round9-fixture.js';

const INVALIDATIONS = ['release', 'expiry', 'probe-failed'] as const;

it('A2-UNIT R13-F1-JOINT-RECONNECT P13-NF-25 P13-NF-29 P13-NF-38 reconnect is monotone across every evidence-read invalidation boundary', () => {
  let scenarios = 0;
  for (const invalidation of INVALIDATIONS) {
    for (const invalidateAtRead of [1, 2, 3]) {
      const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
      let reads = 0;
      let invalidated = false;
      const state: HarnessEvidenceStateStorePort = Object.freeze({
        ...fixture.eventState,
        load() {
          reads++;
          if (!invalidated && reads === invalidateAtRead) {
            invalidated = true;
            if (invalidation === 'release') fixture.six.api.release('r13:release', fixture.fence);
            if (invalidation === 'expiry') fixture.six.advance(501);
            if (invalidation === 'probe-failed') {
              fixture.evidence.admit(witnessedEvent(fixture.ten, 'probe-failed', {
                id: `r13:failed:${invalidateAtRead}`,
                sourceEvidence: [`r13:observation:failed:${invalidateAtRead}`],
                launch: fixture.handle.launch,
                incarnation: fixture.handle.incarnation,
                sourceClock: 22,
                observedAt: 22,
                streamState: 'closed',
              }));
            }
          }
          return fixture.eventState.load();
        },
      });
      const evidence = fixture.holder(state, fixture.freshNine(fixture.fullNine));
      const decision = sameMachineReconnectCandidate({
        launch: fixture.handle.launch,
        machine: fixture.handle.machine,
        incarnation: fixture.handle.incarnation,
        fence: fixture.fence,
        now: 22,
        evidence,
        authority: fixture.six.api,
      }, fixture.handles);
      expect(invalidated, `${invalidation}/read-${invalidateAtRead}`).toBe(true);
      expect(decision, `${invalidation}/read-${invalidateAtRead}`)
        .toMatchObject({ disposition: 'refused', handle: null });
      scenarios++;
    }
  }

  const control = round9PoisonPrefixFixture({ confirmPoison: false });
  expect(sameMachineReconnectCandidate({
    launch: control.handle.launch,
    machine: control.handle.machine,
    incarnation: control.handle.incarnation,
    fence: control.fence,
    now: 22,
    evidence: control.evidence,
    authority: control.six.api,
  }, control.handles)).toMatchObject({ disposition: 'reconnect', handle: control.handle });
  scenarios++;

  expect(scenarios).toBe(10);
}, 60_000);

it('A2-UNIT R13-F1-CROSSED-RECONNECT P13-NF-25 P13-NF-29 P13-NF-38 a later live heartbeat cannot combine with an already released fence', () => {
  const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
  fixture.evidence.admit(witnessedEvent(fixture.ten, 'probe-failed', {
    id: 'r13:crossed:failed',
    sourceEvidence: ['r13:crossed:failed-observation'],
    launch: fixture.handle.launch,
    incarnation: fixture.handle.incarnation,
    sourceClock: 21,
    observedAt: 21,
    streamState: 'closed',
  }));
  let armed = true;
  const state: HarnessEvidenceStateStorePort = Object.freeze({
    ...fixture.eventState,
    load() {
      if (armed) {
        armed = false;
        fixture.six.api.release('r13:crossed:release', fixture.fence);
        fixture.evidence.admit(witnessedEvent(fixture.ten, 'heartbeat', {
          id: 'r13:crossed:recovered',
          sourceEvidence: ['r13:crossed:live-observation'],
          launch: fixture.handle.launch,
          incarnation: fixture.handle.incarnation,
          sourceClock: 22,
          observedAt: 22,
          streamState: 'closed',
        }));
      }
      return fixture.eventState.load();
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
  }, fixture.handles)).toMatchObject({ disposition: 'refused', handle: null });
  expect(evidence.liveness(fixture.handle, 22)).toMatchObject({ state: 'live' });
  expect(fixture.six.api.admitWrite('r13:crossed:after', fixture.fence).kind).toBe('Refused');
});
