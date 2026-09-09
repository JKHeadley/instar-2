import type { Json, Result } from '../index.js';
import type { OwnedShape } from '../facts/index.js';
import type { EffectHost } from './contracts.js';
import { boundary, encoded, ensure, freeze, json } from './boundary.js';

declare const payloadOwned: unique symbol;
interface PayloadOwned { readonly [payloadOwned]: 'part-eight' }
interface EffectPayloadIdentity extends PayloadOwned {
  readonly type: 'EffectPayload'; readonly schemaVersion: 1; readonly id: string;
  readonly kind: ConversationEffectKind | RecoveryEffectKind; readonly semanticMessage: string;
  readonly run: string; readonly step: string; readonly sourceResult: string;
  readonly logicalEffect: string; readonly targetDigest: string;
}
export type EffectPurpose = 'requested-result' | 'required-action' | 'ordinary-reply' | 'infrastructure-receipt';
export type ConversationEffectKind = 'post-text' | 'post-media' | 'edit-message' | 'react' | 'create-topic' |
  'acknowledge' | 'fetch-inbound-media' | 'derive-transcript';
export type RecoveryEffectKind = 'process-control' | 'scheduler-control' | 'account-route-change' |
  'configuration-change' | 'filesystem-mutation' | 'git-mutation' | 'infrastructure-notice';
export type EffectPayloadKind = 'ordinary-reply' | ConversationEffectKind | RecoveryEffectKind;
export interface ObservationCapabilities {
  readonly occurrence: string; readonly nonOccurrence: string; readonly quiescence: string; readonly charge: string;
}
interface ConversationPayload extends EffectPayloadIdentity {
  readonly kind: ConversationEffectKind; readonly speaker: string; readonly account: string;
  readonly conversation: string; readonly purpose: EffectPurpose;
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
  readonly platformFile: string; readonly maximumBytes: number; readonly mediaTypes: readonly string[] }
export interface DeriveTranscriptPayload extends ConversationPayload { readonly kind: 'derive-transcript';
  readonly sourceCapture: { readonly reference: string; readonly hash: string }; readonly providerOperation: string; readonly model: string;
  readonly maximumOutputBytes: number; readonly destinationStep: string; readonly originatingIntake: string }
export interface ProcessControlPayload extends EffectPayloadIdentity { readonly kind: 'process-control';
  readonly action: 'start' | 'interrupt' | 'terminate' | 'close' | 'compact'; readonly machine: string; readonly processId: string;
  readonly processIncarnation: string; readonly parentIdentity: string; readonly startIdentity: string; readonly executable: string; readonly arguments: readonly string[] }
export interface SchedulerControlPayload extends EffectPayloadIdentity { readonly kind: 'scheduler-control'; readonly action: 'pause' | 'resume';
  readonly jobId: string; readonly jobGeneration: string; readonly finiteScope: string; readonly undoOperation: string; readonly reviewAt: number }
export interface AccountRouteChangePayload extends EffectPayloadIdentity { readonly kind: 'account-route-change'; readonly routeRun: string;
  readonly provider: string; readonly fromAccount: string; readonly toAccount: string; readonly sourceGeneration: string; readonly rollbackRoute: string }
export interface ConfigurationChangePayload extends EffectPayloadIdentity { readonly kind: 'configuration-change'; readonly canonicalTarget: string;
  readonly expectedPriorDigest: string; readonly proposedBytes: string; readonly proposedDigest: string; readonly undoReference: string }
export interface FilesystemMutationPayload extends EffectPayloadIdentity { readonly kind: 'filesystem-mutation';
  readonly action: 'create' | 'replace' | 'move' | 'remove';
  readonly fileTargets: readonly Readonly<{ canonicalPath: string; resolvedPath: string; ancestryDigest: string; priorDigest: string }>[];
  readonly proposedBytes: string; readonly proposedDigest: string; readonly undoSemantics: string; readonly protectedTargetPolicy: string }
export interface GitMutationPayload extends EffectPayloadIdentity { readonly kind: 'git-mutation';
  readonly action: 'checkout' | 'branch-create' | 'branch-delete' | 'commit' | 'merge' | 'rebase' | 'reset' | 'tag-create' | 'tag-delete' | 'worktree-add' | 'worktree-remove' | 'push';
  readonly repository: string; readonly worktree: string; readonly ref: string; readonly base: string; readonly targets: readonly string[];
  readonly expectedHeads: readonly Readonly<{ ref: string; digest: string }>[]; readonly rollbackConstraints: readonly string[] }
export interface InfrastructureNoticePayload extends EffectPayloadIdentity { readonly kind: 'infrastructure-notice'; readonly notice: 'action-needed' | 'result';
  readonly infrastructureProvenance: string; readonly causalEpisode: string; readonly text: string }
export type TypedEffectPayload = PostTextPayload | PostMediaPayload | EditMessagePayload | ReactPayload | CreateTopicPayload |
  AcknowledgePayload | FetchInboundMediaPayload | DeriveTranscriptPayload | ProcessControlPayload | SchedulerControlPayload |
  AccountRouteChangePayload | ConfigurationChangePayload | FilesystemMutationPayload | GitMutationPayload | InfrastructureNoticePayload;
type EffectPayload = TypedEffectPayload | Readonly<{ type: 'OutboundMessage' }>;

const text = { kind: 'text', maxLength: 512 } as const;
const longText = { kind: 'text', maxLength: 4096 } as const;
const bytesText = { kind: 'text', maxLength: 16_384 } as const;
const integer = { kind: 'integer' } as const;
const boolean = { kind: 'boolean' } as const;
const capture = { kind: 'capture' } as const;
const strings = { kind: 'array', maxLength: 64, items: text } as const;
const attributes = { kind: 'array', maxLength: 32, items: { kind: 'object', fields: { key: text, value: text } } } as const;
const attachments = { kind: 'array', maxLength: 16, items: { kind: 'object', fields: {
  capture, mediaType: text, bytes: integer, filename: text,
} } } as const;
const fileTargets = { kind: 'array', maxLength: 64, items: { kind: 'object', fields: {
  canonicalPath: text, resolvedPath: text, ancestryDigest: text, priorDigest: text,
} } } as const;
const expectedHeads = { kind: 'array', maxLength: 64, items: { kind: 'object', fields: { ref: text, digest: text } } } as const;

const commonFields = ['type', 'schemaVersion', 'id', 'kind', 'semanticMessage', 'run', 'step', 'sourceResult', 'logicalEffect', 'targetDigest'] as const;
const conversationFields = ['speaker', 'account', 'conversation', 'purpose'] as const;
const variantFields: Readonly<Record<TypedEffectPayload['kind'], readonly string[]>> = freeze({
  'post-text': [...commonFields, ...conversationFields, 'text'],
  'post-media': [...commonFields, ...conversationFields, 'caption', 'attachments'],
  'edit-message': [...commonFields, ...conversationFields, 'targetMessage', 'text'],
  react: [...commonFields, ...conversationFields, 'targetMessage', 'reaction'],
  'create-topic': [...commonFields, ...conversationFields, 'parentConversation', 'title', 'attributes'],
  acknowledge: [...commonFields, ...conversationFields, 'inboundFact', 'acknowledgment', 'value', 'decorative'],
  'fetch-inbound-media': [...commonFields, ...conversationFields, 'inboundReceipt', 'platformFile', 'maximumBytes', 'mediaTypes'],
  'derive-transcript': [...commonFields, ...conversationFields, 'sourceCapture', 'providerOperation', 'model', 'maximumOutputBytes', 'destinationStep', 'originatingIntake'],
  'process-control': [...commonFields, 'action', 'machine', 'processId', 'processIncarnation', 'parentIdentity', 'startIdentity', 'executable', 'arguments'],
  'scheduler-control': [...commonFields, 'action', 'jobId', 'jobGeneration', 'finiteScope', 'undoOperation', 'reviewAt'],
  'account-route-change': [...commonFields, 'routeRun', 'provider', 'fromAccount', 'toAccount', 'sourceGeneration', 'rollbackRoute'],
  'configuration-change': [...commonFields, 'canonicalTarget', 'expectedPriorDigest', 'proposedBytes', 'proposedDigest', 'undoReference'],
  'filesystem-mutation': [...commonFields, 'action', 'fileTargets', 'proposedBytes', 'proposedDigest', 'undoSemantics', 'protectedTargetPolicy'],
  'git-mutation': [...commonFields, 'action', 'repository', 'worktree', 'ref', 'base', 'targets', 'expectedHeads', 'rollbackConstraints'],
  'infrastructure-notice': [...commonFields, 'notice', 'infrastructureProvenance', 'causalEpisode', 'text'],
});

export const effectPayloadShape: OwnedShape = freeze({ kind: 'object', fields: {
  type: text, schemaVersion: integer, id: text, kind: text, semanticMessage: text, run: text, step: text,
  sourceResult: text, logicalEffect: text, targetDigest: text,
  speaker: text, account: text, conversation: text, purpose: text,
  text: longText, caption: longText, attachments, targetMessage: text, reaction: text,
  parentConversation: text, title: text, attributes, inboundFact: text, acknowledgment: text,
  value: longText, decorative: boolean, inboundReceipt: text, platformFile: text, maximumBytes: integer,
  mediaTypes: strings, sourceCapture: capture, providerOperation: text, model: text, maximumOutputBytes: integer,
  destinationStep: text, originatingIntake: text, action: text, machine: text, processId: text,
  processIncarnation: text, parentIdentity: text, startIdentity: text, executable: text, arguments: strings,
  jobId: text, jobGeneration: text, finiteScope: text, undoOperation: text, reviewAt: integer,
  routeRun: text, provider: text, fromAccount: text, toAccount: text, sourceGeneration: text, rollbackRoute: text,
  canonicalTarget: text, expectedPriorDigest: text, proposedBytes: bytesText, proposedDigest: text, undoReference: text,
  fileTargets, targets: strings, expectedHeads, rollbackConstraints: strings, undoSemantics: text, protectedTargetPolicy: text,
  repository: text, worktree: text, ref: text, base: text, notice: text, infrastructureProvenance: text,
  causalEpisode: text,
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
const absoluteCanonical = (value: string): boolean => value.startsWith('/') && !value.includes('//') && !value.split('/').includes('..') && !value.split('/').includes('.');
const safeRelative = (value: string): boolean => value.length > 0 && !value.startsWith('/') && !value.split('/').includes('..') && !value.split('/').includes('.');
const unique = (values: readonly string[], detail: string): void => ensure(new Set(values).size === values.length, detail);

type EffectPayloadDraft = TypedEffectPayload extends infer P ? P extends TypedEffectPayload ? Omit<P, 'id' | 'targetDigest'> : never : never;

export function effectPayloadTarget(payload: EffectPayloadDraft | TypedEffectPayload): Json {
  switch (payload.kind) {
    case 'post-text': case 'post-media': return { account: payload.account, conversation: payload.conversation };
    case 'edit-message': case 'react': return { account: payload.account, conversation: payload.conversation, message: payload.targetMessage };
    case 'create-topic': return { account: payload.account, conversation: payload.parentConversation };
    case 'acknowledge': return { account: payload.account, conversation: payload.conversation, inboundFact: payload.inboundFact };
    case 'fetch-inbound-media': return { account: payload.account, conversation: payload.conversation, inboundReceipt: payload.inboundReceipt, platformFile: payload.platformFile };
    case 'derive-transcript': return { capture: payload.sourceCapture, destinationStep: payload.destinationStep, originatingIntake: payload.originatingIntake };
    case 'process-control': return { machine: payload.machine, processId: payload.processId, incarnation: payload.processIncarnation, parent: payload.parentIdentity, start: payload.startIdentity };
    case 'scheduler-control': return { job: payload.jobId, generation: payload.jobGeneration, scope: payload.finiteScope };
    case 'account-route-change': return { run: payload.routeRun, provider: payload.provider, from: payload.fromAccount, to: payload.toAccount, generation: payload.sourceGeneration };
    case 'configuration-change': return { target: payload.canonicalTarget, prior: payload.expectedPriorDigest };
    case 'filesystem-mutation': return { targets: payload.fileTargets.map(target => ({ canonicalPath: target.canonicalPath, resolvedPath: target.resolvedPath, ancestryDigest: target.ancestryDigest, priorDigest: target.priorDigest })) };
    case 'git-mutation': return { repository: payload.repository, worktree: payload.worktree, ref: payload.ref, base: payload.base, targets: payload.targets, heads: payload.expectedHeads };
    case 'infrastructure-notice': return { provenance: payload.infrastructureProvenance, episode: payload.causalEpisode, notice: payload.notice };
  }
}

export function effectPayloadIdentity(input: EffectPayloadDraft): Readonly<{ id: string; targetDigest: string }> {
  const targetDigest = encoded(effectPayloadTarget(input)).hash;
  return freeze({ id: `payload:${encoded({ ...input, targetDigest }).hash}`, targetDigest });
}

export function validateEffectPayload(payload: TypedEffectPayload, host?: EffectHost): void {
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
    case 'fetch-inbound-media': ensure(Number.isSafeInteger(payload.maximumBytes) && payload.maximumBytes > 0 && payload.mediaTypes.length > 0, 'media fetch bound missing');
      unique(payload.mediaTypes, 'media type set duplicate'); break;
    case 'derive-transcript': exactObject(payload.sourceCapture, ['reference', 'hash'], 'transcript capture fields invalid');
      hash(payload.sourceCapture.hash, 'transcript source hash malformed');
      ensure(payload.maximumOutputBytes > 0 && Number.isSafeInteger(payload.maximumOutputBytes), 'transcript output bound'); break;
    case 'process-control': ensure(['start', 'interrupt', 'terminate', 'close', 'compact'].includes(payload.action), 'process action unknown');
      for (const value of [payload.machine, payload.processId, payload.processIncarnation, payload.parentIdentity, payload.startIdentity, payload.executable]) nonempty(value, 'process identity incomplete');
      ensure(payload.arguments.length <= 64, 'process arguments over bound'); break;
    case 'scheduler-control': ensure(['pause', 'resume'].includes(payload.action) && payload.reviewAt > 0 && Number.isSafeInteger(payload.reviewAt), 'scheduler finite review invalid');
      for (const value of [payload.jobId, payload.jobGeneration, payload.finiteScope, payload.undoOperation]) nonempty(value, 'scheduler identity incomplete'); break;
    case 'account-route-change': ensure(payload.fromAccount !== payload.toAccount, 'route change must change registered identity');
      for (const value of [payload.routeRun, payload.provider, payload.fromAccount, payload.toAccount, payload.sourceGeneration, payload.rollbackRoute]) nonempty(value, 'route change identity incomplete'); break;
    case 'configuration-change': ensure(absoluteCanonical(payload.canonicalTarget), 'configuration target is ambiguous');
      hash(payload.expectedPriorDigest, 'configuration prior digest malformed'); hash(payload.proposedDigest, 'configuration proposed digest malformed');
      ensure(encoded(payload.proposedBytes).hash === payload.proposedDigest, 'configuration proposed bytes digest mismatch'); nonempty(payload.undoReference, 'configuration undo missing'); break;
    case 'filesystem-mutation': ensure(['create', 'replace', 'move', 'remove'].includes(payload.action) && payload.fileTargets.length > 0 && payload.fileTargets.length <= 64, 'filesystem mutation bounds');
      payload.fileTargets.forEach(target => { exactObject(target, ['canonicalPath', 'resolvedPath', 'ancestryDigest', 'priorDigest'], 'filesystem target fields invalid');
        ensure(absoluteCanonical(target.canonicalPath) && target.canonicalPath === target.resolvedPath, 'filesystem symlink or canonical target ambiguity');
        hash(target.ancestryDigest, 'filesystem ancestry digest malformed'); hash(target.priorDigest, 'filesystem prior digest malformed'); });
      unique(payload.fileTargets.map(target => target.canonicalPath), 'filesystem target duplicate'); hash(payload.proposedDigest, 'filesystem proposed digest malformed');
      ensure(encoded(payload.proposedBytes).hash === payload.proposedDigest, 'filesystem proposed bytes digest mismatch');
      nonempty(payload.undoSemantics, 'filesystem undo missing'); nonempty(payload.protectedTargetPolicy, 'protected target policy missing'); break;
    case 'git-mutation': ensure(['checkout', 'branch-create', 'branch-delete', 'commit', 'merge', 'rebase', 'reset', 'tag-create', 'tag-delete', 'worktree-add', 'worktree-remove', 'push'].includes(payload.action), 'git operation unknown');
      ensure(absoluteCanonical(payload.repository) && absoluteCanonical(payload.worktree), 'git repository/worktree target ambiguity');
      ensure(payload.targets.length > 0 && payload.targets.every(safeRelative), 'git target set ambiguous'); unique(payload.targets, 'git target duplicate');
      payload.expectedHeads.forEach(head => { exactObject(head, ['ref', 'digest'], 'git expected-head fields invalid');
        nonempty(head.ref, 'git expected ref missing'); hash(head.digest, 'git expected head malformed'); });
      ensure(payload.expectedHeads.length > 0 && payload.rollbackConstraints.length > 0, 'git head/rollback constraints missing'); break;
    case 'infrastructure-notice': ensure(['action-needed', 'result'].includes(payload.notice), 'infrastructure notice kind');
      for (const value of [payload.infrastructureProvenance, payload.causalEpisode, payload.text]) nonempty(value, 'infrastructure notice provenance incomplete');
      if (host) ensure(host.principal.kind === 'system', 'infrastructure notice cannot impersonate agent or operator'); break;
  }
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
