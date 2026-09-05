import { verify } from 'node:crypto';
import type { Provenance, Result, VerifiedPrincipal } from '../types/values.js';
import type { CaptureInput, DecodeContext, FactEnvelopeReference } from '../types/ports.js';
import { consumeResult, refusal, success } from '../types/internal.js';
import { canonicalText, hashText, snapshot } from './canonical.js';
import { decode } from './decode.js';

// Historical data deliberately has no live constitutional brand, even recursively.
export type HistoricalShape<T> = T extends readonly (infer E)[] ? readonly HistoricalShape<E>[]
  : T extends object ? { readonly [K in keyof T as K extends symbol ? never : K]: HistoricalShape<T[K]> } : T;
declare const historical: unique symbol;
export interface HistoricalRead<T> {
  readonly [historical]: true;
  readonly mode: 'historical';
  readonly origin: FactEnvelopeReference;
  readonly captureStatus: 'available' | 'unavailable';
  readonly view: HistoricalShape<T>;
}
export interface OriginPinInput {
  readonly origin: FactEnvelopeReference;
  readonly capture: CaptureInput;
  readonly machineKeyId: string;
  readonly path: readonly string[];
}

// Part two supplies the original envelope/key position after its chain verification. We verify
// the signed bytes and exact selected record too. No machine signature becomes user authority.
export function readHistorical<N extends 'Provenance' | 'VerifiedPrincipal'>(type: N, input: unknown, pin: OriginPinInput,
  context: DecodeContext): Result<HistoricalRead<N extends 'Provenance' ? Provenance : VerifiedPrincipal>> {
  try {
    if (pin.origin.owner !== 'part-two' || pin.origin.name !== 'FactEnvelope' || !pin.origin.id) return refusal('historical origin must name a fact envelope', context.preserved);
    const bytes = context.captures[pin.capture.reference]; const key = context.register.keys[pin.machineKeyId];
    if (typeof bytes !== 'string' || hashText(bytes) !== pin.capture.hash || !key || key.algorithm !== 'ed25519' || !key.methods.includes('fact-envelope'))
      return refusal('historical origin key or capture failed', context.preserved, 'integrity');
    const envelope = snapshot(JSON.parse(bytes));
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || (envelope as Record<string, unknown>).id !== pin.origin.id)
      return refusal('historical origin identity differs from signed envelope', context.preserved, 'integrity');
    const frame = envelope as Record<string, unknown>;
    if (typeof frame.type !== 'string' || !frame.type || !Number.isSafeInteger(frame.schemaVersion) || Number(frame.schemaVersion) < 1 || frame.machine !== key.owner)
      return refusal('historical envelope domain or machine/key owner mismatch', context.preserved, 'integrity');
    const preimage = Object.fromEntries(Object.entries(frame).filter(([field]) => field !== 'contentHash' && field !== 'signature'));
    if (frame.contentHash !== hashText(canonicalText(preimage))) return refusal('historical envelope contentHash does not bind its preimage', context.preserved, 'integrity');
    if (typeof frame.signature !== 'string' || !/^[a-f0-9]{128}$/.test(frame.signature)
      || !verify(null, Buffer.from(String(frame.contentHash), 'utf8'), key.publicKey, Buffer.from(frame.signature, 'hex')))
      return refusal('historical envelope signature over contentHash failed', context.preserved, 'integrity');
    let selected: unknown = envelope;
    for (const field of pin.path) {
      if (!selected || typeof selected !== 'object' || !Object.hasOwn(selected, field)) return refusal('historical path is absent from signed origin', context.preserved);
      selected = (selected as Record<string, unknown>)[field];
    }
    const shape = snapshot(input);
    if (canonicalText(shape) !== canonicalText(selected)) return refusal('historical record differs from origin pin (including provenance class)', context.preserved, 'integrity');
    const value = shape as unknown as Provenance | VerifiedPrincipal;
    if (value.type !== type || value.schemaVersion !== 1) return refusal('historical type or version unknown', context.preserved);
    const p = value.type === 'Provenance' ? value : value.provenance;
    const expected = ['adapter', 'authenticated', 'class', 'machine', 'method', 'record', 'schemaVersion', 'type', 'verifiedAt'];
    if (!p || p.type !== 'Provenance' || p.schemaVersion !== 1 || Object.keys(p).sort().join(',') !== expected.sort().join(',')
      || !['verified', 'channel-attested'].includes(p.class) || !context.register.methods.includes(p.method)
      || !context.register.entries.includes(p.adapter) || !context.register.entries.includes(p.machine)
      || typeof p.record.reference !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(p.record.hash)) return refusal('historical provenance shape invalid', context.preserved);
    // Capture unavailability stays visible to part two; it cannot be used as fresh proof.
    const available = context.captures[p.record.reference];
    if (available !== undefined && (hashText(available) !== p.record.hash || canonicalText(JSON.parse(available)) !== canonicalText(p.authenticated))) return refusal('historical authentication capture mismatch', context.preserved, 'integrity');
    const identity = p.authenticated?.principal;
    if (!identity || typeof identity.id !== 'string' || !identity.id || !['person', 'agent', 'system'].includes(identity.kind)
      || typeof p.authenticated.recordType !== 'string' || !p.authenticated.recordType) return refusal('historical authenticated identity missing', context.preserved);
    if (value.type === 'VerifiedPrincipal' && (Object.keys(value).sort().join(',') !== 'id,kind,provenance,schemaVersion,type' || value.id !== identity.id || value.kind !== identity.kind
      || canonicalText(p.authenticated.payload) !== canonicalText({ id: value.id, kind: value.kind }))) return refusal('historical principal disagrees with original provenance', context.preserved);
    return consumeResult(decode('Measurement', p.verifiedAt, context), { Refused: r => r, Success: clock => {
      if (clock.subject.kind !== 'clock') return refusal('historical verification time must be clock', context.preserved);
      // Freeze without registering in the live-value issuer set.
      const freeze = (v: object): void => { for (const child of Object.values(v)) if (child && typeof child === 'object') freeze(child); Object.freeze(v); };
      const result = { mode: 'historical', origin: snapshot(pin.origin), captureStatus: available === undefined ? 'unavailable' : 'available', view: shape }; freeze(result);
      return success(result as unknown as HistoricalRead<N extends 'Provenance' ? Provenance : VerifiedPrincipal>);
    } });
  } catch { return refusal('malformed historical record or origin evidence', context.preserved); }
}
