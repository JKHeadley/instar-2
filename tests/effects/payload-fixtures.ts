import { decodeEffectPayload, effectPayloadIdentity } from '../../src/effects/index.js';
import type { EffectHost, TypedEffectPayload } from '../../src/effects/index.js';
import { captureHash } from '../fixtures.js';
import { value } from '../fixtures.js';

export const payloadKinds = ['post-text', 'post-media', 'edit-message', 'react', 'create-topic', 'acknowledge',
  'fetch-inbound-media', 'derive-transcript'] as const;

export function payloadInput(kind: typeof payloadKinds[number], host: EffectHost,
  sourceResult = (host as EffectHost & { fixtureSourceResult?: string }).fixtureSourceResult
    ?? 'five-owned pending and source result STAND-IN'): Record<string, unknown> {
  const common = { type: 'EffectPayload', schemaVersion: 1, kind, semanticMessage: 'semantic:typed:1', run: 'run:1',
    step: `step:${kind}`, sourceResult, logicalEffect: `logical:${kind}:1` };
  const conversation = { speaker: host.principal.id, account: 'bot:fixture', conversation: 'chat:fixture',
    routeGeneration: 'conversation-route:1', purpose: 'required-action' };
  const fixtureHost = host as EffectHost & { fixtureMediaCapture?: object; fixtureAudioCapture?: object;
    fixtureInboundMediaCapture?: object; fixtureSubmittedCapture?: object; fixtureResponseCapture?: object };
  let fields: Record<string, unknown>;
  switch (kind) {
    case 'post-text': fields = { ...conversation, text: 'typed text' }; break;
    case 'post-media': fields = { ...conversation, caption: 'caption', attachments: [{ capture: fixtureHost.fixtureMediaCapture
      ?? { reference: 'capture:media', hash: captureHash('media') }, mediaType: 'image/png', bytes: 5, filename: 'image.png' }] }; break;
    case 'edit-message': fields = { ...conversation, targetMessage: 'message:7', text: 'corrected' }; break;
    case 'react': fields = { ...conversation, targetMessage: 'message:7', reaction: 'ok' }; break;
    case 'create-topic': fields = { ...conversation, parentConversation: 'chat:fixture', title: 'Topic', attributes: [{ key: 'color', value: 'blue' }] }; break;
    case 'acknowledge': fields = { ...conversation, inboundFact: 'intake:1', acknowledgment: 'reaction', value: 'ok', decorative: true }; break;
    case 'fetch-inbound-media': fields = { ...conversation, inboundReceipt: 'receipt:1',
      intakeCapture: fixtureHost.fixtureInboundMediaCapture ?? { reference: 'capture:inbound-media', hash: captureHash('inbound-media') },
      platformFile: 'provider-file:1', maximumBytes: 8192, mediaTypes: ['image/png'] }; break;
    case 'derive-transcript': fields = { ...conversation, sourceCapture: fixtureHost.fixtureAudioCapture
      ?? { reference: 'capture:audio', hash: captureHash('audio') },
      submittedCapture: fixtureHost.fixtureSubmittedCapture ?? { reference: 'capture:submitted', hash: captureHash('submitted') },
      responseCapture: fixtureHost.fixtureResponseCapture ?? { reference: 'capture:response', hash: captureHash('response') },
      providerOperation: 'provider:transcribe', model: 'model:1', maximumOutputBytes: 8192, destinationStep: 'step:transcript', originatingIntake: 'intake:1' }; break;
  }
  const draft: Record<string, unknown> = { ...common, ...fields };
  return { ...draft, ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) };
}

export function payload(kind: typeof payloadKinds[number], host: EffectHost): TypedEffectPayload {
  return value(decodeEffectPayload(payloadInput(kind, host), host));
}
