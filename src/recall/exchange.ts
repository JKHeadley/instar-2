// Capture: one owned fact kind appended through the existing part-two store. The store
// owns signing, ordering, durability receipts, replication and restart recovery.
import type { BoundaryContext, Json, Result, Scope } from '../index.js';
import { authorAndAppend } from '../facts/index.js';
import type { FactEnvelope, FactSchema } from '../facts/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { redact } from './redact.js';
import { recallExchangeKind } from './contracts.js';
import type { CaptureReceipt, ExchangeInput, RecallWriter, RecalledExchange, SpeakerRole, Visibility } from './contracts.js';

const limits = { key: 256, name: 200, text: 8000, audience: 64 } as const;
const roles: readonly SpeakerRole[] = ['user', 'agent', 'system'];
const visibilities: readonly Visibility[] = ['public', 'participants', 'private'];

/** Install in the part-two schema registry. Authority 'none': an exchange is evidence of
 * what was said, never a command, grant or approval. */
export function recallExchangeSchema(scope: Scope): FactSchema {
  return freeze({ kind: recallExchangeKind, version: 1, machineScope: 'shared', standing: 'requester', action: 'work',
    scope, causallyBound: false, requiredReferences: [], authority: 'none',
    fields: {
      conversation: { kind: 'text', maxLength: limits.key }, session: { kind: 'text', maxLength: limits.key },
      messageId: { kind: 'text', maxLength: limits.key }, speakerId: { kind: 'text', maxLength: limits.key },
      speakerName: { kind: 'text', maxLength: limits.name }, speakerRole: { kind: 'text', maxLength: 16 },
      text: { kind: 'text', maxLength: limits.text }, visibility: { kind: 'text', maxLength: 16 },
      audience: { kind: 'text', maxLength: limits.audience * (limits.key + 1) }, redactions: { kind: 'integer' },
    } });
}

const key = (v: unknown, field: string, max: number = limits.key): string => {
  ensure(typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\n\r]/.test(v), `${field}: bounded single-line text required`);
  return v;
};
function validInput(raw: Json): ExchangeInput {
  ensure(raw !== null && typeof raw === 'object' && !Array.isArray(raw), 'exchange: object required');
  const v = raw as Record<string, Json>;
  ensure(roles.includes(v.speakerRole as SpeakerRole), 'speakerRole: user|agent|system required');
  ensure(visibilities.includes(v.visibility as Visibility), 'visibility: public|participants|private required');
  ensure(typeof v.text === 'string' && v.text.length <= limits.text, `text: at most ${limits.text} characters`);
  ensure(Array.isArray(v.audience) && v.audience.length <= limits.audience, 'audience: bounded list required');
  const audience = v.audience.map(id => key(id, 'audience'));
  ensure(new Set(audience).size === audience.length, 'audience: duplicate principal');
  ensure(v.visibility !== 'participants' || audience.length > 0, 'participants visibility requires an audience');
  return { conversation: key(v.conversation, 'conversation'), session: key(v.session, 'session'),
    messageId: key(v.messageId, 'messageId'), speakerId: key(v.speakerId, 'speakerId'),
    speakerName: key(v.speakerName, 'speakerName', limits.name), speakerRole: v.speakerRole as SpeakerRole,
    text: v.text, visibility: v.visibility as Visibility, audience };
}

/** Reads one stored fact as an exchange, or null when it is not one / is malformed. */
export function readExchange(fact: FactEnvelope): RecalledExchange | null {
  if (fact.kind !== recallExchangeKind || fact.schemaVersion !== 1) return null;
  const b = fact.body as Record<string, Json>;
  if (!b || typeof b !== 'object') return null;
  const s = (k: string) => (typeof b[k] === 'string' ? b[k] as string : null);
  const fields = ['conversation', 'session', 'messageId', 'speakerId', 'speakerName', 'speakerRole', 'text', 'visibility', 'audience'].map(s);
  if (fields.some(f => f === null) || !Number.isSafeInteger(b.redactions)) return null;
  const [conversation, session, messageId, speakerId, speakerName, speakerRole, text, visibility, audience] = fields as string[];
  if (!roles.includes(speakerRole as SpeakerRole)) return null;
  // An unknown visibility can never widen reveal: it reads as private.
  const vis: Visibility = visibilities.includes(visibility as Visibility) ? visibility as Visibility : 'private';
  return freeze({ factId: fact.id, machine: fact.machine, at: fact.at.value, conversation: conversation!, session: session!,
    messageId: messageId!, speakerId: speakerId!, speakerName: speakerName!, speakerRole: speakerRole as SpeakerRole,
    text: text!, visibility: vis, audience: audience ? audience.split('\n') : [], redactions: b.redactions as number });
}

/**
 * Durably records one exchange. Returns only after the store's durability receipt.
 * Idempotent on (conversation, messageId): a redelivery returns the original fact id and
 * appends nothing; the same id with different content is refused as an integrity signal.
 * `at` is the part-one clock input sampled by the caller when the message was observed.
 */
export function captureExchange(input: ExchangeInput, at: Json, writer: RecallWriter): Result<CaptureReceipt> {
  const c: BoundaryContext = { site: writer.context.site, preserved: writer.context.preserved, register: writer.context.decode.register };
  return boundary('RecallCapture', input, c, raw => {
    const exchange = validInput(raw);
    const scrubbed = redact(exchange.text);
    const facts = [...writer.context.facts, ...take(writer.store.read())];
    for (const fact of facts) {
      const prior = readExchange(fact);
      if (!prior || prior.conversation !== exchange.conversation || prior.messageId !== exchange.messageId) continue;
      ensure(prior.text === scrubbed.text && prior.speakerId === exchange.speakerId,
        `message id ${exchange.messageId} reused with different content`, 'integrity');
      return { factId: prior.factId, duplicate: true, redactions: prior.redactions, durability: { kind: 'already-recorded' as const } };
    }
    const body = { conversation: exchange.conversation, session: exchange.session, messageId: exchange.messageId,
      speakerId: exchange.speakerId, speakerName: exchange.speakerName, speakerRole: exchange.speakerRole,
      text: scrubbed.text, visibility: exchange.visibility, audience: exchange.audience.join('\n'), redactions: scrubbed.count };
    const receipt = take(authorAndAppend({ kind: recallExchangeKind, schemaVersion: 1, machine: writer.machine,
      principal: writer.principal as Json, provenance: writer.provenance as Json,
      at, body, required: [] }, writer.context, writer.store, writer.privateKey));
    return { factId: receipt.fact.id, duplicate: false, redactions: scrubbed.count, durability: receipt.durability };
  });
}
