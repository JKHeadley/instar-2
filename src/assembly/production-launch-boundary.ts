import { randomBytes, sign, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import type { Hash, Result } from '../index.js';
import type { FactEnvelope, FactStorePort } from '../facts/index.js';
import type { HarnessLaunchSpec, HarnessObservation } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import type { AssemblyDecodeContext } from './contracts.js';

// ---- strict v1 wire (S8 owns the codec; the installed M1 service imports it) ----

export const MONITOR_MAX_FRAME = 65_536;
const receiptDomain = 'instar2-worker-monitor/receipt/v1\n';
const hex64 = /^[a-f0-9]{64}$/;
const hashPattern = /^sha256:[a-f0-9]{64}$/;
const states = new Set(['refused-before-release', 'running', 'exited', 'expired', 'stopped', 'unknown']);
const reasons = new Set(['ok', 'authority', 'binding', 'capacity', 'deadline', 'stop',
  'guard-lost', 'worker-exit', 'journal-full', 'journal-untrusted', 'identity-unknown',
  'unsupported', 'not-observed']);
const requestFields = ['body', 'challenge', 'installation', 'machine', 'method', 'v'];
const launchFields = ['claim', 'consumed', 'digest', 'operation', 'request', 'specification'];
const observeFields = ['digest', 'launchIdentity', 'observationAuthority', 'operation', 'request'];
const replyFields = ['challenge', 'keyId', 'receipt', 'requestHash', 'signature', 'v'];
const receiptFields = ['artifactDigest', 'bootId', 'claim', 'consumed', 'currentBootId',
  'digest', 'evidenceReferences', 'freshForMs', 'handlePolicyDigest', 'installation',
  'launchIdentity', 'limitsDigest', 'machine', 'observedAt', 'operation',
  'originalDeadline', 'pid', 'processStartIdentity', 'profileDigest', 'reason',
  'releaseDigest', 'request', 'sequence', 'specification', 'state', 'uid'];
const trustFields = ['artifactDigest', 'authorityValidUntil', 'clockReference', 'currentBootId',
  'handlePolicyDigest', 'keyId', 'limitsDigest', 'millisecondsPerUnit', 'now',
  'profileDigest', 'publicKey', 'releaseDigest'];

export type MonitorLaunchBody = Readonly<{ request: string; specification: string; claim: string;
  consumed: string; operation: string; digest: string }>;
export type MonitorObserveBody = Readonly<{ request: string; operation: string; digest: string;
  launchIdentity: string | null; observationAuthority: string }>;
export type MonitorRequest = Readonly<{ v: 1; challenge: string; installation: string; machine: string }
  & ({ method: 'launch'; body: MonitorLaunchBody } | { method: 'observe'; body: MonitorObserveBody })>;
export type MonitorReceipt = Readonly<Record<string, unknown> & {
  state: string; reason: string; launchIdentity: string | null; bootId: string | null;
  observedAt: Readonly<{ clockReference: string; value: number }>; freshForMs: number;
  evidenceReferences: readonly string[] }>;
export type MonitorReply = Readonly<{ v: 1; challenge: string; requestHash: string; keyId: string;
  receipt: MonitorReceipt; signature: string }>;
export type MonitorTrust = Readonly<{ keyId: string; publicKey: KeyObject; releaseDigest: string;
  artifactDigest: string; profileDigest: string; handlePolicyDigest: string; limitsDigest: string;
  currentBootId: string; clockReference: string; now: number; authorityValidUntil: number;
  millisecondsPerUnit: number }>;

/** Canonical UTF-8 JSON text through the public owner encoder. */
const canonicalBytes = (value: unknown): string => encoded(value).bytes;
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw Error(message); }
function exact(value: unknown, fields: readonly string[]): asserts value is Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === fields.slice().sort().join(','), 'closed shape required');
}
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 512;
const digest = (value: unknown): value is string => typeof value === 'string' && hashPattern.test(value);
const unsigned = (value: unknown) => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
const nonnegative = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const nullable = (value: unknown, predicate: (value: unknown) => boolean) => value === null || predicate(value);

export function monitorFrame(value: unknown): Buffer {
  const bytes = Buffer.from(canonicalBytes(value), 'utf8');
  assert(bytes.length <= MONITOR_MAX_FRAME, 'frame too large');
  const result = Buffer.allocUnsafe(bytes.length + 4);
  result.writeUInt32BE(bytes.length);
  bytes.copy(result, 4);
  return result;
}

export function monitorUnframe(input: Uint8Array): unknown {
  assert(input instanceof Uint8Array && input.length >= 4, 'truncated frame');
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const length = bytes.readUInt32BE(0);
  assert(length <= MONITOR_MAX_FRAME && bytes.length === length + 4, 'invalid frame length');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(4));
  const value: unknown = JSON.parse(text);
  assert(canonicalBytes(value) === text, 'noncanonical frame');
  return value;
}

export function monitorRequest(input: unknown): MonitorRequest {
  exact(input, requestFields);
  assert(input.v === 1 && (input.method === 'launch' || input.method === 'observe'), 'unsupported method');
  assert(typeof input.challenge === 'string' && hex64.test(input.challenge) && id(input.installation) && id(input.machine),
    'invalid request envelope');
  const body = input.body;
  exact(body, input.method === 'launch' ? launchFields : observeFields);
  assert(id(body.request) && id(body.operation) && digest(body.digest), 'invalid operation identity');
  if (input.method === 'launch')
    assert(id(body.specification) && id(body.claim) && id(body.consumed), 'incomplete launch locators');
  else assert(id(body.observationAuthority) && nullable(body.launchIdentity, digest), 'incomplete observation locators');
  return input as unknown as MonitorRequest;
}

export function monitorReceipt(input: unknown): MonitorReceipt {
  exact(input, receiptFields);
  for (const field of ['installation', 'machine', 'bootId', 'request', 'operation', 'claim', 'consumed',
    'specification', 'currentBootId'])
    assert(nullable(input[field], id), `invalid receipt ${field}`);
  for (const field of ['releaseDigest', 'digest', 'launchIdentity', 'artifactDigest', 'profileDigest',
    'handlePolicyDigest', 'limitsDigest'])
    assert(nullable(input[field], digest), `invalid receipt ${field}`);
  assert(nullable(input.uid, nonnegative) && nullable(input.pid, nonnegative)
    && nonnegative(input.sequence) && nonnegative(input.freshForMs)
    && (input.freshForMs as number) <= 1000 && states.has(input.state as string) && reasons.has(input.reason as string),
  'invalid receipt observation');
  exact(input.observedAt, ['clockReference', 'value']);
  assert(id(input.observedAt.clockReference) && Number.isFinite(input.observedAt.value), 'invalid observation clock');
  if (input.originalDeadline !== null) {
    exact(input.originalDeadline, ['bootId', 'continuousTicks', 'ownerClockReference', 'ownerValidUntil',
      'timebaseDenom', 'timebaseNumer']);
    const d = input.originalDeadline;
    assert(id(d.bootId) && id(d.ownerClockReference) && Number.isFinite(d.ownerValidUntil)
      && unsigned(d.continuousTicks) && unsigned(d.timebaseNumer) && unsigned(d.timebaseDenom)
      && d.timebaseDenom !== '0', 'invalid original deadline');
  }
  if (input.processStartIdentity !== null) {
    exact(input.processStartIdentity, ['bootId', 'startTicks', 'uniqueId']);
    const p = input.processStartIdentity;
    assert(id(p.bootId) && unsigned(p.startTicks) && unsigned(p.uniqueId), 'invalid process identity');
  }
  assert(Array.isArray(input.evidenceReferences) && input.evidenceReferences.length <= 64
    && input.evidenceReferences.every(id), 'invalid evidence references');
  if (['running', 'exited', 'expired', 'stopped'].includes(input.state as string))
    assert(input.launchIdentity !== null && input.originalDeadline !== null
      && input.uid !== null && input.pid !== null && input.processStartIdentity !== null
      && input.bootId === (input.processStartIdentity as Record<string, unknown>).bootId
      && (input.evidenceReferences as unknown[]).length > 0, 'attributable process evidence required');
  return input as unknown as MonitorReceipt;
}

export function monitorLaunchIdentity(input: unknown, originalBootId: string): string {
  const request = monitorRequest(input);
  assert(request.method === 'launch' && id(originalBootId), 'launch identity requires original boot');
  const body = request.body;
  return encoded(['instar2-worker-monitor/v1', request.installation, request.machine,
    originalBootId, body.request, body.operation, body.digest, body.specification, body.claim, body.consumed]).hash;
}

export function signMonitorReply(input: unknown, record: unknown, keyId: string, privateKey: KeyObject): MonitorReply {
  const request = monitorRequest(input), receipt = monitorReceipt(record);
  assert(id(keyId), 'invalid key ID');
  const requestHash = encoded(request).hash;
  const signed = Buffer.from(receiptDomain + canonicalBytes([receipt, request.challenge, requestHash]));
  return Object.freeze({ v: 1 as const, challenge: request.challenge, requestHash, keyId,
    receipt, signature: sign(null, signed, privateKey).toString('base64') });
}

export function verifyMonitorReply(input: unknown, reply: unknown, trust: unknown): MonitorReceipt {
  const request = monitorRequest(input);
  exact(reply, replyFields);
  const receipt = monitorReceipt(reply.receipt);
  exact(trust, trustFields);
  const t = trust as unknown as MonitorTrust;
  assert(reply.v === 1 && reply.challenge === request.challenge
    && reply.requestHash === encoded(request).hash && reply.keyId === t.keyId,
  'reply request or trust binding differs');
  assert(receipt.installation === request.installation && receipt.machine === request.machine
    && receipt.request === request.body.request && receipt.operation === request.body.operation
    && receipt.digest === request.body.digest, 'reply subject differs');
  if (request.method === 'launch')
    assert(receipt.specification === request.body.specification && receipt.claim === request.body.claim
      && receipt.consumed === request.body.consumed, 'launch subject differs');
  if (request.method === 'launch' && receipt.bootId !== null && receipt.launchIdentity !== null)
    assert(receipt.launchIdentity === monitorLaunchIdentity(request, receipt.bootId), 'original launch identity differs');
  else if (request.method === 'observe' && request.body.launchIdentity !== null)
    assert(receipt.launchIdentity === request.body.launchIdentity, 'launch identity differs');
  for (const field of ['artifactDigest', 'handlePolicyDigest', 'limitsDigest', 'profileDigest',
    'releaseDigest', 'currentBootId'] as const)
    assert(receipt[field] === t[field], `trusted ${field} differs`);
  assert(receipt.observedAt.clockReference === t.clockReference
    && Number.isFinite(t.now) && Number.isFinite(t.authorityValidUntil)
    && Number.isFinite(t.millisecondsPerUnit) && t.millisecondsPerUnit > 0
    && t.now >= receipt.observedAt.value
    && (t.now - receipt.observedAt.value) * t.millisecondsPerUnit <= receipt.freshForMs
    && t.now <= t.authorityValidUntil, 'receipt observation is stale, future or unauthorized');
  assert(typeof reply.signature === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(reply.signature), 'invalid signature encoding');
  const signature = Buffer.from(reply.signature, 'base64');
  assert(signature.toString('base64') === reply.signature, 'noncanonical signature');
  const signed = Buffer.from(receiptDomain + canonicalBytes([receipt, reply.challenge, reply.requestHash]));
  assert(verify(null, signed, t.publicKey, signature), 'invalid receipt signature');
  return receipt;
}

// ---- seam 4: constructor-bound locator resolution over the genuine store ----

type Located = Readonly<{ fact: FactEnvelope; record: Readonly<Record<string, unknown>> }>;
const recordOf = (fact: FactEnvelope): Readonly<Record<string, unknown>> | undefined => {
  const body = fact.body as { record?: unknown } | null;
  return body && typeof body === 'object' && body.record && typeof body.record === 'object'
    ? body.record as Readonly<Record<string, unknown>> : undefined;
};

/**
 * Resolves the exact wire locators for S8's synchronous inputs from the one
 * installed store (bound at construction, never per call). Launch: the exact
 * signed specification fact, the operation's original request, the given
 * dispatch claim and its consumed successor. Observation: the original request
 * and the current admitted Six wake pending this operation. Missing or
 * ambiguous resolution refuses before any transport call. Facts are immutable,
 * so a restart resolves the same original tuple; nothing selects a new operation.
 */
export function createLaunchLocatorResolver(store: FactStorePort) {
  const current = () => {
    take(store.sweep());
    const prefix = take(store.verifiedPrefix());
    return prefix.facts.map(fact => ({ fact, record: recordOf(fact) ?? {} }) as Located);
  };
  const reservations = (rows: readonly Located[], operation: string) => rows.filter(row =>
    row.fact.kind === 'transport-AdmissionReservation' && row.record.type === 'AdmissionReservation'
    && row.record.operation === operation);
  return freeze({
    launch(specification: HarnessLaunchSpec, operation: string, claim: string): MonitorLaunchBody {
      const rows = current();
      const specs = rows.filter(row => row.fact.kind === 'assembly-HarnessLaunchSpec'
        && encoded(row.record).bytes === encoded(specification).bytes);
      ensure(specs.length === 1, specs.length ? 'launch specification is ambiguous' : 'exact signed launch specification absent');
      const ops = reservations(rows, operation);
      const index = ops.findIndex(row => row.fact.id === claim);
      const claimed = ops[index], consumed = ops[index + 1];
      ensure(ops.length > 0 && claimed?.record.state === 'dispatch-claimed', 'original dispatch claim absent');
      ensure(consumed?.record.state === 'consumed' && index + 2 === ops.length, 'consumed successor absent or superseded');
      ensure(typeof ops[0]!.record.request === 'string' && typeof claimed.record.digest === 'string', 'original request absent');
      return freeze({ request: ops[0]!.record.request as string, specification: specs[0]!.fact.id, claim,
        consumed: consumed.fact.id, operation, digest: claimed.record.digest as string });
    },
    observe(operation: string, operationDigest: string): Readonly<{
      body: Omit<MonitorObserveBody, 'launchIdentity'>; specification: HarnessLaunchSpec }> {
      const rows = current();
      const ops = reservations(rows, operation);
      ensure(ops.length > 0 && ops[0]!.record.digest === operationDigest, 'original operation absent or changed');
      const run = ops[0]!.record.run;
      // The original placement names this operation's prepared fact (or, on the
      // retained legacy arm, the operation key); exactly one may match.
      const specs = rows.filter(row => row.fact.kind === 'assembly-HarnessLaunchSpec' && row.record.run === run
        && (row.record.processOperation === ops[0]!.fact.id || row.record.processOperation === operation));
      ensure(specs.length === 1, specs.length ? 'original launch specification is ambiguous' : 'original launch specification absent');
      const wakes = rows.filter(row => row.fact.kind === 'transport-LoopRecord' && row.record.type === 'LoopRecord'
        && row.record.run === run);
      const wake = wakes.at(-1);
      ensure(wake && wake.record.pending === operation && ['running', 'restoring', 'waiting'].includes(wake.record.state as string),
        'no current admitted wake for this operation');
      return freeze({ body: { request: ops[0]!.record.request as string, operation, digest: operationDigest,
        observationAuthority: wake.fact.id }, specification: specs[0]!.record as unknown as HarnessLaunchSpec });
    },
  });
}

// ---- S8 ----

/** The installed synchronous client: the pinned enforcer `client` role run with
 * a bounded timeout. It exchanges exactly one frame; it never spawns a worker. */
export interface MonitorClientPort { exchange(request: Uint8Array): Uint8Array }

export interface InstalledLaunchMonitor {
  readonly installation: string; readonly machine: string;
  /** The one installed store (constructor-bound resolver source). */
  readonly store: FactStorePort;
  readonly client: MonitorClientPort;
  /** Independently installed receipt trust, read fresh per verification. */
  trust(): MonitorTrust | null;
  generation(): string;
}

/** The fixed monitor is an installed, independently trusted component. Until its
 * reviewed protocol and host trust reference are present, the production leaf is
 * unavailable. This port deliberately has no local process execution path. */
export interface ProductionLaunchBoundary {
  readonly state: 'monitor-unavailable' | 'monitor-installed';
  launch(specification: HarnessLaunchSpec, operation: string, claim: string): Result<HarnessObservation>;
  observe(operation: string, digest: string): Result<HarnessObservation>;
}

const phaseFor = (receipt: MonitorReceipt): HarnessObservation['phase'] =>
  receipt.state === 'running' ? 'launched'
    : ['exited', 'expired', 'stopped'].includes(receipt.state) ? 'exit-observed'
      : receipt.state === 'refused-before-release' ? 'refused' : 'uncertain';

export function createProductionLaunchBoundary(context: AssemblyDecodeContext,
  installed?: InstalledLaunchMonitor): ProductionLaunchBoundary {
  if (!installed) {
    const unavailable = (site: string, subject: unknown): Result<never> => boundary(site, subject, context, () => {
      ensure(false, 'fixed native worker monitor and trusted installation are unavailable');
      throw Error('unreachable');
    });
    return Object.freeze({ state: 'monitor-unavailable' as const,
      launch: (specification: HarnessLaunchSpec, operation: string, claim: string) =>
        unavailable('ProductionNativeLaunch', { specification, operation, claim }),
      observe: (operation: string, digest: string) =>
        unavailable('ProductionNativeLaunchObservation', { operation, digest }),
    });
  }
  const resolver = createLaunchLocatorResolver(installed.store);
  const launched = new Map<string, Readonly<{ identity: string | null }>>();
  const exchange = (request: MonitorRequest): MonitorReceipt => {
    // Trust is read before transport: unavailable trust means zero calls.
    const trust = installed.trust();
    ensure(trust, 'installed receipt trust unavailable');
    const reply = monitorUnframe(installed.client.exchange(monitorFrame(request)));
    return verifyMonitorReply(request, reply, trust);
  };
  const observation = (specification: HarnessLaunchSpec, receipt: MonitorReceipt, subject: string): HarnessObservation =>
    freeze({ type: 'HarnessObservation', schemaVersion: 1,
      id: `harness-observation:${encoded({ launch: specification.id, subject, sequence: receipt.sequence, state: receipt.state }).hash}`,
      predecessors: [], dependencyFacts: [], launch: specification.id, run: specification.run, step: specification.step,
      input: specification.input, incarnation: specification.incarnation, sourceEvidence: [...receipt.evidenceReferences],
      contextDigests: [], generation: installed.generation(), causalReferences: [],
      observedAt: receipt.observedAt.value, freshFor: receipt.freshForMs, phase: phaseFor(receipt),
      boundaryEvidence: receipt.evidenceReferences[0] ?? `monitor-receipt:${subject}`,
      detail: `${receipt.state}:${receipt.reason}` } as unknown as HarnessObservation);
  const challenge = () => randomBytes(32).toString('hex');
  return Object.freeze({ state: 'monitor-installed' as const,
    launch: (specification: HarnessLaunchSpec, operation: string, claim: string) =>
      boundary('ProductionNativeLaunch', { specification, operation, claim }, context, () => {
        // A launch is sent at most once per operation from this boundary; any
        // uncertainty afterwards is resolved by observe, never by a resend.
        ensure(!launched.has(operation), 'launch already attempted for this operation; observe instead');
        const body = resolver.launch(specification, operation, claim);
        launched.set(operation, freeze({ identity: null }));
        const request = monitorRequest({ v: 1, method: 'launch', challenge: challenge(),
          installation: installed.installation, machine: installed.machine, body });
        const receipt = exchange(request);
        launched.set(operation, freeze({ identity: receipt.launchIdentity }));
        return observation(specification, receipt, 'launch');
      }),
    observe: (operation: string, operationDigest: string) =>
      boundary('ProductionNativeLaunchObservation', { operation, digest: operationDigest }, context, () => {
        // After a restart the identity is unknown (null): the monitor looks the
        // original up by request/operation; it never creates or renews work.
        const located = resolver.observe(operation, operationDigest);
        const request = monitorRequest({ v: 1, method: 'observe', challenge: challenge(),
          installation: installed.installation, machine: installed.machine,
          body: { ...located.body, launchIdentity: launched.get(operation)?.identity ?? null } });
        return observation(located.specification, exchange(request), 'observe');
      }),
  });
}
