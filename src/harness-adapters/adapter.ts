import { canonical, consumeResult, defineDecoder, deriveThrough } from '../index.js';
import type { BoundaryContext, Hash, Json, Refused, Result } from '../index.js';
import { assemblyIdentity, decodeHarnessObservation } from '../assembly/index.js';
import type {
  AdapterConformance,
  AssemblyDecodeContext,
  HarnessAdapterPort,
  HarnessLaunchSpec,
  HarnessObservation,
  NativeHarnessDriverPort,
} from '../assembly/index.js';
import type { HarnessRuntimeHandle } from './contracts.js';
import type { HarnessEvidenceHolder, RuntimeHandleHolder } from './holder.js';
import { decodeHarnessRuntimeHandle } from './records.js';

export interface SessionHarnessAdapterInput {
  readonly id: string;
  readonly artifact: Hash;
  readonly platform: string;
  readonly conformance: string;
  readonly machine: string;
  readonly driver: NativeHarnessDriverPort;
  readonly handles: RuntimeHandleHolder;
  readonly evidence: HarnessEvidenceHolder;
  readonly context: AssemblyDecodeContext;
  readonly clock: () => number;
  readonly generation: () => string;
}

export interface SessionHarnessAdapterPackage {
  readonly owner: 'part-thirteen';
  readonly family: 'session-harness';
  readonly adapter: HarnessAdapterPort;
  readonly handles: RuntimeHandleHolder;
  readonly evidence: HarnessEvidenceHolder;
}

class Inherited extends Error {
  constructor(readonly refusal: Refused) { super(refusal.detail); }
}

function take<T>(result: Result<T>): T {
  return consumeResult(result, {
    Success: value => value,
    Refused: refusal => { throw new Inherited(refusal); },
  });
}

function boundary<T>(name: string, input: unknown, context: BoundaryContext, run: () => T): Result<T> {
  let inherited: Refused | undefined;
  const definition = defineDecoder<T, BoundaryContext>({
    name,
    owner: 'part-thirteen',
    currentVersion: 1,
    versions: { 1: { validate: (value: Json) => ({ ok: true, value }) } },
    migrations: {},
    decodeCurrent: () => {
      try { return { ok: true, value: run() }; }
      catch (error) {
        if (error instanceof Inherited) inherited = error.refusal;
        return { ok: false, detail: error instanceof Error ? error.message : 'harness adapter boundary failed' };
      }
    },
  }, context.preserved);
  const result = consumeResult(definition, {
    Success: decoder => deriveThrough(decoder, { type: name, schemaVersion: 1, input }, context),
    Refused: refusal => refusal,
  });
  return inherited ?? result;
}

function requireValue(value: unknown, detail: string): asserts value {
  if (!value) throw new Error(detail);
}

function hash(value: unknown): Hash {
  return take(canonical(value)).hash;
}

function observation(
  input: SessionHarnessAdapterInput,
  spec: HarnessLaunchSpec,
  phase: HarnessObservation['phase'],
  evidence: string,
  detail: string,
  observedAt: number,
): HarnessObservation {
  const dependencies = [...spec.dependencyFacts];
  const generation = input.generation();
  const id = `harness-observation:${hash({
    adapter: input.id, launch: spec.id, phase, evidence, detail, observedAt,
    generation, dependencies,
  }).slice('sha256:'.length)}`;
  return take(decodeHarnessObservation({
    type: 'HarnessObservation', schemaVersion: 1, id,
    predecessors: [], dependencyFacts: dependencies,
    launch: spec.id, run: spec.run, step: spec.step, input: spec.input,
    incarnation: spec.incarnation, sourceEvidence: evidence ? [evidence] : [],
    contextDigests: spec.contextManifest.map(row => row.digest),
    generation, causalReferences: dependencies,
    observedAt, freshFor: 60_000, phase, boundaryEvidence: evidence, detail,
  }, input.context));
}

function resolveLaunch(input: SessionHarnessAdapterInput, reference: string): HarnessLaunchSpec {
  requireValue(input.context.history, 'durable launch resolution requires Ten AssemblyHistoryReadPort');
  const row = take(input.context.history.lookup(reference));
  requireValue(row?.record?.type === 'HarnessLaunchSpec', 'launch is absent from Ten signed assembly history');
  requireValue(row.completeness === 'complete' && row.taint.length === 0 && row.conflicts.length === 0,
    'launch history is partial, tainted, or conflicted');
  requireValue(take(input.context.history.resolve(row.record)).admitted, 'launch history is not admitted');
  return row.record;
}

function resolveObservation(input: SessionHarnessAdapterInput, reference: string, phase: HarnessObservation['phase']): HarnessObservation {
  requireValue(reference && input.context.history, 'observation requires an exact durable delivery identity');
  const row = take(input.context.history.lookup(reference));
  requireValue(row?.record?.type === 'HarnessObservation' && row.record.phase === phase,
    'delivery observation is absent from Ten signed assembly history');
  requireValue(row.completeness === 'complete' && row.taint.length === 0 && row.conflicts.length === 0,
    'delivery observation history is partial, tainted, or conflicted');
  requireValue(take(input.context.history.resolve(row.record)).admitted,
    'delivery observation history is not admitted');
  requireValue(row.record.generation === input.generation(),
    'delivery observation belongs to a non-current register generation');
  const now = input.clock();
  requireValue(row.record.freshFor > 0 && now >= row.record.observedAt
    && now <= row.record.observedAt + row.record.freshFor,
  'delivery observation is stale or future-dated');
  return row.record;
}

function resolveConformance(input: SessionHarnessAdapterInput): AdapterConformance {
  requireValue(input.context.history, 'adapter binding requires Ten AssemblyHistoryReadPort');
  const row = take(input.context.history.lookup(input.conformance));
  requireValue(row?.record?.type === 'AdapterConformance', 'adapter conformance is absent from Ten signed assembly history');
  requireValue(row.completeness === 'complete' && row.taint.length === 0 && row.conflicts.length === 0,
    'adapter conformance history is partial, tainted, or conflicted');
  requireValue(take(input.context.history.resolve(row.record)).admitted, 'adapter conformance history is not admitted');
  const now = input.clock();
  requireValue(row.record.adapter === input.id && row.record.artifact === input.artifact
    && row.record.platform === input.platform && row.record.mode === 'advisory'
    && row.record.disposition === 'passed' && row.record.generation === input.generation()
    && row.record.testedAt <= now && now <= row.record.validUntil,
  'adapter conformance does not pass for the exact adapter, artifact, platform, and advisory mode');
  return row.record;
}

function checkedHandle(input: SessionHarnessAdapterInput, launch: string): HarnessRuntimeHandle {
  const lookup = input.handles.lookup(launch);
  requireValue(lookup.state === 'found' && lookup.handle,
    lookup.state === 'unknown'
      ? `machine-local runtime handle custody is unknown: ${lookup.reason}`
      : 'machine-local runtime handle is missing; blind fallback is forbidden');
  const handle = lookup.handle;
  requireValue(handle.harness === input.id && handle.artifactDigest === input.artifact
    && handle.platform === input.platform && handle.machine === input.machine,
  'runtime handle does not match the exact adapter artifact, platform, and machine');
  return handle;
}

function handleMatchesSpec(handle: HarnessRuntimeHandle, spec: HarnessLaunchSpec): boolean {
  return handle.launch === spec.id && handle.harness === spec.harness
    && handle.artifactDigest === spec.artifactDigest && handle.machine === spec.machine
    && handle.run === spec.run && handle.step === spec.step && handle.input === spec.input
    && handle.inputDigest === spec.inputDigest && handle.incarnation === spec.incarnation;
}

export function createSessionHarnessAdapter(input: SessionHarnessAdapterInput): SessionHarnessAdapterPackage {
  requireValue(input.id && input.platform && input.conformance && input.machine, 'adapter identity fields are required');
  requireValue(input.driver.owner === 'part-eight', 'harness driver must be the landed Eight-owned public port');
  requireValue(input.handles.owner === 'part-thirteen' && input.handles.machine === input.machine,
    'adapter requires a real machine-local Part Thirteen handle holder');
  requireValue(input.evidence.owner === 'part-thirteen' && input.evidence.machine === input.machine,
    'adapter requires a real current Part Thirteen evidence holder');
  resolveConformance(input);

  const adapter = Object.freeze({
    owner: 'part-ten' as const,
    id: input.id,
    describe: () => {
      resolveConformance(input);
      return Object.freeze({
        artifact: input.artifact,
        platform: input.platform,
        contextModes: Object.freeze(['advisory']),
        outputModes: Object.freeze(['framed']),
        interruptionModes: Object.freeze([]),
        custodyModes: Object.freeze(['machine-local-scoped-handles']),
        observationModes: Object.freeze(['instrumented-boundary']),
        conformance: input.conformance,
      });
    },
    launch(spec: HarnessLaunchSpec, operation: string, claim: string): Result<HarnessObservation> {
      return boundary('SessionHarnessLaunch', { spec, operation, claim }, input.context, () => {
        resolveConformance(input);
        requireValue(operation && claim, 'launch requires the existing admitted operation and claim identities');
        requireValue(spec.harness === input.id && spec.artifactDigest === input.artifact
          && spec.machine === input.machine, 'launch targets another exact adapter artifact or machine');
        requireValue(spec.consumptionMode === 'advisory',
          'governed model-context mode is unsupported until the named grounding and runtime seams land');
        const durableSpec = resolveLaunch(input, spec.id);
        requireValue(operation === durableSpec.processOperation,
          'launch operation differs from the owner-resolved process operation');
        requireValue(assemblyIdentity(durableSpec).canonicalHash === assemblyIdentity(spec).canonicalHash,
          'launch input differs from Ten owner-resolved durable specification');
        const retainedAttempt = input.handles.lookup(spec.id).handle;
        if (retainedAttempt) {
          requireValue(handleMatchesSpec(retainedAttempt, spec)
            && retainedAttempt.launchOperation === operation && retainedAttempt.launchClaim === claim,
          'retained launch attempt differs in specification, operation, or claim');
          return observation(input, spec, 'uncertain', retainedAttempt.processIdentity,
            'launch was already invoked under this operation and claim; observe the original attempt before any next action', input.clock());
        }
        requireValue(input.handles.prepare(spec.id).disposition === 'available',
          'runtime handle capacity unavailable before invocation');
        const attemptedAt = input.clock();
        const attempt = input.handles.beginAttempt({
          kind: 'launch', operation, launch: spec.id, incarnation: spec.incarnation,
          subjectDigest: hash({ spec: assemblyIdentity(spec).canonicalHash, operation, claim }),
          attemptedAt,
        });
        requireValue(attempt.disposition !== 'refused', attempt.reason);
        if (attempt.disposition === 'existing') {
          requireValue(attempt.attempt?.subjectDigest === hash({ spec: assemblyIdentity(spec).canonicalHash, operation, claim }),
            'retained launch attempt differs in specification, operation, or claim');
          return observation(input, spec, 'uncertain', attempt.attempt.evidence,
            'launch may already have been invoked under this durable operation journal; observe the original attempt before any next action', attemptedAt);
        }
        const processIdentity = take(input.driver.launch({
          operation, claim, artifact: spec.artifactDigest, incarnation: spec.incarnation,
          workingScope: spec.workingScope, handles: spec.portHandles,
        }));
        requireValue(processIdentity, 'driver returned no exact process identity');
        const at = input.clock();
        const handle = take(decodeHarnessRuntimeHandle({
          type: 'HarnessRuntimeHandle', schemaVersion: 1,
          id: `runtime-handle:${hash({ launch: spec.id, processIdentity, machine: input.machine, incarnation: spec.incarnation }).slice('sha256:'.length)}`,
          harness: input.id, artifactDigest: input.artifact, platform: input.platform,
          machine: input.machine, launch: spec.id, run: spec.run, step: spec.step,
          input: spec.input, inputDigest: spec.inputDigest, incarnation: spec.incarnation,
          processIdentity, launchOperation: operation, launchClaim: claim, acquiredAt: at,
          contextDigests: spec.contextManifest.map(row => row.digest),
          dependencyFacts: spec.dependencyFacts,
        }, input.context));
        const retained = input.handles.put(handle);
        if (retained.disposition === 'refused')
          return observation(input, spec, 'uncertain', processIdentity,
            `process invocation occurred but handle custody is uncertain: ${retained.reason}`, at);
        const finished = input.handles.finishAttempt(operation, processIdentity, at);
        requireValue(finished.disposition !== 'refused', finished.reason);
        return observation(input, spec, 'launched', processIdentity,
          'actual process launch observed and machine-local handle retained', at);
      });
    },
    deliver(delivery: Readonly<{ launch: string; intake: string; digest: Hash; incarnation: string; operation: string }>): Result<HarnessObservation> {
      return boundary('SessionHarnessDeliver', delivery, input.context, () => {
        resolveConformance(input);
        requireValue(delivery.operation, 'delivery requires an exact operation identity');
        const handle = checkedHandle(input, delivery.launch);
        const spec = resolveLaunch(input, delivery.launch);
        requireValue(handleMatchesSpec(handle, spec), 'durable handle and owner-resolved launch disagree');
        requireValue(delivery.incarnation === handle.incarnation, 'delivery targets a stale process incarnation');
        requireValue(delivery.intake === spec.input && delivery.digest === spec.inputDigest,
          'landed Ten port can deliver only the immutable original launch input');
        const attemptedAt = input.clock();
        const subjectDigest = hash(delivery);
        const attempt = input.handles.beginAttempt({
          kind: 'delivery', operation: delivery.operation, launch: delivery.launch,
          incarnation: delivery.incarnation, subjectDigest, attemptedAt,
        });
        requireValue(attempt.disposition !== 'refused', attempt.reason);
        if (attempt.disposition === 'existing') {
          requireValue(attempt.attempt?.subjectDigest === subjectDigest, 'retained delivery attempt names changed input or target');
          let ownerWitness: HarnessObservation | null = null;
          if (attempt.attempt.state === 'observed' && attempt.attempt.evidence) {
            try {
              const candidate = resolveObservation(input, attempt.attempt.evidence, 'input-accepted');
              if (candidate.launch === spec.id && candidate.run === spec.run && candidate.step === spec.step
                && candidate.input === spec.input && candidate.incarnation === spec.incarnation) ownerWitness = candidate;
            } catch {
              // Local custody proves only that an observation was recorded. If
              // Ten cannot currently resolve that receipt, delivery remains
              // uncertain and the original operation must not be invoked again.
            }
          }
          if (ownerWitness) return ownerWitness;
          return observation(input, spec, 'uncertain', attempt.attempt.evidence,
            'delivery may already have occurred but its owner receipt is unresolved; observe the original operation before any repeat',
            attempt.attempt.observedAt ?? attempt.attempt.attemptedAt);
        }
        const accepted = take(input.driver.deliver({
          operation: delivery.operation, processIdentity: handle.processIdentity,
          intake: delivery.intake, digest: delivery.digest, incarnation: delivery.incarnation,
        }));
        const at = input.clock();
        const finished = input.handles.finishAttempt(delivery.operation, accepted, at);
        requireValue(finished.disposition !== 'refused', finished.reason);
        return observation(input, spec, 'input-accepted', accepted,
          'driver witnessed input acceptance; consumption is not inferred', at);
      });
    },
    observe(request: Readonly<{ launch: string; delivery: string; operation: string }>): Result<HarnessObservation> {
      return boundary('SessionHarnessObserve', request, input.context, () => {
        resolveConformance(input);
        requireValue(request.operation && request.delivery, 'observation requires exact operation and delivery identities');
        const handle = checkedHandle(input, request.launch);
        const spec = resolveLaunch(input, request.launch);
        requireValue(handleMatchesSpec(handle, spec), 'durable handle and owner-resolved launch disagree');
        const delivery = resolveObservation(input, request.delivery, 'input-accepted');
        requireValue(delivery.launch === spec.id && delivery.run === spec.run && delivery.step === spec.step
          && delivery.input === spec.input && delivery.incarnation === spec.incarnation,
        'delivery observation names another launch, run, step, input, or incarnation');
        const observed = take(input.driver.observe({ operation: request.operation, processIdentity: handle.processIdentity }));
        if (observed.phase === 'context-consumed') {
          requireValue(input.context.history, 'context consumption requires Ten signed history');
          const source = take(input.context.history.lookup(observed.evidence));
          requireValue(source?.record?.type === 'HarnessObservation'
            && source.record.phase === 'context-consumed'
            && source.record.launch === spec.id && source.record.run === spec.run
            && source.record.step === spec.step && source.record.input === spec.input
            && source.record.incarnation === spec.incarnation
            && source.record.generation === input.generation()
            && hash(source.record.contextDigests) === hash(spec.contextManifest.map(row => row.digest))
            && source.conflicts.length === 0 && source.taint.length === 0
            && source.completeness === 'complete',
          'terminal appearance or unresolved evidence cannot prove consumption; source is missing, unavailable, conflicted, or names another subject');
          requireValue(take(input.context.history.resolve(source.record)).admitted,
            'context consumption source history is not admitted');
          const now = input.clock();
          requireValue(source.record.freshFor > 0 && now >= source.record.observedAt
            && now <= source.record.observedAt + source.record.freshFor,
          'context consumption source is stale or future-dated');
          return source.record;
        }
        return observation(input, spec, observed.phase, observed.evidence, observed.detail, input.clock());
      });
    },
  });

  return Object.freeze({
    owner: 'part-thirteen' as const,
    family: 'session-harness' as const,
    adapter,
    handles: input.handles,
    evidence: input.evidence,
  });
}

export function createClaudeCodeHarnessAdapter(input: SessionHarnessAdapterInput): SessionHarnessAdapterPackage {
  return createSessionHarnessAdapter(input);
}

export function createCodexHarnessAdapter(input: SessionHarnessAdapterInput): SessionHarnessAdapterPackage {
  return createSessionHarnessAdapter(input);
}

export function createFutureHarnessAdapter(input: SessionHarnessAdapterInput): SessionHarnessAdapterPackage {
  return createSessionHarnessAdapter(input);
}
