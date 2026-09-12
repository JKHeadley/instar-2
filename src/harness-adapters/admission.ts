import { canonical, consumeResult } from '../index.js';
import type { Hash } from '../index.js';
import type { HarnessLaunchSpec, HarnessObservation } from '../assembly/index.js';
import type {
  HarnessAdapterDecodeContext,
  HarnessAdmissionInput,
  HarnessAdmissionPort,
  HarnessAttemptAdmission,
  HarnessObservationAdmission,
  HarnessOperationAttempt,
  HarnessProgressIdentity,
  HarnessRuntimeEvent,
  HarnessRuntimeEventDecoderPort,
} from './contracts.js';
import {
  decodeHarnessOperationAttempt,
  decodeHarnessRuntimeEvent,
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

function exactSubject(event: HarnessRuntimeEvent): string {
  return encoded([event.harness, event.artifactDigest, event.platform, event.machine,
    event.launch, event.run, event.step, event.input, event.incarnation,
    event.processIdentity])?.bytes ?? '';
}

function attemptReceipt(disposition: HarnessAttemptAdmission['disposition'], reason: string,
  attempt: HarnessOperationAttempt | null): HarnessAttemptAdmission {
  return freeze({ disposition, reason, attempt });
}

function observationReceipt(disposition: HarnessObservationAdmission['disposition'], reason: string,
  progress: boolean, progressKey: string, event: HarnessRuntimeEvent | null): HarnessObservationAdmission {
  return freeze({ disposition, reason, progress, progressKey, event });
}

function progressReceipt(disposition: HarnessProgressIdentity['disposition'], reason: string,
  key: string): HarnessProgressIdentity {
  return freeze({ disposition, reason, key });
}

function decodedAttempt(input: unknown, context: HarnessAdapterDecodeContext):
Readonly<{ value: HarnessOperationAttempt | null; detail: string }> {
  return consumeResult<HarnessOperationAttempt,
  Readonly<{ value: HarnessOperationAttempt | null; detail: string }>>(
    decodeHarnessOperationAttempt(input, context), {
      Success: value => ({ value, detail: '' }),
      Refused: refusal => ({ value: null, detail: refusal.detail }),
    });
}

function decodedEvent(input: unknown, context: HarnessAdapterDecodeContext):
Readonly<{ value: HarnessRuntimeEvent | null; detail: string }> {
  return consumeResult<HarnessRuntimeEvent,
  Readonly<{ value: HarnessRuntimeEvent | null; detail: string }>>(
    decodeHarnessRuntimeEvent(input, context), {
      Success: value => ({ value, detail: '' }),
      Refused: refusal => ({ value: null, detail: refusal.detail }),
    });
}

function retainedAttempts(input: readonly unknown[], context: HarnessAdapterDecodeContext):
Readonly<{ values: readonly HarnessOperationAttempt[]; detail: string }> {
  if (!Array.isArray(input)) return { values: [], detail: 'retained attempts must be an array' };
  const values: HarnessOperationAttempt[] = [];
  for (const row of input) {
    const decoded = decodedAttempt(row, context);
    if (!decoded.value) return { values: [], detail: `retained attempt is malformed: ${decoded.detail}` };
    values.push(decoded.value);
  }
  if (new Set(values.map(row => row.operation)).size !== values.length)
    return { values: [], detail: 'retained attempts contain a contradictory operation identity' };
  return { values: freeze(values), detail: '' };
}

function retainedEvents(input: readonly unknown[], context: HarnessAdapterDecodeContext):
Readonly<{ values: readonly HarnessRuntimeEvent[]; detail: string }> {
  if (!Array.isArray(input)) return { values: [], detail: 'retained events must be an array' };
  const values: HarnessRuntimeEvent[] = [];
  for (const row of input) {
    const decoded = decodedEvent(row, context);
    if (!decoded.value) return { values: [], detail: `retained runtime event is malformed: ${decoded.detail}` };
    values.push(decoded.value);
  }
  if (new Set(values.map(row => row.id)).size !== values.length)
    return { values: [], detail: 'retained events contain a duplicate immutable event identity' };
  return { values: freeze(values), detail: '' };
}

function attemptSubject(attempt: HarnessOperationAttempt): string {
  return encoded({ kind: attempt.kind, operation: attempt.operation, launch: attempt.launch,
    incarnation: attempt.incarnation, subjectDigest: attempt.subjectDigest,
    attemptedAt: attempt.attemptedAt })?.bytes ?? '';
}

export function beginHarnessOperationAttempt(input: unknown, retained: readonly unknown[], maximum: number,
  context: HarnessAdapterDecodeContext): HarnessAttemptAdmission {
  if (!Number.isSafeInteger(maximum) || maximum < 1)
    return attemptReceipt('refused', 'operation-attempt capacity must be a positive safe integer', null);
  const candidate = decodedAttempt(input, context);
  if (!candidate.value) return attemptReceipt('refused', candidate.detail, null);
  if (candidate.value.state !== 'pending')
    return attemptReceipt('refused', 'beginAttempt accepts only an unobserved pending attempt', null);
  const prior = retainedAttempts(retained, context);
  if (prior.detail) return attemptReceipt('refused', prior.detail, null);
  const existing = prior.values.find(row => row.operation === candidate.value!.operation);
  if (existing) return attemptSubject(existing) === attemptSubject(candidate.value)
    ? attemptReceipt('existing', 'exact operation attempt already has custody', existing)
    : attemptReceipt('refused', 'operation identity is already bound to another action or subject', existing);
  if (prior.values.length >= maximum)
    return attemptReceipt('refused', 'operation-attempt capacity reached before invocation', null);
  return attemptReceipt('started', 'operation attempt is valid for durable admission', candidate.value);
}

export function finishHarnessOperationAttempt(operation: unknown, evidence: unknown, observedAt: unknown,
  retained: readonly unknown[], context: HarnessAdapterDecodeContext): HarnessAttemptAdmission {
  if (typeof operation !== 'string' || operation.length === 0 || operation.length > 4096 || operation.includes('\0'))
    return attemptReceipt('refused', 'operation observation requires a bounded operation identity', null);
  if (typeof evidence !== 'string' || evidence.length === 0 || evidence.length > 4096 || evidence.includes('\0'))
    return attemptReceipt('refused', 'operation observation requires bounded nonempty evidence', null);
  if (!Number.isSafeInteger(observedAt) || (observedAt as number) < 0)
    return attemptReceipt('refused', 'operation observation clock must be a nonnegative safe integer', null);
  const prior = retainedAttempts(retained, context);
  if (prior.detail) return attemptReceipt('refused', prior.detail, null);
  const existing = prior.values.find(row => row.operation === operation);
  if (!existing) return attemptReceipt('refused', 'operation observation has no retained attempt', null);
  if ((observedAt as number) < existing.attemptedAt)
    return attemptReceipt('refused', 'operation observation cannot predate the attempted operation', existing);
  if (existing.state === 'observed') return existing.evidence === evidence && existing.observedAt === observedAt
    ? attemptReceipt('duplicate', 'exact operation observation already retained', existing)
    : attemptReceipt('refused', 'operation observation disagrees with retained result', existing);
  const observed = decodedAttempt({ ...existing, state: 'observed', evidence, observedAt }, context);
  return observed.value
    ? attemptReceipt('observed', 'operation observation is valid for durable admission', observed.value)
    : attemptReceipt('refused', observed.detail, existing);
}

function progressKey(event: HarnessRuntimeEvent): string {
  const subject = exactSubject(event);
  if (event.kind === 'work-transition')
    return `work:${encoded({ subject, workSubject: event.workSubject,
      predecessor: event.predecessor, workPhase: event.workPhase })?.bytes ?? ''}`;
  if (event.kind === 'output-chunk' && event.output)
    return `output:${encoded({ subject, start: event.output.start,
      end: event.output.end, digest: event.output.digest })?.bytes ?? ''}`;
  return `non-progress:${encoded({ subject, kind: event.kind })?.bytes ?? ''}`;
}

export function classifyHarnessRuntimeProgress(input: unknown, retained: readonly unknown[],
  context: HarnessAdapterDecodeContext): HarnessProgressIdentity {
  const candidate = decodedEvent(input, context);
  if (!candidate.value) return progressReceipt('conflict', candidate.detail, '');
  const prior = retainedEvents(retained, context);
  if (prior.detail) return progressReceipt('conflict', prior.detail, '');
  const event = candidate.value;
  const key = progressKey(event);
  const subjectRows = prior.values.filter(row => exactSubject(row) === exactSubject(event));
  if (event.kind === 'output-chunk' && event.output) {
    const sameRange = subjectRows.find(row => row.output
      && row.output.start === event.output!.start && row.output.end === event.output!.end);
    if (sameRange) return sameRange.output!.digest === event.output.digest
      ? progressReceipt('duplicate', 'owner subject, output range, and content digest already retained', key)
      : progressReceipt('conflict', 'owner subject and output range retain a different content digest', key);
    return progressReceipt('advancing', 'new owner-subject output range and content digest', key);
  }
  if (event.kind === 'work-transition') return subjectRows.some(row => progressKey(row) === key)
    ? progressReceipt('duplicate', 'owner subject, predecessor, and phase already retained', key)
    : progressReceipt('advancing', 'new owner-subject predecessor and phase', key);
  return progressReceipt('non-progress', 'event kind is not a declared work-progress transition', key);
}

const observationPhase: Readonly<Record<HarnessRuntimeEvent['kind'], HarnessObservation['phase']>> = Object.freeze({
  'process-started': 'launched', 'probe-live': 'launched', 'probe-failed': 'uncertain',
  'input-accepted': 'input-accepted', 'context-consumed': 'context-consumed', heartbeat: 'launched',
  'work-transition': 'output-observed', 'output-chunk': 'output-observed', 'turn-closed': 'output-observed',
  'process-exited': 'exit-observed', diagnostic: 'pause-observed',
});

/** Canonical closed claim carried by the current Part Ten observation. */
export function harnessRuntimeEventWitness(event: HarnessRuntimeEvent): string {
  const claim = encoded({
    id: event.id, subject: exactSubject(event), operation: event.operation, kind: event.kind,
    sourceClock: event.sourceClock, observedAt: event.observedAt, freshFor: event.freshFor,
    predecessor: event.predecessor, workSubject: event.workSubject, workPhase: event.workPhase,
    output: event.output, streamState: event.streamState, childrenState: event.childrenState,
    unresolvedOperations: event.unresolvedOperations, exitStatus: event.exitStatus,
    diagnosticCode: event.diagnosticCode,
  });
  if (!claim) throw new Error('runtime event witness is not canonically encodable');
  return `harness-runtime-event:${claim.hash}`;
}

function lookupCurrentObservation(event: HarnessRuntimeEvent, input: HarnessAdmissionInput):
Readonly<{ observation: HarnessObservation | null; launch: HarnessLaunchSpec | null; detail: string }> {
  if (!input.context.history)
    return { observation: null, launch: null, detail: 'runtime evidence requires Part Ten signed-history resolution' };
  try {
    if (event.sourceEvidence.length !== 1)
      return { observation: null, launch: null, detail: 'runtime event requires one exact current Part Ten observation' };
    const row = consumeResult(input.context.history.lookup(event.sourceEvidence[0]!), {
      Success: value => value, Refused: refusal => { throw new Error(refusal.detail); },
    });
    if (!row?.record || row.record.type !== 'HarnessObservation' || row.completeness !== 'complete'
      || row.taint.length || row.conflicts.length)
      return { observation: null, launch: null, detail: 'runtime evidence is missing, partial, tainted, or disputed' };
    const admitted = consumeResult(input.context.history.resolve(row.record), {
      Success: value => value.admitted, Refused: refusal => { throw new Error(refusal.detail); },
    });
    if (!admitted) return { observation: null, launch: null, detail: 'runtime evidence is rejected by Part Ten history' };
    const current = input.current.current();
    if (row.record.generation !== current.generation)
      return { observation: null, launch: null, detail: 'runtime evidence belongs to a non-current register generation' };
    const launchRow = consumeResult(input.context.history.lookup(event.launch), {
      Success: value => value, Refused: refusal => { throw new Error(refusal.detail); },
    });
    if (!launchRow?.record || launchRow.record.type !== 'HarnessLaunchSpec'
      || launchRow.completeness !== 'complete' || launchRow.taint.length || launchRow.conflicts.length)
      return { observation: null, launch: null, detail: 'runtime launch is missing, partial, tainted, or disputed' };
    const launchAdmitted = consumeResult(input.context.history.resolve(launchRow.record), {
      Success: value => value.admitted, Refused: refusal => { throw new Error(refusal.detail); },
    });
    if (!launchAdmitted) return { observation: null, launch: null, detail: 'runtime launch is rejected by Part Ten history' };
    return { observation: row.record, launch: launchRow.record, detail: '' };
  } catch (error) {
    return { observation: null, launch: null,
      detail: error instanceof Error ? error.message : 'runtime evidence resolution failed' };
  }
}

function observationFailure(event: HarnessRuntimeEvent, input: HarnessAdmissionInput): string {
  if (event.harness !== input.adapter || event.artifactDigest !== input.artifact
    || event.platform !== input.platform || event.machine !== input.machine)
    return 'runtime event belongs to another exact adapter, artifact, platform, or machine';
  const current = lookupCurrentObservation(event, input);
  if (!current.observation || !current.launch) return current.detail;
  const observation = current.observation;
  const launch = current.launch;
  if (launch.harness !== event.harness || launch.artifactDigest !== event.artifactDigest
    || launch.machine !== event.machine || launch.id !== event.launch || launch.run !== event.run
    || launch.step !== event.step || launch.input !== event.input || launch.incarnation !== event.incarnation)
    return 'runtime launch does not establish the exact event subject';
  if (observation.launch !== event.launch || observation.run !== event.run
    || observation.step !== event.step || observation.input !== event.input
    || observation.incarnation !== event.incarnation || observation.phase !== observationPhase[event.kind]
    || observation.observedAt !== event.sourceClock || observation.freshFor !== event.freshFor
    || observation.boundaryEvidence !== event.processIdentity
    || observation.detail !== harnessRuntimeEventWitness(event))
    return 'runtime observation does not witness the exact subject, phase, clocks, lifetime, and claim';
  return '';
}

export function createHarnessAdmissionPort(input: HarnessAdmissionInput): HarnessAdmissionPort {
  if (!input.adapter || !input.artifact || !input.platform || !input.machine)
    throw new Error('harness admission requires exact adapter, artifact, platform, and machine identity');
  const port: HarnessAdmissionPort = {
    owner: 'part-thirteen',
    beginAttempt: (attempt, retained, maximum) =>
      beginHarnessOperationAttempt(attempt, retained, maximum, input.context),
    finishAttempt: (operation, evidence, observedAt, retained) =>
      finishHarnessOperationAttempt(operation, evidence, observedAt, retained, input.context),
    progressIdentity: (event, retained) => classifyHarnessRuntimeProgress(event, retained, input.context),
    admitObservation(eventInput, retainedInput, maximum) {
      if (!Number.isSafeInteger(maximum) || maximum < 1)
        return observationReceipt('refused', 'event capacity must be a positive safe integer', false, '', null);
      const candidate = decodedEvent(eventInput, input.context);
      if (!candidate.value) return observationReceipt('refused', candidate.detail, false, '', null);
      const retained = retainedEvents(retainedInput, input.context);
      if (retained.detail) return observationReceipt('refused', retained.detail, false, '', null);
      const event = candidate.value;
      const key = progressKey(event);
      const failure = observationFailure(event, input);
      if (failure) return observationReceipt('refused', failure, false, key, null);
      const existing = retained.values.find(row => row.id === event.id);
      if (existing) return harnessAdapterIdentity(existing).canonicalHash === harnessAdapterIdentity(event).canonicalHash
        ? observationReceipt('duplicate', 'exact runtime event already retained', false, key, existing)
        : observationReceipt('refused', 'immutable runtime event disagreement', false, key, existing);
      const progress = classifyHarnessRuntimeProgress(event, retained.values, input.context);
      if (progress.disposition === 'duplicate')
        return observationReceipt('duplicate', progress.reason, false, progress.key, event);
      if (progress.disposition === 'conflict')
        return observationReceipt('refused', progress.reason, false, progress.key, null);
      if (retained.values.length >= maximum)
        return observationReceipt('refused', 'event capacity reached; retained evidence is not age-deleted', false, key, null);
      if (event.kind === 'output-chunk')
        return observationReceipt('refused',
          'output progress is NON-EXECUTABLE-UNTIL-slice-A2 because Part Two exposes no landed current capture-custody read port',
          false, key, null);
      if (event.kind === 'work-transition')
        return observationReceipt('refused',
          'owner-state progress is NON-EXECUTABLE-UNTIL-slice-A2', false, key, null);
      return observationReceipt('recorded',
        'current-generation Part Ten observation matches the exact runtime event identity', false, key, event);
    },
  };
  return Object.freeze(port);
}

export function createHarnessRuntimeEventDecoder(harness: string): HarnessRuntimeEventDecoderPort {
  if (!harness) throw new Error('runtime event decoder requires exact harness identity');
  return Object.freeze({
    owner: 'part-thirteen' as const,
    harness,
    decode(input: unknown, context: HarnessAdapterDecodeContext) {
      const decoded = decodedEvent(input, context);
      if (!decoded.value || decoded.value.harness !== harness) {
        if (decoded.value) return decodeHarnessRuntimeEvent({ ...decoded.value, harness: '' }, context);
        return decodeHarnessRuntimeEvent(input, context);
      }
      return decodeHarnessRuntimeEvent(input, context);
    },
  });
}
