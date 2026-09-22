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
  if (v.responseEvidence) {
    const e = v.responseEvidence, bounded = (value: string, field: string) => ensure(typeof value === 'string' && value.length > 0 && value.length <= 2048, `${field} bound`);
    ensure(e.eligibility === 'admitted' || e.eligibility === 'held', 'response evidence eligibility invalid');
    ensure(e.contract.mode === 'single-final-reply', 'unsupported response evidence mode');
    for (const value of [e.contract.maxMetadataBytes, e.contract.maxRawTerminalBytes, e.contract.maxCaptureBytes, e.terminal.observedAt])
      ensure(Number.isSafeInteger(value) && value >= 0, 'response evidence bound or clock invalid');
    ensure(e.contract.maxMetadataBytes > 0 && e.contract.maxRawTerminalBytes > 0
      && e.contract.maxCaptureBytes >= e.contract.maxMetadataBytes
      && new TextEncoder().encode(encoded(e).bytes).length <= e.contract.maxMetadataBytes,
    'response evidence exceeds declared finite metadata bound');
    for (const [field, value] of Object.entries({ parserReference: e.contract.parserReference, parserVersion: e.contract.parserVersion,
      evidenceContractReference: e.contract.evidenceContractReference, evidenceContractVersion: e.contract.evidenceContractVersion,
      observerPrincipal: e.source.observerPrincipal, executableArtifact: e.source.executableArtifact,
      provider: e.source.provider, model: e.source.model, route: e.source.route, call: e.source.call, request: e.source.request,
      attempt: e.source.attempt, operation: e.source.operation, claim: e.source.claim,
      reason: e.terminal.reason, providerReason: e.terminal.providerReason,
      extractionContract: e.answer.extractionContract })) bounded(value, field);
    if (e.eligibility === 'admitted') for (const [field, value] of Object.entries({ controller: e.source.controller,
      endpoint: e.source.endpoint, account: e.source.account, credentialReference: e.source.credentialReference,
      terminalEvidence: e.terminal.evidence })) bounded(value, field);
    ensure(e.source.provider === d.provider && e.source.model === d.model && e.source.route === d.route,
      'response evidence route differs');
    ensure((e.eligibility === 'held' || e.source.evidence.length > 0) && e.source.evidence.length <= 64
      && e.source.evidence.every(id => typeof id === 'string' && id.length > 0 && id.length <= 2048), 'response source Evidence references invalid');
    ensure(['proof', 'observation', 'attestation', 'inference'].includes(e.source.strength), 'response source strength invalid');
    for (const capture of [e.terminal.raw, e.answer.source]) {
      bounded(capture.reference, 'response capture reference');
      ensure(/^sha256:[a-f0-9]{64}$/.test(capture.hash), 'response capture hash malformed');
    }
    for (const digest of [e.source.submittedDigest, e.terminal.rawDigest, e.answer.answerDigest]) ensure(/^sha256:[a-f0-9]{64}$/.test(digest), 'response digest malformed');
    for (const flag of [e.terminal.limited, e.terminal.errored, e.terminal.cancelled, e.terminal.timedOut, e.terminal.truncated, e.terminal.toolCall])
      ensure(typeof flag === 'boolean', 'response terminal flag invalid');
  }
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
function snapshotObservation(raw: unknown, d: ModelDescription): ProviderObservation {
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
  const responseEvidence = data(raw, 'responseEvidence');
  const count = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
  const input = data(usage, 'inputTokens'), output = data(usage, 'outputTokens'), charge = data(usage, 'charge'), source = data(usage, 'source');
  const validCount = (v: unknown) => v === null || count(v) !== null;
  const validText = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 256;
  // Avoid allocating a second unbounded byte array for oversized raw strings.
  const observedBytesAtLeast = typeof bytes !== 'string' ? null : bytes.length > d.maxOutputBytes ? bytes.length : new TextEncoder().encode(bytes).length;
  const oversized = observedBytesAtLeast !== null && observedBytesAtLeast > d.maxOutputBytes;
  const baseFields = ['state', 'bytes', 'providerOperation', 'usage', 'retryBlocked'];
  const valid = (plain(raw, baseFields) || plain(raw, [...baseFields, 'responseEvidence']))
    && plain(usage, ['inputTokens', 'outputTokens', 'charge', 'source'])
    && typeof state === 'string' && ['complete', 'rejected', 'uncertain'].includes(state)
    && (bytes === null || typeof bytes === 'string') && (state !== 'complete' || typeof bytes === 'string')
    && (operation === null || typeof operation === 'string' && operation.length <= 256)
    && [input, output, charge].every(validCount) && validText(source) && typeof data(raw, 'retryBlocked') === 'boolean';
  const copyEvidence = (): ProviderObservation['responseEvidence'] => {
    if (!responseEvidence || typeof responseEvidence !== 'object') return undefined;
    // Canonical snapshot rejects accessors and divorces every nested field from
    // the provider-owned object before the receipt is admitted.
    let nodes = 0;
    const clone = (value: unknown, depth: number): unknown => {
      ensure(depth <= 8 && ++nodes <= 512, 'response evidence structure exceeds bound');
      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
      ensure(value && typeof value === 'object', 'response evidence contains unsupported value');
      if (Array.isArray(value)) {
        const length = Object.getOwnPropertyDescriptor(value, 'length');
        ensure(length && 'value' in length && Number.isSafeInteger(length.value) && length.value >= 0
          && length.value <= 64, 'response evidence array exceeds bound');
        const allowed = new Set(['length', ...Array.from({ length: length.value }, (_, index) => String(index))]);
        ensure(Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.has(key)),
          'response evidence array fields differ');
        return Array.from({ length: length.value }, (_, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          ensure(descriptor && 'value' in descriptor, 'response evidence array accessor refused');
          return clone(descriptor.value, depth + 1);
        });
      }
      ensure([Object.prototype, null].includes(Object.getPrototypeOf(value)), 'response evidence prototype refused');
      const output: Record<string, unknown> = {};
      for (const key of Reflect.ownKeys(value)) {
        ensure(typeof key === 'string', 'response evidence symbol refused');
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        ensure(descriptor && 'value' in descriptor, 'response evidence accessor refused');
        output[key] = clone(descriptor.value, depth + 1);
      }
      return output;
    };
    const copied = clone(responseEvidence, 0) as NonNullable<ProviderObservation['responseEvidence']>;
    const keys = (value: object, expected: readonly string[]) => ensure(Reflect.ownKeys(value).sort().join(',') === [...expected].sort().join(','),
      'response evidence fields differ');
    keys(copied, ['eligibility', 'contract', 'source', 'terminal', 'answer']);
    keys(copied.contract, ['parserReference', 'parserVersion', 'evidenceContractReference', 'evidenceContractVersion',
      'mode', 'maxMetadataBytes', 'maxRawTerminalBytes', 'maxCaptureBytes']);
    keys(copied.source, ['observerPrincipal', 'controller', 'evidence', 'endpoint', 'account', 'credentialReference',
      'executableArtifact', 'provider', 'model', 'route', 'call', 'request', 'attempt', 'operation', 'claim',
      'submittedDigest', 'strength']);
    keys(copied.terminal, ['raw', 'rawDigest', 'evidence', 'reason', 'providerReason', 'observedAt', 'limited', 'errored',
      'cancelled', 'timedOut', 'truncated', 'toolCall']);
    keys(copied.terminal.raw, ['reference', 'hash']);
    keys(copied.answer, ['source', 'extractionContract', 'answerDigest']);
    keys(copied.answer.source, ['reference', 'hash']);
    return copied;
  };
  const evidence = copyEvidence();
  const observation: ProviderObservation = {
    state: valid && !oversized ? state as ProviderObservation['state'] : 'uncertain',
    bytes: typeof bytes === 'string' && !oversized ? bytes : null,
    providerOperation: typeof operation === 'string' && operation.length <= 256 ? operation : null,
    usage: { inputTokens: count(input), outputTokens: count(output), charge: count(charge),
      source: validText(source) ? source as string : 'invalid usage source; independently valid numeric fields retained' },
    retryBlocked: false,
    ...(evidence ? { responseEvidence: evidence } : {}),
    ...(!valid || oversized ? { limitation: { kind: oversized ? 'response-byte-limit' as const : 'invalid-provider-observation' as const, observedBytesAtLeast } } : {}),
  };
  observationCheck(observation, d);
  // Canonical copy also divorces the recorder from provider/SDK-owned objects.
  return freeze(JSON.parse(encoded(observation).bytes) as ProviderObservation);
}
const thrownObservation = (): ProviderObservation => freeze({ state: 'uncertain', bytes: null, providerOperation: null,
  usage: { inputTokens: null, outputTokens: null, charge: null, source: 'invocation threw; liability unknown' }, retryBlocked: false,
  limitation: { kind: 'transport-threw', observedBytesAtLeast: null } });
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
