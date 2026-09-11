import { canonical } from '../../src/index.js';
import {
  createTelegramReplyOperationAdapter, installTelegramReplyOperation, telegramConversation,
} from '../../src/conversation/index.js';
import { createEffectDoorway, decodeOutboundMessage } from '../../src/effects/index.js';
import { effectFixture } from '../effects/fixture.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';

/** A Telegram reply admitted through Part Eight's public prepare arm. */
export function telegramPreparedOutbound(lostResponse = false) {
  const telegram = conversationFixture();
  if (lostResponse) telegram.loseSendResponse();
  const target = { chatId: '-1000000001001', forum: true, messageThreadId: 42 } as const;
  const conversation = telegramConversation(telegram.declaration.bot.id, target);
  const effects = effectFixture();
  const registerEntries = effects.host.boundary.register.entries as string[];
  registerEntries.push('telegram-ordinary-reply', telegram.admitted.id);
  const definition = {
    type: 'OperationDefinition', schemaVersion: 1, id: 'telegram-reply-definition:round5',
    feature: 'telegram-ordinary-reply', version: 'telegram:9.2:ordinary-reply:v1',
    adapter: telegram.admitted.id, account: telegram.admitted.account, conversation,
    generation: effects.host.current().decode.register.generation.id,
    speaker: effects.host.principal.id, scopeDigest: value(canonical(effects.host.scope)).hash,
    durability: 'replicated' as const, replicas: 1,
    lossModel: 'fixture peer custody; production loss model remains an assembly admission concern',
    maxBytes: telegram.declaration.limits.maxReplyBytes,
    maxCharge: telegram.declaration.limits.maxCharge,
    timeout: telegram.declaration.limits.timeout, verificationBar: 'reply-bar:1',
  };
  const approvedIn = effects.authorize({ id: 'telegram-reply-approval:round5',
    artifact: effects.capture(value(canonical(definition)).bytes), base: 'telegram-reply-base:round5' });
  effects.versions([{ id: definition.version, subject: definition.feature,
    content: JSON.parse(value(canonical(definition)).bytes), contentHash: value(canonical(definition)).hash,
    since: effects.pending.id, supersedes: [], approvedIn, base: approvedIn.base, landedIn: null }]);
  const installed = value(installTelegramReplyOperation({
    id: definition.id, generation: definition.generation, admitted: telegram.admitted, target,
    speaker: definition.speaker, scopeDigest: definition.scopeDigest, durability: definition.durability,
    replicas: definition.replicas, lossModel: definition.lossModel, verificationBar: definition.verificationBar,
  }, effects.host, effects.spine));
  const message = value(decodeOutboundMessage({
    type: 'OutboundMessage', schemaVersion: 1, id: 'telegram-message:round5',
    semanticMessage: 'five-semantic-message:telegram:round5', run: effects.run.id,
    speaker: effects.host.principal.id, account: telegram.admitted.account, conversation,
    text: 'Here is the requested result.', purpose: 'ordinary-reply', sourceResult: effects.pending.id,
  }, effects.host));
  const adapter = createTelegramReplyOperationAdapter(telegram.admitted, telegram.api, target,
    effects.host.boundary);
  const doorway = createEffectDoorway({ ...effects.composition, adapter, assessment: null });
  const request = value(doorway.prepare({ definition: installed.id, message, run: effects.run,
    pending: effects.pending.id, attempt: 'attempt:telegram:round5', verificationOwner: 'reply-verifier',
    obligation: effects.obligation, closure: [], fence: effects.fence }));
  return { telegram, target, effects, message, adapter, doorway, request };
}
