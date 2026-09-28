/**
 * Design 10 §6–7 — Threadline as the reference adapter of the agent-transport
 * port. "No mandatory Threadline service" is a deployment boundary: the relay
 * (optional store-and-forward) and key custody are injected. The adapter only
 * maps authenticated frames into the port's states; it never redefines them.
 *
 * Observed constraints this mapping honours (design 10 §6, A1–A4):
 *  - a retry re-signs a frame but preserves the logical message key and digest;
 *  - relay acceptance maps only to `accepted-by-transport`;
 *  - a relay queue acknowledgement never substitutes for the recipient's receipt;
 *  - session/queue labels are not delivery evidence.
 * Frames bind sender, recipient, conversation, key, digest, protocol and suite
 * in canonical signed bytes. Unknown suites refuse and never negotiate down.
 */
import type { BoundaryContext } from '../index.js';
import type { AgentEndpoint, AgentTransportEnvelope, AgentTransportPort, CapabilityAdvertisement, DeliveryEvidence,
  EndpointReceipt } from '../rungraph/index.js';
import { envelopeIntact, evidenceFromReceipt, semanticDigest } from '../rungraph/index.js';
import { boundary, encoded, ensure, freeze } from './boundary.js';

export const THREADLINE_PROTOCOL = 'threadline-ref-v1';
export const THREADLINE_SUITE = 'ed25519-canonical-v1';
export interface ThreadlineFrame {
  readonly protocol: string; readonly suite: string; readonly schemaVersion: number;
  readonly kind: 'envelope' | 'lookup' | 'receipt';
  readonly sender: string; readonly recipient: string; readonly conversation: string;
  readonly key: string; readonly digest: string;
  /** Delivery-attempt identity: one per transmission, never part of the logical identity. */
  readonly attempt: string;
  readonly envelope: AgentTransportEnvelope | null;
  readonly receipt: EndpointReceipt | null;
  readonly signature: string;
}
/** Optional store-and-forward relay. `submit` throwing means the outcome is unknown. */
export interface ThreadlineRelay {
  submit(frame: ThreadlineFrame): 'accepted' | 'rejected';
  collect(recipient: string): readonly ThreadlineFrame[];
}
/** Key custody stays with the adapter's signer; the worker never sees key material. */
export interface ThreadlineKeys {
  readonly principal: string;
  sign(bytes: string): string;
  verify(principal: string, bytes: string, signature: string): 'valid' | 'invalid' | 'unknown-key';
}
export type ThreadlineRejection = Readonly<{ reason: 'unknown-suite' | 'future-schema' | 'wrong-recipient' | 'unknown-key'
  | 'bad-signature' | 'malformed' | 'binding-mismatch'; sender: string; key: string }>;
export interface ThreadlineAdapter {
  readonly port: AgentTransportPort;
  /** Drain this agent's inbox: admit envelopes through the endpoint, answer lookups, keep verified receipts. */
  pump(endpoint: AgentEndpoint): readonly ThreadlineRejection[];
}

const unsigned = (frame: Omit<ThreadlineFrame, 'signature'>) => encoded(frame).bytes;

export function createThreadlineReferenceAdapter(input: Readonly<{ keys: ThreadlineKeys; relay: ThreadlineRelay;
  now: () => number; freshFor: number; context: BoundaryContext;
  advertisements: (peer: string) => readonly CapabilityAdvertisement[] }>): ThreadlineAdapter {
  const { keys, relay, context } = input;
  const receipts = new Map<string, EndpointReceipt>();
  const frame = (fields: Omit<ThreadlineFrame, 'signature' | 'protocol' | 'suite' | 'schemaVersion' | 'sender'>): ThreadlineFrame => {
    const body = { protocol: THREADLINE_PROTOCOL, suite: THREADLINE_SUITE, schemaVersion: 1, sender: keys.principal, ...fields };
    return freeze({ ...body, signature: keys.sign(unsigned(body)) });
  };
  const check = (f: ThreadlineFrame): ThreadlineRejection['reason'] | null => {
    if (f.protocol !== THREADLINE_PROTOCOL || f.suite !== THREADLINE_SUITE) return 'unknown-suite';
    if (f.schemaVersion !== 1) return 'future-schema';
    if (f.recipient !== keys.principal) return 'wrong-recipient';
    const { signature, ...body } = f;
    let verdict: 'valid' | 'invalid' | 'unknown-key';
    try { verdict = keys.verify(f.sender, unsigned(body), signature); } catch { return 'malformed'; }
    if (verdict === 'unknown-key') return 'unknown-key';
    if (verdict !== 'valid') return 'bad-signature';
    if (f.envelope && (!envelopeIntact(f.envelope) || f.envelope.key !== f.key || f.envelope.sender !== f.sender
      || f.envelope.recipient !== f.recipient || f.envelope.conversation !== f.conversation)) return 'binding-mismatch';
    if (f.receipt && f.receipt.key !== f.key) return 'binding-mismatch';
    return null;
  };
  const evidence = (envelope: AgentTransportEnvelope, attempt: string, fields: Pick<DeliveryEvidence, 'state' | 'witness' | 'authoritative'>
    & Partial<Pick<DeliveryEvidence, 'refusedWhat' | 'unresolved'>>): DeliveryEvidence => freeze({ type: 'DeliveryEvidence', schemaVersion: 1,
    key: envelope.key, digest: envelope.digest, edge: envelope.edge, conversation: envelope.conversation, attempt,
    observedAt: input.now(), freshFor: input.freshFor, ...fields });
  const submit = (envelope: AgentTransportEnvelope, attempt: string, kind: 'envelope' | 'lookup'): DeliveryEvidence => {
    const f = frame({ kind, recipient: envelope.recipient, conversation: envelope.conversation, key: envelope.key,
      digest: semanticDigest(envelope), attempt, envelope, receipt: null });
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
    const receipt = receipts.get(`${envelope.key}\u0000${semanticDigest(envelope)}`);
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
        const reason = check(f);
        if (reason) { rejected.push({ reason, sender: typeof f.sender === 'string' ? f.sender : '', key: typeof f.key === 'string' ? f.key : '' }); continue; }
        if (f.kind === 'receipt' && f.receipt) {
          const prior = receipts.get(`${f.key}\u0000${f.digest}`);
          // A later lookup never erases a stronger stored proof (answered before a stale queued receipt).
          if (!prior || prior.state === 'unknown' || f.receipt.state === 'answered' || (prior.state === 'durably-queued' && f.receipt.state !== 'unknown'))
            receipts.set(`${f.key}\u0000${f.digest}`, f.receipt);
          continue;
        }
        if (!f.envelope) { rejected.push({ reason: 'malformed', sender: f.sender, key: f.key }); continue; }
        const receipt = f.kind === 'lookup' ? endpoint.lookup(f.key, f.digest) : endpoint.receive(f.envelope, input.now());
        try {
          relay.submit(frame({ kind: 'receipt', recipient: f.sender, conversation: f.conversation, key: f.key, digest: f.digest,
            attempt: `receipt:${f.attempt}`, envelope: null, receipt }));
        } catch { /* The receipt is re-derivable: the sender's lookup reads the same durable records. */ }
      }
      return rejected;
    },
  });
}
