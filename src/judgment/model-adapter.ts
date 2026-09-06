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
}
export function createModelAdapter(d: ModelDescription, client: ModelClient, invoke: (bytes: string, operation: string) => Promise<ProviderObservation>,
  authority: TransportAuthority, host: TransportHost, c: BoundaryContext): Result<ModelAdapterPort> {
  return boundary('ModelAdapterConstruction', d, c, () => {
    ensure(d.owner === 'part-ten' && d.automaticRetries === 0 && client.automaticRetries === 0, 'client automatic retries must be disabled');
    ensure(d.measured === false && d.basis.length > 0, 'slice route must be explicitly unmeasured');
    for (const n of [d.maxInputBytes, d.maxOutputBytes, d.maxCharge]) ensure(Number.isSafeInteger(n) && n >= 0, 'finite provider bounds required');
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
              started = true; return reservation;
            });
            const reservation = take(admission);
            try { observed = await invoke(exchange.bytes, reservation.operation); }
            catch { observed = { state: 'uncertain', bytes: null, providerOperation: null,
              usage: { inputTokens: null, outputTokens: null, charge: null, source: 'invocation threw; liability unknown' }, retryBlocked: false }; }
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
