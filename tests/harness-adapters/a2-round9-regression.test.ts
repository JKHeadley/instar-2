import { expect, it } from 'vitest';
import { sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import { round9PoisonPrefixFixture, withoutPoisonJournal } from './a2-round9-fixture.js';

it('A2-UNIT A2-R7-01-MONOTONICITY P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 losing confirmed poison evidence never makes the conversation reconnect-eligible', () => {
  const losses = [
    {
      id: 'older-nine-probe-prefix',
      apply: (fixture: ReturnType<typeof round9PoisonPrefixFixture>) =>
        fixture.holder(fixture.eventState, fixture.freshNine(fixture.probePrefix)),
    },
    {
      id: 'older-nine-plan-and-probe-prefix',
      apply: (fixture: ReturnType<typeof round9PoisonPrefixFixture>) =>
        fixture.holder(fixture.eventState, fixture.freshNine(fixture.planPrefix)),
    },
    {
      id: 'older-ten-observation-prefix',
      apply(fixture: ReturnType<typeof round9PoisonPrefixFixture>) {
        fixture.ten.owner.raw.splice(0, fixture.ten.owner.raw.length, ...fixture.tenPrefix);
        return fixture.holder(fixture.eventState, fixture.freshNine(fixture.fullNine));
      },
    },
    {
      id: 'missing-local-poison-journal-event',
      apply: (fixture: ReturnType<typeof round9PoisonPrefixFixture>) => fixture.holder(
        withoutPoisonJournal(fixture.eventState, fixture.poison), fixture.freshNine(fixture.fullNine)),
    },
    {
      id: 'missing-nine-poison-witness',
      apply: (fixture: ReturnType<typeof round9PoisonPrefixFixture>) => fixture.holder(
        fixture.eventState,
        fixture.freshNine(fixture.fullNine,
          fixture.nineEvidence.filter(row => row.id !== 'r9:evidence:transcript-poison')),
      ),
    },
  ] as const;

  let scenarios = 0;
  for (const loss of losses) {
    const fixture = round9PoisonPrefixFixture();
    expect(fixture.evidence.resume(fixture.handle, 22), `${loss.id}: full-history control`)
      .toMatchObject({ state: 'poisoned' });
    const holder = loss.apply(fixture);
    const resume = holder.resume(fixture.handle, 22);
    expect(resume.state === 'eligible', loss.id).toBe(false);
    expect(sameMachineReconnectCandidate({
      launch: fixture.handle.launch,
      machine: fixture.handle.machine,
      incarnation: fixture.handle.incarnation,
      fence: fixture.fence,
      now: 22,
      evidence: holder,
      authority: fixture.six.api,
    }, fixture.handles), loss.id).toMatchObject({ disposition: 'refused', handle: null });
    scenarios++;
  }
  expect(scenarios).toBe(5);
}, 30_000);

it('A2-UNIT A2-R7-01-NEIGHBOR P13-NF-38 P13-NF-51 a poison plan that never earned a successful probe does not veto later compatibility', () => {
  const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
  expect(fixture.evidence.resume(fixture.handle, 22)).toMatchObject({ state: 'eligible' });
  expect(fixture.holder(fixture.eventState, fixture.freshNine(fixture.fullNine))
    .resume(fixture.handle, 22)).toMatchObject({ state: 'eligible' });
});
