import { consumeResult } from '../index.js';
import type { BoundaryContext, Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import type { FactStorePort } from '../facts/index.js';
import type { DispatchClaim, FenceToken, TransportAuthority, TransportHost } from '../transport/index.js';
import type { Capture, JudgmentCapturePort, ProviderObservation } from '../judgment/index.js';
type ProviderCallPayload = import('../effects/provider-api.js').ProviderCallPayload;
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

/** Assembly-only route custody. Its closure owns the credential; no credential or
 * client is reachable from the worker's request or the returned adapter handle. */
export interface ConfinedProviderRoute {
  readonly provider: string; readonly model: string; readonly route: string; readonly disclosure: string;
  readonly automaticRetries: 0; readonly environment: 'local-test' | 'production';
  readonly custodyProof?: ProviderCustodyProof;
  invoke(bytes: string, bounds: Readonly<{ operation: string; deadline: number; timeout: number;
    maxOutputBytes: number; maxTokens: number; maxCharge: number; automaticRetries: 0 }>): Promise<ProviderObservation>;
}
declare const providerCustodyBrand: unique symbol;
/** The brand alone is not authority: admission checks exact object registration. */
export type ProviderCustodyProof = Readonly<{ [providerCustodyBrand]: true }>;
const productionCustody = new WeakMap<ConfinedProviderRoute, ProviderCustodyProof>();

/** GRANT U4-A: owner-internal registration; never export through assembly/index. */
export function registerProductionProviderCustody(route: ConfinedProviderRoute): void {
  ensure(Object.isFrozen(route) && route.environment === 'production'
    && route.custodyProof !== undefined && Object.isFrozen(route.custodyProof), 'immutable provider custody required');
  ensure(!productionCustody.has(route), 'provider custody already registered');
  productionCustody.set(route, route.custodyProof);
}
export interface ProviderInvocationPort {
  readonly owner: 'part-ten';
  invoke(payload: ProviderCallPayload, claim: DispatchClaim, fence: FenceToken,
    accepted: () => Result<string>): Promise<Result<Capture>>;
}
export function createConfinedProviderInvocation(route: ConfinedProviderRoute, authority: TransportAuthority,
  host: TransportHost, captures: JudgmentCapturePort, c: BoundaryContext, store: FactStorePort): Result<ProviderInvocationPort> {
  return boundary('ConfinedProviderConstruction', null, c, () => {
    ensure(route.environment === 'local-test' || (route.environment === 'production'
      && route.custodyProof !== undefined && productionCustody.get(route) === route.custodyProof),
    'NON-EXECUTABLE-UNTIL-production-boot-credential-custody');
    ensure(route.automaticRetries === 0, 'hidden retry forbidden');
    const send = route.invoke.bind(route);
    const binding = { provider: route.provider, model: route.model, route: route.route, disclosure: route.disclosure };
    return Object.freeze({ owner: 'part-ten', invoke: async (payload, claim, fence, accepted) => {
      const checked = <T>(name: string, fn: () => T) => boundary(name, null, c, fn);
      const admission = checked('ProviderInvocationAdmission', () => {
        ensure(route.automaticRetries === 0, 'hidden retry forbidden');
        ensure(Object.entries(binding).every(([k, v]) => payload[k as keyof ProviderCallPayload] === v), 'unapproved provider route');
        ensure(claim.digest === payload.submittedDigest && claim.attempt === payload.attempt
          && claim.executor === host.incarnation, 'provider claim/attempt/digest mismatch');
        ensure(!host.current().stopped && payload.deadline > host.monotonic(), 'provider stale deadline or stop');
        const bytes = take(captures.read(payload.submitted));
        ensure(hashBytes(bytes) === payload.submitted.hash && encoded(bytes).hash === payload.submittedDigest, 'missing or changed submitted bytes');
        ensure(new TextEncoder().encode(bytes).length <= payload.maxInputBytes, 'provider input bound exceeded');
        const wire = JSON.parse(bytes) as Record<string, unknown>;
        ensure(wire.provider === payload.provider && wire.model === payload.model && wire.route === payload.route
          && encoded(wire.settings).hash === payload.settingsDigest && encoded(wire.outputSchema).hash === payload.outputSchemaDigest,
          'submitted model/settings/schema changed');
        const capacity = take(captures.reserve(6 * payload.maxOutputBytes + 8192));
        const consumed = take(authority.consume(claim, fence));
        ensure(consumed.request === payload.effectRequest && consumed.run === payload.run
          && consumed.semanticMessage === payload.semanticMessage && consumed.charge === payload.maxCharge, 'consumed claim binding differs');
        const acceptance = take(accepted());
        const snapshot = take(store.readForProjection());
        // Validate the ACCEPTED operation's required dependency closure, not every
        // unrelated record in the store: an unrelated unavailable fact must not block
        // an otherwise clean invocation, while a tainted dependency of the acceptance
        // still refuses. Every taint/conflict status is left exactly as observed.
        const validateDependencies = (ids: readonly string[]) => {
          const seen = new Set<string>();
          const visit = (id: string) => {
            if (seen.has(id)) return; seen.add(id);
            const dependency = snapshot.entries.find(e => e.fact.id === id);
            ensure(dependency && !dependency.taint.length && !dependency.conflicts.length, 'provider acceptance tainted');
            dependency.fact.predecessors.required.forEach(visit);
          };
          ids.forEach(visit);
        };
        if (snapshot.entries.some(e => e.fact.id === acceptance)) validateDependencies([acceptance]);
        const entry = snapshot.entries.find(e => e.fact.id === acceptance);
        const record = entry?.fact.body as unknown as { record?: { stage: string; operation: string; request: string; digest: string; claim: string } };
        ensure(entry?.fact.kind === 'effect-provider-ProviderOperationObservation' && record?.record?.stage === 'executor-accepted'
          && record.record.operation === claim.operation && record.record.request === consumed.request && record.record.digest === claim.digest,
          'guarded Eight executor acceptance missing');
        const claimFact = snapshot.entries.find(e => e.fact.id === record.record!.claim);
        const claimRecord = claimFact?.fact.body as unknown as { record?: { state: string; operation: string } };
        ensure(claimFact?.fact.kind === 'transport-AdmissionReservation' && claimRecord?.record?.state === 'dispatch-claimed'
          && claimRecord.record.operation === claim.operation, 'executor acceptance claim differs');
        // No formatting, queue or provider-owned object is consulted after this
        // final equality check. The next operation submits these very bytes.
        ensure(take(captures.read(payload.submitted)) === bytes && hashBytes(bytes) === payload.submitted.hash
          && encoded(bytes).hash === claim.digest, 'submitted bytes changed immediately before call');
        ensure(!host.current().stopped && host.monotonic() < payload.deadline, 'provider stopped before call');
        return { bytes, capacity };
      });
      return consumeResult(admission, { Refused: r => Promise.resolve(r), Success: async admitted => {
        let observation: ProviderObservation;
        try {
          const returned = await send(admitted.bytes, { operation: claim.operation, deadline: payload.deadline,
            timeout: payload.timeout, maxOutputBytes: payload.maxOutputBytes, maxTokens: payload.maxTokens,
            maxCharge: payload.maxCharge, automaticRetries: 0 });
          // Copy once at the transport return; no SDK sees or edits this receipt.
          const own = (v: object, key: string) => Object.getOwnPropertyDescriptor(v, key)?.value as unknown;
          const usage = own(returned, 'usage');
          ensure(usage !== null && typeof usage === 'object', 'provider usage missing');
          // Copy data fields only: provider getters and unrelated metadata never
          // execute or enter the receipt's bounded canonical encoding.
          const limitation = own(returned, 'limitation');
          observation = { state: own(returned, 'state'), bytes: own(returned, 'bytes'), providerOperation: own(returned, 'providerOperation'),
            usage: { inputTokens: own(usage, 'inputTokens'), outputTokens: own(usage, 'outputTokens'), charge: own(usage, 'charge'), source: own(usage, 'source') },
            retryBlocked: own(returned, 'retryBlocked'), ...(limitation && typeof limitation === 'object' ? { limitation: { kind: own(limitation, 'kind'), observedBytesAtLeast: own(limitation, 'observedBytesAtLeast') } } : {}) } as ProviderObservation;
        } catch {
          observation = { state: 'uncertain', bytes: null, providerOperation: null,
            usage: { inputTokens: null, outputTokens: null, charge: null, source: 'provider timeout or transport failure; liability unresolved' }, retryBlocked: false,
            limitation: { kind: 'transport-threw', observedBytesAtLeast: null } };
        }
        return checked('CaptureProviderReturn', () => {
          ensure(['complete', 'rejected', 'uncertain'].includes(observation.state), 'invalid provider state');
          ensure(observation.bytes === null || typeof observation.bytes === 'string'
            && observation.bytes.length <= payload.maxOutputBytes && new TextEncoder().encode(observation.bytes).length <= payload.maxOutputBytes, 'provider output bound exceeded; uncertainty retained');
          ensure(observation.state !== 'complete' || observation.bytes !== null, 'complete provider response lacks bytes');
          ensure(observation.providerOperation === null || typeof observation.providerOperation === 'string' && observation.providerOperation.length <= 256, 'provider operation bound');
          ensure(typeof observation.usage.source === 'string' && observation.usage.source.length > 0 && observation.usage.source.length <= 256, 'provider usage source bound');
          if (observation.limitation) {
            ensure(observation.state === 'uncertain' && ['transport-threw', 'invalid-provider-observation', 'response-byte-limit'].includes(observation.limitation.kind), 'invalid provider limitation');
            const lower = observation.limitation.observedBytesAtLeast;
            ensure(lower === null || Number.isSafeInteger(lower) && lower >= 0, 'invalid provider byte lower bound');
          }
          ensure(typeof observation.retryBlocked === 'boolean', 'provider retry status absent');
          ensure(!observation.retryBlocked, 'hidden retry reported; uncertainty retained');
          for (const n of [observation.usage.inputTokens, observation.usage.outputTokens, observation.usage.charge])
            ensure(n === null || Number.isSafeInteger(n) && n >= 0, 'invalid provider usage');
          ensure(observation.usage.outputTokens === null || observation.usage.outputTokens <= payload.maxTokens, 'provider token bound exceeded; uncertainty retained');
          ensure(observation.usage.charge === null || observation.usage.charge <= payload.maxCharge, 'provider charge bound exceeded; uncertainty retained');
          return take(captures.putReserved(admitted.capacity, encoded(freeze(observation)).bytes));
        });
      } });
    } } satisfies ProviderInvocationPort);
  });
}
