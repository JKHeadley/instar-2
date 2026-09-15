import { expect, it } from 'vitest';
import { admitTelegramAdapter } from '../../src/conversation/index.js';
import type { TelegramBotApiCustodianPort } from '../../src/conversation/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import { privateKey } from '../facts/fixtures.js';
import { json, value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';

it('P12-NF-07 P12-NF-46 round14 cold admission accepts a witnessed probe completed during identity', () => {
  const fixture = conversationFixture({ skipInitialAdmission: true });
  const oldProbe = value(fixture.api.identity({ token: fixture.declaration.token,
    apiVersion: fixture.declaration.apiVersion }));
  const prior = value(fixture.admissionDependencies.history.lookup(oldProbe.reference))!;
  const probeRecord = { ...(prior.fact.body as any).record,
    id: 'probe:telegram:get-me:9001:9.2:round14-fresh101',
    attempt: 'attempt:telegram:9001:9.2:round14-fresh101', startedAt: 100, completedAt: 101 };
  let now = 100;
  const samples: number[] = [];
  const api: TelegramBotApiCustodianPort = Object.freeze({ ...fixture.api,
    identity() {
      now = 101;
      value(authorAndAppend({ kind: 'verification-ProbeRecord', schemaVersion: 1,
        machine: fixture.assembly.host.machine, principal: json(fixture.assembly.alice),
        provenance: json(fixture.assembly.alice.provenance), at: json(fixture.assembly.clock(now)),
        body: { record: probeRecord }, required: [],
      }, fixture.assembly.context, fixture.assembly.store, privateKey));
      return fixture.intake.f.success({ ...oldProbe, observedAt: now, reference: probeRecord.id });
    },
  });

  const admission = admitTelegramAdapter(fixture.declaration, { ...fixture.admissionDependencies, api,
    clock: () => { samples.push(now); return fixture.intake.f.clock(now); },
  });

  expect(admission.kind).toBe('Success');
  expect(samples).toEqual([101]);
  if (admission.kind === 'Success') {
    expect(admission.value.probe.reference).toBe(probeRecord.id);
    expect(admission.value.conformance.probes).toEqual([probeRecord.id]);
    expect(admission.value.conformance.testedAt).toBe(101);
  }
});
