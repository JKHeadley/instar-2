import type { Json, Result } from '../index.js';
import type { FactEnvelope, OwnedShape } from '../facts/index.js';
import type { EffectHost } from './contracts.js';
import { boundary, encoded, ensure, freeze, json } from './boundary.js';
import { referencedPayloadFacts } from './references.js';

declare const payloadOwned: unique symbol;
interface PayloadOwned { readonly [payloadOwned]: 'part-eight' }
interface EffectPayloadIdentity extends PayloadOwned {
  readonly type: 'EffectPayload'; readonly schemaVersion: 1; readonly id: string;
  readonly kind: ConversationEffectKind; readonly semanticMessage: string;
  readonly run: string; readonly step: string; readonly sourceResult: string;
  readonly logicalEffect: string; readonly targetDigest: string;
}
export type EffectPurpose = 'requested-result' | 'required-action' | 'ordinary-reply' | 'infrastructure-receipt';
export type ConversationEffectKind = 'post-text' | 'post-media' | 'edit-message' | 'react' | 'create-topic' |
  'acknowledge' | 'fetch-inbound-media' | 'derive-transcript';
export type EffectPayloadKind = 'ordinary-reply' | ConversationEffectKind;
export interface ObservationCapabilities {
  readonly occurrence: string; readonly nonOccurrence: string; readonly quiescence: string; readonly charge: string;
}
interface ConversationPayload extends EffectPayloadIdentity {
  readonly kind: ConversationEffectKind; readonly speaker: string; readonly account: string;
  readonly conversation: string; readonly routeGeneration: string; readonly purpose: EffectPurpose;
}
export interface PostTextPayload extends ConversationPayload { readonly kind: 'post-text'; readonly text: string }
export interface PostMediaPayload extends ConversationPayload { readonly kind: 'post-media'; readonly caption: string;
  readonly attachments: readonly Readonly<{ capture: { reference: string; hash: string }; mediaType: string; bytes: number; filename: string }>[] }
export interface EditMessagePayload extends ConversationPayload { readonly kind: 'edit-message'; readonly targetMessage: string; readonly text: string }
export interface ReactPayload extends ConversationPayload { readonly kind: 'react'; readonly targetMessage: string; readonly reaction: string }
export interface CreateTopicPayload extends ConversationPayload { readonly kind: 'create-topic'; readonly parentConversation: string; readonly title: string;
  readonly attributes: readonly Readonly<{ key: string; value: string }>[] }
export interface AcknowledgePayload extends ConversationPayload { readonly kind: 'acknowledge'; readonly inboundFact: string;
  readonly acknowledgment: 'reaction' | 'read-receipt' | 'typing' | 'text'; readonly value: string; readonly decorative: true }
export interface FetchInboundMediaPayload extends ConversationPayload { readonly kind: 'fetch-inbound-media'; readonly inboundReceipt: string;
  readonly intakeCapture: { readonly reference: string; readonly hash: string };
  readonly platformFile: string; readonly maximumBytes: number; readonly mediaTypes: readonly string[] }
export interface DeriveTranscriptPayload extends ConversationPayload { readonly kind: 'derive-transcript';
  readonly sourceCapture: { readonly reference: string; readonly hash: string };
  readonly submittedCapture: { readonly reference: string; readonly hash: string };
  readonly responseCapture: { readonly reference: string; readonly hash: string }; readonly providerOperation: string; readonly model: string;
  readonly maximumOutputBytes: number; readonly destinationStep: string; readonly originatingIntake: string }
export type TypedEffectPayload = PostTextPayload | PostMediaPayload | EditMessagePayload | ReactPayload | CreateTopicPayload |
  AcknowledgePayload | FetchInboundMediaPayload | DeriveTranscriptPayload;
type EffectPayload = TypedEffectPayload | Readonly<{ type: 'OutboundMessage' }>;

const text = { kind: 'text', maxLength: 512 } as const;
const longText = { kind: 'text', maxLength: 4096 } as const;
const integer = { kind: 'integer' } as const;
const boolean = { kind: 'boolean' } as const;
const capture = { kind: 'capture' } as const;
const strings = { kind: 'array', maxLength: 64, items: text } as const;
const attributes = { kind: 'array', maxLength: 32, items: { kind: 'object', fields: { key: text, value: text } } } as const;
const attachments = { kind: 'array', maxLength: 16, items: { kind: 'object', fields: {
  capture, mediaType: text, bytes: integer, filename: text,
} } } as const;

const commonFields = ['type', 'schemaVersion', 'id', 'kind', 'semanticMessage', 'run', 'step', 'sourceResult', 'logicalEffect', 'targetDigest'] as const;
const conversationFields = ['speaker', 'account', 'conversation', 'routeGeneration', 'purpose'] as const;
const variantFields: Readonly<Record<TypedEffectPayload['kind'], readonly string[]>> = freeze({
  'post-text': [...commonFields, ...conversationFields, 'text'],
  'post-media': [...commonFields, ...conversationFields, 'caption', 'attachments'],
  'edit-message': [...commonFields, ...conversationFields, 'targetMessage', 'text'],
  react: [...commonFields, ...conversationFields, 'targetMessage', 'reaction'],
  'create-topic': [...commonFields, ...conversationFields, 'parentConversation', 'title', 'attributes'],
  acknowledge: [...commonFields, ...conversationFields, 'inboundFact', 'acknowledgment', 'value', 'decorative'],
  'fetch-inbound-media': [...commonFields, ...conversationFields, 'inboundReceipt', 'intakeCapture', 'platformFile', 'maximumBytes', 'mediaTypes'],
  'derive-transcript': [...commonFields, ...conversationFields, 'sourceCapture', 'submittedCapture', 'responseCapture',
    'providerOperation', 'model', 'maximumOutputBytes', 'destinationStep', 'originatingIntake'],
});

export const effectPayloadShape: OwnedShape = freeze({ kind: 'object', fields: {
  type: text, schemaVersion: integer, id: text, kind: text, semanticMessage: text, run: text, step: text,
  sourceResult: text, logicalEffect: text, targetDigest: text,
  speaker: text, account: text, conversation: text, routeGeneration: text, purpose: text,
  text: longText, caption: longText, attachments, targetMessage: text, reaction: text,
  parentConversation: text, title: text, attributes, inboundFact: text, acknowledgment: text,
  value: longText, decorative: boolean, inboundReceipt: text, platformFile: text, maximumBytes: integer,
  mediaTypes: strings, intakeCapture: capture, sourceCapture: capture, submittedCapture: capture, responseCapture: capture,
  providerOperation: text, model: text, maximumOutputBytes: integer,
  destinationStep: text, originatingIntake: text,
}, optional: [...new Set(Object.values(variantFields).flat().filter(field => !commonFields.includes(field as typeof commonFields[number])))] });

// The one field whose shape differs by variant is checked by the owner decoder;
// P2's outer shape still bounds both possibilities without accepting new keys.
export const effectPayloadOwnedShape: OwnedShape = effectPayloadShape;

const hash = (value: unknown, detail: string): void => ensure(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), detail);
const nonempty = (value: unknown, detail: string): void => ensure(typeof value === 'string' && value.length > 0, detail);
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): void => {
  ensure(Object.keys(value).length === expected.length && Object.keys(value).every(key => expected.includes(key)), 'missing or undeclared payload field');
};
const exactObject = (value: unknown, expected: readonly string[], detail: string): Record<string, unknown> => {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), detail);
  const object = value as Record<string, unknown>;
  ensure(Object.keys(object).length === expected.length && Object.keys(object).every(key => expected.includes(key)), detail);
  return object;
};
const shapeCheck = (value: unknown, shape: OwnedShape): void => {
  if (shape.kind === 'text') { ensure(typeof value === 'string' && value.length <= shape.maxLength, 'bounded text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(value), 'safe integer required'); return; }
  if (shape.kind === 'boolean') { ensure(typeof value === 'boolean', 'boolean required'); return; }
  if (shape.kind === 'array') {
    ensure(Array.isArray(value) && value.length <= shape.maxLength, 'bounded array required');
    value.forEach(item => shapeCheck(item, shape.items)); return;
  }
  if (shape.kind === 'capture') {
    shapeCheck(value, { kind: 'object', fields: { reference: text, hash: text } }); return;
  }
  ensure(shape.kind === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value), 'closed object required');
  const object = value as Record<string, unknown>, optional = new Set(shape.optional ?? []);
  ensure(Object.keys(object).every(key => Object.hasOwn(shape.fields, key))
    && Object.keys(shape.fields).filter(key => !optional.has(key)).every(key => Object.hasOwn(object, key)),
  'missing or undeclared field');
  for (const [key, child] of Object.entries(shape.fields)) if (Object.hasOwn(object, key)) shapeCheck(object[key], child);
};
const unique = (values: readonly string[], detail: string): void => ensure(new Set(values).size === values.length, detail);

type EffectPayloadDraft = TypedEffectPayload extends infer P ? P extends TypedEffectPayload ? Omit<P, 'id' | 'targetDigest'> : never : never;

export function effectPayloadTarget(payload: EffectPayloadDraft | TypedEffectPayload): Json {
  switch (payload.kind) {
    case 'post-text': case 'post-media': return { account: payload.account, conversation: payload.conversation, routeGeneration: payload.routeGeneration };
    case 'edit-message': case 'react': return { account: payload.account, conversation: payload.conversation, routeGeneration: payload.routeGeneration, message: payload.targetMessage };
    case 'create-topic': return { account: payload.account, conversation: payload.parentConversation, routeGeneration: payload.routeGeneration };
    case 'acknowledge': return { account: payload.account, conversation: payload.conversation, routeGeneration: payload.routeGeneration, inboundFact: payload.inboundFact };
    case 'fetch-inbound-media': return { account: payload.account, conversation: payload.conversation, routeGeneration: payload.routeGeneration,
      inboundReceipt: payload.inboundReceipt, intakeCapture: payload.intakeCapture, platformFile: payload.platformFile };
    case 'derive-transcript': return { account: payload.account, conversation: payload.conversation, routeGeneration: payload.routeGeneration,
      capture: payload.sourceCapture, submittedCapture: payload.submittedCapture, responseCapture: payload.responseCapture,
      destinationStep: payload.destinationStep, originatingIntake: payload.originatingIntake };
  }
}

export function effectPayloadIdentity(input: EffectPayloadDraft): Readonly<{ id: string; targetDigest: string }> {
  const targetDigest = encoded(effectPayloadTarget(input)).hash;
  return freeze({ id: `payload:${encoded({ ...input, targetDigest }).hash}`, targetDigest });
}

export function validateEffectPayload(payload: TypedEffectPayload, host?: EffectHost, facts?: readonly FactEnvelope[], clock = host?.current().clock): void {
  // The public decoder and the P2 owned-body decoder share this complete shape
  // contract. A value cannot become more permissive by entering through one
  // boundary instead of the other.
  shapeCheck(payload, effectPayloadShape);
  ensure(payload.type === 'EffectPayload' && payload.schemaVersion === 1 && Object.hasOwn(variantFields, payload.kind), 'unknown effect payload kind/version');
  exactKeys(payload as unknown as Record<string, unknown>, variantFields[payload.kind]);
  const common = payload as unknown as Record<string, unknown>;
  for (const field of ['semanticMessage', 'run', 'step', 'sourceResult', 'logicalEffect']) nonempty(common[field], `payload ${field} missing`);
  hash(payload.targetDigest, 'payload target digest malformed');
  ensure(payload.targetDigest === encoded(effectPayloadTarget(payload)).hash, 'payload target digest mismatch');
  const { id: expected } = effectPayloadIdentity(Object.fromEntries(Object.entries(payload).filter(([key]) => !['id', 'targetDigest'].includes(key))) as unknown as EffectPayloadDraft);
  ensure(payload.id === expected, 'payload immutable identity mismatch');
  if (['post-text', 'post-media', 'edit-message', 'react', 'create-topic', 'acknowledge', 'fetch-inbound-media', 'derive-transcript'].includes(payload.kind)) {
    const message = payload as Extract<TypedEffectPayload, { speaker: string }>;
    nonempty(message.speaker, 'payload speaker missing'); nonempty(message.account, 'payload account missing'); nonempty(message.conversation, 'payload conversation missing');
    nonempty(message.routeGeneration, 'payload route generation missing');
    ensure(['requested-result', 'required-action', 'ordinary-reply', 'infrastructure-receipt'].includes(message.purpose), 'payload purpose unknown');
    if (host) ensure(message.speaker === host.principal.id, 'payload speaker is not current principal');
  }
  switch (payload.kind) {
    case 'post-text': nonempty(payload.text, 'post-text bytes missing'); break;
    case 'post-media': ensure(payload.caption.length <= 4096 && payload.attachments.length > 0 && payload.attachments.length <= 16, 'post-media expansion bound');
      payload.attachments.forEach(item => { exactObject(item, ['capture', 'mediaType', 'bytes', 'filename'], 'attachment fields invalid');
        exactObject(item.capture, ['reference', 'hash'], 'attachment capture fields invalid'); hash(item.capture.hash, 'attachment digest malformed'); nonempty(item.capture.reference, 'attachment capture missing');
        nonempty(item.mediaType, 'attachment media type missing'); ensure(Number.isSafeInteger(item.bytes) && item.bytes >= 0, 'attachment byte size invalid');
        ensure(item.filename.length > 0 && !item.filename.includes('/') && !item.filename.includes('\\') && item.filename !== '.' && item.filename !== '..', 'attachment filename unsafe for disclosure'); }); break;
    case 'edit-message': nonempty(payload.targetMessage, 'edit target missing'); nonempty(payload.text, 'replacement text missing'); break;
    case 'react': nonempty(payload.targetMessage, 'reaction target missing'); nonempty(payload.reaction, 'reaction value missing'); break;
    case 'create-topic': nonempty(payload.parentConversation, 'topic parent missing'); nonempty(payload.title, 'topic title missing');
      payload.attributes.forEach(item => exactObject(item, ['key', 'value'], 'topic attribute fields invalid'));
      unique(payload.attributes.map(item => item.key), 'topic attributes duplicate'); break;
    case 'acknowledge': ensure(payload.decorative === true && ['reaction', 'read-receipt', 'typing', 'text'].includes(payload.acknowledgment), 'acknowledgment contract');
      nonempty(payload.inboundFact, 'acknowledgment intake missing'); if (payload.acknowledgment === 'reaction' || payload.acknowledgment === 'text') nonempty(payload.value, 'acknowledgment value missing'); break;
    case 'fetch-inbound-media': nonempty(payload.inboundReceipt, 'media inbound receipt missing');
      exactObject(payload.intakeCapture, ['reference', 'hash'], 'media intake capture fields invalid');
      nonempty(payload.intakeCapture.reference, 'media intake capture missing'); hash(payload.intakeCapture.hash, 'media intake capture hash malformed');
      nonempty(payload.platformFile, 'media platform file missing');
      ensure(Number.isSafeInteger(payload.maximumBytes) && payload.maximumBytes > 0 && payload.mediaTypes.length > 0, 'media fetch bound missing');
      payload.mediaTypes.forEach(value => nonempty(value, 'media type missing'));
      unique(payload.mediaTypes, 'media type set duplicate'); break;
    case 'derive-transcript': exactObject(payload.sourceCapture, ['reference', 'hash'], 'transcript capture fields invalid');
      nonempty(payload.sourceCapture.reference, 'transcript source capture missing'); hash(payload.sourceCapture.hash, 'transcript source hash malformed');
      for (const [captureValue, label] of [[payload.submittedCapture, 'submitted'], [payload.responseCapture, 'response']] as const) {
        exactObject(captureValue, ['reference', 'hash'], `transcript ${label} capture fields invalid`);
        nonempty(captureValue.reference, `transcript ${label} capture missing`); hash(captureValue.hash, `transcript ${label} hash malformed`);
      }
      for (const value of [payload.providerOperation, payload.model, payload.destinationStep, payload.originatingIntake])
        nonempty(value, 'transcript reference missing');
      ensure(payload.maximumOutputBytes > 0 && Number.isSafeInteger(payload.maximumOutputBytes), 'transcript output bound'); break;
  }
  if (host) referencedPayloadFacts(payload, host, facts, clock);
}

export function decodeEffectPayload(input: unknown, host: EffectHost): Result<TypedEffectPayload> {
  return boundary('EffectPayloadInput', input, host.boundary, () => {
    const safe = json(input) as unknown as TypedEffectPayload; validateEffectPayload(safe, host); return freeze(safe);
  });
}

const observation = (kind: EffectPayloadKind): ObservationCapabilities => freeze({
  occurrence: `${kind}:independent-target-occurrence-v1`,
  nonOccurrence: `${kind}:decisive-target-non-occurrence-v1`,
  quiescence: `${kind}:executor-and-delivery-quiescence-v1`,
  charge: `${kind}:final-accounted-charge-v1`,
});
export const effectOperationContracts: Readonly<Record<EffectPayloadKind, Readonly<{
  inputSchema: string; canonicalization: 'instar-canonical-json-v1'; observations: ObservationCapabilities;
}>>> = freeze(Object.fromEntries((['ordinary-reply', ...Object.keys(variantFields)] as EffectPayloadKind[]).map(kind => [kind, {
  inputSchema: kind === 'ordinary-reply' ? 'outbound-message/ordinary-reply@1' : `effect-payload/${kind}@1`,
  canonicalization: 'instar-canonical-json-v1' as const, observations: observation(kind),
}])) as Record<EffectPayloadKind, { inputSchema: string; canonicalization: 'instar-canonical-json-v1'; observations: ObservationCapabilities }>);

export function payloadKind(payload: EffectPayload): EffectPayloadKind { return payload.type === 'OutboundMessage' ? 'ordinary-reply' : payload.kind }
