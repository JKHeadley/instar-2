import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import {
  createTelegramReplyOperationAdapter, installTelegramReplyOperation,
} from '../../src/conversation/index.js';
import { createEffectDoorway, decodeOutboundMessage } from '../../src/effects/index.js';
import { privateKey } from '../facts/fixtures.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramPreparedOutbound } from './round5-fixture.js';
import { telegramUpdate, wireTelegram } from './round3-fixture.js';

const json = (input: unknown) => JSON.parse(value(canonical(input)).bytes);

function appendVerification(f: ReturnType<typeof conversationFixture>, record: object) {
  return value(authorAndAppend({ kind: `verification-${(record as { type: string }).type}`, schemaVersion: 1,
    machine: f.assembly.host.machine, principal: json(f.assembly.alice),
    provenance: json(f.assembly.alice.provenance), at: json(f.assembly.clock(100)),
    body: json({ record }), required: [],
  }, f.assembly.context, f.assembly.store, privateKey));
}

function callbackUpdate(chatType: 'private' | 'supergroup' | 'channel'): string {
  return JSON.stringify({ update_id: 100, callback_query: {
    id: 'query:100', from: { id: 7, is_bot: false, first_name: 'Caller' },
    message: { message_id: 700, date: 1_700_000_000,
      chat: { id: chatType === 'private' ? 123 : -1000000001001, type: chatType }, text: 'Select an option' },
    chat_instance: 'chat-instance-1', data: 'choice:one',
  } });
}

function reactionUpdate(actor: 'user7' | 'user8' | 'channel200' | 'channel201' | 'invalid-user'): string {
  return JSON.stringify({ update_id: 100, message_reaction: {
    chat: { id: -1000000001001, type: 'supergroup' }, message_id: 700,
    ...(actor.startsWith('channel')
      ? { actor_chat: { id: actor === 'channel200' ? -1000000000200 : -1000000000201, type: 'channel', title: 'Actor' } }
      : { user: { id: actor === 'user7' ? 7 : 8, is_bot: actor === 'invalid-user' ? 'false' : false, first_name: 'Caller' } }),
    date: 1_700_000_000, old_reaction: [], new_reaction: [{ type: 'emoji', emoji: '👍' }],
  } });
}

it('P12-NF-07 P12-NF-08 P12-NF-10 P12-NF-16 P12-NF-17 P12-NF-18 round7 variant senders reach durable custody without destination substitution', () => {
  for (const [name, raw, sender] of [
    ['callback-channel', callbackUpdate('channel'), 'telegram:v1:user:7'],
    ['reaction-user-7', reactionUpdate('user7'), 'telegram:v1:user:7'],
    ['reaction-user-8', reactionUpdate('user8'), 'telegram:v1:user:8'],
    ['reaction-channel-200', reactionUpdate('channel200'), 'telegram:v1:channel:-1000000000200'],
    ['reaction-channel-201', reactionUpdate('channel201'), 'telegram:v1:channel:-1000000000201'],
  ] as const) {
    const f = conversationFixture({ initialOffset: 100 }); const wire = wireTelegram(f);
    f.queue(raw); const result = wire.ingress.pollOnce();
    expect(result.kind, name).toBe('Success');
    expect(value(wire.ingress.currentOffset()), name).toBe(101);
    expect(value(wire.facts.read()).filter(row => row.kind === 'intake-receipt'), name).toHaveLength(1);
    expect(value(wire.facts.read()).some(row => row.kind === 'intake-receipt'
      && JSON.parse((row.body as { ingress: string }).ingress).sender === sender), name).toBe(true);
  }
});

it('P12-NF-07 P12-NF-16 P12-NF-17 P12-NF-18 round7 malformed sender sources refuse typed before custody and offset advance', () => {
  const inputs = [reactionUpdate('invalid-user'), ...[
    { id: 0, type: 'channel' }, { id: -200 }, { id: -200, type: 'private' },
  ].map(senderChat => telegramUpdate(100, update => {
    update.message.sender_chat = senderChat; delete update.message.from;
  }))];
  for (const raw of inputs) {
    const f = conversationFixture({ initialOffset: 100 }); const wire = wireTelegram(f); f.queue(raw);
    expect(wire.ingress.pollOnce().kind).toBe('Refused');
    expect(value(wire.ingress.currentOffset())).toBe(100);
    expect(value(wire.facts.read()).filter(row => row.kind === 'intake-receipt')).toHaveLength(0);
  }
});

it('P12-NF-04 P12-NF-46 P12-NF-49 P12-NF-50 round7 admission requires the signed plan generation to match current admission', () => {
  for (const mismatch of [false, true]) {
    const f = conversationFixture({ skipInitialAdmission: true });
    const rows = value(f.verification.inspect());
    const prior = rows.find(row => row.record.type === 'ProbeRecord'
      && row.record.subject === 'telegram:v1:bot:9001')!.record as any;
    const plan = structuredClone(rows.find(row => row.record.type === 'VerificationPlan'
      && row.record.id === prior.plan)!.record) as any;
    plan.id = `plan:generation:${mismatch}`;
    if (mismatch) plan.subject.generation = 'generation:obsolete';
    appendVerification(f, plan);
    const probe = { ...prior, id: `probe:generation:${mismatch}`, plan: plan.id,
      attempt: `attempt:generation:${mismatch}` };
    appendVerification(f, probe);
    f.setProbe({ botId: '9001', username: '@fixture_bot', apiVersion: '9.2', authenticated: true,
      observedAt: 100, freshFor: 50, reference: probe.id,
      capture: { reference: probe.witnesses[0], hash: probe.challengeDigest } });
    expect(f.admit().kind, String(mismatch)).toBe(mismatch ? 'Refused' : 'Success');
  }
});

it('P12-NF-28 round7 final concrete invocation refuses after current standing is removed', () => {
  for (const mode of ['unchanged', 'standing-removed'] as const) {
    const f = telegramPreparedOutbound();
    let concreteInput: Parameters<typeof f.adapter.invoke>[0] | undefined;
    let suppress = false;
    const adapter = { ...f.adapter, invoke(input: Parameters<typeof f.adapter.invoke>[0]) {
      concreteInput = input; suppress = true; throw new Error('pause before concrete invocation');
    } };
    const spine = { ...f.effects.spine, append(...args: Parameters<typeof f.effects.spine.append>) {
      if (suppress) throw new Error('response observation unavailable');
      return f.effects.spine.append(...args);
    } };
    const doorway = createEffectDoorway({ ...f.effects.composition, spine, adapter, assessment: null });
    expect(value(doorway.dispatch(f.request, f.effects.fence)).stage).toBe('executor-accepted');
    if (mode === 'standing-removed') Object.assign(f.effects.host.current().decode, { grants: [] });
    expect(f.adapter.invoke(concreteInput!).kind).toBe(mode === 'unchanged' ? 'Success' : 'Refused');
    expect(f.telegram.calls.send).toHaveLength(mode === 'unchanged' ? 1 : 0);
  }
}, 15_000);

it('P12-NF-27 P12-NF-28 P12-NF-33 P12-NF-41 round7 retained unrelated binding cannot refuse a valid next reply', () => {
  const f = telegramPreparedOutbound();
  const prior = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation').at(-1)!.record as any;
  expect(f.effects.transport.close('close-unused-first', f.effects.fence, prior.operation).kind).toBe('Success');
  const oldVersions = f.effects.host.current().versions;
  const old = oldVersions[0]!.content as any;
  const replacement = { ...old, id: 'definition:second-topic', conversation: 'telegram:v1:bot:9001:chat:-1000000001001:topic:43' };
  const approvedIn = f.effects.authorize({ id: 'approval:second-topic',
    artifact: f.effects.capture(value(canonical(replacement)).bytes), base: 'base:second-topic' });
  f.effects.versions([{ ...oldVersions[0]!, content: replacement,
    contentHash: value(canonical(replacement)).hash, approvedIn, base: approvedIn.base }]);
  const target = { ...f.target, messageThreadId: 43 };
  const installed = value(installTelegramReplyOperation({ id: replacement.id, generation: replacement.generation,
    admitted: f.telegram.admitted, target, speaker: replacement.speaker, scopeDigest: replacement.scopeDigest,
    durability: replacement.durability, replicas: replacement.replicas, lossModel: replacement.lossModel,
    verificationBar: replacement.verificationBar,
  }, f.effects.host, f.effects.spine));
  const adapter = createTelegramReplyOperationAdapter(f.telegram.admitted, f.telegram.api, target, f.effects.host.boundary);
  const doorway = createEffectDoorway({ ...f.effects.composition, adapter, assessment: null });
  const message = value(decodeOutboundMessage({ ...f.message, id: 'message:second-topic',
    semanticMessage: 'semantic:second-topic', conversation: replacement.conversation }, f.effects.host));
  const prepared = value(doorway.prepare({ definition: installed.id, message, run: f.effects.run,
    pending: f.effects.pending.id, attempt: 'attempt:second-topic', verificationOwner: 'reply-verifier',
    obligation: f.effects.obligation, closure: [], fence: f.effects.fence }));
  expect(value(doorway.dispatch(prepared, f.effects.fence)).stage).toBe('response');
  expect(f.telegram.calls.send).toHaveLength(1);
}, 15_000);
