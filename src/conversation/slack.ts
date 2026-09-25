/** Slack Socket Mode preparation: one bound text route, durable custody, and held reply. */
import { canonical, consumeResult } from '../index.js';
import type { BoundaryContext, Clock, ProvenanceInput, Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import type { FactStorePort } from '../facts/index.js';
import type { InboundRoute, IntakeAdapterPort, IntakePort, IntakeDisposition } from '../intake/index.js';
import type { OperationAdapterPort, EffectDoorway, EffectRequest } from '../effects/index.js';
import { boundary, ensure, take } from './boundary.js';

export const slackParserDeclarationId = 'slack-intake-v1';
export const slackFeatureDeclarationId = 'slack-conversation-adapter';
export interface SlackSelection {
  readonly app: string; readonly team: string; readonly bot: string; readonly operator: string; readonly principal: string;
  readonly channel: string; readonly thread: string | null; readonly epoch: string;
}
export interface SlackSocketAuthority {
  readonly owner: 'part-ten';
  readonly incarnation: string;
  currentIncarnation(): string;
  authenticate(input: Readonly<{ raw: string; route: InboundRoute; at: Clock }>): Result<ProvenanceInput>;
  readCapture(reference: string): Result<string>;
}
const object = (v: unknown): Readonly<Record<string, unknown>> => {
  ensure(v !== null && typeof v === 'object' && !Array.isArray(v), 'Slack object required');
  return v as Readonly<Record<string, unknown>>;
};
const name = (v: unknown, field: string): string => {
  ensure(typeof v === 'string' && v.length > 0 && v.length <= 256, `Slack ${field} is missing or too long`);
  return v;
};
const id = (v: unknown, field: string): string => {
  const s = name(v, field);
  ensure(/^[A-Z0-9]+$/u.test(s), `Slack ${field} is malformed`);
  return s;
};
const timestamp = (v: unknown, field: string): string => {
  const s = name(v, field);
  ensure(/^[0-9]+\.[0-9]+$/u.test(s), `Slack ${field} is malformed`);
  return s;
};
export function slackConversation(selection: SlackSelection): string {
  return `slack:v1:${selection.app}:${selection.team}:${selection.channel}:${selection.thread ?? 'dm'}`;
}
export function extractSlackEnvelope(raw: string, selection: SlackSelection): Readonly<{
  envelopeId: string; route: InboundRoute; text: string | null; eventId: string;
}> {
  const envelope = object(JSON.parse(raw) as unknown);
  const envelopeId = name(envelope.envelope_id, 'envelope id');
  ensure(envelope.type === 'events_api', 'only Slack Events API envelopes are prepared');
  const payload = object(envelope.payload);
  ensure(payload.team_id === selection.team && payload.api_app_id === selection.app,
    'Slack app or workspace differs from bound selection');
  const eventId = name(payload.event_id, 'event id');
  const event = object(payload.event);
  ensure(event.type === 'message' && event.channel === selection.channel,
    'Slack event is outside the selected text conversation');
  const sender = id(event.user, 'sender');
  timestamp(event.event_ts, 'event timestamp');
  if (selection.thread !== null) ensure(event.thread_ts === selection.thread,
    'Slack thread differs from bound selection');
  else ensure(event.thread_ts === undefined || event.thread_ts === null,
    'Slack thread differs from bound DM');
  ensure(event.bot_id === undefined && event.subtype === undefined,
    'Slack bot and edited events are outside the requester slice');
  const text = typeof event.text === 'string' && event.text.length > 0 && Object.keys(event).every(k =>
    ['type', 'channel', 'user', 'event_ts', 'thread_ts', 'text', 'ts'].includes(k)) ? event.text : null;
  return { envelopeId, route: { channel: slackConversation(selection), sender,
    identityEpoch: selection.epoch, eventId }, text, eventId };
}
export function createSlackIntakeAdapter(selection: SlackSelection, socket: SlackSocketAuthority,
  context: BoundaryContext): IntakeAdapterPort {
  ensure(socket.owner === 'part-ten', 'Slack socket authority must be Part Ten');
  return Object.freeze({ id: slackParserDeclarationId,
    authenticate(raw: string, route: InboundRoute, at: Clock) {
      return boundary('SlackInboundAuthentication', { route }, context, () => {
        ensure(socket.incarnation === socket.currentIncarnation(), 'stale Slack socket incarnation');
        const extracted = extractSlackEnvelope(raw, selection);
        ensure(take(canonical(extracted.route)).bytes === take(canonical(route)).bytes,
          'Slack authenticated route differs from captured envelope');
        ensure(route.sender === selection.operator, 'Slack sender is not the bound operator');
        const provenance = take(socket.authenticate({ raw, route, at }));
        return { provenance, principalId: selection.principal, principalKind: 'person' as const,
          channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch };
      });
    },
    parse(raw: string) {
      const event = extractSlackEnvelope(raw, selection);
      return event.text === null ? { schemaVersion: 1, kind: 'held-slack-event' }
        : { schemaVersion: 1, kind: 'message', text: event.text };
    },
  });
}
export function createSlackIngress(input: Readonly<{ selection: SlackSelection; socket: SlackSocketAuthority;
  intake: IntakePort; facts: FactStorePort; observer: string; boundary: BoundaryContext;
  acknowledge(envelopeId: string): Result<void> }>) {
  ensure(input.socket.owner === 'part-ten' && input.observer.length > 0, 'Slack ingress needs owner custody');
  return Object.freeze({
    receive(raw: string): Result<Readonly<{ receipt: string; disposition: 'admitted' | 'duplicate' | 'held' }>> {
      return boundary('SlackSocketIngress', { hash: hashBytes(raw) }, input.boundary, () => {
        ensure(input.socket.incarnation === input.socket.currentIncarnation(), 'stale Slack socket incarnation');
        const extracted = extractSlackEnvelope(raw, input.selection);
        const outcome = input.intake.receive(raw, extracted.route);
        const ingress = take(canonical(extracted.route)).bytes;
        const rows = take(input.facts.read());
        const receipt = rows.find(f => f.kind === 'intake-receipt' && f.principal.id === input.observer
          && f.principal.provenance.class === 'verified' && f.provenance.class === 'verified'
          && (f.body as { adapter?: unknown }).adapter === slackParserDeclarationId
          && (f.body as { rawHash?: unknown }).rawHash === hashBytes(raw)
          && (f.body as { ingress?: unknown }).ingress === ingress);
        ensure(receipt, 'Slack envelope has no durable owner receipt');
        const capture = (receipt.body as { capture?: { reference?: string; hash?: string } }).capture;
        ensure(capture?.reference && capture.hash === hashBytes(raw)
          && hashBytes(take(input.socket.readCapture(capture.reference))) === capture.hash,
        'Slack original envelope capture is unavailable');
        let disposition: 'admitted' | 'duplicate' | 'held' = 'held';
        consumeResult<IntakeDisposition, void>(outcome, {
          Success: value => { disposition = value.kind === 'admitted' ? 'admitted' : value.kind === 'duplicate' ? 'duplicate' : 'held'; },
          Refused: refusal => {
            ensure(rows.some(f => f.id === refusal.preserved && ['intake-held', 'intake-mismatch'].includes(f.kind)),
              'Slack refusal lacks durable owned disposition');
          },
        });
        take(input.acknowledge(extracted.envelopeId));
        return { receipt: receipt.id, disposition };
      });
    },
  });
}
/** Candidate only. The fixed profile has not admitted Slack to its local closed set. */
export function createHeldSlackReplyOperation(selection: SlackSelection, context: BoundaryContext): OperationAdapterPort &
  Readonly<{ prepare(doorway: EffectDoorway, request: Parameters<EffectDoorway['prepare']>[0]): Result<EffectRequest> }> {
  return Object.freeze({ owner: 'part-ten' as const, id: `slack:v1:${selection.app}:${selection.team}`,
    describe: () => ({ contract: 'slack-reply-held:v1', account: `slack:v1:${selection.app}:${selection.team}`,
      conversation: slackConversation(selection), maxCharge: 0, timeout: 30000, hiddenRetries: 0 as const }),
    prepare(_doorway: EffectDoorway, request: Parameters<EffectDoorway['prepare']>[0]) {
      return boundary<EffectRequest>('SlackReplyPreparationHeld', { message: request.message.id }, context, () => {
        ensure(request.message.purpose === 'ordinary-reply', 'Slack candidate accepts only ordinary replies');
        throw new Error('Slack local-durable ordinary reply is outside the current fixed-profile closed set');
      });
    },
    invoke(input: Parameters<OperationAdapterPort['invoke']>[0]) {
      return boundary<string>('SlackReplyDispatchHeld', { operation: input.operation }, context, () => {
        throw new Error('Slack reply dispatch is held until the constitutional and installed P-08 sets admit it');
      });
    },
    observe(input: Parameters<OperationAdapterPort['observe']>[0]) {
      return boundary<string>('SlackReplyObserveHeld', { operation: input.operation }, context, () => {
        throw new Error('Slack has no dispatched operation to observe under this hold');
      });
    },
  });
}
