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
  decodeHarnessRuntimeHandle,
  harnessAdapterIdentity,
} from './records.js';

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
  events(launch: string): HarnessEventRead;
}

export interface HarnessEvidenceOwnerPorts {
  readonly work?: Pick<RunGraphPort, 'read'>;
  readonly handles: Pick<RuntimeHandleHolder, 'owner' | 'machine' | 'lookup'>;
  readonly current: Pick<AssemblyHost, 'current'>;
  readonly verification?: Pick<VerificationRuntimePort, 'inspectCurrent' | 'posture'>;
}

/** Exact-byte compare-and-swap memory store used for bounded local composition and tests. */
export function createMemoryHarnessAdapterStateStore(
  id = 'memory:harness-adapter-state',
): HarnessAdapterStateStorePort {
  let retained: HarnessAdapterStateSnapshot | null = null;
  return Object.freeze({
    owner: 'part-thirteen' as const,
    id,
    load: () => retained,
    save(expected: Hash | null, snapshot: HarnessAdapterStateSnapshot) {
      const current = retained ? harnessAdapterIdentity(retained).canonicalHash : null;
      if (current !== expected) throw new Error('harness adapter state compare-and-swap mismatch');
      retained = snapshot;
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
  readonly current: readonly HarnessRuntimeEvent[];
  readonly unavailable: readonly HarnessRuntimeEvent[];
  readonly ownerOmittedCurrent: readonly HarnessObservation[];
  readonly ownerOmittedUnavailable: readonly HarnessObservation[];
}

function retainsPendingWork(event: HarnessRuntimeEvent): boolean {
  return ['input-accepted', 'context-consumed', 'work-transition', 'output-chunk', 'turn-closed']
    .includes(event.kind)
    || event.streamState === 'open'
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
  state: HarnessAdapterStateStorePort;
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
    const all = state.read().events.filter(event => sameHandle(event, handle));
    const current: HarnessRuntimeEvent[] = [];
    const unavailable: HarnessRuntimeEvent[] = [];
    for (const event of all) {
      if (event.observedAt > now || event.sourceClock > now) {
        unavailable.push(event);
        continue;
      }
      try {
        const failure = witnessFailure(event);
        if (failure || event.freshFor <= 0 || now - event.sourceClock > event.freshFor) unavailable.push(event);
        else current.push(event);
      } catch {
        unavailable.push(event);
      }
    }
    const represented = new Set(all.flatMap(event => event.sourceEvidence));
    const rows = consumeResult(input.context.history.current(), {
      Success: value => value,
      Refused: refused => { throw new Error(refused.detail); },
    });
    const candidates = rows.flatMap(row => row.record.type === 'HarnessObservation'
      && !represented.has(row.record.id)
      && row.record.launch === handle.launch && row.record.run === handle.run
      && row.record.step === handle.step && row.record.input === handle.input
      && row.record.incarnation === handle.incarnation
      && row.record.boundaryEvidence === handle.processIdentity
      ? [{ ...row, record: row.record }]
      : []);
    const ownerOmittedCurrent: HarnessObservation[] = [];
    const ownerOmittedUnavailable: HarnessObservation[] = [];
    for (const row of candidates) {
      if (row.record.generation !== owner.generation || row.record.observedAt > now
        || row.record.freshFor <= 0 || now - row.record.observedAt > row.record.freshFor
        || row.taint.length || row.conflicts.length) {
        ownerOmittedUnavailable.push(row.record);
        continue;
      }
      const admitted = consumeResult(input.context.history.resolve(row.record), {
        Success: value => value.admitted,
        Refused: () => false,
      });
      (admitted ? ownerOmittedCurrent : ownerOmittedUnavailable).push(row.record);
    }
    const ordered = (values: HarnessObservation[]) => values.sort((left, right) =>
      right.observedAt - left.observedAt || left.id.localeCompare(right.id));
    return freeze({ all, current, unavailable,
      ownerOmittedCurrent: ordered(ownerOmittedCurrent),
      ownerOmittedUnavailable: ordered(ownerOmittedUnavailable) });
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

  const omittedOwnerPoison = (
    handle: HarnessRuntimeHandle,
    now: number,
    analysis: EvidenceAnalysis,
  ): HarnessObservation | null => {
    if (!input.owners.verification) return null;
    const pauses = analysis.ownerOmittedCurrent.filter(row => row.phase === 'pause-observed');
    if (pauses.length === 0) return null;
    try {
      const rows = consumeResult(input.owners.verification.inspectCurrent(), {
        Success: value => value,
        Refused: refused => { throw new Error(refused.detail); },
      });
      const subject = bytes([handle.harness, handle.artifactDigest, handle.platform, handle.machine,
        handle.launch, handle.run, handle.step, handle.input, handle.incarnation,
        handle.processIdentity]) ?? '';
      const poisoned = rows.some(row => row.record.type === 'VerificationPlan'
        && row.taint.length === 0 && row.conflicts.length === 0
        && validResumePlan(row.record, subject, 'transcript-poison', now));
      return poisoned ? pauses[0]! : null;
    } catch {
      return null;
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
        if (progress.disposition === 'duplicate') {
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
        const analysis = readAnalysis(handle, now);
        const relevantKinds = new Set<HarnessRuntimeEvent['kind']>([
          'process-started', 'probe-live', 'probe-failed', 'heartbeat', 'process-exited',
        ]);
        const availableEvents = analysis.current.filter(event => relevantKinds.has(event.kind));
        const unavailableEvents = analysis.unavailable.filter(event => relevantKinds.has(event.kind));
        const available = newest(availableEvents);
        const omittedAvailable = analysis.ownerOmittedCurrent.find(row =>
          ['launched', 'uncertain', 'exit-observed'].includes(row.phase));
        const unavailable = newest(unavailableEvents);
        const omittedUnavailable = analysis.ownerOmittedUnavailable.find(row =>
          ['launched', 'uncertain', 'exit-observed'].includes(row.phase));
        const availableClock = Math.max(available?.sourceClock ?? -1, omittedAvailable?.observedAt ?? -1);
        const unavailableClock = Math.max(unavailable?.sourceClock ?? -1, omittedUnavailable?.observedAt ?? -1);
        if (unavailableClock >= availableClock && unavailableClock >= 0) {
          return freeze({ state: 'unknown' as const,
            reason: 'newest exact-process evidence is stale, unavailable, future-dated, or disputed',
            event: (unavailableClock === omittedUnavailable?.observedAt
              ? omittedUnavailable.id : unavailable?.id) ?? '' });
        }
        if (!available && !omittedAvailable) return freeze({ state: 'unknown' as const,
          reason: 'no fresh exact-incarnation liveness witness; timeout or absence does not prove death', event: '' });
        if (omittedAvailable && omittedAvailable.observedAt >= (available?.sourceClock ?? -1)) {
          if (omittedAvailable.phase === 'uncertain') return freeze({ state: 'unknown' as const,
            reason: 'current owner history contains a newer uncertain exact-process observation omitted from the local journal',
            event: omittedAvailable.id });
          if (omittedAvailable.phase === 'exit-observed') return freeze({ state: 'dead' as const,
            reason: 'current owner history contains a newer exact-process exit omitted from the local journal',
            event: omittedAvailable.id });
          if (!available || omittedAvailable.observedAt > available.sourceClock) return freeze({ state: 'live' as const,
            reason: 'fresh exact-incarnation Part Ten launch-phase observation', event: omittedAvailable.id });
        }
        const frontier = sourceFrontier(availableEvents);
        const positive = frontier.some(event => ['process-started', 'probe-live', 'heartbeat'].includes(event.kind));
        const exited = frontier.find(event => event.kind === 'process-exited');
        const failed = frontier.find(event => event.kind === 'probe-failed');
        if (failed || (exited && positive)) return freeze({ state: 'unknown' as const,
          reason: 'latest source-clock frontier contains failed, contradictory, or unordered liveness evidence',
          event: (failed ?? exited)!.id });
        if (exited) return freeze({ state: 'dead' as const,
          reason: 'explicit current correlated process-exit witness', event: exited.id });
        return freeze({ state: 'live' as const,
          reason: 'fresh exact-incarnation owner-witnessed proof', event: available!.id });
      } catch (error) {
        return freeze({ state: 'unknown' as const,
          reason: error instanceof Error ? error.message : 'runtime evidence journal is unavailable', event: '' });
      }
    },
    progress(handle, now) {
      try {
        const analysis = readAnalysis(handle, now);
        const relevant = new Set<HarnessRuntimeEvent['kind']>(['work-transition', 'output-chunk']);
        const unavailable = newest(analysis.unavailable.filter(event => relevant.has(event.kind)));
        const omitted = [...analysis.ownerOmittedUnavailable, ...analysis.ownerOmittedCurrent]
          .filter(row => row.phase === 'output-observed')
          .sort((left, right) => right.observedAt - left.observedAt || left.id.localeCompare(right.id))[0];
        if (unavailable || omitted) return freeze({ state: 'unknown' as const,
          reason: 'retained or owner-current work evidence is omitted, stale, unavailable, or disputed',
          event: (omitted?.observedAt ?? -1) >= (unavailable?.sourceClock ?? -1)
            ? omitted?.id ?? '' : unavailable?.id ?? '' });
        const work = newest(analysis.current.filter(event => event.kind === 'work-transition'));
        const output = newest(analysis.current.filter(event => event.kind === 'output-chunk'));
        const coverage = outputCoverage(analysis.current);
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
        const closures = analysis.current.filter(event => event.kind === 'turn-closed');
        const closure = newest(closures);
        if (!closure) {
          const unavailable = newest(analysis.unavailable.filter(event => event.kind === 'turn-closed'));
          return freeze({ state: 'unknown' as const,
            reason: unavailable
              ? 'retained turn closure is stale, unavailable, or disputed'
              : 'no correlated structured turn closure',
            event: unavailable?.id ?? '' });
        }

        const unavailableLater = newest(analysis.unavailable.filter(event =>
          retainsPendingWork(event) && event.sourceClock >= closure.sourceClock));
        if (unavailableLater) {
          return freeze({ state: 'pending' as const,
            reason: 'later pending-input, closure, or output evidence is stale, unavailable, or disputed',
            event: unavailableLater.id });
        }

        const frontierClosures = closures.filter(event => event.sourceClock === closure.sourceClock);
        const closureIds = new Set(frontierClosures.map(event => event.id));
        const laterOpen = analysis.current.some(event => !closureIds.has(event.id)
          && event.sourceClock >= closure.sourceClock
          && retainsPendingWork(event));
        const incompleteClosure = frontierClosures.some(event => event.streamState !== 'closed'
          || !['none', 'closed'].includes(event.childrenState) || event.unresolvedOperations.length > 0);
        if (incompleteClosure || laterOpen || !outputCoverage(analysis.current).complete) {
          return freeze({ state: 'pending' as const,
            reason: 'turn closure retains later work, incomplete output, an open stream, child, or unresolved operation',
            event: closure.id });
        }
        const omitted = [...analysis.ownerOmittedUnavailable, ...analysis.ownerOmittedCurrent]
          .filter(row => row.observedAt >= closure.sourceClock)
          .sort((left, right) => right.observedAt - left.observedAt || left.id.localeCompare(right.id))[0];
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
        const analysis = readAnalysis(handle, now);
        const relevant = (event: HarnessRuntimeEvent) => event.kind === 'diagnostic'
          && (event.diagnosticCode.startsWith('resume-compatible:')
            || event.diagnosticCode.startsWith('transcript-poison:'));
        const availableEvents = analysis.current.filter(relevant);
        const available = newest(availableEvents);
        const unavailable = newest(analysis.unavailable.filter(relevant));
        const poison = omittedOwnerPoison(handle, now, analysis);
        if (poison) return freeze({ state: 'poisoned' as const,
          reason: 'Part Nine current guard posture confirms owner poison evidence omitted from the local journal',
          event: poison.id });
        const omitted = [...analysis.ownerOmittedUnavailable, ...analysis.ownerOmittedCurrent]
          .sort((left, right) => right.observedAt - left.observedAt || left.id.localeCompare(right.id))[0];
        if (omitted && (!available || omitted.observedAt >= available.sourceClock)) {
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
      } catch (error) {
        return freeze({ state: 'unknown' as const,
          reason: error instanceof Error ? error.message : 'runtime evidence journal is unavailable', event: '' });
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
  const head = consumeResult(input.authority.inspect(), {
    Success: rows => rows.at(-1)?.fact.id ?? 'genesis',
    Refused: () => '',
  });
  if (!head) return freeze({ disposition: 'refused', reason: 'Part Six current history is unavailable', handle: null });
  const currentFence = consumeResult(
    input.authority.admitWrite(`p13-reconnect:${handle.launch}:${handle.incarnation}:${head}`, input.fence),
    { Success: () => true, Refused: () => false },
  );
  if (!currentFence) {
    return freeze({ disposition: 'refused', reason: 'Part Six rejected the fence as non-current', handle: null });
  }
  const liveness = input.evidence.liveness(handle, input.now);
  if (liveness.state !== 'live') {
    return freeze({ disposition: 'refused',
      reason: 'same-machine reconnect requires fresh exact-process liveness', handle: null });
  }
  const resume = input.evidence.resume(handle, input.now);
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
