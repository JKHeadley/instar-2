import type { BoundaryContext, Result } from '../index.js';
import type { TransportAuthority, TransportHost } from '../transport/index.js';
import type { ModelAdapterPort, ModelDescription, ProviderObservation } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

// The SDK gets only a guarded transport callback, never credentials or an unguarded
// provider. A malicious retrying SDK therefore cannot turn one claim into two calls.
export interface ModelClient {
  readonly automaticRetries: number;
  execute(send: () => Promise<ProviderObservation>, options: { readonly maxRetries: 0 }): Promise<void>;
}
export function observationCheck(v: ProviderObservation, d: ModelDescription): void {
  ensure(['complete', 'rejected', 'uncertain'].includes(v.state), 'unknown provider observation');
  ensure(v.bytes === null || typeof v.bytes === 'string' && new TextEncoder().encode(v.bytes).length <= d.maxOutputBytes, 'response byte bound');
  ensure(v.state !== 'complete' || v.bytes !== null, 'complete response lacks bytes');
  ensure(v.providerOperation === null || typeof v.providerOperation === 'string' && v.providerOperation.length <= 256, 'provider operation bound');
  for (const n of [v.usage.inputTokens, v.usage.outputTokens, v.usage.charge]) ensure(n === null || Number.isSafeInteger(n) && n >= 0, 'invalid observed usage');
  ensure(typeof v.usage.source === 'string' && v.usage.source.length > 0 && v.usage.source.length <= 256, 'usage source or explicit exception required');
  ensure(typeof v.retryBlocked === 'boolean', 'retry observation required');
  if (v.limitation) {
    ensure(v.state === 'uncertain' && ['transport-threw', 'invalid-provider-observation', 'response-byte-limit'].includes(v.limitation.kind), 'limited observation cannot authorize answer');
    ensure(v.limitation.observedBytesAtLeast === null || Number.isSafeInteger(v.limitation.observedBytesAtLeast) && v.limitation.observedBytesAtLeast >= 0, 'invalid observed byte lower bound');
  }
}
// Each raw UTF-8 byte needs at most six JSON bytes (e.g. a control character).
// Two bounded 256-code-unit metadata strings need <= 3072 escaped bytes total;
// 8192 covers those, keys, safe integers and the closed limitation arm. No
// unbounded provider metadata or raw object is serialized into this receipt.
export function receiptByteBound(d: ModelDescription): number {
  const bound = 6 * d.maxOutputBytes + 8192;
  ensure(Number.isSafeInteger(bound) && bound >= 8192, 'finite encoded receipt bound required'); return bound;
}
export function snapshotObservation(raw: unknown, d: ModelDescription): ProviderObservation {
  // Read data descriptors, never invoke SDK/provider getters. Copy only bounded
  // fields; malformed/oversized objects still retain independently valid usage.
  const data = (v: unknown, key: string): unknown => {
    try { return v && typeof v === 'object' ? Object.getOwnPropertyDescriptor(v, key)?.value : undefined; } catch { return undefined; }
  };
  const plain = (v: unknown, fields: string[]) => {
    try { return !!v && typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v))
      && Reflect.ownKeys(v).length === fields.length && fields.every(k => Object.getOwnPropertyDescriptor(v, k)?.value !== undefined); } catch { return false; }
  };
  const state = data(raw, 'state'), bytes = data(raw, 'bytes'), operation = data(raw, 'providerOperation'), usage = data(raw, 'usage');
  const count = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
  const input = data(usage, 'inputTokens'), output = data(usage, 'outputTokens'), charge = data(usage, 'charge'), source = data(usage, 'source');
  const validCount = (v: unknown) => v === null || count(v) !== null;
  const validText = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 256;
  // Avoid allocating a second unbounded byte array for oversized raw strings.
  const observedBytesAtLeast = typeof bytes !== 'string' ? null : bytes.length > d.maxOutputBytes ? bytes.length : new TextEncoder().encode(bytes).length;
  const oversized = observedBytesAtLeast !== null && observedBytesAtLeast > d.maxOutputBytes;
  const valid = plain(raw, ['state', 'bytes', 'providerOperation', 'usage', 'retryBlocked'])
    && plain(usage, ['inputTokens', 'outputTokens', 'charge', 'source'])
    && typeof state === 'string' && ['complete', 'rejected', 'uncertain'].includes(state)
    && (bytes === null || typeof bytes === 'string') && (state !== 'complete' || typeof bytes === 'string')
    && (operation === null || typeof operation === 'string' && operation.length <= 256)
    && [input, output, charge].every(validCount) && validText(source) && typeof data(raw, 'retryBlocked') === 'boolean';
  const observation: ProviderObservation = {
    state: valid && !oversized ? state as ProviderObservation['state'] : 'uncertain',
    bytes: typeof bytes === 'string' && !oversized ? bytes : null,
    providerOperation: typeof operation === 'string' && operation.length <= 256 ? operation : null,
    usage: { inputTokens: count(input), outputTokens: count(output), charge: count(charge),
      source: validText(source) ? source as string : 'invalid usage source; independently valid numeric fields retained' },
    retryBlocked: false,
    ...(!valid || oversized ? { limitation: { kind: oversized ? 'response-byte-limit' as const : 'invalid-provider-observation' as const, observedBytesAtLeast } } : {}),
  };
  observationCheck(observation, d);
  // Canonical copy also divorces the recorder from provider/SDK-owned objects.
  return freeze(JSON.parse(encoded(observation).bytes) as ProviderObservation);
}
export const uncertainObservation = (source: string): ProviderObservation => freeze({ state: 'uncertain', bytes: null, providerOperation: null,
  usage: { inputTokens: null, outputTokens: null, charge: null, source }, retryBlocked: false,
  limitation: { kind: 'transport-threw', observedBytesAtLeast: null } });
const thrownObservation = (): ProviderObservation => uncertainObservation('invocation threw; liability unknown');
export function createModelAdapter(d: ModelDescription, client: ModelClient, invoke: (bytes: string, operation: string) => Promise<ProviderObservation>,
  authority: TransportAuthority, host: TransportHost, c: BoundaryContext): Result<ModelAdapterPort> {
  return boundary('ModelAdapterConstruction', d, c, () => {
    ensure(d.owner === 'part-ten' && d.automaticRetries === 0 && client.automaticRetries === 0, 'client automatic retries must be disabled');
    ensure(d.measured === false && d.basis.length > 0, 'slice route must be explicitly unmeasured');
    for (const n of [d.maxInputBytes, d.maxOutputBytes, d.maxCharge]) ensure(Number.isSafeInteger(n) && n >= 0, 'finite provider bounds required');
    receiptByteBound(d);
    const description = freeze(JSON.parse(encoded(d).bytes) as ModelDescription);
    return Object.freeze({ owner: 'part-ten', describe: () => description,
      prepare: input => boundary('ModelPrepare', input, c, safe => {
        const bytes = encoded({ provider: description.provider, model: description.model, route: description.route,
          settings: { automaticRetries: 0, tools: [], maxOutputBytes: description.maxOutputBytes },
          hiddenProviderContext: 'unavailable', input: safe }).bytes;
        ensure(new TextEncoder().encode(bytes).length <= description.maxInputBytes, 'submitted byte bound'); return bytes;
      }),
      exchange: async exchange => {
        let observed: ProviderObservation | undefined, started = false, blocked = false, closed = false;
        try {
          await client.execute(async () => {
            const admission = boundary('ModelInvocation', null, c, () => {
              ensure(!closed, 'exchange already returned; delayed SDK invocation refused');
              if (started) { blocked = true; ensure(false, 'automatic second invocation refused'); }
              ensure(exchange.incarnation === host.incarnation && host.monotonic() < exchange.deadline, 'expired or restored exchange');
              ensure(new TextEncoder().encode(exchange.bytes).length <= description.maxInputBytes, 'submitted byte bound');
              ensure(encoded(exchange.bytes).hash === exchange.claim.digest, 'submitted bytes differ from reserved payload');
              const reservation = take(authority.consume(exchange.claim, exchange.fence));
              ensure(reservation.charge === description.maxCharge, 'reservation does not cover declared liability');
              take(exchange.recordDispatch());
              started = true; return reservation;
            });
            const reservation = take(admission);
            try {
              // Snapshot at the transport return, before the SDK sees the object.
              // An SDK cannot rewrite captured bytes or usage after the fact.
              observed = snapshotObservation(await invoke(exchange.bytes, reservation.operation), description);
            }
            catch { observed = thrownObservation(); }
            return observed;
          }, { maxRetries: 0 });
        } catch { /* An SDK exception cannot erase the actual first observation. */ }
        finally { closed = true; }
        return boundary('ModelExchangeObservation', null, c, () => {
          ensure(observed, 'no admitted provider observation'); observationCheck(observed, description);
          return freeze({ ...observed, retryBlocked: blocked });
        });
      },
    } satisfies ModelAdapterPort);
  });
}
