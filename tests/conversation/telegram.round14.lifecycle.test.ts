import { expect, it } from 'vitest';
import { admitTelegramAdapter } from '../../src/conversation/index.js';
import type { TelegramBotApiCustodianPort } from '../../src/conversation/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import { privateKey } from '../facts/fixtures.js';
import { json, value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';

it('P12-NF-07 P12-NF-46 round14 readmission uses one post-identity clock for both changing-time neighbors', () => {
  for (const [name, finish, newProbe, expected] of [
    ['expires-during-identity', 150, false, 'Refused'],
    ['new-probe-completes-during-identity', 101, true, 'Success'],
  ] as const) {
    const fixture = conversationFixture();
    const oldProbe = fixture.admitted.probe;
    const before = value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
      row.record.type === 'AdapterConformance').map(row => row.fact.id);
    let now = 100;
    const samples: number[] = [];
    const api: TelegramBotApiCustodianPort = Object.freeze({ ...fixture.api,
      identity(input: Parameters<TelegramBotApiCustodianPort['identity']>[0]) {
        const matched = value(fixture.api.identity(input));
        now = finish;
        if (!newProbe) return fixture.intake.f.success(matched);
        const prior = value(fixture.admissionDependencies.history.lookup(matched.reference))!;
        const probeRecord = { ...(prior.fact.body as any).record,
          id: 'probe:telegram:get-me:9001:9.2:round14-readmission-fresh101',
          attempt: 'attempt:telegram:9001:9.2:round14-readmission-fresh101', startedAt: 100, completedAt: 101 };
        value(authorAndAppend({ kind: 'verification-ProbeRecord', schemaVersion: 1,
          machine: fixture.assembly.host.machine, principal: json(fixture.assembly.alice),
          provenance: json(fixture.assembly.alice.provenance), at: json(fixture.assembly.clock(now)),
          body: { record: probeRecord }, required: [],
        }, fixture.assembly.context, fixture.assembly.store, privateKey));
        return fixture.intake.f.success({ ...matched, observedAt: now, reference: probeRecord.id });
      },
    });

    const admission = admitTelegramAdapter(fixture.declaration, { ...fixture.admissionDependencies, api,
      clock: () => { samples.push(now); return fixture.intake.f.clock(now); },
    });

    expect(admission.kind, name).toBe(expected);
    expect(samples, name).toEqual([finish]);
    const after = value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
      row.record.type === 'AdapterConformance');
    if (newProbe) {
      expect(after.map(row => row.fact.id), name).toHaveLength(before.length + 1);
      expect(admission.kind === 'Success' ? admission.value.conformance.testedAt : null, name).toBe(101);
    } else {
      expect(after.map(row => row.fact.id), name).toEqual(before);
    }
    expect(oldProbe.observedAt).toBe(100);
  }
});
