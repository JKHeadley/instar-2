/** Ten's bounded custody candidate. Installation and transport authority are supplied by
 * independently installed host configuration; this module creates no standing fact. */
import { randomBytes } from 'node:crypto';
import type { BoundaryContext, Hash, Result } from '../index.js';
import { canonical, consumeResult } from '../index.js';
import { causalCone, createFactStore, hashBytes, prepareSnapshot, verifyAndAdmit } from '../facts/index.js';
import type { AppendReceipt, CapturedContent, FactContext, FactEnvelope, FactStorePort, SegmentStoragePort } from '../facts/index.js';
import type { EffectComposition } from '../effects/index.js';
type EffectDurabilityPort = EffectComposition['durability'];
import type { TelegramDurableCapturePort } from './telegram-bot-api-custodian.js';
import { boundary, ensure, take } from './boundary.js';

export interface PeerLimits {
  readonly maxRequestBytes: number; readonly maxResponseBytes: number;
  readonly maxFacts: number; readonly maxCaptures: number; readonly maxCaptureBytes: number;
  readonly maxDiskBytes: number; readonly maxQueue: number; readonly timeoutMs: number; readonly maxAttempts: number;
}
export interface PeerDescriptor {
  readonly installation: string; readonly studio: string; readonly laptop: string;
  readonly store: string; readonly epoch: number; readonly trust: string; readonly custody: string;
  readonly captureReferences: readonly string[]; readonly capturePrefixes: readonly string[]; readonly limits: PeerLimits;
}
export interface PeerCapture { readonly reference: string; readonly hash: Hash; readonly bytes: string }
export interface PeerRequest {
  readonly protocol: 'instar-fixed-peer-v1'; readonly operation: 'append-verify' | 'verify';
  readonly installation: string; readonly studio: string; readonly laptop: string;
  readonly store: string; readonly epoch: number; readonly trust: string; readonly custody: string;
  readonly descriptorDigest: string; readonly challenge: string; readonly prefixDigest: string;
  readonly frontier: Readonly<Record<string, { epoch: number; position: number }>>;
  readonly facts: readonly FactEnvelope[]; readonly captures: readonly PeerCapture[];
}
export interface PeerResponse {
  readonly protocol: 'instar-fixed-peer-v1'; readonly installation: string; readonly studio: string;
  readonly laptop: string; readonly store: string; readonly epoch: number; readonly trust: string;
  readonly custody: string; readonly descriptorDigest: string; readonly challenge: string; readonly requestDigest: string;
  readonly prefixDigest: string; readonly captureDigest: string; readonly persistedFacts: readonly { id: string; hash: string }[];
  readonly persistedCaptures: readonly { reference: string; hash: string }[]; readonly durable: true;
}
export interface AuthenticatedPeerTransport {
  readonly owner: 'part-ten';
  roundTrip(request: PeerRequest): Readonly<{ peer: string; trust: string; response: PeerResponse }>;
}
const bytes = (value: unknown) => take(canonical(value)).bytes;
const digest = (value: unknown) => hashBytes(bytes(value));
const positive = (v: number) => Number.isSafeInteger(v) && v > 0;
const closed = (value: object, keys: readonly string[]) =>
  Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const fields = (d: Pick<PeerDescriptor, 'installation' | 'studio' | 'laptop' | 'store' | 'epoch' | 'trust' | 'custody'>) => ({ installation: d.installation, studio: d.studio, laptop: d.laptop,
  store: d.store, epoch: d.epoch, trust: d.trust, custody: d.custody });
function validateDescriptor(d: PeerDescriptor): void {
  for (const value of [d.installation, d.studio, d.laptop, d.store, d.trust, d.custody])
    ensure(typeof value === 'string' && value.length > 0 && value.length <= 256, 'peer descriptor binding missing');
  ensure(d.studio !== d.laptop && d.laptop === 'm_cc2ec651a91f', 'distinct enrolled Laptop required');
  ensure(Number.isSafeInteger(d.epoch) && d.epoch >= 0, 'peer epoch invalid');
  ensure(closed(d.limits, ['maxRequestBytes', 'maxResponseBytes', 'maxFacts', 'maxCaptures',
    'maxCaptureBytes', 'maxDiskBytes', 'maxQueue', 'timeoutMs', 'maxAttempts'])
    && Object.values(d.limits).every(positive), 'finite peer bounds required');
  ensure(d.limits.maxAttempts === 1 && d.limits.maxQueue === 1, 'peer retry/queue must be one');
  ensure(new Set(d.captureReferences).size === d.captureReferences.length
    && d.captureReferences.every(r => typeof r === 'string' && r.length > 0 && r.length <= 4096), 'capture policy invalid');
  ensure(new Set(d.capturePrefixes).size === d.capturePrefixes.length
    && d.capturePrefixes.every(p => typeof p === 'string' && /^[A-Za-z0-9._-]{3,64}:$/.test(p)),
  'capture class policy invalid');
}
const permitted = (d: PeerDescriptor, reference: string) => d.captureReferences.includes(reference)
  || d.capturePrefixes.some(prefix => reference.startsWith(prefix));
function prefix(facts: readonly FactEnvelope[]) {
  const frontier: Record<string, { epoch: number; position: number }> = {};
  for (const fact of facts) {
    ensure(fact.machine === fact.segment.machine && fact.segment.epoch >= 0, 'prefix segment mismatch');
    frontier[fact.machine] = { epoch: fact.segment.epoch, position: fact.segment.position };
  }
  return { frontier, digest: digest(facts.map(f => ({ id: f.id, hash: f.contentHash, bytes: bytes(f) }))) };
}
function custodyContext(base: FactContext, captures: readonly PeerCapture[]): FactContext {
  const selected = new Map(captures.map(c => [c.reference, c]));
  const entries: Record<string, CapturedContent> = {};
  for (const [reference, capture] of Object.entries(base.captures)) {
    const supplied = selected.get(reference);
    entries[reference] = supplied ? { hash: supplied.hash, bytes: supplied.bytes,
      byteLength: Buffer.byteLength(supplied.bytes), status: 'available' }
      : { ...capture, bytes: null, status: capture.status === 'available' ? 'missing' : capture.status };
  }
  for (const capture of captures) if (!entries[capture.reference]) entries[capture.reference] = {
    hash: capture.hash, bytes: capture.bytes, byteLength: Buffer.byteLength(capture.bytes), status: 'available' };
  return { ...base, captures: entries, decode: { ...base.decode,
    captures: Object.fromEntries(captures.map(c => [c.reference, c.bytes])) } };
}
function requestedCaptures(d: PeerDescriptor, available: Readonly<Record<string, CapturedContent>>,
  context: FactContext, local: SegmentStoragePort, facts: readonly FactEnvelope[]): PeerCapture[] {
  // The installed policy supplies the bounded candidate universe. Removing each
  // candidate is tested by Two's actual historical projection, so hash-addressed,
  // schema-owned and constitutional dependencies use their owner's semantics.
  const selected = Object.keys(available).filter(r => permitted(d, r)).sort();
  ensure(selected.length <= d.limits.maxCaptures, 'capture candidate count bound');
  const all = selected.map(reference => {
    const capture = available[reference];
    return capture?.status === 'available' && typeof capture.bytes === 'string'
      && hashBytes(capture.bytes) === capture.hash && Buffer.byteLength(capture.bytes) === capture.byteLength
      ? { reference, hash: capture.hash, bytes: capture.bytes } : null;
  });
  const clean = (captures: readonly PeerCapture[]) => {
    const result = createFactStore(custodyContext(context, captures), local).readForProjection();
    return consumeResult(result, { Success: snapshot => snapshot.entries.length === facts.length
      && snapshot.entries.every((entry, i) => bytes(entry.fact) === bytes(facts[i])
        && !entry.taint.length && !entry.conflicts.length), Refused: () => false });
  };
  // Available approved candidates are removed only when Two remains clean.
  // A missing approved capture is left for the final owner refusal below.
  let required = all.filter((c): c is PeerCapture => c !== null);
  for (const candidate of [...required]) {
    const without = required.filter(c => c.reference !== candidate.reference);
    if (clean(without)) required = without;
  }
  ensure(required.length <= d.limits.maxCaptures, 'capture count bound');
  ensure(clean(required), 'required capture unavailable or outside approved disclosure');
  ensure(required.every(c => Buffer.byteLength(c.bytes) <= d.limits.maxCaptureBytes), 'capture byte bound');
  return required;
}
function checkRequest(request: PeerRequest, d: PeerDescriptor): void {
  validateDescriptor(d);
  ensure(closed(request, ['protocol', 'operation', 'installation', 'studio', 'laptop', 'store', 'epoch', 'trust',
    'custody', 'descriptorDigest', 'challenge', 'prefixDigest', 'frontier', 'facts', 'captures']),
  'peer request fields not closed');
  ensure(request.protocol === 'instar-fixed-peer-v1' && ['append-verify', 'verify'].includes(request.operation), 'peer protocol invalid');
  ensure(bytes(fields(request)) === bytes(fields(d)), 'peer installation/store/trust binding differs');
  ensure(request.descriptorDigest === digest(d), 'peer descriptor/finite bounds differ');
  ensure(request.facts.length > 0 && request.facts.length <= d.limits.maxFacts, 'fact count bound');
  ensure(request.facts.every(f => f.machine === d.studio && f.segment.machine === d.studio
    && f.segment.epoch === d.epoch), 'peer source/epoch differs');
  ensure(request.captures.length <= d.limits.maxCaptures && request.captures.every(c =>
    closed(c, ['reference', 'hash', 'bytes']) && permitted(d, c.reference) && Buffer.byteLength(c.bytes) <= d.limits.maxCaptureBytes
    && hashBytes(c.bytes) === c.hash), 'capture policy/hash bound');
  ensure(new Set(request.captures.map(c => c.reference)).size === request.captures.length, 'duplicate capture');
  ensure(/^[a-f0-9]{64}$/.test(request.challenge), 'challenge invalid');
  const actual = prefix(request.facts);
  ensure(actual.digest === request.prefixDigest && bytes(actual.frontier) === bytes(request.frontier), 'prefix digest/frontier differs');
  const requestBytes = Buffer.byteLength(bytes(request));
  ensure(requestBytes <= d.limits.maxRequestBytes, 'request byte bound');
  ensure(d.limits.maxDiskBytes >= 2 * requestBytes + 4096, 'disk reservation smaller than transfer');
}
function responseFor(request: PeerRequest): PeerResponse {
  return { protocol: request.protocol, ...fields(request), descriptorDigest: request.descriptorDigest,
    challenge: request.challenge,
    requestDigest: digest(request), prefixDigest: request.prefixDigest,
    captureDigest: digest(request.captures.map(c => ({ reference: c.reference, hash: c.hash }))),
    persistedFacts: request.facts.map(f => ({ id: f.id, hash: f.contentHash })),
    persistedCaptures: request.captures.map(c => ({ reference: c.reference, hash: c.hash })), durable: true };
}
function checkResponse(request: PeerRequest, d: PeerDescriptor, channel: ReturnType<AuthenticatedPeerTransport['roundTrip']>): void {
  ensure(channel.peer === d.laptop && channel.trust === d.trust, 'authenticated Laptop/trust differs');
  const expected = responseFor(request);
  ensure(bytes(channel.response) === bytes(expected), 'peer response differs from exact request');
  ensure(Buffer.byteLength(bytes(channel.response)) <= d.limits.maxResponseBytes, 'response byte bound');
}
/** This is called only inside the fixed endpoint after the transport has authenticated
 * Studio. The real Two append and readForProjection decide historical admission. */
export function receiveFixedPeerRequest(input: Readonly<{ request: PeerRequest; descriptor: PeerDescriptor;
  authenticatedStudio: string; context: FactContext; storage: SegmentStoragePort;
  captures: TelegramDurableCapturePort; boundary: BoundaryContext;
  reserve(bytes: number): void }>): Result<PeerResponse> {
  return boundary('FixedPeerReceive', null, input.boundary, () => {
    const { request, descriptor: d } = input;
    checkRequest(request, d);
    ensure(input.authenticatedStudio === d.studio, 'authenticated Studio differs');
    input.reserve(Buffer.byteLength(bytes(request)));
    const captureMap: Record<string, CapturedContent> = { ...input.context.captures };
    for (const c of request.captures) {
      const existing = captureMap[c.reference];
      ensure(!existing || (existing.status === 'missing' && existing.hash === c.hash)
        || (existing.status === 'available' && existing.hash === c.hash
        && existing.bytes === c.bytes), 'receiver capture status conflict');
      captureMap[c.reference] = { hash: c.hash, bytes: c.bytes,
        byteLength: Buffer.byteLength(c.bytes), status: 'available' };
    }
    const context = custodyContext({ ...input.context, captures: captureMap }, request.captures);
    const store = createFactStore(context, input.storage);
    const old = take(store.read());
    ensure(old.length <= request.facts.length, 'receiver has history beyond requested prefix');
    for (let i = 0; i < old.length; i++) ensure(bytes(old[i]) === bytes(request.facts[i]), 'immutable receiver prefix conflict');
    const checkRequired = () => {
      const supplied = Object.fromEntries(request.captures.map(c => [c.reference, {
        hash: c.hash, bytes: c.bytes, byteLength: Buffer.byteLength(c.bytes), status: 'available' as const }]));
      const required = requestedCaptures(d, supplied, input.context,
        { owner: 'part-ten', read: () => request.facts, append: input.storage.append }, request.facts);
      ensure(bytes(required) === bytes(request.captures), 'unrelated or missing custody capture');
    };
    if (request.operation === 'verify') ensure(old.length === request.facts.length, 'prefix absent on verify');
    else {
      // Use Two's admission and snapshot ports before any durable mutation.
      // The real append repeats admission against the current durable head.
      const candidate = [...old];
      for (const f of request.facts.slice(old.length))
        candidate.push(take(verifyAndAdmit(f, d.studio, { ...context, facts: [...context.facts, ...candidate] })));
      const admitted = take(prepareSnapshot(candidate, context));
      ensure(admitted.entries.length === request.facts.length && admitted.entries.every((entry, i) =>
        bytes(entry.fact) === bytes(request.facts[i]) && !entry.taint.length && !entry.conflicts.length),
      'candidate prefix tainted, conflicted or incomplete');
      checkRequired();
      for (const c of request.captures) {
        ensure(input.captures.preserve(c.reference, c.bytes) && input.captures.read(c.reference) === c.bytes,
          'capture durable readback failed');
      }
      for (const f of request.facts.slice(old.length)) {
        const receipt = take(store.append(f, { peer: f.machine }));
        ensure(!receipt.taint.length && receipt.durability.kind === 'local-durable', 'receiver fact tainted or not durable');
      }
    }
    if (request.operation === 'verify') checkRequired();
    for (const c of request.captures) ensure(input.captures.read(c.reference) === c.bytes, 'capture readback differs');
    const snapshot = take(store.readForProjection());
    ensure(snapshot.entries.length === request.facts.length && snapshot.entries.every((entry, i) =>
      bytes(entry.fact) === bytes(request.facts[i]) && !entry.taint.length && !entry.conflicts.length),
    'receiver prefix tainted, conflicted or incomplete');
    return responseFor(request);
  });
}

export function createFixedPeerReplication(input: Readonly<{ descriptor: PeerDescriptor;
  local: SegmentStoragePort; context: FactContext; captures: () => Readonly<Record<string, CapturedContent>>;
  transport: AuthenticatedPeerTransport; boundary: BoundaryContext }>): Result<Readonly<{
  storage: SegmentStoragePort; durability: EffectDurabilityPort; verify(): Result<readonly AppendReceipt[]> }>> {
  return boundary('FixedPeerReplication', null, input.boundary, () => {
    const d = input.descriptor; validateDescriptor(d);
    ensure(input.local.owner === 'part-ten' && input.transport.owner === 'part-ten', 'peer port owner differs');
    const localStore: FactStorePort = createFactStore(input.context, input.local);
    const transfer = (required: readonly FactEnvelope[], operation: PeerRequest['operation']): readonly AppendReceipt[] => {
      ensure(required.length > 0 && required.length <= d.limits.maxFacts, 'fact count bound');
      const snapshot = take(localStore.readForProjection());
      const facts = snapshot.entries.map(entry => entry.fact), requiredIds = new Set(required.map(f => f.id));
      ensure(facts.length > 0 && facts.length <= d.limits.maxFacts && snapshot.entries.every(entry =>
        !entry.taint.length && !entry.conflicts.length), 'local prefix incomplete, tainted or conflicted');
      ensure(required.every(f => facts.some(local => local.id === f.id && bytes(local) === bytes(f))),
        'required exact fact absent from local prefix');
      for (const fact of required) ensure(causalCone(fact, facts).every(ancestor => requiredIds.has(ancestor.id)),
        'required causal ancestor missing');
      const captures = requestedCaptures(d, input.captures(), input.context, input.local, facts);
      const custodySnapshot = take(createFactStore(custodyContext(input.context, captures), input.local).readForProjection());
      ensure(custodySnapshot.entries.length === facts.length && custodySnapshot.entries.every((entry, i) =>
        bytes(entry.fact) === bytes(facts[i]) && !entry.taint.length && !entry.conflicts.length),
      'required custody captures unavailable or unapproved');
      const p = prefix(facts);
      const request: PeerRequest = { protocol: 'instar-fixed-peer-v1', operation, ...fields(d), descriptorDigest: digest(d),
        challenge: randomBytes(32).toString('hex'), prefixDigest: p.digest, frontier: p.frontier, facts, captures };
      checkRequest(request, d);
      const channel = input.transport.roundTrip(request);
      checkResponse(request, d, channel);
      // The receipt is issued by this Ten durability port after current local Two status
      // and the authenticated remote Two append/readback both pass for these exact bytes.
      return snapshot.entries.filter(entry => requiredIds.has(entry.fact.id)).map(entry => ({ fact: entry.fact, taint: entry.taint,
        durability: { kind: 'replicated' as const, n: 1, peers: [d.laptop] } }));
    };
    const durability: EffectDurabilityPort = Object.freeze({ owner: 'part-ten', ensure: (facts: readonly FactEnvelope[]) =>
      boundary('FixedPeerDurability', null, input.boundary, () => transfer(facts, 'append-verify')) });
    const storage: SegmentStoragePort = Object.freeze({ owner: 'part-ten', read: input.local.read,
      append: (value: string, expectedHead: string | null) => boundary('FixedPeerSegmentAppend', null, input.boundary, () => {
        take(input.local.append(value, expectedHead));
        const facts = take(localStore.read());
        transfer(facts, 'append-verify');
        return { kind: 'replicated' as const, n: 1, peers: [d.laptop] };
      }) });
    return Object.freeze({ storage, durability,
      verify: () => boundary('FixedPeerReadback', null, input.boundary, () => transfer(take(localStore.read()), 'verify')) });
  });
}
