import { canonical, consumeResult } from '../index.js';
import type { Hash } from '../index.js';
import type {
  HarnessAdapterDecodeContext,
  HarnessAdapterStateSnapshot,
  HarnessAdapterStateStorePort,
  HarnessCompletionView,
  HarnessEvidenceAdmission,
  HarnessEvidenceHolder,
  HarnessHandleSnapshot,
  HarnessHandleWriteReceipt,
  HarnessOperationAttempt,
  HarnessReconnectDecision,
  HarnessReconnectInput,
  HarnessRuntimeEvent,
  HarnessRuntimeHandle,
  RuntimeHandleHolder,
} from './contracts.js';
import { decodeHarnessAdapterStateSnapshot, decodeHarnessHandleSnapshot, harnessAdapterIdentity } from './records.js';

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
function bytes(value: unknown): string | null { return encoded(value)?.bytes ?? null; }
function receipt(disposition: HarnessHandleWriteReceipt['disposition'], reason: string, canonicalHash: HarnessHandleWriteReceipt['canonicalHash']): HarnessHandleWriteReceipt {
  return freeze({ disposition, reason, canonicalHash });
}

/** Explicitly process-local convenience. Durable callers inject a filesystem-backed implementation. */
export function createMemoryHarnessAdapterStateStore(id = 'memory:harness-adapter-state'): HarnessAdapterStateStorePort {
  let retained: HarnessAdapterStateSnapshot | null = null;
  return Object.freeze({
    owner: 'part-thirteen' as const, id, load: () => retained,
    save(expected: Hash | null, snapshot: HarnessAdapterStateSnapshot) {
      const current = retained ? harnessAdapterIdentity(retained).canonicalHash : null;
      if (current !== expected) throw new Error('harness adapter state compare-and-swap mismatch');
      retained = snapshot;
    },
  });
}

function stateFrom(input: Readonly<{
  adapter: string; machine: string; maxHandles: number; maxAttempts: number; maxEvents: number; maxCaptureBytes: number;
  context: HarnessAdapterDecodeContext; state: HarnessAdapterStateStorePort; initialHandles?: readonly HarnessRuntimeHandle[];
}>) {
  if (input.state.owner !== 'part-thirteen') throw new Error('harness adapter journal requires the package-local state port');
  const raw = input.state.load();
  const decode = (value: unknown) => consumeResult(decodeHarnessAdapterStateSnapshot(value, input.context), {
    Success: result => result,
    Refused: refusal => { throw new Error(`harness adapter state unavailable: ${refusal.detail}`); },
  });
  let current = raw === null ? decode({
    type: 'HarnessAdapterStateSnapshot', schemaVersion: 1,
    id: `adapter-state:${input.adapter}:${input.machine}`, adapter: input.adapter, machine: input.machine,
    revision: 0, maxHandles: input.maxHandles, maxAttempts: input.maxAttempts,
    maxEvents: input.maxEvents, maxCaptureBytes: input.maxCaptureBytes,
    handles: input.initialHandles ?? [], attempts: [], events: [],
  }) : decode(raw);
  if (current.adapter !== input.adapter || current.machine !== input.machine
    || current.maxHandles !== input.maxHandles || current.maxAttempts !== input.maxAttempts
    || current.maxEvents !== input.maxEvents || current.maxCaptureBytes !== input.maxCaptureBytes)
    throw new Error('harness adapter state belongs to another exact bounded holder');
  if (input.initialHandles && raw !== null && bytes(current.handles) !== bytes(input.initialHandles))
    throw new Error('restored handle snapshot disagrees with durable operation custody');
  if (raw === null) input.state.save(null, current);
  return {
    current: () => current,
    commit(change: Partial<HarnessAdapterStateSnapshot>) {
      const next = decode({ ...current, ...change, revision: current.revision + 1 });
      input.state.save(harnessAdapterIdentity(current).canonicalHash, next);
      current = next;
      return current;
    },
  };
}

/** A bounded holder backed by write-ahead exact-byte custody. It grants no authority. */
export function createRuntimeHandleHolder(input: Readonly<{
  adapter: string; machine: string; maxHandles: number; maxAttempts: number;
  context: HarnessAdapterDecodeContext; state: HarnessAdapterStateStorePort; initial?: HarnessHandleSnapshot;
}>): RuntimeHandleHolder {
  if (!input.adapter || !input.machine || !Number.isSafeInteger(input.maxHandles) || input.maxHandles < 1
    || !Number.isSafeInteger(input.maxAttempts) || input.maxAttempts < 1)
    throw new Error('runtime handle holder requires an adapter, machine, and positive finite capacities');
  if (input.initial && (input.initial.adapter !== input.adapter || input.initial.machine !== input.machine || input.initial.maxHandles !== input.maxHandles))
    throw new Error('runtime handle snapshot belongs to another exact holder');
  const state = stateFrom({ adapter: input.adapter, machine: input.machine, maxHandles: input.maxHandles,
    maxAttempts: input.maxAttempts, maxEvents: 0, maxCaptureBytes: 0, context: input.context, state: input.state,
    ...(input.initial ? { initialHandles: input.initial.handles } : {}) });
  const holder: RuntimeHandleHolder = {
    owner: 'part-thirteen', machine: input.machine, maxHandles: input.maxHandles, maxAttempts: input.maxAttempts,
    prepare(launch) {
      if (!launch) return freeze({ disposition: 'refused' as const, reason: 'launch identity is required' });
      if (state.current().handles.some(handle => handle.launch === launch))
        return freeze({ disposition: 'existing' as const, reason: 'an exact attempted launch is already retained' });
      return state.current().handles.length < input.maxHandles
        ? freeze({ disposition: 'available' as const, reason: 'bounded handle capacity is available before invocation' })
        : freeze({ disposition: 'refused' as const, reason: 'runtime handle capacity reached before invocation' });
    },
    beginAttempt(attempt) {
      const existing = state.current().attempts.find(row => row.kind === attempt.kind && row.operation === attempt.operation);
      if (existing) return freeze({ disposition: 'existing' as const, reason: 'operation attempt already has durable custody', attempt: existing });
      if (state.current().attempts.length >= input.maxAttempts)
        return freeze({ disposition: 'refused' as const, reason: 'operation-attempt capacity reached before invocation', attempt: null });
      const pending: HarnessOperationAttempt = freeze({ ...attempt, state: 'pending', evidence: '', observedAt: null });
      state.commit({ attempts: [...state.current().attempts, pending] });
      return freeze({ disposition: 'started' as const, reason: 'operation attempt durably retained before invocation', attempt: pending });
    },
    finishAttempt(operation, evidence, observedAt) {
      const prior = state.current().attempts.find(row => row.operation === operation);
      if (!prior) return freeze({ disposition: 'refused' as const, reason: 'operation observation has no retained attempt', attempt: null });
      if (prior.state === 'observed') {
        const same = prior.evidence === evidence && prior.observedAt === observedAt;
        return freeze({ disposition: same ? 'duplicate' as const : 'refused' as const,
          reason: same ? 'exact operation observation already retained' : 'operation observation disagrees with retained result', attempt: prior });
      }
      const observed: HarnessOperationAttempt = freeze({ ...prior, state: 'observed', evidence, observedAt });
      state.commit({ attempts: state.current().attempts.map(row => row === prior ? observed : row) });
      return freeze({ disposition: 'observed' as const, reason: 'operation observation durably retained', attempt: observed });
    },
    put(handle) {
      if (handle.harness !== input.adapter || handle.machine !== input.machine)
        return receipt('refused', 'runtime handle belongs to another adapter or machine', null);
      const identity = harnessAdapterIdentity(handle);
      const existing = state.current().handles.find(row => row.launch === handle.launch);
      if (existing) {
        const prior = harnessAdapterIdentity(existing);
        if (prior.canonicalHash === identity.canonicalHash) return receipt('duplicate', 'exact runtime handle already retained', identity.canonicalHash);
        return receipt('refused', 'immutable runtime handle disagreement for launch', prior.canonicalHash);
      }
      if (state.current().handles.length >= input.maxHandles) return receipt('refused', 'runtime handle capacity reached; existing custody retained', null);
      state.commit({ handles: [...state.current().handles, handle] });
      return receipt('stored', 'machine-local runtime handle retained', identity.canonicalHash);
    },
    lookup(launch) {
      const handle = state.current().handles.find(row => row.launch === launch) ?? null;
      return freeze({ found: handle !== null, handle });
    },
    snapshot(id, capturedAt) {
      return decodeHarnessHandleSnapshot({ type: 'HarnessHandleSnapshot', schemaVersion: 1, id,
        adapter: input.adapter, machine: input.machine, capturedAt, maxHandles: input.maxHandles,
        handles: state.current().handles }, input.context);
    },
  };
  return Object.freeze(holder);
}

export function restoreRuntimeHandleHolder(input: Readonly<{
  snapshot: unknown; adapter: string; machine: string; maxHandles: number; maxAttempts: number;
  context: HarnessAdapterDecodeContext; state: HarnessAdapterStateStorePort;
}>): RuntimeHandleHolder {
  const snapshot = consumeResult(decodeHarnessHandleSnapshot(input.snapshot, input.context), {
    Success: value => value,
    Refused: refusal => { throw new Error(`runtime handle custody unknown: ${refusal.detail}`); },
  });
  return createRuntimeHandleHolder({ adapter: input.adapter, machine: input.machine, maxHandles: input.maxHandles,
    maxAttempts: input.maxAttempts, initial: snapshot, context: input.context, state: input.state });
}

function exactSubject(event: HarnessRuntimeEvent): string {
  return bytes([event.harness, event.artifactDigest, event.platform, event.machine, event.launch, event.run,
    event.step, event.input, event.incarnation, event.processIdentity]) ?? '';
}
function eventKey(event: HarnessRuntimeEvent): string {
  const subject = exactSubject(event);
  if (event.kind === 'work-transition') return `work:${subject}:${event.workSubject}:${event.predecessor}:${event.workPhase}`;
  if (event.kind === 'output-chunk' && event.output) return `output:${subject}:${event.output.start}:${event.output.end}:${event.output.digest}`;
  return `non-progress:${subject}:${event.kind}:${event.id}`;
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
function latest(left: HarnessRuntimeEvent, right: HarnessRuntimeEvent): number {
  return right.observedAt - left.observedAt || right.sourceClock - left.sourceClock || right.id.localeCompare(left.id);
}
function laterThan(left: HarnessRuntimeEvent, right: HarnessRuntimeEvent): boolean {
  return right.observedAt > left.observedAt || (right.observedAt === left.observedAt && right.sourceClock > left.sourceClock);
}
function sameHandle(event: HarnessRuntimeEvent, handle: HarnessRuntimeHandle): boolean {
  return event.harness === handle.harness && event.artifactDigest === handle.artifactDigest
    && event.platform === handle.platform && event.machine === handle.machine && event.launch === handle.launch
    && event.run === handle.run && event.step === handle.step && event.input === handle.input
    && event.incarnation === handle.incarnation && event.processIdentity === handle.processIdentity;
}

export function createHarnessEvidenceHolder(input: Readonly<{
  adapter: string; machine: string; maxEvents: number; maxCaptureBytes: number;
  context: HarnessAdapterDecodeContext; state: HarnessAdapterStateStorePort;
}>): HarnessEvidenceHolder {
  if (!input.adapter || !input.machine || !Number.isSafeInteger(input.maxEvents) || input.maxEvents < 1
    || !Number.isSafeInteger(input.maxCaptureBytes) || input.maxCaptureBytes < 1)
    throw new Error('evidence holder requires exact adapter identity and explicit positive finite bounds');
  const state = stateFrom({ adapter: input.adapter, machine: input.machine, maxHandles: 0, maxAttempts: 0,
    maxEvents: input.maxEvents, maxCaptureBytes: input.maxCaptureBytes, context: input.context, state: input.state });
  const decision = (disposition: HarnessEvidenceAdmission['disposition'], reason: string, progress: boolean, progressKey: string): HarnessEvidenceAdmission =>
    freeze({ disposition, reason, progress, progressKey });
  const witnessFailure = (event: HarnessRuntimeEvent): string | null => {
    if (!input.context.history) return 'runtime evidence requires current signed-history resolution';
    const references = [...event.sourceEvidence, ...(event.kind === 'work-transition' ? [event.workSubject, event.predecessor] : [])];
    for (const reference of references) {
      const row = consumeResult(input.context.history.lookup(reference), {
        Success: value => value,
        Refused: refusal => { throw new Error(refusal.detail); },
      });
      if (!row || row.completeness !== 'complete' || row.taint.length || row.conflicts.length)
        return `runtime evidence reference ${reference} is missing, partial, tainted, or conflicted`;
      if (row.record) {
        const verdict = consumeResult(input.context.history.resolve(row.record), {
          Success: value => value,
          Refused: refusal => { throw new Error(refusal.detail); },
        });
        if (!verdict.admitted) return `runtime evidence reference ${reference} is rejected by its owner history`;
      }
    }
    return null;
  };
  const holder: HarnessEvidenceHolder = {
    owner: 'part-thirteen', machine: input.machine, maxEvents: input.maxEvents, maxCaptureBytes: input.maxCaptureBytes,
    admit(event) {
      if (event.machine !== input.machine || event.harness !== input.adapter)
        return decision('refused', 'runtime event belongs to another adapter or machine', false, '');
      let failure: string | null;
      try { failure = witnessFailure(event); }
      catch (error) { return decision('refused', error instanceof Error ? error.message : 'runtime evidence resolution failed', false, eventKey(event)); }
      if (failure) return decision('refused', failure, false, eventKey(event));
      const existing = state.current().events.find(row => row.id === event.id);
      if (existing) return harnessAdapterIdentity(existing).canonicalHash === harnessAdapterIdentity(event).canonicalHash
        ? decision('duplicate', 'exact runtime event already recorded', false, eventKey(event))
        : decision('refused', 'immutable runtime event disagreement', false, eventKey(event));
      if (state.current().events.length >= input.maxEvents)
        return decision('refused', 'event capacity reached; retained evidence is not age-deleted', false, eventKey(event));
      const subjectEvents = state.current().events.filter(row => exactSubject(row) === exactSubject(event));
      const key = eventKey(event);
      let progress = event.kind === 'work-transition' && !subjectEvents.some(row => eventKey(row) === key);
      if (event.output) {
        const sameRange = subjectEvents.find(row => row.output && row.output.start === event.output!.start && row.output.end === event.output!.end);
        if (sameRange) return bytes(sameRange.output) === bytes(event.output)
          ? decision('duplicate', 'same exact-subject output range already retained', false, key)
          : decision('refused', 'same exact-subject output range has a different digest or capture identity', false, key);
        const captured = state.current().events.reduce((sum, row) => sum + (row.output?.byteCount ?? 0), 0);
        if (captured + event.output.byteCount > input.maxCaptureBytes)
          return decision('refused', 'capture capacity reached; retained evidence is not age-deleted', false, key);
        const before = outputCoverage(subjectEvents), after = outputCoverage([...subjectEvents, event]);
        progress = after.complete && after.end > before.end;
      }
      state.commit({ events: [...state.current().events, event] });
      return decision('recorded', progress ? 'owner-witnessed exact-subject work state advanced'
        : 'diagnostic, liveness, duplicate-state, or noncontiguous output evidence recorded without progress', progress, key);
    },
    liveness(handle, now) {
      const correlated = state.current().events.filter(event => sameHandle(event, handle) && event.observedAt <= now);
      const exited = correlated.filter(event => event.kind === 'process-exited').sort(latest)[0];
      if (exited) return freeze({ state: 'dead' as const, reason: 'explicit current correlated process-exit witness', event: exited.id });
      const live = correlated.filter(event => event.kind === 'process-started' || event.kind === 'probe-live' || event.kind === 'heartbeat').sort(latest)[0];
      if (live && live.freshFor > 0 && now <= live.observedAt + live.freshFor)
        return freeze({ state: 'live' as const, reason: 'fresh exact-incarnation owner-witnessed proof', event: live.id });
      return freeze({ state: 'unknown' as const, reason: 'no fresh exact-incarnation liveness witness; timeout or absence does not prove death', event: live?.id ?? '' });
    },
    completion(handle) {
      const correlated = state.current().events.filter(event => sameHandle(event, handle));
      const closure = correlated.filter(event => event.kind === 'turn-closed').sort(latest)[0];
      if (!closure) return freeze({ state: 'unknown' as const, reason: 'no correlated structured turn closure', event: '' });
      const laterOpen = correlated.some(event => laterThan(closure, event) && (event.streamState === 'open'
        || event.unresolvedOperations.length > 0 || event.kind === 'work-transition' || event.kind === 'output-chunk'));
      if (closure.streamState !== 'closed' || !['none', 'closed'].includes(closure.childrenState)
        || closure.unresolvedOperations.length || laterOpen || !outputCoverage(correlated).complete)
        return freeze({ state: 'pending' as const, reason: 'turn closure retains later work, incomplete output coverage, an open stream, child, or unresolved operation', event: closure.id });
      return freeze({ state: 'complete' as const, reason: 'correlated lifecycle closure has contiguous output and closed streams, children, and operations', event: closure.id });
    },
    resume(handle) {
      const correlated = state.current().events.filter(event => sameHandle(event, handle) && event.kind === 'diagnostic').sort(latest);
      const poison = correlated.find(event => event.diagnosticCode === 'transcript-poison-confirmed');
      if (poison) return freeze({ state: 'poisoned' as const, reason: 'owner-witnessed evidence confirms the runtime conversation cannot resume safely', event: poison.id });
      const compatible = correlated.find(event => event.diagnosticCode === 'transcript-resume-compatible');
      if (compatible) return freeze({ state: 'eligible' as const, reason: 'owner-witnessed evidence supports owner-gated same-incarnation resume', event: compatible.id });
      return freeze({ state: 'unknown' as const, reason: 'pane text, silence, or missing evidence cannot establish resume safety', event: '' });
    },
    events(launch) { return Object.freeze(state.current().events.filter(event => event.launch === launch)); },
  };
  return Object.freeze(holder);
}

/** Six validates the current fence; both evidence views are derived for the exact retained process. */
export function sameMachineReconnectCandidate(input: HarnessReconnectInput, holder: RuntimeHandleHolder): HarnessReconnectDecision {
  if (input.machine !== holder.machine)
    return freeze({ disposition: 'unsupported', reason: 'cross-machine replacement requires design-harness-adapters-seam-request-cross-machine-ownership.md', handle: null });
  const handle = holder.lookup(input.launch).handle;
  if (!handle) return freeze({ disposition: 'refused', reason: 'machine-local runtime handle is missing; blind fallback is forbidden', handle: null });
  if (input.incarnation !== handle.incarnation || input.fence.machine !== handle.machine || input.fence.incarnation !== handle.incarnation)
    return freeze({ disposition: 'refused', reason: 'fence or requested incarnation does not name the retained process lifetime', handle: null });
  const head = consumeResult(input.authority.inspect(), {
    Success: rows => rows.at(-1)?.fact.id ?? 'genesis', Refused: () => '',
  });
  if (!head) return freeze({ disposition: 'refused', reason: 'Part Six current history is unavailable', handle: null });
  const currentFence = consumeResult(input.authority.admitWrite(`p13-reconnect:${handle.launch}:${handle.incarnation}:${head}`, input.fence), {
    Success: () => true, Refused: () => false,
  });
  if (!currentFence) return freeze({ disposition: 'refused', reason: 'Part Six rejected the fence as non-current', handle: null });
  const liveness = input.evidence.liveness(handle, input.now);
  if (liveness.state !== 'live') return freeze({ disposition: 'refused', reason: 'same-machine reconnect requires fresh exact-process liveness', handle: null });
  const resume = input.evidence.resume(handle);
  if (resume.state !== 'eligible') return freeze({ disposition: 'refused', reason: resume.state === 'poisoned'
    ? 'confirmed poisoned runtime conversation cannot be resumed' : 'same-machine reconnect requires structured resume compatibility', handle: null });
  return freeze({ disposition: 'reconnect', reason: 'candidate retains exact machine, incarnation, current fence, handle, and owner-witnessed liveness', handle });
}
