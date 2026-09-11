import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createEffectDoorway, decodeOutboundMessage } from '../../src/effects/index.js';
import {
  createTelegramReplyOperationAdapter, installTelegramReplyOperation, telegramConversation,
} from '../../src/conversation/index.js';
import { effectFixture, refused, value } from '../effects/fixture.js';
import { conversationFixture } from './fixture.js';

it('P12-NF-27 P12-NF-28 P12-NF-33 P12-NF-34 P12-NF-42 registered Telegram reply consumes Part Six claim once and records exact response evidence', () => {
  const telegram = conversationFixture();
  const target = { chatId: '-1001', forum: true, messageThreadId: 42 } as const;
  const conversation = telegramConversation(telegram.declaration.bot.id, target);
  const effects = effectFixture();
  const registerEntries = effects.host.boundary.register.entries as string[];
  registerEntries.push('telegram-ordinary-reply', telegram.admitted.id);
  const definition = {
    type: 'OperationDefinition', schemaVersion: 1, id: 'telegram-reply-definition:1',
    feature: 'telegram-ordinary-reply',
    version: 'telegram:9.2:ordinary-reply:v1',
    adapter: telegram.admitted.id,
    account: telegram.admitted.account,
    conversation,
    generation: effects.host.current().decode.register.generation.id,
    speaker: effects.host.principal.id,
    scopeDigest: value(canonical(effects.host.scope)).hash,
    durability: 'replicated' as const,
    replicas: 1,
    lossModel: 'fixture peer custody; production loss model remains an assembly admission concern',
    maxBytes: telegram.declaration.limits.maxReplyBytes,
    maxCharge: telegram.declaration.limits.maxCharge,
    timeout: telegram.declaration.limits.timeout,
    verificationBar: 'reply-bar:1',
  };
  const approvedIn = effects.authorize({ id: 'telegram-reply-approval',
    artifact: effects.capture(value(canonical(definition)).bytes), base: 'telegram-reply-base:1' });
  effects.versions([{ id: definition.version, subject: definition.feature,
    content: JSON.parse(value(canonical(definition)).bytes), contentHash: value(canonical(definition)).hash,
    since: effects.pending.id, supersedes: [], approvedIn, base: approvedIn.base, landedIn: null }]);
  const installed = value(installTelegramReplyOperation({
    id: definition.id, generation: definition.generation, admitted: telegram.admitted, target,
    speaker: definition.speaker, scopeDigest: definition.scopeDigest, durability: definition.durability,
    replicas: definition.replicas, lossModel: definition.lossModel, verificationBar: definition.verificationBar,
  }, effects.host, effects.spine));
  const message = value(decodeOutboundMessage({
    type: 'OutboundMessage', schemaVersion: 1, id: 'telegram-message:1', semanticMessage: 'five-semantic-message:telegram:1',
    run: effects.run.id, speaker: effects.host.principal.id, account: telegram.admitted.account, conversation,
    text: 'Here is the requested result.', purpose: 'ordinary-reply', sourceResult: effects.pending.id,
  }, effects.host));
  const adapter = createTelegramReplyOperationAdapter(telegram.admitted, telegram.api, target, effects.host.boundary);
  const doorway = createEffectDoorway({ ...effects.composition, adapter, assessment: null });

  const requestId = `request:${value(canonical([message.account, message.conversation, message.semanticMessage])).hash}`;
  const messageDigest = value(canonical(message)).hash;
  value(effects.transport.reserve({ command: 'telegram-external-admit', fence: effects.fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: requestId }, attempt: 'attempt:telegram:1',
    payloadDigest: messageDigest, charge: definition.maxCharge, run: effects.run,
    semanticMessage: message.semanticMessage, durability: definition.durability, replicas: definition.replicas }));
  const request = value(doorway.adopt({
    definition: installed.id, message, run: effects.run, pending: effects.pending.id,
    attempt: 'attempt:telegram:1', verificationOwner: 'reply-verifier', obligation: effects.obligation, closure: [],
  }));
  const observation = value(doorway.dispatch(request, effects.fence));
  expect(observation.stage).toBe('response');
  expect(telegram.calls.send).toEqual([{
    token: telegram.declaration.token,
    apiVersion: '9.2',
    chatId: '-1001',
    messageThreadId: 42,
    text: message.text,
    parseMode: 'HTML',
    timeout: 30,
    hiddenRetries: 0,
  }]);
  const transport = value(effects.transport.inspect());
  const admissions = transport.filter(row => row.record.type === 'AdmissionReservation');
  expect(new Set(admissions.map(row => row.record.type === 'AdmissionReservation' ? row.record.operation : '')).size).toBe(1);
  expect(admissions.at(-1)?.record).toMatchObject({ state: 'consumed' });
  expect(transport.some(row => row.fact.id === observation.claim
    && row.record.type === 'AdmissionReservation' && row.record.state === 'dispatch-claimed')).toBe(true);
  expect(value(doorway.dispatch(request, effects.fence)).id).toBe(observation.id);
  expect(telegram.calls.send).toHaveLength(1);

  const captured = effects.ctx.captures[observation.capture.reference];
  expect(captured?.bytes).toBe('{"ok":true,"result":{"message_id":700}}');
  expect(observation).toMatchObject({ account: telegram.admitted.account, conversation, stage: 'response' });
  expect(message).toMatchObject({ speaker: effects.host.principal.id, sourceResult: effects.pending.id, purpose: 'ordinary-reply' });
  refused(doorway.settle(observation.operation), 'assessor unavailable');
});

it('P12-NF-30 P12-NF-31 P12-NF-32 P12-NF-36 P12-NF-37 P12-NF-41 unsupported lookup or target mismatch never invents delivery or a second send', () => {
  const telegram = conversationFixture();
  const effects = effectFixture();
  const target = { chatId: '123', forum: false, messageThreadId: null } as const;
  const adapter = createTelegramReplyOperationAdapter(telegram.admitted, telegram.api, target, effects.host.boundary);
  const observed = adapter.observe({ operation: 'operation:unknown', digest: effects.messageDigest,
    account: telegram.admitted.account, conversation: telegramConversation(telegram.declaration.bot.id, target) });
  consumeResult(observed, {
    Success: () => { throw new Error('Telegram lookup cannot report success'); },
    Refused: refusal => expect(refusal.detail).toContain('unsupported'),
  });
  const mismatch = adapter.invoke({ operation: 'operation:unclaimed-test', claim: 'claim:test',
    digest: effects.messageDigest, message: effects.message });
  consumeResult(mismatch, {
    Success: () => { throw new Error('mismatched target cannot invoke'); },
    Refused: refusal => expect(refusal.detail).toContain('target differs'),
  });
  expect(telegram.calls.send).toHaveLength(0);
});
