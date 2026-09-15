import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import {
  admitTelegramAdapter, createTelegramReplyOperationAdapter, extractTelegramUpdate,
  installTelegramReplyOperation,
} from '../../src/conversation/index.js';
import { createEffectDoorway } from '../../src/effects/index.js';
import { privateKey } from '../facts/fixtures.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramOutbound, telegramUpdate, wireTelegram } from './round3-fixture.js';

const asJson = (input: unknown) => JSON.parse(value(canonical(input)).bytes);

it('P12-NF-06 P12-NF-16 P12-NF-18 P12-NF-38 round4 public intake mismatched route must not advance uncaptured provider id', () => {
  const f = conversationFixture({ initialOffset: 100 });
  const wire = wireTelegram(f);
  const raw = telegramUpdate(100);
  f.queue(raw);
  value(wire.ingress.pollOnce());
  const route = { ...extractTelegramUpdate(raw, f.declaration).route, eventId: '101' };
  expect(wire.intake.receive(raw, route).kind).toBe('Refused');
  expect(value(wire.ingress.currentOffset())).toBe(101);
  expect(value(wire.facts.read()).filter(row => row.kind === 'intake-receipt')).toHaveLength(2);
});

it('P12-NF-06 P12-NF-16 P12-NF-18 P12-NF-38 round4 receipt event id does not match captured update', () => {
  const f = conversationFixture({ initialOffset: 100 });
  const wire = wireTelegram(f);
  f.queue(telegramUpdate(100));
  value(wire.ingress.pollOnce());
  const original = value(wire.facts.read()).find(row => row.kind === 'intake-receipt')!;
  const route = JSON.parse(String((original.body as any).ingress));
  route.eventId = '101';
  value(authorAndAppend({ kind: 'intake-receipt', schemaVersion: 1,
    machine: f.intake.deps.author.machine, principal: asJson(f.intake.deps.author.principal),
    provenance: asJson(f.intake.deps.author.provenance), at: asJson(f.intake.f.clock(100)),
    body: { ...(original.body as Record<string, unknown>), ingress: value(canonical(route)).bytes } as any,
    required: [original.id],
  }, f.intake.context, wire.facts, privateKey));
  expect(value(wire.ingress.currentOffset())).toBe(101);
  expect(value(wireTelegram(f).ingress.currentOffset())).toBe(101);
});

it('P12-NF-28 P12-NF-33 P12-NF-38 round4 prepared valid reply remains dispatchable after re-admission', () => {
  const f = telegramOutbound();
  const definition = (value(f.effects.spine.store.read()).find(row => row.kind === 'effect-OperationDefinition'
    && (row.body as any).record.id === f.request.definition)!.body as any).record;
  const readmitted = value(f.telegram.admit());
  const installation = installTelegramReplyOperation({
    id: definition.id, generation: definition.generation, admitted: readmitted, target: f.target,
    speaker: definition.speaker, scopeDigest: definition.scopeDigest, durability: definition.durability,
    replicas: definition.replicas, lossModel: definition.lossModel, verificationBar: definition.verificationBar,
  }, f.effects.host, f.effects.spine);
  expect(installation.kind).toBe('Success');
  const adapter = createTelegramReplyOperationAdapter(readmitted, f.telegram.api, f.target, f.effects.host.boundary);
  const doorway = createEffectDoorway({ ...f.effects.composition, adapter, assessment: null });
  expect(value(doorway.dispatch(f.request, f.effects.fence)).stage).toBe('response');
  expect(f.telegram.calls.send).toHaveLength(1);
});

it('P12-NF-18 P12-NF-38 P12-NF-46 P12-NF-49 round4 newer fully witnessed matching probe permits re-admission', () => {
  const f = conversationFixture();
  const old = f.admitted.probe;
  const prior = value(f.admissionDependencies.history.lookup(old.reference))!;
  const probeRecord = { ...(prior.fact.body as any).record,
    id: 'probe:telegram:get-me:9001:9.2:fresh101', attempt: 'attempt:telegram:9001:9.2:fresh101',
    startedAt: 100, completedAt: 101 };
  value(authorAndAppend({ kind: 'verification-ProbeRecord', schemaVersion: 1,
    machine: f.assembly.host.machine, principal: asJson(f.assembly.alice),
    provenance: asJson(f.assembly.alice.provenance), at: asJson(f.assembly.clock(101)),
    body: { record: probeRecord }, required: [],
  }, f.assembly.context, f.assembly.store, privateKey));
  f.setProbe({ ...old, observedAt: 101, reference: probeRecord.id });
  Object.assign(f.admissionDependencies, { clock: () => f.intake.f.clock(101) });
  const result = f.admit();
  expect(result.kind).toBe('Success');
  if (result.kind === 'Success') {
    expect(result.value.conformance.id).not.toBe(f.admitted.conformance.id);
    expect(result.value.conformance.probes).toEqual([probeRecord.id]);
    expect(result.value.conformance.testedAt).toBe(101);
  }
});

it('P12-NF-04 P12-NF-18 round4 two independent fresh admissions share bot polling limit', () => {
  const f = conversationFixture();
  let active = 0;
  let maximum = 0;
  let nested: ReturnType<ReturnType<typeof wireTelegram>['ingress']['pollOnce']> | undefined;
  let second: ReturnType<typeof wireTelegram>;
  const api = { ...f.api,
    poll(input: Parameters<typeof f.api.poll>[0]) {
      active += 1;
      maximum = Math.max(maximum, active);
      if (active === 1) nested = second.ingress.pollOnce();
      const result = f.api.poll(input);
      active -= 1;
      return result;
    },
  };
  const firstAdmission = value(admitTelegramAdapter(f.declaration, { ...f.admissionDependencies, api }));
  const secondAdmission = value(admitTelegramAdapter(f.declaration, { ...f.admissionDependencies, api }));
  const first = wireTelegram({ ...f, api, admitted: firstAdmission } as ReturnType<typeof conversationFixture>);
  second = wireTelegram({ ...f, api, admitted: secondAdmission } as ReturnType<typeof conversationFixture>);
  expect(first.ingress.pollOnce().kind).toBe('Success');
  expect(nested?.kind).toBe('Refused');
  expect(maximum).toBe(1);
});

for (const senderCase of [
  { name: 'missing sender type evidence', mutate: (update: any) => { delete update.message.from.is_bot; } },
  { name: 'invalid sender type evidence', mutate: (update: any) => { update.message.from.is_bot = 'true'; } },
] as const) {
  it(`P12-NF-07 P12-NF-08 P12-NF-17 round4 ${senderCase.name}`, () => {
    const f = conversationFixture();
    const wire = wireTelegram(f);
    f.queue(telegramUpdate(100, senderCase.mutate));
    expect(wire.ingress.pollOnce().kind).toBe('Refused');
    expect(value(wire.facts.read()).some(row => row.kind === 'intake-admitted')).toBe(false);
  });
}
