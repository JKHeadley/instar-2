import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { witnessedEvent } from './fixture.js';
import { round9PoisonPrefixFixture } from './a2-round9-fixture.js';

const MUTATIONS = [
  'stable',
  'failed-probe',
  'process-exit',
  'verification-witness-loss',
  'clock-advance',
  'journal-EIO',
] as const;

it('A2-UNIT R14-F1-FINAL-FRONTIER P13-NF-25 P13-NF-29 P13-NF-38 reconnect is monotone across all final Six owner-read mutations', () => {
  let scenarios = 0;
  for (const phase of ['inspect', 'admitWrite'] as const) {
    for (const mutation of MUTATIONS) {
      const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
      const nine = fixture.freshNine(fixture.fullNine);
      let journalUnreadable = false;
      let reads = 0;
      let writes = 0;
      const state: HarnessEvidenceStateStorePort = Object.freeze({
        ...fixture.eventState,
        load() {
          if (journalUnreadable) throw new Error('EIO current journal');
          return fixture.eventState.load();
        },
      });
      const evidence = fixture.holder(state, nine);
      const mutate = () => {
        if (mutation === 'failed-probe' || mutation === 'process-exit') {
          fixture.evidence.admit(witnessedEvent(fixture.ten,
            mutation === 'failed-probe' ? 'probe-failed' : 'process-exited', {
              id: `r14:final:${phase}:${mutation}`,
              sourceEvidence: [`r14:final:observation:${phase}:${mutation}`],
              launch: fixture.handle.launch,
              incarnation: fixture.handle.incarnation,
              sourceClock: 22,
              observedAt: 22,
              streamState: 'closed',
            }));
        }
        if (mutation === 'verification-witness-loss') nine.setEvidence([]);
        if (mutation === 'clock-advance') fixture.ten.owner.time(23);
        if (mutation === 'journal-EIO') journalUnreadable = true;
      };
      const authority = {
        ...fixture.six.api,
        inspect() {
          reads++;
          if (reads === 2 && phase === 'inspect') mutate();
          return fixture.six.api.inspect();
        },
        admitWrite(...args: Parameters<typeof fixture.six.api.admitWrite>) {
          writes++;
          if (writes === 2 && phase === 'admitWrite') mutate();
          return fixture.six.api.admitWrite(...args);
        },
      };
      const decision = sameMachineReconnectCandidate({
        launch: fixture.handle.launch,
        machine: fixture.handle.machine,
        incarnation: fixture.handle.incarnation,
        fence: fixture.fence,
        now: 22,
        evidence,
        authority,
      }, fixture.handles);
      expect(decision, `${phase}/${mutation}`).toMatchObject({
        disposition: mutation === 'stable' ? 'reconnect' : 'refused',
        handle: mutation === 'stable' ? fixture.handle : null,
      });
      scenarios++;
    }
  }
  expect(scenarios).toBe(12);
}, 60_000);

it('A2-UNIT R14-F2-INVALID-LEGACY P13-NF-24 P13-NF-28 P13-NF-46 existing JSON null refuses instead of becoming empty custody', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-r14-null-'));
  const target = join(directory, 'journal.json');
  writeFileSync(target, 'null');
  expect(() => createHarnessAdapterFileState(target).load())
    .toThrow('versioned input must be an object');
});
