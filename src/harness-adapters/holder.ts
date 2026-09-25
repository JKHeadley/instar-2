import { canonical, consumeResult } from '../index.js';
import type { Clock, Hash, Result } from '../index.js';
import type { AssemblyHost, HarnessObservation } from '../assembly/index.js';
import type { RunGraphPort } from '../rungraph/index.js';
import type { FenceToken, TransportAuthority } from '../transport/index.js';
import type { VerificationPlan, VerificationRuntimePort } from '../verification/index.js';
import type {
  HarnessAdapterDecodeContext,
  HarnessAdapterStateSnapshot,
  HarnessAdmissionPort,
  HarnessOperationAttempt,
  HarnessRuntimeEvent,
  HarnessRuntimeHandle,
} from './contracts.js';
import {
  decodeHarnessAdapterStateSnapshot,
  decodeHarnessHandleSnapshot,
  decodeHarnessRuntimeEvent,
  decodeHarnessRuntimeHandle,
  harnessAdapterIdentity,
} from './records.js';
import { decodeHarnessValidationFloor } from './validation-floor.js';
import type { HarnessValidationFloor } from './validation-floor.js';

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function encoded(value: unknown): Readonly<{ bytes: string; hash: Hash }> | null {
  return consumeResult(canonical(value), { Success: result => result, Refused: () => null });
}

function bytes(value: unknown): string | null {
  return encoded(value)?.bytes ?? null;
}

export interface HarnessAdapterStateStorePort {
  readonly owner: 'part-thirteen';
  readonly id: string;
  load(): unknown | null;
  save(expected: Hash | null, snapshot: HarnessAdapterStateSnapshot): void;
}

export interface HarnessEvidenceStateStorePort extends HarnessAdapterStateStorePort {
  loadValidationFloors(): readonly unknown[];
  appendValidationFloor(floor: HarnessValidationFloor): void;
  loadPoisonCandidates(): readonly unknown[];
  appendPoisonCandidate(event: HarnessRuntimeEvent): void;
}

export class HarnessEvidenceStateStoreBindingError extends Error {
  readonly code = 'HARNESS_EVIDENCE_DURABLE_RETENTION_REQUIRED';
  constructor() {
    super('evidence holder requires durable validation-floor load and append custody');
    this.name = 'HarnessEvidenceStateStoreBindingError';
  }
}

function validationFloorStore(state: HarnessEvidenceStateStorePort): HarnessEvidenceStateStorePort {
  if (typeof state.loadValidationFloors !== 'function'
    || typeof state.appendValidationFloor !== 'function'
    || typeof state.loadPoisonCandidates !== 'function'
    || typeof state.appendPoisonCandidate !== 'function') {
    throw new HarnessEvidenceStateStoreBindingError();
  }
  return state;
}

export interface HarnessHandleLookup {
  readonly state: 'found' | 'missing' | 'unknown';
  readonly found: boolean;
  readonly handle: HarnessRuntimeHandle | null;
  readonly reason: string;
}

export interface HarnessHandleWriteReceipt {
  readonly disposition: 'stored' | 'duplicate' | 'refused';
  readonly reason: string;
  readonly canonicalHash: Hash | null;
}

export interface RuntimeHandleHolder {
  readonly owner: 'part-thirteen';
  readonly machine: string;
  readonly maxHandles: number;
  readonly maxAttempts: number;
  prepare(launch: string): Readonly<{ disposition: 'available' | 'existing' | 'refused'; reason: string }>;
  beginAttempt(input: Readonly<Omit<HarnessOperationAttempt, 'state' | 'evidence' | 'observedAt'>>):
    import('./contracts.js').HarnessAttemptAdmission;
  finishAttempt(operation: string, evidence: string, observedAt: number):
    import('./contracts.js').HarnessAttemptAdmission;
  pendingAttempts(): readonly HarnessOperationAttempt[];
  put(handle: HarnessRuntimeHandle): HarnessHandleWriteReceipt;
  lookup(launch: string): HarnessHandleLookup;
  snapshot(id: string, capturedAt: number): Result<import('./contracts.js').HarnessHandleSnapshot>;
}

export interface HarnessEvidenceAdmission {
  readonly disposition: 'recorded' | 'duplicate' | 'refused';
  readonly reason: string;
  readonly progress: boolean;
  readonly progressKey: string;
}

export interface HarnessLivenessView {
  readonly state: 'live' | 'dead' | 'unknown';
  readonly reason: string;
  readonly event: string;
}

export interface HarnessProgressView {
  readonly state: 'progressed' | 'pending' | 'unknown';
  readonly reason: string;
  readonly event: string;
}

export interface HarnessCompletionView {
  readonly state: 'complete' | 'pending' | 'unknown';
  readonly reason: string;
  readonly event: string;
}

export interface HarnessResumeView {
  readonly state: 'eligible' | 'poisoned' | 'unknown';
  readonly reason: string;
  readonly event: string;
}

export interface HarnessReconnectEvidenceView {
  readonly state: 'joint' | 'unknown';
  readonly reason: string;
  readonly liveness: HarnessLivenessView;
  readonly resume: HarnessResumeView;
}

export interface HarnessEventRead {
  readonly state: 'available' | 'unknown';
  readonly events: readonly HarnessRuntimeEvent[];
  readonly reason: string;
}

export interface HarnessEvidenceHolder {
  readonly owner: 'part-thirteen';
  readonly machine: string;
  readonly scope: string;
  readonly maxEvents: number;
  readonly maxCaptureBytes: number;
  admit(event: HarnessRuntimeEvent): HarnessEvidenceAdmission;
  liveness(handle: HarnessRuntimeHandle, now: number): HarnessLivenessView;
  progress(handle: HarnessRuntimeHandle, now: number): HarnessProgressView;
  completion(handle: HarnessRuntimeHandle, now: number): HarnessCompletionView;
  resume(handle: HarnessRuntimeHandle, now: number): HarnessResumeView;
  reconnectEvidence(handle: HarnessRuntimeHandle, now: number): HarnessReconnectEvidenceView;
  events(launch: string): HarnessEventRead;
}

type ReconnectAuthorityCheck = () => Readonly<{ current: boolean; reason: string }>;
type ReconnectAuthorityBracket = (
  handle: HarnessRuntimeHandle,
  now: number,
  checkAuthority: ReconnectAuthorityCheck,
) => HarnessReconnectEvidenceView;

/* Package-private composition keeps the landed public holder contract unchanged while
 * ensuring reconnect uses the implementation's exact observation frontier. */
const reconnectAuthorityBrackets = new WeakMap<HarnessEvidenceHolder, ReconnectAuthorityBracket>();

export interface HarnessEvidenceOwnerPorts {
  readonly work?: Pick<RunGraphPort, 'read'>;
  readonly handles: Pick<RuntimeHandleHolder, 'owner' | 'machine' | 'lookup'>;
  readonly current: Pick<AssemblyHost, 'current'>;
  readonly verification?: Pick<VerificationRuntimePort, 'inspectCurrent' | 'posture'>;
}

/** Exact-byte compare-and-swap memory store used for bounded local composition and tests. */
export function createMemoryHarnessAdapterStateStore(
  id = 'memory:harness-adapter-state',
): HarnessEvidenceStateStorePort {
  let retained: HarnessAdapterStateSnapshot | null = null;
  let validationFloors: readonly HarnessValidationFloor[] = [];
  let poisonCandidates: readonly HarnessRuntimeEvent[] = [];
  return Object.freeze({
    owner: 'part-thirteen' as const,
    id,
    load: () => retained,
    save(expected: Hash | null, snapshot: HarnessAdapterStateSnapshot) {
      const current = retained ? harnessAdapterIdentity(retained).canonicalHash : null;
      if (current !== expected) throw new Error('harness adapter state compare-and-swap mismatch');
      retained = snapshot;
    },
    loadValidationFloors: () => validationFloors,
    appendValidationFloor(floor: HarnessValidationFloor) {
      const decoded = consumeResult(decodeHarnessValidationFloor(floor), {
        Success: value => value,
        Refused: refusal => { throw new Error(refusal.detail); },
      });
      const existing = validationFloors.find(row => row.id === decoded.id);
      if (existing) {
        if (bytes(existing) !== bytes(decoded)) throw new Error('immutable validation floor disagreement');
        return;
      }
      validationFloors = freeze([...validationFloors, decoded]);
    },
    loadPoisonCandidates: () => poisonCandidates,
    appendPoisonCandidate(event: HarnessRuntimeEvent) {
      const existing = poisonCandidates.find(row => row.id === event.id);
      if (existing) {
        if (harnessAdapterIdentity(existing).canonicalHash
          !== harnessAdapterIdentity(event).canonicalHash) {
          throw new Error('immutable poison candidate disagreement');
        }
        return;
      }
      poisonCandidates = freeze([...poisonCandidates, event]);
    },
  });
}

interface StateJournal {
  read(): HarnessAdapterStateSnapshot;
  commit(base: HarnessAdapterStateSnapshot, change: Partial<HarnessAdapterStateSnapshot>): HarnessAdapterStateSnapshot;
}

function stateFrom(input: Readonly<{
  adapter: string;
  machine: string;
  maxHandles: number;
  maxAttempts: number;
  maxEvents: number;
  maxCaptureBytes: number;
  context: HarnessAdapterDecodeContext;
  state: HarnessAdapterStateStorePort;
  initialHandles?: readonly HarnessRuntimeHandle[];
}>): StateJournal {
  if (input.state.owner !== 'part-thirteen') {
    throw new Error('harness adapter journal requires the package-local state port');
  }

  const decode = (value: unknown): HarnessAdapterStateSnapshot =>
    consumeResult(decodeHarnessAdapterStateSnapshot(value, input.context), {
      Success: result => result,
      Refused: refused => {
        throw new Error(`harness adapter state unavailable: ${refused.detail}`);
      },
    });

  const validateSubject = (snapshot: HarnessAdapterStateSnapshot): HarnessAdapterStateSnapshot => {
    if (snapshot.adapter !== input.adapter || snapshot.machine !== input.machine
      || snapshot.maxHandles !== input.maxHandles || snapshot.maxAttempts !== input.maxAttempts
      || snapshot.maxEvents !== input.maxEvents || snapshot.maxCaptureBytes !== input.maxCaptureBytes) {
      throw new Error('harness adapter state belongs to another exact bounded holder');
    }
    return snapshot;
  };

  const read = (): HarnessAdapterStateSnapshot => {
    const raw = input.state.load();
    if (raw === null) throw new Error('harness adapter state disappeared after initialization');
    return validateSubject(decode(raw));
  };

  const raw = input.state.load();
  if (raw === null) {
    const initial = decode({
      type: 'HarnessAdapterStateSnapshot',
      schemaVersion: 1,
      id: `adapter-state:${input.adapter}:${input.machine}`,
      adapter: input.adapter,
      machine: input.machine,
      revision: 0,
      maxHandles: input.maxHandles,
      maxAttempts: input.maxAttempts,
      maxEvents: input.maxEvents,
      maxCaptureBytes: input.maxCaptureBytes,
      handles: input.initialHandles ?? [],
      attempts: [],
      events: [],
    });
    try {
      input.state.save(null, initial);
    } catch {
      // Another holder may have initialized the same store. The fresh read below
      // is authoritative; no cached empty image is retained.
      read();
    }
  } else {
    const restored = validateSubject(decode(raw));
    if (input.initialHandles && bytes(restored.handles) !== bytes(input.initialHandles)) {
      throw new Error('restored handle snapshot disagrees with durable operation custody');
    }
  }

  return {
    read,
    commit(base, change) {
      const next = validateSubject(decode({ ...base, ...change, revision: base.revision + 1 }));
      input.state.save(harnessAdapterIdentity(base).canonicalHash, next);
      return next;
    },
  };
}

function handleReceipt(
  disposition: HarnessHandleWriteReceipt['disposition'],
  reason: string,
  canonicalHash: Hash | null,
): HarnessHandleWriteReceipt {
  return freeze({ disposition, reason, canonicalHash });
}

/** Bounded machine-local handle custody. Every attempt transition delegates to A1's total admission port. */
export function createRuntimeHandleHolder(input: Readonly<{
  adapter: string;
  machine: string;
  maxHandles: number;
  maxAttempts: number;
  context: HarnessAdapterDecodeContext;
  state: HarnessAdapterStateStorePort;
  admission: Pick<HarnessAdmissionPort, 'owner' | 'beginAttempt' | 'finishAttempt'>;
  initial?: import('./contracts.js').HarnessHandleSnapshot;
}>): RuntimeHandleHolder {
  if (!input.adapter || !input.machine || !Number.isSafeInteger(input.maxHandles) || input.maxHandles < 1
    || !Number.isSafeInteger(input.maxAttempts) || input.maxAttempts < 1) {
    throw new Error('runtime handle holder requires an adapter, machine, and positive finite capacities');
  }
  if (input.admission.owner !== 'part-thirteen') {
    throw new Error('runtime handle holder requires the landed Part Thirteen admission port');
  }
  if (input.initial && (input.initial.adapter !== input.adapter || input.initial.machine !== input.machine
    || input.initial.maxHandles !== input.maxHandles)) {
    throw new Error('runtime handle snapshot belongs to another exact holder');
  }

  const state = stateFrom({
    adapter: input.adapter,
    machine: input.machine,
    maxHandles: input.maxHandles,
    maxAttempts: input.maxAttempts,
    maxEvents: 0,
    maxCaptureBytes: 0,
    context: input.context,
    state: input.state,
    ...(input.initial ? { initialHandles: input.initial.handles } : {}),
  });

  const holder: RuntimeHandleHolder = {
    owner: 'part-thirteen',
    machine: input.machine,
    maxHandles: input.maxHandles,
    maxAttempts: input.maxAttempts,
    prepare(launch) {
      if (!launch) return freeze({ disposition: 'refused' as const, reason: 'launch identity is required' });
      try {
        const current = state.read();
        if (current.handles.some(handle => handle.launch === launch)) {
          return freeze({ disposition: 'existing' as const, reason: 'an exact attempted launch is already retained' });
        }
        return current.handles.length < input.maxHandles
          ? freeze({ disposition: 'available' as const, reason: 'bounded handle capacity is available before invocation' })
          : freeze({ disposition: 'refused' as const, reason: 'runtime handle capacity reached before invocation' });
      } catch (error) {
        return freeze({ disposition: 'refused' as const,
          reason: error instanceof Error ? error.message : 'runtime handle journal is unavailable' });
      }
    },
    beginAttempt(attempt) {
      try {
        const current = state.read();
        // Validate the submitted recovery input before restoring the immutable
        // first-attempt clock. Otherwise a malformed clock can disappear behind
        // retained custody and be reported as an exact existing attempt.
        const submitted = input.admission.beginAttempt({
          ...attempt,
          state: 'pending' as const,
          evidence: '',
          observedAt: null,
        }, [], 1);
        if (submitted.disposition === 'refused') return submitted;
        const retained = current.attempts.find(row => row.operation === attempt.operation);
        const candidate = {
          ...attempt,
          // The operation identity owns the first attempt clock. Recovery may run
          // later, but it reconstructs that same immutable attempt rather than
          // presenting the recovery clock as a changed action subject.
          attemptedAt: retained?.attemptedAt ?? attempt.attemptedAt,
          state: 'pending' as const,
          evidence: '',
          observedAt: null,
        };
        const admitted = input.admission.beginAttempt(candidate, current.attempts, input.maxAttempts);
        if (admitted.disposition !== 'started' || !admitted.attempt) return admitted;
        state.commit(current, { attempts: [...current.attempts, admitted.attempt] });
        return freeze({ ...admitted, reason: 'operation attempt durably retained before invocation' });
      } catch (error) {
        return freeze({ disposition: 'refused' as const,
          reason: error instanceof Error ? error.message : 'operation-attempt journal is unavailable', attempt: null });
      }
    },
    finishAttempt(operation, evidence, observedAt) {
      try {
        const current = state.read();
        const admitted = input.admission.finishAttempt(operation, evidence, observedAt, current.attempts);
        if (admitted.disposition !== 'observed' || !admitted.attempt) return admitted;
        const prior = current.attempts.find(row => row.operation === operation);
        if (!prior) return freeze({ disposition: 'refused' as const,
          reason: 'operation observation has no retained attempt', attempt: null });
        state.commit(current, {
          attempts: current.attempts.map(row => row.operation === operation ? admitted.attempt! : row),
        });
        return freeze({ ...admitted, reason: 'operation observation durably retained' });
      } catch (error) {
        return freeze({ disposition: 'refused' as const,
          reason: error instanceof Error ? error.message : 'operation-attempt journal is unavailable', attempt: null });
      }
    },
    pendingAttempts() {
      return freeze(state.read().attempts.filter(row => row.state === 'pending'));
    },
    put(handleInput) {
      const decoded = consumeResult(decodeHarnessRuntimeHandle(handleInput, input.context), {
        Success: value => value,
        Refused: refused => null as HarnessRuntimeHandle | null,
      });
      if (!decoded) return handleReceipt('refused', 'runtime handle is malformed', null);
      if (decoded.harness !== input.adapter || decoded.machine !== input.machine) {
        return handleReceipt('refused', 'runtime handle belongs to another adapter or machine', null);
      }
      const identity = harnessAdapterIdentity(decoded);
      try {
        const current = state.read();
        const existing = current.handles.find(row => row.launch === decoded.launch);
        if (existing) {
          const prior = harnessAdapterIdentity(existing);
          if (prior.canonicalHash === identity.canonicalHash) {
            return handleReceipt('duplicate', 'exact runtime handle already retained', identity.canonicalHash);
          }
          return handleReceipt('refused', 'immutable runtime handle disagreement for launch', prior.canonicalHash);
        }
        if (current.handles.length >= input.maxHandles) {
          return handleReceipt('refused', 'runtime handle capacity reached; existing custody retained', null);
        }
        state.commit(current, { handles: [...current.handles, decoded] });
        return handleReceipt('stored', 'machine-local runtime handle retained', identity.canonicalHash);
      } catch (error) {
        return handleReceipt('refused',
          error instanceof Error ? error.message : 'runtime handle journal is unavailable', null);
      }
    },
    lookup(launch) {
      try {
        const handle = state.read().handles.find(row => row.launch === launch) ?? null;
        return freeze({
          state: handle ? 'found' as const : 'missing' as const,
          found: handle !== null,
          handle,
          reason: handle ? 'exact machine-local handle found' : 'machine-local runtime handle is absent',
        });
      } catch (error) {
        return freeze({ state: 'unknown' as const, found: false, handle: null,
          reason: error instanceof Error ? error.message : 'runtime handle journal is unavailable' });
      }
    },
    snapshot(id, capturedAt) {
      try {
        const current = state.read();
        return decodeHarnessHandleSnapshot({
          type: 'HarnessHandleSnapshot',
          schemaVersion: 1,
          id,
          adapter: input.adapter,
          machine: input.machine,
          capturedAt,
          maxHandles: input.maxHandles,
          handles: current.handles,
        }, input.context);
      } catch (error) {
        return decodeHarnessHandleSnapshot(null, input.context);
      }
    },
  };
  return Object.freeze(holder);
}

export function restoreRuntimeHandleHolder(input: Readonly<{
  snapshot: unknown;
  adapter: string;
  machine: string;
  maxHandles: number;
  maxAttempts: number;
  context: HarnessAdapterDecodeContext;
  state: HarnessAdapterStateStorePort;
  admission: Pick<HarnessAdmissionPort, 'owner' | 'beginAttempt' | 'finishAttempt'>;
}>): RuntimeHandleHolder {
  const snapshot = consumeResult(decodeHarnessHandleSnapshot(input.snapshot, input.context), {
    Success: value => value,
    Refused: refused => {
      throw new Error(`runtime handle custody unknown: ${refused.detail}`);
    },
  });
  return createRuntimeHandleHolder({
    adapter: input.adapter,
    machine: input.machine,
    maxHandles: input.maxHandles,
    maxAttempts: input.maxAttempts,
    initial: snapshot,
    context: input.context,
    state: input.state,
    admission: input.admission,
  });
}

function exactSubject(event: HarnessRuntimeEvent): string {
  return bytes([
    event.harness,
    event.artifactDigest,
    event.platform,
    event.machine,
    event.launch,
    event.run,
    event.step,
    event.input,
    event.incarnation,
    event.processIdentity,
  ]) ?? '';
}

function sameHandle(event: HarnessRuntimeEvent, handle: HarnessRuntimeHandle): boolean {
  return event.harness === handle.harness && event.artifactDigest === handle.artifactDigest
    && event.platform === handle.platform && event.machine === handle.machine
    && event.launch === handle.launch && event.run === handle.run && event.step === handle.step
    && event.input === handle.input && event.incarnation === handle.incarnation
    && event.processIdentity === handle.processIdentity;
}

function newest(events: readonly HarnessRuntimeEvent[]): HarnessRuntimeEvent | undefined {
  return [...events].sort((left, right) =>
    right.sourceClock - left.sourceClock
    || left.id.localeCompare(right.id))[0];
}

function sourceFrontier(events: readonly HarnessRuntimeEvent[]): readonly HarnessRuntimeEvent[] {
  const clock = newest(events)?.sourceClock;
  return clock === undefined ? [] : events.filter(event => event.sourceClock === clock);
}

function outputCoverage(events: readonly HarnessRuntimeEvent[]): Readonly<{ end: number; complete: boolean }> {
  const ranges = events.filter(event => event.kind === 'output-chunk' && event.output)
    .sort((left, right) => left.output!.start - right.output!.start || left.output!.end - right.output!.end);
  let end = 0;
  for (const event of ranges) {
    const range = event.output!;
    if (range.start !== end || range.truncated) return { end, complete: false };
    end = range.end;
  }
  return { end, complete: true };
}

interface EvidenceAnalysis {
  readonly all: readonly HarnessRuntimeEvent[];
  readonly decisionSet: readonly MaterializedEvidence[];
  readonly signedResumeHandle: boolean;
}

interface MaterializedEvidence {
  readonly id: string;
  readonly sourceClock: number;
  readonly phase: HarnessObservation['phase'] | null;
  readonly observation: HarnessObservation | null;
  readonly event: HarnessRuntimeEvent | null;
  readonly ownerCurrent: boolean;
  readonly availability: 'current' | 'unavailable';
}

function sameOrderedValues(left: readonly unknown[], right: readonly unknown[]): boolean {
  return bytes(left) === bytes(right);
}

function handleMatchesSignedLaunch(
  handle: HarnessRuntimeHandle,
  launch: import('../assembly/index.js').HarnessLaunchSpec,
  now: number,
): boolean {
  return handle.launch === launch.id && handle.harness === launch.harness
    && handle.artifactDigest === launch.artifactDigest && handle.machine === launch.machine
    && handle.run === launch.run && handle.step === launch.step && handle.input === launch.input
    && handle.inputDigest === launch.inputDigest && handle.incarnation === launch.incarnation
    && handle.launchOperation === launch.processOperation && handle.acquiredAt <= now
    && sameOrderedValues(handle.contextDigests, launch.contextManifest.map(row => row.digest))
    && sameOrderedValues(handle.dependencyFacts, launch.dependencyFacts);
}

function retainsPendingWork(event: HarnessRuntimeEvent): boolean {
  return ['input-accepted', 'context-consumed', 'work-transition', 'output-chunk', 'turn-closed']
    .includes(event.kind)
    || event.streamState !== 'closed'
    || event.childrenState === 'pending'
    || event.childrenState === 'unknown'
    || event.unresolvedOperations.length > 0;
}

const OUTPUT_CUSTODY_SEAM =
  'NON-EXECUTABLE-UNTIL-design-17-harness-adapters-seam-request-part-two-capture-read.md';

export function createHarnessEvidenceHolder(input: Readonly<{
  adapter: string;
  artifact: Hash;
  platform: string;
  machine: string;
  scope: string;
  maxEvents: number;
  maxCaptureBytes: number;
  context: HarnessAdapterDecodeContext;
  state: HarnessEvidenceStateStorePort;
  admission: HarnessAdmissionPort;
  owners: HarnessEvidenceOwnerPorts;
}>): HarnessEvidenceHolder {
  if (!input.adapter || !input.artifact || !input.platform || !input.machine || !input.scope
    || !Number.isSafeInteger(input.maxEvents) || input.maxEvents < 1
    || !Number.isSafeInteger(input.maxCaptureBytes) || input.maxCaptureBytes < 1) {
    throw new Error('evidence holder requires exact adapter identity and explicit positive finite bounds');
  }
  if (input.admission.owner !== 'part-thirteen'
    || input.owners.handles.owner !== 'part-thirteen'
    || input.owners.handles.machine !== input.machine) {
    throw new Error('evidence holder requires real current Part Thirteen admission and handle holders');
  }

  const validationFloors = validationFloorStore(input.state);
  const state = stateFrom({
    adapter: input.adapter,
    machine: input.machine,
    maxHandles: 0,
    maxAttempts: 0,
    maxEvents: input.maxEvents,
    maxCaptureBytes: input.maxCaptureBytes,
    context: input.context,
    state: input.state,
  });
  const decision = (
    disposition: HarnessEvidenceAdmission['disposition'],
    reason: string,
    progress: boolean,
    progressKey: string,
  ): HarnessEvidenceAdmission => freeze({ disposition, reason, progress, progressKey });

  const witnessFailure = (event: HarnessRuntimeEvent): string | null => {
    if (event.harness !== input.adapter || event.artifactDigest !== input.artifact
      || event.platform !== input.platform || event.machine !== input.machine) {
      return 'runtime event belongs to another exact adapter artifact, platform, or machine';
    }
    const admission = input.admission.admitObservation(event, [], Number.MAX_SAFE_INTEGER);
    const heldWork = event.kind === 'work-transition'
      && admission.disposition === 'refused'
      && admission.reason.includes('owner-state progress is NON-EXECUTABLE-UNTIL-slice-A2');
    const heldOutput = event.kind === 'output-chunk'
      && admission.disposition === 'refused'
      && admission.reason.includes('Part Two exposes no landed current capture-custody read port');
    if (admission.disposition === 'refused' && !heldWork && !heldOutput) return admission.reason;
    if (event.kind === 'output-chunk') return OUTPUT_CUSTODY_SEAM;

    const lookup = input.owners.handles.lookup(event.launch);
    if (lookup.state !== 'found' || !lookup.handle || !sameHandle(event, lookup.handle)) {
      return lookup.state === 'unknown'
        ? `runtime handle custody is unknown: ${lookup.reason}`
        : `runtime launch ${event.launch} has no exact current machine-local process handle`;
    }

    if (event.kind === 'work-transition') {
      if (!input.owners.work) return 'work transition requires the current Part Five run owner view';
      const view = consumeResult(input.owners.work.read(event.run), {
        Success: value => value,
        Refused: refused => {
          throw new Error(refused.detail);
        },
      });
      const step = view.pending.find(candidate => candidate.id === event.workSubject);
      if (!step || event.step !== step.id || step.expected !== event.predecessor
        || step.operation.key !== event.operation || view.state !== event.workPhase) {
        return 'work transition disagrees with the current Part Five step, subject, predecessor, operation, or phase';
      }
    }
    return null;
  };

  const readAnalysis = (handle: HarnessRuntimeHandle, now: number): EvidenceAnalysis => {
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('evidence decision clock must be a nonnegative safe integer');
    const owner = input.owners.current.current();
    if (owner.clock.value !== now) throw new Error('evidence decision requires the exact current owner clock');
    if (handle.harness !== input.adapter || handle.artifactDigest !== input.artifact
      || handle.platform !== input.platform || handle.machine !== input.machine) {
      throw new Error('runtime handle belongs to another exact adapter artifact, platform, or machine');
    }
    const custody = input.owners.handles.lookup(handle.launch);
    if (custody.state !== 'found' || !custody.handle
      || harnessAdapterIdentity(handle).canonicalHash !== harnessAdapterIdentity(custody.handle).canonicalHash) {
      throw new Error(custody.state === 'unknown'
        ? `runtime handle custody is unknown: ${custody.reason}`
        : `runtime launch ${handle.launch} has no exact current machine-local process handle`);
    }
    if (!input.context.history) throw new Error('evidence decisions require current Part Ten signed-history resolution');
    const launch = consumeResult(input.context.history.lookup(handle.launch), {
      Success: value => value,
      Refused: refused => { throw new Error(refused.detail); },
    });
    if (!launch?.record || launch.record.type !== 'HarnessLaunchSpec'
      || launch.taint.length || launch.conflicts.length || launch.completeness !== 'complete'
      || !consumeResult(input.context.history.resolve(launch.record), {
        Success: value => value.admitted,
        Refused: refused => { throw new Error(refused.detail); },
      })
      || launch.record.harness !== handle.harness || launch.record.artifactDigest !== handle.artifactDigest
      || launch.record.machine !== handle.machine || launch.record.run !== handle.run
      || launch.record.step !== handle.step || launch.record.input !== handle.input
      || launch.record.incarnation !== handle.incarnation) {
      throw new Error('evidence decision cannot resolve the exact current Ten launch subject');
    }
    const signedResumeHandle = handleMatchesSignedLaunch(handle, launch.record, now);
    const all = state.read().events.filter(event => sameHandle(event, handle));
    const rows = consumeResult(input.context.history.current(), {
      Success: value => value,
      Refused: refused => { throw new Error(refused.detail); },
    });
    const candidates = rows.flatMap(row => row.record.type === 'HarnessObservation'
      && row.record.launch === handle.launch && row.record.run === handle.run
      && row.record.step === handle.step && row.record.input === handle.input
      && row.record.incarnation === handle.incarnation
      && row.record.boundaryEvidence === handle.processIdentity
      ? [{ ...row, record: row.record }]
      : []);
    // Re-resolve through the same public lookup used by A1 admission. That
    // lookup accepts both the owned record id and its signed fact-envelope id;
    // the fact id then binds the result back to this decision's current listing.
    const byFact = new Map(candidates.map(row => [row.fact.id, row]));
    const resolveObservation = (reference: string) => {
      try {
        const resolved = consumeResult(input.context.history!.lookup(reference), {
          Success: value => value,
          Refused: () => null,
        });
        if (!resolved?.record || resolved.record.type !== 'HarnessObservation') return null;
        return byFact.get(resolved.fact.id) ?? null;
      } catch {
        return null;
      }
    };
    const represented = new Set<string>();
    const decisionSet: MaterializedEvidence[] = [];

    for (const event of all) {
      const source = event.sourceEvidence[0] ?? '';
      const row = resolveObservation(source);
      if (!row) {
        // Evidence loss is monotone at the common decision boundary. A retained
        // local event never disappears merely because the current owner reader
        // cannot resolve its signed source; it remains explicit unavailable
        // evidence so no predicate can recover an older favourable answer.
        decisionSet.push({ id: event.id, sourceClock: event.sourceClock, phase: null,
          observation: null, event, ownerCurrent: false, availability: 'unavailable' });
        continue;
      }
      represented.add(row.record.id);
      const ownerCurrent = row.record.generation === owner.generation && row.record.observedAt <= now
        && row.taint.length === 0 && row.conflicts.length === 0
        && consumeResult(input.context.history.resolve(row.record), {
          Success: value => value.admitted,
          Refused: () => false,
        });
      let availability: MaterializedEvidence['availability'] = 'unavailable';
      if (event.observedAt <= now && event.sourceClock <= now) {
        try {
          const failure = witnessFailure(event);
          if (!failure && event.freshFor > 0 && now - event.sourceClock <= event.freshFor) availability = 'current';
        } catch {
          availability = 'unavailable';
        }
      }
      decisionSet.push({ id: event.id, sourceClock: event.sourceClock, phase: row.record.phase,
        observation: row.record, event, ownerCurrent, availability });
    }

    for (const row of candidates) {
      if (represented.has(row.record.id)) continue;
      let availability: MaterializedEvidence['availability'] = 'unavailable';
      let ownerCurrent = false;
      if (row.record.generation !== owner.generation || row.record.observedAt > now
        || row.record.freshFor <= 0 || now - row.record.observedAt > row.record.freshFor
        || row.taint.length || row.conflicts.length) {
        availability = 'unavailable';
      } else {
        const admitted = consumeResult(input.context.history.resolve(row.record), {
          Success: value => value.admitted,
          Refused: () => false,
        });
        ownerCurrent = admitted;
        if (ownerCurrent) availability = 'current';
      }
      decisionSet.push({ id: row.record.id, sourceClock: row.record.observedAt,
        phase: row.record.phase, observation: row.record, event: null, ownerCurrent, availability });
    }
    decisionSet.sort((left, right) => right.sourceClock - left.sourceClock || left.id.localeCompare(right.id));
    return freeze({ all, decisionSet, signedResumeHandle });
  };

  const validResumePlan = (
    plan: VerificationPlan,
    subject: string,
    purpose: 'resume-compatible' | 'transcript-poison',
    now: number,
  ): boolean => {
    const current = input.owners.current.current();
    const holder = `part-thirteen:${purpose}`;
    const fixture = purpose === 'resume-compatible' ? 'P13-NF-38' : 'P13-NF-51';
    const purposeArm = plan.arms.some(arm => arm.required && arm.kind === 'runtime'
      && arm.id === purpose && arm.executable === `harness.${purpose}`
      && arm.fixture === fixture && arm.outputContract === 'VerificationAssessment');
    const purposeConsumer = plan.consumers.some(consumer => consumer.id === holder
      && consumer.direction === 'closed' && consumer.enforcedRecord === 'VerificationAssessment'
      && consumer.decoder === 'decodeVerificationAssessment');
    if (current.clock.value !== now || plan.subject.holder !== holder
      || plan.subject.governed !== subject || plan.subject.scope !== input.scope
      || plan.subject.generation !== current.generation || !purposeArm || !purposeConsumer
      || !plan.bar.complete || !plan.bar.sources.includes('runtime-conversation')) return false;
    const posture = consumeResult(input.owners.verification!.posture(plan.id, current.clock), {
      Success: value => value,
      Refused: refused => { throw new Error(refused.detail); },
    });
    return posture.posture === 'healthy' && posture.generation === current.generation
      && posture.evaluatedAt === now;
  };

  const poisonConfirmation = (
    event: HarnessRuntimeEvent,
    now: number,
  ): HarnessValidationFloor | null => {
    if (event.kind !== 'diagnostic' || !event.diagnosticCode.startsWith('transcript-poison:')
      || !input.owners.verification || !input.context.history) return null;
    const planId = event.diagnosticCode.slice('transcript-poison:'.length);
    if (!planId) return null;
    try {
      const rows = consumeResult(input.owners.verification.inspectCurrent(), {
        Success: value => value,
        Refused: refused => { throw new Error(refused.detail); },
      });
      const planRow = rows.find(candidate => candidate.record.type === 'VerificationPlan'
        && candidate.record.id === planId);
      if (!planRow || planRow.record.type !== 'VerificationPlan' || planRow.taint.length
        || planRow.conflicts.length || !validResumePlan(planRow.record, exactSubject(event),
          'transcript-poison', now)) return null;
      const plan = planRow.record;
      const probeRow = rows.find(candidate => candidate.record.type === 'ProbeRecord'
        && candidate.record.plan === plan.id
        && candidate.record.planVersion === plan.bar.version
        && candidate.record.arm === 'transcript-poison'
        && candidate.record.subject === exactSubject(event)
        && candidate.record.disposition === 'passed'
        && candidate.record.captureStatus === 'available'
        && candidate.record.missingPhases.length === 0
        && candidate.record.witnesses.length > 0
        && candidate.taint.length === 0 && candidate.conflicts.length === 0);
      if (!probeRow || probeRow.record.type !== 'ProbeRecord') return null;
      const observationRow = consumeResult(input.context.history.lookup(event.sourceEvidence[0] ?? ''), {
        Success: value => value,
        Refused: refused => { throw new Error(refused.detail); },
      });
      if (!observationRow?.record || observationRow.record.type !== 'HarnessObservation'
        || observationRow.taint.length || observationRow.conflicts.length
        || observationRow.completeness !== 'complete') return null;
      const identity = harnessAdapterIdentity(event);
      return consumeResult(decodeHarnessValidationFloor({
        type: 'HarnessValidationFloor' as const,
        schemaVersion: 1 as const,
        id: `validation-floor:${identity.canonicalHash}`,
        purpose: 'transcript-poison' as const,
        adapter: event.harness,
        artifact: event.artifactDigest,
        platform: event.platform,
        machine: event.machine,
        launch: event.launch,
        incarnation: event.incarnation,
        processIdentity: event.processIdentity,
        subject: exactSubject(event),
        event: event.id,
        eventHash: identity.canonicalHash,
        observation: observationRow.record.id,
        observationFact: observationRow.fact.id,
        observationWitness: observationRow.record.detail,
        plan: plan.id,
        planFact: planRow.fact.id,
        planVersion: plan.bar.version,
        probe: probeRow.record.id,
        probeFact: probeRow.fact.id,
        generation: plan.subject.generation,
        confirmedAt: now,
      }), {
        Success: floor => floor,
        Refused: refusal => { throw new Error(refusal.detail); },
      });
    } catch {
      return null;
    }
  };

  const ownerOnlyPoisonConfirmation = (
    evidence: MaterializedEvidence,
    handle: HarnessRuntimeHandle,
    now: number,
  ): HarnessValidationFloor | null => {
    if (!evidence.observation || !evidence.ownerCurrent || evidence.availability !== 'current'
      || !input.owners.verification || !input.context.history) return null;
    try {
      const observationRow = consumeResult(input.context.history.lookup(evidence.observation.id), {
        Success: value => value,
        Refused: refusal => { throw new Error(refusal.detail); },
      });
      if (!observationRow?.record || observationRow.record.type !== 'HarnessObservation'
        || observationRow.record.id !== evidence.observation.id || observationRow.taint.length
        || observationRow.conflicts.length || observationRow.completeness !== 'complete'
        || !consumeResult(input.context.history.resolve(observationRow.record), {
          Success: value => value.admitted,
          Refused: () => false,
        })) return null;
      const observation = observationRow.record;
      if (observation.phase !== 'pause-observed' || observation.launch !== handle.launch
        || observation.run !== handle.run || observation.step !== handle.step
        || observation.input !== handle.input || observation.incarnation !== handle.incarnation
        || observation.boundaryEvidence !== handle.processIdentity) return null;
      const witnessPrefix = 'harness-runtime-event:';
      if (!observation.detail.startsWith(witnessPrefix)) return null;
      const eventHash = observation.detail.slice(witnessPrefix.length) as Hash;
      const subject = bytes([handle.harness, handle.artifactDigest, handle.platform, handle.machine,
        handle.launch, handle.run, handle.step, handle.input, handle.incarnation,
        handle.processIdentity]) ?? '';
      const rows = consumeResult(input.owners.verification.inspectCurrent(), {
        Success: value => value,
        Refused: refusal => { throw new Error(refusal.detail); },
      });
      const planRow = rows.find(candidate => candidate.record.type === 'VerificationPlan'
        && candidate.record.subject.holder === 'part-thirteen:transcript-poison'
        && candidate.record.subject.governed === subject && candidate.record.subject.scope === input.scope
        && candidate.taint.length === 0 && candidate.conflicts.length === 0
        && validResumePlan(candidate.record, subject, 'transcript-poison', now));
      if (!planRow || planRow.record.type !== 'VerificationPlan') return null;
      const plan = planRow.record;
      const probeRow = rows.find(candidate => candidate.record.type === 'ProbeRecord'
        && candidate.record.plan === plan.id && candidate.record.planVersion === plan.bar.version
        && candidate.record.arm === 'transcript-poison' && candidate.record.subject === subject
        && candidate.record.disposition === 'passed' && candidate.record.captureStatus === 'available'
        && candidate.record.missingPhases.length === 0 && candidate.record.witnesses.length > 0
        && candidate.taint.length === 0 && candidate.conflicts.length === 0);
      if (!probeRow || probeRow.record.type !== 'ProbeRecord') return null;
      return consumeResult(decodeHarnessValidationFloor({
        type: 'HarnessValidationFloor', schemaVersion: 1,
        id: `validation-floor:${eventHash}`, purpose: 'transcript-poison',
        adapter: handle.harness, artifact: handle.artifactDigest, platform: handle.platform,
        machine: handle.machine, launch: handle.launch, incarnation: handle.incarnation,
        processIdentity: handle.processIdentity, subject,
        event: observation.id, eventHash,
        observation: observation.id, observationFact: observationRow.fact.id,
        observationWitness: observation.detail,
        plan: plan.id, planFact: planRow.fact.id, planVersion: plan.bar.version,
        probe: probeRow.record.id, probeFact: probeRow.fact.id,
        generation: plan.subject.generation, confirmedAt: now,
      }), {
        Success: floor => floor,
        Refused: refusal => { throw new Error(refusal.detail); },
      });
    } catch {
      return null;
    }
  };

  const validationFloorFor = (value: unknown): HarnessValidationFloor =>
    consumeResult(decodeHarnessValidationFloor(value), {
      Success: floor => floor,
      Refused: refusal => { throw new Error(`retained validation floor refused: ${refusal.detail}`); },
    });

  const poisonCandidateFor = (value: unknown): HarnessRuntimeEvent =>
    consumeResult(decodeHarnessRuntimeEvent(value, input.context), {
      Success: event => event,
      Refused: refusal => { throw new Error(`retained poison candidate refused: ${refusal.detail}`); },
    });

  const retainedPoisonFloors = (
  ): readonly HarnessValidationFloor[] => {
    const raw = validationFloors.loadValidationFloors();
    if (!Array.isArray(raw)) throw new Error('retained validation floors are unavailable');
    const floors = raw.map(validationFloorFor);
    if (new Set(floors.map(floor => floor.id)).size !== floors.length) {
      throw new Error('retained validation floors contain duplicate identities');
    }
    return freeze(floors);
  };

  const retainedPoisonCandidates = (): readonly HarnessRuntimeEvent[] => {
    const raw = validationFloors.loadPoisonCandidates();
    if (!Array.isArray(raw)) throw new Error('retained poison candidates are unavailable');
    const candidates = raw.map(poisonCandidateFor);
    if (new Set(candidates.map(event => event.id)).size !== candidates.length) {
      throw new Error('retained poison candidates contain duplicate identities');
    }
    return freeze(candidates);
  };

  const appendValidationFloorDurably = (floor: HarnessValidationFloor): void => {
    validationFloors.appendValidationFloor(floor);
    const retained = validationFloors.loadValidationFloors().map(validationFloorFor)
      .find(candidate => candidate.id === floor.id);
    if (!retained || bytes(retained) !== bytes(floor)) {
      throw new Error('validation floor append did not retain the exact confirmation');
    }
  };

  const appendPoisonCandidateDurably = (event: HarnessRuntimeEvent): void => {
    validationFloors.appendPoisonCandidate(event);
    const retained = validationFloors.loadPoisonCandidates().map(poisonCandidateFor)
      .find(candidate => candidate.id === event.id);
    if (!retained || harnessAdapterIdentity(retained).canonicalHash
      !== harnessAdapterIdentity(event).canonicalHash) {
      throw new Error('poison candidate append did not retain the exact event');
    }
  };

  const floorMatchesEvent = (
    floor: HarnessValidationFloor,
    event: HarnessRuntimeEvent,
  ): boolean => event.kind === 'diagnostic'
    && event.diagnosticCode === `transcript-poison:${floor.plan}`
    && floor.event === event.id
    && floor.eventHash === harnessAdapterIdentity(event).canonicalHash
    && floor.adapter === event.harness && floor.artifact === event.artifactDigest
    && floor.platform === event.platform && floor.machine === event.machine
    && floor.launch === event.launch && floor.incarnation === event.incarnation
    && floor.processIdentity === event.processIdentity && floor.subject === exactSubject(event)
    && floor.confirmedAt >= event.observedAt;

  const floorMatchesHandle = (
    floor: HarnessValidationFloor,
    handle: HarnessRuntimeHandle,
  ): boolean => floor.adapter === handle.harness && floor.artifact === handle.artifactDigest
    && floor.platform === handle.platform && floor.machine === handle.machine
    && floor.launch === handle.launch && floor.incarnation === handle.incarnation
    && floor.processIdentity === handle.processIdentity;

  const sameImmutableFloor = (
    first: HarnessValidationFloor,
    reconsidered: HarnessValidationFloor,
  ): boolean => {
    const { confirmedAt: _firstConfirmation, ...firstImmutable } = first;
    const { confirmedAt: _laterConfirmation, ...laterImmutable } = reconsidered;
    return bytes(firstImmutable) === bytes(laterImmutable);
  };

  const validationFloorCurrent = (floor: HarnessValidationFloor, now: number): boolean => {
    if (!input.owners.verification || !input.context.history) return false;
    try {
      const observation = consumeResult(input.context.history.lookup(floor.observation), {
        Success: value => value,
        Refused: refused => { throw new Error(refused.detail); },
      });
      if (!observation?.record || observation.record.type !== 'HarnessObservation'
        || observation.fact.id !== floor.observationFact || observation.record.detail !== floor.observationWitness
        || observation.record.launch !== floor.launch || observation.record.incarnation !== floor.incarnation
        || observation.record.boundaryEvidence !== floor.processIdentity || observation.taint.length
        || observation.conflicts.length || observation.completeness !== 'complete'
        || !consumeResult(input.context.history.resolve(observation.record), {
          Success: value => value.admitted,
          Refused: () => false,
        })) return false;
      const rows = consumeResult(input.owners.verification.inspectCurrent(), {
        Success: value => value,
        Refused: refused => { throw new Error(refused.detail); },
      });
      const plan = rows.find(candidate => candidate.record.type === 'VerificationPlan'
        && candidate.record.id === floor.plan && candidate.fact.id === floor.planFact);
      const probe = rows.find(candidate => candidate.record.type === 'ProbeRecord'
        && candidate.record.id === floor.probe && candidate.fact.id === floor.probeFact);
      if (!plan || plan.record.type !== 'VerificationPlan' || plan.taint.length || plan.conflicts.length
        || plan.record.bar.version !== floor.planVersion || plan.record.subject.generation !== floor.generation
        || !probe || probe.record.type !== 'ProbeRecord' || probe.taint.length || probe.conflicts.length
        || probe.record.plan !== floor.plan || probe.record.planVersion !== floor.planVersion
        || probe.record.arm !== 'transcript-poison' || probe.record.subject !== floor.subject
        || probe.record.disposition !== 'passed' || probe.record.captureStatus !== 'available'
        || probe.record.missingPhases.length > 0 || probe.record.witnesses.length === 0) return false;
      return validResumePlan(plan.record, floor.subject, 'transcript-poison', now);
    } catch {
      return false;
    }
  };

  const resumeDisposition = (
    event: HarnessRuntimeEvent,
    now: number,
  ): 'eligible' | 'poisoned' | 'unknown' => {
    const compatible = 'resume-compatible:';
    const poisoned = 'transcript-poison:';
    const prefix = event.diagnosticCode.startsWith(compatible)
      ? compatible
      : event.diagnosticCode.startsWith(poisoned) ? poisoned : '';
    if (!prefix || !input.owners.verification) return 'unknown';
    const planId = event.diagnosticCode.slice(prefix.length);
    if (!planId) return 'unknown';
    try {
      const rows = consumeResult(input.owners.verification!.inspectCurrent(), {
        Success: value => value,
        Refused: refused => {
          throw new Error(refused.detail);
        },
      });
      const row = rows.find(candidate => candidate.record.type === 'VerificationPlan'
        && candidate.record.id === planId);
      if (!row || row.taint.length || row.conflicts.length || row.record.type !== 'VerificationPlan') return 'unknown';
      const purpose = prefix === compatible ? 'resume-compatible' : 'transcript-poison';
      return validResumePlan(row.record, exactSubject(event), purpose, now)
        ? purpose === 'resume-compatible' ? 'eligible' : 'poisoned'
        : 'unknown';
    } catch {
      return 'unknown';
    }
  };

  const outstandingOwnerPoison = (
    handle: HarnessRuntimeHandle,
    now: number,
    analysis: EvidenceAnalysis,
  ): Readonly<{ disposition: 'poisoned' | 'unknown'; evidence: MaterializedEvidence }> | null => {
    if (!input.owners.verification) return null;
    const allFloors = retainedPoisonFloors();
    const allCandidates = retainedPoisonCandidates();
    const retainedPoison = analysis.decisionSet.filter(row => row.event?.kind === 'diagnostic'
      && row.event.diagnosticCode.startsWith('transcript-poison:'));
    const handleSubject = bytes([handle.harness, handle.artifactDigest, handle.platform, handle.machine,
      handle.launch, handle.run, handle.step, handle.input, handle.incarnation,
      handle.processIdentity]) ?? '';
    for (const floor of allFloors) {
      const event = analysis.all.find(candidate => candidate.id === floor.event
        || harnessAdapterIdentity(candidate).canonicalHash === floor.eventHash
        || floor.id === `validation-floor:${harnessAdapterIdentity(candidate).canonicalHash}`)
        ?? allCandidates.find(candidate => candidate.id === floor.event
          || harnessAdapterIdentity(candidate).canonicalHash === floor.eventHash
          || floor.id === `validation-floor:${harnessAdapterIdentity(candidate).canonicalHash}`);
      if (!event) {
        if (floor.subject === handleSubject && !floorMatchesHandle(floor, handle)) {
          throw new Error('retained validation floor subject disagrees with its decomposed runtime identity');
        }
        continue;
      }
      const eventHash = harnessAdapterIdentity(event).canonicalHash;
      if (floor.event !== event.id || floor.eventHash !== eventHash
        || floor.id !== `validation-floor:${eventHash}`) {
        throw new Error('retained validation floor disagrees with its runtime event identity');
      }
      if (!floorMatchesEvent(floor, event)) {
        throw new Error('retained validation floor disagrees with its immutable runtime event');
      }
    }
    const floors = allFloors.filter(floor => floorMatchesHandle(floor, handle));
    if (floors.some(floor => floor.confirmedAt > now)) {
      throw new Error('retained validation floor confirmation is future-dated');
    }
    const locallyConfirmed = retainedPoison.find(row => row.ownerCurrent && row.availability === 'current'
      && row.event && resumeDisposition(row.event, now) === 'poisoned');
    if (locallyConfirmed?.event) {
      const confirmation = poisonConfirmation(locallyConfirmed.event, now);
      if (!confirmation) return freeze({ disposition: 'unknown' as const, evidence: locallyConfirmed });
      const retained = floors.find(floor => floor.id === confirmation.id);
      if (retained) {
        if (!sameImmutableFloor(retained, confirmation)) {
          throw new Error('retained validation floor disagrees with current owner confirmation');
        }
      } else if (floors.length > 0) {
        return freeze({ disposition: 'unknown' as const, evidence: locallyConfirmed });
      } else {
        appendValidationFloorDurably(confirmation);
      }
      return freeze({ disposition: 'poisoned' as const, evidence: locallyConfirmed });
    }
    // The floor is appended when the owner-confirmed diagnostic is admitted,
    // before the event-journal write. It therefore distinguishes a candidate
    // that never earned confirmation from a confirmation whose current owner
    // prefix, observation, or local event later disappeared. No landed owner
    // clearance record exists, so loss can only degrade poison to unknown.
    if (floors.length > 0) {
      const floor = floors[0]!;
      const evidence = retainedPoison.find(row => row.event?.id === floor.event)
        ?? (analysis.all.length >= input.maxEvents
          ? analysis.decisionSet.find(row => row.id === floor.observation)
          : undefined)
        ?? freeze({ id: floor.event, sourceClock: floor.confirmedAt, phase: null,
          observation: null, event: null, ownerCurrent: false, availability: 'unavailable' as const });
      return freeze({ disposition: validationFloorCurrent(floor, now) ? 'poisoned' as const : 'unknown' as const,
        evidence });
    }

    const omitted = analysis.decisionSet.filter(row => !row.event && row.phase === 'pause-observed');
    if (omitted.length === 0) return null;
    try {
      const candidates = allCandidates.filter(event => sameHandle(event, handle)
        && event.kind === 'diagnostic' && event.diagnosticCode.startsWith('transcript-poison:'));
      for (const evidence of omitted.filter(row => row.ownerCurrent && row.availability === 'current')) {
        const candidate = candidates.find(event => event.sourceEvidence.length === 1
          && event.sourceEvidence[0] === evidence.id);
        const confirmation = candidate
          ? poisonConfirmation(candidate, now)
          : ownerOnlyPoisonConfirmation(evidence, handle, now);
        if (!confirmation) continue;
        appendValidationFloorDurably(confirmation);
        return freeze({ disposition: 'poisoned' as const,
          evidence: candidate ? freeze({ ...evidence, id: candidate.id, event: candidate }) : evidence });
      }
      const rows = consumeResult(input.owners.verification.inspectCurrent(), {
        Success: value => value,
        Refused: refused => { throw new Error(refused.detail); },
      });
      const subject = bytes([handle.harness, handle.artifactDigest, handle.platform, handle.machine,
        handle.launch, handle.run, handle.step, handle.input, handle.incarnation,
        handle.processIdentity]) ?? '';
      const poisonPlans = rows.filter(row => row.record.type === 'VerificationPlan'
        && row.record.subject.holder === 'part-thirteen:transcript-poison'
        && row.record.subject.governed === subject && row.record.subject.scope === input.scope);
      const poisoned = poisonPlans.some(row => row.record.type === 'VerificationPlan'
        && row.taint.length === 0 && row.conflicts.length === 0
        && validResumePlan(row.record, subject, 'transcript-poison', now));
      if (poisoned) {
        const evidence = omitted.find(row => row.ownerCurrent && row.availability === 'current') ?? omitted[0]!;
        const confirmation = ownerOnlyPoisonConfirmation(evidence, handle, now);
        if (!confirmation) return freeze({ disposition: 'unknown' as const, evidence });
        appendValidationFloorDurably(confirmation);
        return freeze({ disposition: 'poisoned' as const, evidence });
      }
      return null;
    } catch {
      return freeze({ disposition: 'unknown' as const, evidence: omitted[0]! });
    }
  };

  const livenessFrom = (analysis: EvidenceAnalysis): HarnessLivenessView => {
    const relevant = analysis.decisionSet.filter(row => row.event
      ? ['process-started', 'probe-live', 'probe-failed', 'heartbeat', 'process-exited'].includes(row.event.kind)
      : row.phase !== null && ['launched', 'uncertain', 'exit-observed'].includes(row.phase));
    const availableRows = relevant.filter(row => row.availability === 'current');
    const unavailableRows = relevant.filter(row => row.availability === 'unavailable');
    const availableClock = availableRows[0]?.sourceClock ?? -1;
    const unavailableClock = unavailableRows[0]?.sourceClock ?? -1;
    if (unavailableClock >= availableClock && unavailableClock >= 0) {
      return freeze({ state: 'unknown' as const,
        reason: 'newest exact-process evidence is stale, unavailable, future-dated, or disputed',
        event: unavailableRows[0]?.id ?? '' });
    }
    if (availableClock < 0) return freeze({ state: 'unknown' as const,
      reason: 'no fresh exact-incarnation liveness witness; timeout or absence does not prove death', event: '' });
    const frontier = availableRows.filter(row => row.sourceClock === availableClock);
    const dispositions = new Set(frontier.map(row => {
      if (row.event) {
        if (row.event.kind === 'probe-failed') return 'unknown';
        if (row.event.kind === 'process-exited') return 'dead';
        return 'live';
      }
      if (row.phase === 'uncertain') return 'unknown';
      if (row.phase === 'exit-observed') return 'dead';
      return 'live';
    }));
    if (dispositions.size !== 1 || dispositions.has('unknown')) return freeze({ state: 'unknown' as const,
      reason: 'latest source-clock frontier contains failed, contradictory, or unordered liveness evidence',
      event: frontier[0]?.id ?? '' });
    if (dispositions.has('dead')) return freeze({ state: 'dead' as const,
      reason: 'explicit current correlated process-exit witness', event: frontier[0]?.id ?? '' });
    return freeze({ state: 'live' as const,
      reason: 'fresh exact-incarnation owner-witnessed proof', event: frontier[0]?.id ?? '' });
  };

  const resumeFrom = (
    handle: HarnessRuntimeHandle,
    now: number,
    analysis: EvidenceAnalysis,
  ): HarnessResumeView => {
    if (!analysis.signedResumeHandle) return freeze({ state: 'unknown' as const,
      reason: 'retained runtime handle disagrees with the current signed Ten launch or decision clock',
      event: '' });
    const relevant = (event: HarnessRuntimeEvent) => event.kind === 'diagnostic'
      && (event.diagnosticCode.startsWith('resume-compatible:')
        || event.diagnosticCode.startsWith('transcript-poison:'));
    const availableEvents = analysis.decisionSet.filter(row => row.availability === 'current'
      && row.event && relevant(row.event)).map(row => row.event!);
    const available = newest(availableEvents);
    const unavailable = analysis.decisionSet.find(row => row.availability === 'unavailable'
      && row.event && relevant(row.event))?.event;
    const poison = outstandingOwnerPoison(handle, now, analysis);
    if (poison?.disposition === 'poisoned') return freeze({ state: 'poisoned' as const,
      reason: 'Part Nine current guard posture confirms outstanding owner poison evidence',
      event: poison.evidence.id });
    if (poison?.disposition === 'unknown') return freeze({ state: 'unknown' as const,
      reason: 'retained poison evidence is stale, unavailable, or disputed and has no owner clearance',
      event: poison.evidence.id });
    const omitted = analysis.decisionSet.find(row => !row.event);
    if (omitted && (!available || omitted.sourceClock >= available.sourceClock)) {
      return freeze({ state: 'unknown' as const,
        reason: 'newer current owner evidence omitted from the local journal prevents favourable resume',
        event: omitted.id });
    }
    if (unavailable && (!available || unavailable.sourceClock >= available.sourceClock)) {
      return freeze({ state: 'unknown' as const,
        reason: 'newest resume evidence is stale, unavailable, future-dated, or disputed',
        event: unavailable.id });
    }
    if (!available) return freeze({ state: 'unknown' as const,
      reason: 'pane text, silence, or missing evidence cannot establish resume safety', event: '' });
    const dispositions = new Set(sourceFrontier(availableEvents).map(event => resumeDisposition(event, now)));
    if (dispositions.size !== 1) return freeze({ state: 'unknown' as const,
      reason: 'latest resume source-clock frontier contains unordered contradictory evidence', event: available.id });
    const disposition = resumeDisposition(available, now);
    if (disposition === 'poisoned') return freeze({ state: 'poisoned' as const,
      reason: 'Part Nine current guard posture confirms the runtime conversation cannot resume safely',
      event: available.id });
    if (disposition === 'eligible') return freeze({ state: 'eligible' as const,
      reason: 'Part Nine current guard posture confirms owner-gated resume compatibility',
      event: available.id });
    return freeze({ state: 'unknown' as const,
      reason: 'diagnostic claim lacks a healthy current Part Nine guard posture', event: available.id });
  };

  const reconnectFrontier = (handle: HarnessRuntimeHandle): string => {
    if (!input.context.history) throw new Error('reconnect evidence requires current Part Ten signed history');
    const current = input.owners.current.current();
    const localHandle = input.owners.handles.lookup(handle.launch);
    const history = consumeResult(input.context.history.current(), {
      Success: value => value,
      Refused: refused => { throw new Error(refused.detail); },
    });
    const verification = input.owners.verification
      ? consumeResult(input.owners.verification.inspectCurrent(), {
          Success: value => value,
          Refused: refused => { throw new Error(refused.detail); },
        })
      : null;
    const frontier = bytes({
      clock: current.clock,
      generation: current.generation,
      stopped: current.stopped,
      handle: localHandle.state === 'found' && localHandle.handle
        ? harnessAdapterIdentity(localHandle.handle).canonicalHash
        : localHandle,
      journal: harnessAdapterIdentity(state.read()).canonicalHash,
      history,
      verification,
      validationFloors: validationFloors.loadValidationFloors(),
      poisonCandidates: validationFloors.loadPoisonCandidates(),
    });
    if (!frontier) throw new Error('reconnect evidence frontier cannot be canonicalized');
    return frontier;
  };

  const unknownReconnectEvidence = (reason: string): HarnessReconnectEvidenceView => freeze({
    state: 'unknown' as const,
    reason,
    liveness: freeze({ state: 'unknown' as const, reason, event: '' }),
    resume: freeze({ state: 'unknown' as const, reason, event: '' }),
  });

  const reconnectView = (
    handle: HarnessRuntimeHandle,
    now: number,
  ): HarnessReconnectEvidenceView => {
    const analysis = readAnalysis(handle, now);
    return freeze({ state: 'joint' as const,
      reason: 'liveness and resume eligibility share one stable current evidence frontier',
      liveness: livenessFrom(analysis),
      resume: resumeFrom(handle, now, analysis) });
  };

  const reconnectCandidateView = (
    handle: HarnessRuntimeHandle,
    now: number,
  ): HarnessReconnectEvidenceView => {
    const analysis = readAnalysis(handle, now);
    const liveness = livenessFrom(analysis);
    if (liveness.state !== 'live') {
      const reason = 'resume eligibility is immaterial while exact-process liveness is not live';
      return freeze({ state: 'joint' as const,
        reason: 'reconnect predicates share the current evidence frontier',
        liveness,
        resume: freeze({ state: 'unknown' as const, reason, event: '' }) });
    }
    return freeze({ state: 'joint' as const,
      reason: 'reconnect predicates share the current evidence frontier',
      liveness,
      resume: resumeFrom(handle, now, analysis) });
  };

  const reconnectWithAuthority: ReconnectAuthorityBracket = (handle, now, checkAuthority) => {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const preliminary = reconnectCandidateView(handle, now);
        if (preliminary.liveness.state !== 'live' || preliminary.resume.state !== 'eligible') {
          return preliminary;
        }
        const firstAuthority = checkAuthority();
        if (!firstAuthority.current) return unknownReconnectEvidence(firstAuthority.reason);
        const before = reconnectFrontier(handle);
        const finalAuthority = checkAuthority();
        if (!finalAuthority.current) return unknownReconnectEvidence(finalAuthority.reason);
        const final = reconnectCandidateView(handle, now);
        if (final.liveness.state !== 'live' || final.resume.state !== 'eligible') return final;
        const afterAuthority = reconnectFrontier(handle);
        if (before !== afterAuthority) continue;
        const closingAuthority = checkAuthority();
        if (!closingAuthority.current) return unknownReconnectEvidence(closingAuthority.reason);
        if (afterAuthority === reconnectFrontier(handle)) return final;
      }
      return unknownReconnectEvidence(
        'reconnect evidence and authority did not stabilize across the bounded current-frontier reads',
      );
    } catch (error) {
      return unknownReconnectEvidence(
        error instanceof Error ? error.message : 'reconnect evidence frontier is unavailable',
      );
    }
  };

  const holder: HarnessEvidenceHolder = {
    owner: 'part-thirteen',
    machine: input.machine,
    scope: input.scope,
    maxEvents: input.maxEvents,
    maxCaptureBytes: input.maxCaptureBytes,
    admit(event) {
      let current: HarnessAdapterStateSnapshot;
      try {
        current = state.read();
        const failure = witnessFailure(event);
        const progress = input.admission.progressIdentity(event, current.events);
        if (progress.disposition === 'conflict') {
          return decision('refused', progress.reason, false, progress.key);
        }
        if (failure) return decision('refused', failure, false, progress.key);
        const existing = current.events.find(row => row.id === event.id);
        if (existing) {
          return harnessAdapterIdentity(existing).canonicalHash === harnessAdapterIdentity(event).canonicalHash
            ? decision('duplicate', 'exact runtime event already recorded', false, progress.key)
            : decision('refused', 'immutable runtime event disagreement', false, progress.key);
        }
        if (event.kind === 'diagnostic' && event.diagnosticCode.startsWith('transcript-poison:')) {
          const candidates = validationFloors.loadPoisonCandidates().map(poisonCandidateFor);
          if (!candidates.some(candidate => candidate.id === event.id)
            && candidates.length >= input.maxEvents) {
            return decision('refused', 'poison candidate capacity reached; retained evidence is not age-deleted',
              false, progress.key);
          }
          appendPoisonCandidateDurably(event);
        }
        const confirmation = poisonConfirmation(event, input.owners.current.current().clock.value);
        if (confirmation) appendValidationFloorDurably(confirmation);
        if (progress.disposition === 'duplicate') {
          const representative = current.events
            .map((retained, index) => ({ retained, index,
              identity: input.admission.progressIdentity(retained, []) }))
            .filter(row => row.identity.key === progress.key)
            .sort((left, right) => right.retained.sourceClock - left.retained.sourceClock)[0];
          if (representative && event.sourceClock > representative.retained.sourceClock) {
            const events = [...current.events];
            events[representative.index] = event;
            state.commit(current, { events });
            return decision('duplicate',
              `${progress.reason}; newest equivalent owner witness retained without another advance`,
              false, progress.key);
          }
          return decision('duplicate', progress.reason, false, progress.key);
        }
        if (current.events.length >= input.maxEvents) {
          return decision('refused', 'event capacity reached; retained evidence is not age-deleted', false, progress.key);
        }
        const workProgress = event.kind === 'work-transition' && progress.disposition === 'advancing';
        state.commit(current, { events: [...current.events, event] });
        return decision('recorded', workProgress
          ? 'current owner-resolved exact-subject work state advanced'
          : 'diagnostic, liveness, lifecycle, or unchanged-state evidence recorded without progress',
        workProgress, progress.key);
      } catch (error) {
        return decision('refused',
          error instanceof Error ? error.message : 'runtime evidence journal is unavailable', false, '');
      }
    },
    liveness(handle, now) {
      try {
        return livenessFrom(readAnalysis(handle, now));
      } catch (error) {
        return freeze({ state: 'unknown' as const,
          reason: error instanceof Error ? error.message : 'runtime evidence journal is unavailable', event: '' });
      }
    },
    progress(handle, now) {
      try {
        const analysis = readAnalysis(handle, now);
        const currentEvents = analysis.decisionSet.filter(row => row.availability === 'current' && row.event)
          .map(row => row.event!);
        const work = newest(currentEvents.filter(event => event.kind === 'work-transition'));
        const output = newest(currentEvents.filter(event => event.kind === 'output-chunk'));
        const coverage = outputCoverage(currentEvents);
        const positiveClock = Math.max(work?.sourceClock ?? -1,
          output && coverage.complete && coverage.end > 0 ? output.sourceClock : -1);
        const uncertain = analysis.decisionSet.find(row => row.sourceClock > positiveClock
          && (row.phase === 'output-observed' || (row.observation === null && row.event
            && ['work-transition', 'output-chunk'].includes(row.event.kind)))
          && (row.availability === 'unavailable' || !row.event));
        if (uncertain) return freeze({ state: 'unknown' as const,
          reason: 'retained or owner-current work evidence is omitted, stale, unavailable, or disputed',
          event: uncertain.id });
        if (work || (output && coverage.complete && coverage.end > 0)) {
          return freeze({ state: 'progressed' as const,
            reason: 'current owner-resolved exact-subject work evidence advances',
            event: (work ?? output)!.id });
        }
        return freeze({ state: 'pending' as const,
          reason: 'no current owner-resolved work-bearing transition', event: '' });
      } catch (error) {
        return freeze({ state: 'unknown' as const,
          reason: error instanceof Error ? error.message : 'runtime evidence journal is unavailable', event: '' });
      }
    },
    completion(handle, now) {
      try {
        const analysis = readAnalysis(handle, now);
        const currentEvents = analysis.decisionSet.filter(row => row.availability === 'current' && row.event)
          .map(row => row.event!);
        const closures = currentEvents.filter(event => event.kind === 'turn-closed');
        const closure = newest(closures);
        if (!closure) {
          const unavailable = analysis.decisionSet.find(row => row.availability === 'unavailable'
            && (row.event?.kind === 'turn-closed' || (!row.event && row.phase === 'output-observed')));
          return freeze({ state: 'unknown' as const,
            reason: unavailable
              ? 'retained turn closure is stale, unavailable, or disputed'
              : 'no correlated structured turn closure',
            event: unavailable?.id ?? '' });
        }

        const unavailableLater = analysis.decisionSet.find(row => row.availability === 'unavailable'
          && row.sourceClock >= closure.sourceClock
          && (row.observation === null || !row.event || retainsPendingWork(row.event)));
        if (unavailableLater) {
          return freeze({ state: 'pending' as const,
            reason: 'later pending-input, closure, or output evidence is stale, unavailable, or disputed',
            event: unavailableLater.id });
        }

        const frontierClosures = closures.filter(event => event.sourceClock === closure.sourceClock);
        const closureIds = new Set(frontierClosures.map(event => event.id));
        const laterOpen = currentEvents.some(event => !closureIds.has(event.id)
          && event.sourceClock >= closure.sourceClock
          && retainsPendingWork(event));
        const incompleteClosure = frontierClosures.some(event => event.streamState !== 'closed'
          || !['none', 'closed'].includes(event.childrenState) || event.unresolvedOperations.length > 0);
        if (incompleteClosure || laterOpen || !outputCoverage(currentEvents).complete) {
          return freeze({ state: 'pending' as const,
            reason: 'turn closure retains later work, incomplete output, an open stream, child, or unresolved operation',
            event: closure.id });
        }
        const omitted = analysis.decisionSet.find(row => !row.event && row.sourceClock >= closure.sourceClock);
        if (omitted) return freeze({ state: 'pending' as const,
          reason: 'current exact-subject owner history retains later work omitted from the local event journal',
          event: omitted.id });
        return freeze({ state: 'complete' as const,
          reason: 'correlated lifecycle closure has contiguous output and closed streams, children, and operations',
          event: closure.id });
      } catch (error) {
        return freeze({ state: 'unknown' as const,
          reason: error instanceof Error ? error.message : 'runtime evidence journal is unavailable', event: '' });
      }
    },
    resume(handle, now) {
      try {
        return resumeFrom(handle, now, readAnalysis(handle, now));
      } catch (error) {
        return freeze({ state: 'unknown' as const,
          reason: error instanceof Error ? error.message : 'runtime evidence journal is unavailable', event: '' });
      }
    },
    reconnectEvidence(handle, now) {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const before = reconnectFrontier(handle);
          const joint = reconnectView(handle, now);
          if (before === reconnectFrontier(handle)) {
            return joint;
          }
        }
        return unknownReconnectEvidence(
          'reconnect evidence did not stabilize across the bounded current-frontier reads',
        );
      } catch (error) {
        return unknownReconnectEvidence(
          error instanceof Error ? error.message : 'reconnect evidence frontier is unavailable',
        );
      }
    },
    events(launch) {
      try {
        return freeze({ state: 'available' as const,
          events: Object.freeze(state.read().events.filter(event => event.launch === launch)),
          reason: 'fresh durable journal read' });
      } catch (error) {
        return freeze({ state: 'unknown' as const, events: Object.freeze([]),
          reason: error instanceof Error ? error.message : 'runtime evidence journal is unavailable' });
      }
    },
  };
  reconnectAuthorityBrackets.set(holder, reconnectWithAuthority);
  return Object.freeze(holder);
}

export interface HarnessReconnectDecision {
  readonly disposition: 'reconnect' | 'refused' | 'unsupported';
  readonly reason: string;
  readonly handle: HarnessRuntimeHandle | null;
}

export interface HarnessReconnectInput {
  readonly launch: string;
  readonly machine: string;
  readonly incarnation: string;
  readonly fence: FenceToken;
  readonly now: number;
  readonly evidence: HarnessEvidenceHolder;
  readonly authority: Pick<TransportAuthority<unknown>, 'inspect' | 'admitWrite'>;
}

/** Six validates current authority; Nine validates resume policy; the holder supplies only local evidence. */
export function sameMachineReconnectCandidate(
  input: HarnessReconnectInput,
  holder: RuntimeHandleHolder,
): HarnessReconnectDecision {
  if (input.machine !== holder.machine) {
    return freeze({ disposition: 'unsupported',
      reason: 'cross-machine replacement requires design-harness-adapters-seam-request-cross-machine-ownership.md',
      handle: null });
  }
  const lookup = holder.lookup(input.launch);
  if (lookup.state !== 'found' || !lookup.handle) {
    return freeze({ disposition: 'refused',
      reason: lookup.state === 'unknown'
        ? `machine-local runtime handle custody is unknown: ${lookup.reason}`
        : 'machine-local runtime handle is missing; blind fallback is forbidden',
      handle: null });
  }
  const handle = lookup.handle;
  if (input.incarnation !== handle.incarnation || input.fence.machine !== handle.machine
    || input.fence.incarnation !== handle.incarnation || input.fence.domain !== input.evidence.scope) {
    return freeze({ disposition: 'refused',
      reason: 'fence domain, machine, or requested incarnation does not name the governed conversation process lifetime',
      handle: null });
  }
  const bracket = reconnectAuthorityBrackets.get(input.evidence);
  if (!bracket) {
    return freeze({ disposition: 'refused',
      reason: 'same-machine reconnect requires the current evidence-authority bracket', handle: null });
  }
  const joint = bracket(handle, input.now, () => {
    const head = consumeResult(input.authority.inspect(), {
      Success: rows => rows.at(-1)?.fact.id ?? 'genesis',
      Refused: () => '',
    });
    if (!head) return freeze({ current: false,
      reason: 'Part Six current history is unavailable' });
    const current = consumeResult(
      input.authority.admitWrite(`p13-reconnect:${handle.launch}:${handle.incarnation}:${head}`, input.fence),
      { Success: () => true, Refused: () => false },
    );
    return freeze({ current,
      reason: current
        ? 'Part Six accepts the current exact-process fence'
        : 'Part Six rejected the fence as non-current' });
  });
  if (joint.state !== 'joint') {
    return freeze({ disposition: 'refused',
      reason: `same-machine reconnect requires one stable current evidence and authority frontier: ${joint.reason}`,
      handle: null });
  }
  const liveness = joint.liveness;
  if (liveness.state !== 'live') {
    return freeze({ disposition: 'refused',
      reason: 'same-machine reconnect requires fresh exact-process liveness', handle: null });
  }
  const resume = joint.resume;
  if (resume.state !== 'eligible') {
    return freeze({ disposition: 'refused',
      reason: resume.state === 'poisoned'
        ? 'confirmed poisoned runtime conversation cannot be resumed'
        : 'same-machine reconnect requires owner-validated resume compatibility',
      handle: null });
  }
  return freeze({ disposition: 'reconnect',
    reason: 'candidate retains exact machine, incarnation, current fence, local handle, liveness, and owner resume validation',
    handle });
}

export function currentClock(input: Pick<AssemblyHost, 'current'>): Clock {
  return input.current().clock;
}
