import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import { decodeOutboundMessage } from '../../src/effects/index.js';
import { privateKey } from '../facts/fixtures.js';
import { value } from '../intake/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { conversationFixture } from './fixture.js';
import { telegramPreparedOutbound } from './round5-fixture.js';
import { telegramUpdate, wireTelegram } from './round3-fixture.js';

const asJson = (input: unknown) => JSON.parse(value(canonical(input)).bytes);

function appendVerification(f: ReturnType<typeof conversationFixture>, kind: string, record: object,
  required: readonly string[] = []) {
  return value(authorAndAppend({ kind, schemaVersion: 1, machine: f.assembly.host.machine,
    principal: asJson(f.assembly.alice), provenance: asJson(f.assembly.alice.provenance),
    at: asJson(f.assembly.clock(100)), body: asJson({ record }), required,
  }, f.assembly.context, f.assembly.store, privateKey)).fact;
}

it('P12-NF-16 P12-NF-17 P12-NF-18 round6 malformed conversation discriminators preserve no route and advance no offset', () => {
  const mutations = [
    (update: any) => { update.message.chat.is_forum = 'true'; delete update.message.message_thread_id; },
    (update: any) => { update.message.chat.is_forum = 1; delete update.message.message_thread_id; },
    (update: any) => { update.message.chat.is_forum = null; delete update.message.message_thread_id; },
    (update: any) => { update.message.chat.type = 'private'; },
    (update: any) => {
      update.message.chat.type = 'channel'; delete update.message.chat.is_forum; delete update.message.message_thread_id;
    },
  ];
  for (const mutate of mutations) {
    const f = conversationFixture({ initialOffset: 100 });
    const wire = wireTelegram(f);
    f.queue(telegramUpdate(100, mutate));
    expect(wire.ingress.pollOnce().kind).toBe('Refused');
    expect(value(wire.ingress.currentOffset())).toBe(100);
    expect(value(wire.facts.read()).some(row => row.kind === 'intake-admitted')).toBe(false);
  }
});

it('P12-NF-07 P12-NF-18 P12-NF-46 round6 signed plan freshness cannot be extended by the custodian wrapper', () => {
  const f = conversationFixture();
  const priorProbe = f.admitted.probe;
  const basePlan = verificationInput('VerificationPlan');
  const plan = { ...basePlan, id: 'plan:telegram-round6-freshness',
    subject: { ...basePlan.subject, governed: f.admitted.account,
      generation: f.admissionDependencies.generation },
    bar: { ...basePlan.bar, freshness: 50 },
    scheduling: { ...basePlan.scheduling, freshnessWindow: 50 },
  };
  const planFact = appendVerification(f, 'verification-VerificationPlan', plan);
  const priorRecord = value(f.admissionDependencies.history.lookup(priorProbe.reference))!.fact.body as any;
  const probeRecord = { ...priorRecord.record, id: 'probe:telegram-round6-freshness', plan: plan.id,
    planVersion: plan.bar.version, slot: 'slot:telegram:round6', attempt: 'attempt:telegram:round6' };
  appendVerification(f, 'verification-ProbeRecord', probeRecord, [planFact.id]);
  f.setProbe({ ...priorProbe, reference: probeRecord.id, freshFor: 50 });
  expect(f.admit().kind).toBe('Success');

  Object.assign(f.admissionDependencies, { clock: () => f.intake.f.clock(151) });
  f.setProbe({ ...priorProbe, reference: probeRecord.id, freshFor: 1_000_000 });
  const expired = f.admit();
  expect(expired.kind).toBe('Refused');
  if (expired.kind === 'Refused') expect(expired.detail).toContain('recorded verification plan');
});

it.each([
  ['conflicting disposition', { disposition: 'failed' }],
  ['conflicting subject', { subject: 'telegram:v1:bot:9002' }],
] as const)('P12-NF-07 P12-NF-46 round6 refuses %s for one probe identity', (_name, patch) => {
  const f = conversationFixture();
  const prior = value(f.admissionDependencies.history.lookup(f.admitted.probe.reference))!;
  appendVerification(f, 'verification-ProbeRecord', { ...(prior.fact.body as any).record, ...patch }, [prior.fact.id]);
  const result = f.admit();
  expect(result.kind).toBe('Refused');
  if (result.kind === 'Refused') expect(result.detail).toContain('ambiguous or contested');
});

it('P12-NF-07 P12-NF-46 round6 refuses a probe whose signed verification plan is absent', () => {
  const f = conversationFixture();
  const prior = value(f.admissionDependencies.history.lookup(f.admitted.probe.reference))!;
  const probeRecord = { ...(prior.fact.body as any).record, id: 'probe:telegram-round6-missing-plan',
    plan: 'plan:missing', planVersion: 'bar:missing', slot: 'slot:telegram:missing-plan' };
  appendVerification(f, 'verification-ProbeRecord', probeRecord, [prior.fact.id]);
  f.setProbe({ ...f.admitted.probe, reference: probeRecord.id });
  const result = f.admit();
  expect(result.kind).toBe('Refused');
  if (result.kind === 'Refused') expect(result.detail).toContain('plan is missing');
});

it('P12-NF-32 round6 unsupported reaction typing read receipt deletion edit media and single-member shapes refuse with no fallback', () => {
  const f = telegramPreparedOutbound();
  expect(decodeOutboundMessage(f.message, f.effects.host).kind).toBe('Success');
  const cases = [
    ['reaction', { purpose: 'reaction' }],
    ['typing', { purpose: 'typing' }],
    ['read-receipt', { purpose: 'read-receipt' }],
    ['delete-message', { purpose: 'delete-message' }],
    ['edit', { purpose: 'edit' }],
    ['media', { attachments: [{ reference: 'capture:media' }] }],
    ['single-member-audience', { audience: { member: 'telegram:v1:user:7' } }],
  ] as const;
  for (const [name, patch] of cases) {
    const candidate = { ...f.message, id: `candidate:${name}`, semanticMessage: `semantic:${name}`, ...patch };
    const result = f.doorway.prepare({ definition: f.request.definition, message: candidate as never,
      run: f.effects.run, pending: f.effects.pending.id, attempt: `candidate-attempt:${name}`,
      verificationOwner: 'reply-verifier', obligation: f.effects.obligation,
      closure: [], fence: f.effects.fence });
    expect(result.kind, name).toBe('Refused');
    expect(f.telegram.calls.send, name).toHaveLength(0);
  }
});
