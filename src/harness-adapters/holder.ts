import { canonical, consumeResult } from '../index.js';
import type { FenceToken } from '../transport/index.js';
import type {
  HarnessAdapterDecodeContext,
  HarnessCompletionView,
  HarnessEvidenceAdmission,
  HarnessEvidenceHolder,
  HarnessHandleSnapshot,
  HarnessHandleWriteReceipt,
  HarnessLivenessView,
  HarnessReconnectDecision,
  HarnessReconnectInput,
  HarnessRuntimeEvent,
  HarnessRuntimeHandle,
  RuntimeHandleHolder,
} from './contracts.js';
import {
  decodeHarnessHandleSnapshot,
  harnessAdapterIdentity,
} from './records.js';

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function bytes(value: unknown): string | null {
  return consumeResult(canonical(value), {
    Success: encoded => encoded.bytes,
    Refused: () => null,
  });
}

function write(disposition: HarnessHandleWriteReceipt['disposition'], reason: string, canonicalHash: HarnessHandleWriteReceipt['canonicalHash']): HarnessHandleWriteReceipt {
  return freeze({ disposition, reason, canonicalHash });
}

/**
 * A bounded holder for machine-local opaque handles. It never launches,
 * replaces, adopts a remote handle, or converts custody into authority.
 */
export function createRuntimeHandleHolder(input: Readonly<{
  adapter: string;
  machine: string;
  maxHandles: number;
  context: HarnessAdapterDecodeContext;
  initial?: HarnessHandleSnapshot;
}>): RuntimeHandleHolder {
  if (!input.adapter || !input.machine || !Number.isSafeInteger(input.maxHandles) || input.maxHandles < 1)
    throw new Error('runtime handle holder requires an adapter, machine, and positive finite capacity');
  if (input.initial && (input.initial.adapter !== input.adapter || input.initial.machine !== input.machine || input.initial.maxHandles !== input.maxHandles))
    throw new Error('runtime handle snapshot belongs to another exact holder');
  const handles = new Map<string, HarnessRuntimeHandle>();
  for (const handle of input.initial?.handles ?? []) handles.set(handle.launch, handle);

  const holder: RuntimeHandleHolder = {
    owner: 'part-thirteen',
    machine: input.machine,
    maxHandles: input.maxHandles,
    prepare(launch) {
      if (!launch) return freeze({ disposition: 'refused', reason: 'launch identity is required' });
      if (handles.has(launch)) return freeze({ disposition: 'existing', reason: 'an exact attempted launch is already retained' });
      return handles.size < input.maxHandles
        ? freeze({ disposition: 'available', reason: 'bounded handle capacity is available before invocation' })
        : freeze({ disposition: 'refused', reason: 'runtime handle capacity reached before invocation' });
    },
    put(handle) {
      if (handle.harness !== input.adapter || handle.machine !== input.machine)
        return write('refused', 'runtime handle belongs to another adapter or machine', null);
      const identity = harnessAdapterIdentity(handle);
      const existing = handles.get(handle.launch);
      if (existing) {
        const prior = harnessAdapterIdentity(existing);
        if (prior.canonicalHash === identity.canonicalHash) return write('duplicate', 'exact runtime handle already retained', identity.canonicalHash);
        return write('refused', 'immutable runtime handle disagreement for launch', prior.canonicalHash);
      }
      if (handles.size >= input.maxHandles) return write('refused', 'runtime handle capacity reached; existing custody retained', null);
      handles.set(handle.launch, handle);
      return write('stored', 'machine-local runtime handle retained', identity.canonicalHash);
    },
    lookup(launch) {
      const handle = handles.get(launch) ?? null;
      return freeze({ found: handle !== null, handle });
    },
    snapshot(id, capturedAt) {
      return decodeHarnessHandleSnapshot({
        type: 'HarnessHandleSnapshot', schemaVersion: 1, id,
        adapter: input.adapter, machine: input.machine, capturedAt,
        maxHandles: input.maxHandles, handles: [...handles.values()],
      }, input.context);
    },
  };
  return Object.freeze(holder);
}

export function restoreRuntimeHandleHolder(input: Readonly<{
  snapshot: unknown;
  adapter: string;
  machine: string;
  maxHandles: number;
  context: HarnessAdapterDecodeContext;
}>): RuntimeHandleHolder {
  const snapshot = consumeResult(decodeHarnessHandleSnapshot(input.snapshot, input.context), {
    Success: value => value,
    Refused: refusal => { throw new Error(`runtime handle custody unknown: ${refusal.detail}`); },
  });
  return createRuntimeHandleHolder({
    adapter: input.adapter,
    machine: input.machine,
    maxHandles: input.maxHandles,
    initial: snapshot,
    context: input.context,
  });
}

function eventKey(event: HarnessRuntimeEvent): string {
  if (event.kind === 'work-transition')
    return `work:${event.launch}:${event.workSubject}:${event.predecessor}:${event.workPhase}`;
  if (event.kind === 'output-chunk' && event.output)
    return `output:${event.launch}:${event.output.start}:${event.output.end}:${event.output.digest}`;
  return `non-progress:${event.launch}:${event.kind}:${event.id}`;
}

function isProgress(event: HarnessRuntimeEvent): boolean {
  return event.kind === 'work-transition' || event.kind === 'output-chunk';
}

export function createHarnessEvidenceHolder(input: Readonly<{
  machine: string;
  maxEvents: number;
  maxCaptureBytes: number;
}>): HarnessEvidenceHolder {
  if (!input.machine || !Number.isSafeInteger(input.maxEvents) || input.maxEvents < 1
    || !Number.isSafeInteger(input.maxCaptureBytes) || input.maxCaptureBytes < 1)
    throw new Error('evidence holder requires explicit positive finite bounds');
  const events = new Map<string, HarnessRuntimeEvent>();
  const progress = new Set<string>();
  const outputRanges = new Map<string, HarnessRuntimeEvent>();
  let capturedBytes = 0;

  const admission = (disposition: HarnessEvidenceAdmission['disposition'], reason: string, advances: boolean, progressKey: string): HarnessEvidenceAdmission =>
    freeze({ disposition, reason, progress: advances, progressKey });

  const holder: HarnessEvidenceHolder = {
    owner: 'part-thirteen', machine: input.machine, maxEvents: input.maxEvents, maxCaptureBytes: input.maxCaptureBytes,
    admit(event) {
      if (event.machine !== input.machine) return admission('refused', 'runtime event belongs to another machine', false, '');
      const identity = harnessAdapterIdentity(event);
      const existing = events.get(event.id);
      if (existing) {
        return harnessAdapterIdentity(existing).canonicalHash === identity.canonicalHash
          ? admission('duplicate', 'exact runtime event already recorded', false, eventKey(event))
          : admission('refused', 'immutable runtime event disagreement', false, eventKey(event));
      }
      if (events.size >= input.maxEvents) return admission('refused', 'event capacity reached; retained evidence is not age-deleted', false, eventKey(event));
      if (event.output) {
        const rangeKey = `${event.launch}:${event.output.start}:${event.output.end}`;
        const prior = outputRanges.get(rangeKey);
        if (prior) {
          if (bytes(prior.output) !== bytes(event.output))
            return admission('refused', 'same output range has a different digest or capture identity', false, eventKey(event));
          return admission('duplicate', 'same correlated output range already retained', false, eventKey(event));
        }
        if (capturedBytes + event.output.byteCount > input.maxCaptureBytes)
          return admission('refused', 'capture capacity reached; retained evidence is not age-deleted', false, eventKey(event));
        outputRanges.set(rangeKey, event);
        capturedBytes += event.output.byteCount;
      }
      events.set(event.id, event);
      const key = eventKey(event);
      const advances = isProgress(event) && !progress.has(key);
      if (advances) progress.add(key);
      return admission('recorded', advances ? 'correlated work state advanced' : 'diagnostic or liveness evidence recorded without progress', advances, key);
    },
    liveness(handle, now) {
      const correlated = [...events.values()].filter(event => sameHandle(event, handle));
      const exited = correlated.filter(event => event.kind === 'process-exited').sort(latest)[0];
      if (exited) return freeze({ state: 'dead', reason: 'explicit correlated process-exit witness', event: exited.id });
      const live = correlated.filter(event => event.kind === 'process-started' || event.kind === 'probe-live' || event.kind === 'heartbeat').sort(latest)[0];
      if (live && live.freshFor > 0 && now >= live.observedAt && now <= live.observedAt + live.freshFor)
        return freeze({ state: 'live', reason: 'fresh exact-incarnation structured witness', event: live.id });
      return freeze({ state: 'unknown', reason: 'no fresh exact-incarnation liveness witness; timeout or absence does not prove death', event: live?.id ?? '' });
    },
    completion(handle) {
      const correlated = [...events.values()].filter(event => sameHandle(event, handle));
      const closure = correlated.filter(event => event.kind === 'turn-closed').sort(latest)[0];
      if (!closure) return freeze({ state: 'unknown', reason: 'no correlated structured turn closure', event: '' });
      if (closure.streamState !== 'closed' || !['none', 'closed'].includes(closure.childrenState) || closure.unresolvedOperations.length)
        return freeze({ state: 'pending', reason: 'turn closure retains an open stream, child, or unresolved operation', event: closure.id });
      return freeze({ state: 'complete', reason: 'correlated lifecycle closure has closed stream, children, and operations', event: closure.id });
    },
    resume(handle) {
      const correlated = [...events.values()].filter(event => sameHandle(event, handle) && event.kind === 'diagnostic').sort(latest);
      const poison = correlated.find(event => event.diagnosticCode === 'transcript-poison-confirmed');
      if (poison) return freeze({ state: 'poisoned', reason: 'correlated structured evidence confirms the runtime conversation cannot resume safely', event: poison.id });
      const compatible = correlated.find(event => event.diagnosticCode === 'transcript-resume-compatible');
      if (compatible) return freeze({ state: 'eligible', reason: 'correlated structured evidence supports owner-gated same-incarnation resume', event: compatible.id });
      return freeze({ state: 'unknown', reason: 'pane text, silence, or missing evidence cannot establish resume safety', event: '' });
    },
    events(launch) { return Object.freeze([...events.values()].filter(event => event.launch === launch)); },
  };
  return Object.freeze(holder);
}

function latest(left: HarnessRuntimeEvent, right: HarnessRuntimeEvent): number {
  return right.observedAt - left.observedAt || right.sourceClock - left.sourceClock || right.id.localeCompare(left.id);
}

function sameHandle(event: HarnessRuntimeEvent, handle: HarnessRuntimeHandle): boolean {
  return event.harness === handle.harness && event.artifactDigest === handle.artifactDigest
    && event.platform === handle.platform && event.machine === handle.machine
    && event.launch === handle.launch && event.run === handle.run && event.step === handle.step
    && event.input === handle.input && event.incarnation === handle.incarnation
    && event.processIdentity === handle.processIdentity;
}

/** Read-only admission decision. Six remains the authority that validates a fence. */
export function sameMachineReconnectCandidate(input: HarnessReconnectInput, holder: RuntimeHandleHolder): HarnessReconnectDecision {
  if (input.machine !== holder.machine)
    return freeze({ disposition: 'unsupported', reason: 'cross-machine replacement requires design-harness-adapters-seam-request-cross-machine-ownership.md', handle: null });
  const lookup = holder.lookup(input.launch);
  if (!lookup.handle) return freeze({ disposition: 'refused', reason: 'machine-local runtime handle is missing; blind fallback is forbidden', handle: null });
  const handle = lookup.handle;
  if (!sameFenceSubject(input.fence, handle) || input.incarnation !== handle.incarnation)
    return freeze({ disposition: 'refused', reason: 'fence or requested incarnation does not name the retained process lifetime', handle: null });
  if (input.liveness.state !== 'live')
    return freeze({ disposition: 'refused', reason: 'same-machine reconnect requires fresh exact-process liveness', handle: null });
  if (input.resume.state !== 'eligible')
    return freeze({ disposition: 'refused', reason: input.resume.state === 'poisoned'
      ? 'confirmed poisoned runtime conversation cannot be resumed'
      : 'same-machine reconnect requires structured resume compatibility', handle: null });
  return freeze({ disposition: 'reconnect', reason: 'candidate retains exact machine, incarnation, handle, and fresh liveness; owners still admit the action', handle });
}

function sameFenceSubject(fence: FenceToken, handle: HarnessRuntimeHandle): boolean {
  return fence.type === 'FenceToken' && fence.schemaVersion === 1
    && fence.machine === handle.machine && fence.incarnation === handle.incarnation;
}
