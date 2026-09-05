import { verify } from 'node:crypto';
import type * as T from '../types/values.js';
import type { CaptureInput, DecodeContext, FactEnvelopeReference } from '../types/ports.js';
import { consumeResult, errorDetail, refusal, seal, success, trusted } from '../types/internal.js';
import { canonicalText, hashText, snapshot } from './canonical.js';
import { decode } from './decode.js';
import { rehydrateConflict } from './rehydrate.js';
import { readEvidence } from '../types/operations.js';
import { inSession } from './session.js';
import type { CaptureStatus, HistoricalSession } from './session.js';

// Historical values have private validation identity, but never live constitutional authority.
export type HistoricalShape<T> = T extends readonly (infer E)[] ? readonly HistoricalShape<E>[]
  : T extends object ? { readonly [K in keyof T as K extends symbol ? never : K]: HistoricalShape<T[K]> } : T;
declare const historical: unique symbol;
export interface HistoricalRead<T> {
  readonly [historical]: true;
  readonly mode: 'historical';
  readonly origin: FactEnvelopeReference;
  readonly captureStatus: CaptureStatus;
  readonly unavailableCaptures: readonly { readonly reference: string; readonly hash: import('../types/values.js').Hash; readonly status: Exclude<CaptureStatus, 'available'> }[];
  readonly view: HistoricalShape<T>;
}
export interface OriginPinInput {
  readonly origin: FactEnvelopeReference;
  readonly capture: CaptureInput;
  readonly machineKeyId: string;
  readonly path: readonly string[];
}
export interface HistoricalDecodeContext extends Omit<DecodeContext, 'provenance' | 'principals' | 'grants' | 'revocations' | 'authorizations' | 'directives' | 'evidence' | 'recordSubjects' | 'binding'> {
  // Part two selects only the fact's causal dependencies and supplies its explicit clock proof.
  readonly history?: readonly HistoricalRead<T.ConstitutionalValue>[];
  readonly captureStatuses?: Readonly<Record<string, CaptureStatus>>;
  readonly recordSubjects?: Readonly<Record<string, unknown>>;
  readonly historicalBinding?: Omit<NonNullable<DecodeContext['binding']>, 'source' | 'scope'> & {
    readonly source: HistoricalRead<T.Provenance>; readonly scope: unknown;
  };
}
const records = new WeakMap<object, T.ConstitutionalValue>();
function take<V>(result: T.Result<V>): V {
  return consumeResult(result, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
}
// Verify hash BEFORE the signature over contentHash, per P2. Chain/key-position admission
// remains P2's job; the supplied key set must be the one admitted for this origin position.
export function readHistorical<N extends keyof T.Inventory>(type: N, input: unknown, pin: OriginPinInput,
  context: HistoricalDecodeContext): T.Result<HistoricalRead<T.Inventory[N]>> {
  let preserved = 'input://caller';
  try {
    if (typeof context.preserved !== 'string' || !context.preserved) return refusal('historical read requires preservation reference', preserved);
    preserved = context.preserved;
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

    const values: T.ConstitutionalValue[] = [];
    const session: HistoricalSession = { issued: new WeakSet(), unavailable: new Map(), statuses: context.captureStatuses ?? {}, ...(context.now ? { now: context.now } : {}) };
    for (const status of Object.values(session.statuses)) if (!['available', 'tombstoned', 'expired', 'missing'].includes(status))
      return refusal('unknown historical capture status', preserved);
    if (context.now && (!trusted(context.now, 'Measurement') || context.now.subject.kind !== 'clock'))
      return refusal('historical causal clock must be decoded explicitly', preserved);
    for (const history of context.history ?? []) {
      const value = records.get(history);
      if (!value) return refusal('historical dependencies must come from origin-verified reads', preserved);
      values.push(value); session.issued.add(value);
      for (const capture of history.unavailableCaptures) session.unavailable.set(capture.reference, capture);
    }
    const ofType = <K extends keyof T.Inventory>(name: K) => values.filter(v => v.type === name) as T.Inventory[K][];
    const recordSubjects: Record<string, T.Scope> = {};
    const c = inSession({ ...context, recordSubjects, principals: ofType('VerifiedPrincipal'), grants: ofType('StandingGrant'),
      revocations: ofType('Revocation'), authorizations: ofType('Authorization'), directives: ofType('Directive'), evidence: ofType('Evidence') }, session);
    for (const [hash, scope] of Object.entries(context.recordSubjects ?? {})) recordSubjects[hash] = take(decode('Scope', scope, c));
    let validationContext = c;
    if (context.historicalBinding) {
      const binding = context.historicalBinding;
      const source = records.get(binding.source);
      if (!source || source.type !== 'Provenance') return refusal('binding source requires origin-verified Provenance', preserved);
      session.issued.add(source);
      validationContext = inSession({ ...c, binding: { ...binding, source, scope: take(decode('Scope', binding.scope, c)) } }, session);
    }
    const decoded = type === 'Conflict' ? take(rehydrateConflict(shape, validationContext)) : take(decode(type, shape, validationContext));
    const unavailableCaptures = [...session.unavailable.values()].sort((a, b) => a.reference < b.reference ? -1 : a.reference > b.reference ? 1 : 0);
    const result = seal<HistoricalRead<T.Inventory[N]>>({ mode: 'historical', origin: snapshot(pin.origin),
      captureStatus: unavailableCaptures[0]?.status ?? 'available', unavailableCaptures, view: decoded }, false);
    records.set(result, decoded);
    return success(result);
  } catch (error) { return refusal(errorDetail(error), preserved); }
}
// A historical Evidence record is inspectable as evidence only through the same freshness
// boundary, and never when one of its retained dependencies is unavailable.
export function readHistoricalEvidence(record: HistoricalRead<T.Evidence>, now: T.Clock, preserved: string): T.Result<T.Claim> {
  const value = records.get(record);
  if (!value || value.type !== 'Evidence') return refusal('historical Evidence must be origin-verified', preserved);
  if (record.unavailableCaptures.length) return refusal('evidence-unavailable: historical capture cannot be reinspected', preserved, 'integrity');
  return readEvidence(value, now, preserved);
}
