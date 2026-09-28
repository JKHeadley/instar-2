/**
 * Design 10 §6–7 — Threadline as the reference adapter of the agent-transport
 * port. "No mandatory Threadline service" is a deployment boundary: the relay
 * (optional store-and-forward) and key custody are injected. The adapter only
 * maps authenticated frames into the port's states; it never redefines them.
 *
 * Wire: signed end-to-end authenticated encryption. The inner frame (routing,
 * payload and the sender's Ed25519 signature over both) is sealed to the
 * recipient with the routing identifiers as associated data. The relay holds
 * only those routing identifiers, the ciphertext and its length (the privacy
 * cost the design accepts); never the contract, question, result or grants.
 * Re-sealing a retry for a changed route preserves the inner key and digest.
 *
 * Observed constraints this mapping honours (design 10 §6, A1–A4):
 *  - a retry re-seals a frame but preserves the logical message key and digest;
 *  - relay acceptance maps only to `accepted-by-transport`;
 *  - a relay queue acknowledgement never substitutes for the recipient's receipt;
 *  - session/queue labels are not delivery evidence.
 * A receipt counts only when its authenticated signer is the exact recipient this
 * adapter sent that key and digest to, in that conversation. Unknown suites
 * refuse and never negotiate down.
 */
import type { BoundaryContext } from '../index.js';
import type { AgentEndpoint, AgentTransportEnvelope, AgentTransportPort, CapabilityAdvertisement, DeliveryEvidence,
  EndpointReceipt } from '../rungraph/index.js';
import { envelopeIntact, evidenceFromReceipt, semanticDigest } from '../rungraph/index.js';
import { boundary, encoded, ensure, freeze } from './boundary.js';

export const THREADLINE_PROTOCOL = 'threadline-ref-v2';
export const THREADLINE_SUITE = 'ed25519-x25519-hkdf-sha256-chacha20poly1305-v1';
/** Relay-visible identifiers: exactly what the design accepts revealing. */
export interface ThreadlineRouting {
  readonly protocol: string; readonly suite: string; readonly schemaVersion: number;
  readonly kind: 'envelope' | 'lookup' | 'receipt';
  readonly sender: string; readonly recipient: string; readonly conversation: string;
  readonly key: string; readonly digest: string;
  /** Delivery-attempt identity: one per transmission, never part of the logical identity. */
  readonly attempt: string;
}
export interface ThreadlineSealedBox { readonly salt: string; readonly nonce: string; readonly sealed: string }
/** What the relay stores and forwards: routing plus ciphertext. */
export interface ThreadlineFrame extends ThreadlineRouting, ThreadlineSealedBox {}
/** Inside the ciphertext only. */
export interface ThreadlinePayload { readonly envelope: AgentTransportEnvelope | null; readonly receipt: EndpointReceipt | null }
/** Optional store-and-forward relay. `submit` throwing means the outcome is unknown. */
export interface ThreadlineRelay {
  submit(frame: ThreadlineFrame): 'accepted' | 'rejected';
  collect(recipient: string): readonly ThreadlineFrame[];
}
/** Key custody (e.g. `createThreadlineKeyCustody`): signing, verification, sealing and opening; no key leaves it. */
export interface ThreadlineKeys {
  readonly principal: string;
  sign(bytes: string): string;
  verify(principal: string, bytes: string, signature: string): 'valid' | 'invalid' | 'unknown-key';
  seal(recipient: string, associated: string, plaintext: string): ThreadlineSealedBox | 'unknown-key';
  open(sender: string, associated: string, box: ThreadlineSealedBox): string | 'invalid' | 'unknown-key';
}
export type ThreadlineRejection = Readonly<{ reason: 'unknown-suite' | 'future-schema' | 'wrong-recipient' | 'unknown-key'
  | 'bad-signature' | 'bad-ciphertext' | 'malformed' | 'binding-mismatch' | 'unexpected-receipt'; sender: string; key: string }>;
export interface ThreadlineAdapter {
  readonly port: AgentTransportPort;
  /** Drain this agent's inbox: admit envelopes through the endpoint, answer lookups, keep verified receipts. */
  pump(endpoint: AgentEndpoint): readonly ThreadlineRejection[];
}

const routingOf = (f: ThreadlineRouting): ThreadlineRouting => ({ protocol: f.protocol, suite: f.suite, schemaVersion: f.schemaVersion,
  kind: f.kind, sender: f.sender, recipient: f.recipient, conversation: f.conversation, key: f.key, digest: f.digest, attempt: f.attempt });
const associated = (routing: ThreadlineRouting) => encoded(routingOf(routing)).bytes;

/** Builds one sealed frame from this custody's principal: sign the inner frame, then seal it to the recipient. */
export function sealThreadlineFrame(keys: ThreadlineKeys, fields: Omit<ThreadlineRouting, 'protocol' | 'suite' | 'schemaVersion' | 'sender'>,
  payload: ThreadlinePayload): ThreadlineFrame | 'unknown-key' {
  const routing = routingOf({ protocol: THREADLINE_PROTOCOL, suite: THREADLINE_SUITE, schemaVersion: 1, sender: keys.principal, ...fields });
  const signed = { routing, envelope: payload.envelope, receipt: payload.receipt };
  const inner = { ...signed, signature: keys.sign(encoded(signed).bytes) };
  const box = keys.seal(routing.recipient, associated(routing), encoded(inner).bytes);
  return box === 'unknown-key' ? box : freeze({ ...routing, salt: box.salt, nonce: box.nonce, sealed: box.sealed });
}

export function createThreadlineReferenceAdapter(input: Readonly<{ keys: ThreadlineKeys; relay: ThreadlineRelay;
  now: () => number; freshFor: number; context: BoundaryContext;
  advertisements: (peer: string) => readonly CapabilityAdvertisement[] }>): ThreadlineAdapter {
  const { keys, relay, context } = input;
  const receipts = new Map<string, EndpointReceipt>();
  /** Which recipient and conversation each key+digest was sent to: the only party whose receipt counts. */
  const sentTo = new Map<string, Readonly<{ recipient: string; conversation: string }>>();
  const id = (key: string, digest: string) => `${key}\u0000${digest}`;
  const open = (f: ThreadlineFrame): ThreadlineRejection['reason'] | ThreadlinePayload => {
    if (!f || typeof f !== 'object') return 'malformed';
    const texts = [f.protocol, f.suite, f.kind, f.sender, f.recipient, f.conversation, f.key, f.digest, f.attempt, f.salt, f.nonce, f.sealed];
    if (texts.some(value => typeof value !== 'string') || !Number.isSafeInteger(f.schemaVersion)) return 'malformed';
    if (f.protocol !== THREADLINE_PROTOCOL || f.suite !== THREADLINE_SUITE) return 'unknown-suite';
    if (f.schemaVersion !== 1) return 'future-schema';
    if (f.recipient !== keys.principal) return 'wrong-recipient';
    const routing = routingOf(f);
    let plain: string;
    try { plain = keys.open(f.sender, associated(routing), f); } catch { return 'malformed'; }
    if (plain === 'unknown-key') return 'unknown-key';
    // Any change to the ciphertext or to the routing it authenticates fails here.
    if (plain === 'invalid') return 'bad-ciphertext';
    let inner: { routing: ThreadlineRouting; envelope: AgentTransportEnvelope | null; receipt: EndpointReceipt | null; signature: string };
    try { inner = JSON.parse(plain) as typeof inner; } catch { return 'malformed'; }
    if (!inner || typeof inner.signature !== 'string' || !inner.routing) return 'malformed';
    const signed = { routing: inner.routing, envelope: inner.envelope ?? null, receipt: inner.receipt ?? null };
    let verdict: 'valid' | 'invalid' | 'unknown-key';
    try {
      if (encoded(routingOf(inner.routing)).bytes !== encoded(routing).bytes) return 'binding-mismatch';
      verdict = keys.verify(f.sender, encoded(signed).bytes, inner.signature);
    } catch { return 'malformed'; }
    if (verdict === 'unknown-key') return 'unknown-key';
    if (verdict !== 'valid') return 'bad-signature';
    const envelope = signed.envelope, receipt = signed.receipt;
    if (envelope && (!envelopeIntact(envelope) || envelope.key !== f.key || semanticDigest(envelope) !== f.digest || envelope.sender !== f.sender
      || envelope.recipient !== f.recipient || envelope.conversation !== f.conversation)) return 'binding-mismatch';
    if (receipt && (receipt.key !== f.key || receipt.digest !== f.digest)) return 'binding-mismatch';
    return { envelope, receipt };
  };
  const evidence = (envelope: AgentTransportEnvelope, attempt: string, fields: Pick<DeliveryEvidence, 'state' | 'witness' | 'authoritative'>
    & Partial<Pick<DeliveryEvidence, 'refusedWhat' | 'unresolved'>>): DeliveryEvidence => freeze({ type: 'DeliveryEvidence', schemaVersion: 1,
    key: envelope.key, digest: envelope.digest, edge: envelope.edge, conversation: envelope.conversation, attempt,
    observedAt: input.now(), freshFor: input.freshFor, ...fields });
  const submit = (envelope: AgentTransportEnvelope, attempt: string, kind: 'envelope' | 'lookup'): DeliveryEvidence => {
    const digest = semanticDigest(envelope);
    sentTo.set(id(envelope.key, digest), { recipient: envelope.recipient, conversation: envelope.conversation });
    const f = sealThreadlineFrame(keys, { kind, recipient: envelope.recipient, conversation: envelope.conversation, key: envelope.key,
      digest, attempt }, { envelope, receipt: null });
    if (f === 'unknown-key') return evidence(envelope, attempt, { state: 'refused', witness: { kind: 'transport', principal: THREADLINE_PROTOCOL },
      authoritative: 'custody:unknown-recipient-key', refusedWhat: 'transport-send' });
    let verdict: 'accepted' | 'rejected';
    try { verdict = relay.submit(f); }
    catch (error) {
      return evidence(envelope, attempt, { state: 'uncertain', witness: { kind: 'observer', principal: keys.principal },
        authoritative: 'relay:unknown', unresolved: `relay outcome unknown (${error instanceof Error ? error.message : 'interrupted'})` });
    }
    return verdict === 'accepted'
      ? evidence(envelope, attempt, { state: 'accepted-by-transport', witness: { kind: 'transport', principal: THREADLINE_PROTOCOL },
        authoritative: `relay:${attempt}` })
      : evidence(envelope, attempt, { state: 'refused', witness: { kind: 'transport', principal: THREADLINE_PROTOCOL },
        authoritative: `relay:${attempt}`, refusedWhat: 'transport-send' });
  };
  const known = (envelope: AgentTransportEnvelope) => {
    const receipt = receipts.get(id(envelope.key, semanticDigest(envelope)));
    return receipt && receipt.state !== 'unknown' ? receipt : undefined;
  };
  const port: AgentTransportPort = freeze({
    adapter: THREADLINE_PROTOCOL,
    describe: (peer, required) => boundary('ThreadlineDescribe', { peer, required: [...required] }, context, () => {
      const observed = input.advertisements(peer).filter(ad => ad.agent === peer);
      ensure(observed.length > 0, `no capability observation for ${peer}`);
      return observed;
    }),
    send: (envelope, attempt, mode) => boundary('ThreadlineSend', { key: envelope.key, attempt, mode }, context, () => {
      ensure(envelopeIntact(envelope), 'envelope digest does not match its fields');
      ensure(envelope.sender === keys.principal, 'an adapter sends only as its own principal');
      // Lookup mode reads stored evidence and never re-submits the original envelope.
      if (mode === 'lookup') {
        const receipt = known(envelope);
        // A stored signed proof stays true; a non-terminal one is refreshed by another read-only lookup.
        if (receipt && (receipt.state === 'answered' || receipt.state === 'refused'))
          return evidenceFromReceipt(envelope, receipt, attempt, input.now(), input.freshFor, null);
        const sent = submit(envelope, attempt, 'lookup');
        if (receipt) return evidenceFromReceipt(envelope, receipt, attempt, input.now(), input.freshFor, null);
        return sent.state === 'uncertain' ? sent : evidence(envelope, attempt, { state: 'uncertain',
          witness: { kind: 'observer', principal: keys.principal }, authoritative: `lookup:${attempt}`,
          unresolved: `lookup sent; no signed receipt for ${envelope.key} yet` });
      }
      return submit(envelope, attempt, 'envelope');
    }),
    observe: (envelope, attempt) => port.send(envelope, attempt, 'lookup'),
  });
  return freeze({
    port,
    pump: endpoint => {
      const rejected: ThreadlineRejection[] = [];
      for (const f of relay.collect(keys.principal)) {
        const opened = open(f);
        const sender = typeof f?.sender === 'string' ? f.sender : '', key = typeof f?.key === 'string' ? f.key : '';
        if (typeof opened === 'string') { rejected.push({ reason: opened, sender, key }); continue; }
        if (f.kind === 'receipt' && opened.receipt) {
          // Only the exact party this key+digest was sent to, in that conversation, can witness it.
          const expected = sentTo.get(id(f.key, f.digest));
          if (!expected || expected.recipient !== f.sender || expected.conversation !== f.conversation) {
            rejected.push({ reason: 'unexpected-receipt', sender, key }); continue;
          }
          const prior = receipts.get(id(f.key, f.digest)), next = opened.receipt;
          // A later lookup never erases a stronger stored proof (answered before a stale queued receipt).
          if (!prior || prior.state === 'unknown' || next.state === 'answered' || (prior.state === 'durably-queued' && next.state !== 'unknown'))
            receipts.set(id(f.key, f.digest), next);
          continue;
        }
        if (!opened.envelope || f.kind === 'receipt') { rejected.push({ reason: 'malformed', sender, key }); continue; }
        // The verified signer, never a field inside the envelope, is the sender the endpoint authorizes.
        const receipt = f.kind === 'lookup' ? endpoint.lookup(f.key, f.digest, f.sender) : endpoint.receive(opened.envelope, input.now(), f.sender);
        try {
          const reply = sealThreadlineFrame(keys, { kind: 'receipt', recipient: f.sender, conversation: f.conversation, key: f.key,
            digest: f.digest, attempt: `receipt:${f.attempt}` }, { envelope: null, receipt });
          if (reply !== 'unknown-key') relay.submit(reply);
        } catch { /* The receipt is re-derivable: the sender's lookup reads the same durable records. */ }
      }
      return rejected;
    },
  });
}
