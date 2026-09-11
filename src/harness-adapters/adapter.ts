import { canonical, consumeResult, defineDecoder, deriveThrough } from '../index.js';
import type { BoundaryContext, Hash, Json, Refused, Result } from '../index.js';
import { assemblyIdentity, decodeHarnessObservation } from '../assembly/index.js';
import type { AdapterConformance, HarnessLaunchSpec, HarnessObservation } from '../assembly/index.js';
import type {
  HarnessRuntimeEventDecoderPort,
  HarnessRuntimeHandle,
  SessionHarnessAdapterInput,
  SessionHarnessAdapterPackage,
} from './contracts.js';
import { decodeHarnessRuntimeEvent, decodeHarnessRuntimeHandle } from './records.js';

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

function resolveConformance(input: SessionHarnessAdapterInput): AdapterConformance {
  requireValue(input.context.history, 'adapter binding requires Ten AssemblyHistoryReadPort');
  const row = take(input.context.history.lookup(input.conformance));
  requireValue(row?.record?.type === 'AdapterConformance', 'adapter conformance is absent from Ten signed assembly history');
  requireValue(row.completeness === 'complete' && row.taint.length === 0 && row.conflicts.length === 0,
    'adapter conformance history is partial, tainted, or conflicted');
  requireValue(take(input.context.history.resolve(row.record)).admitted, 'adapter conformance history is not admitted');
  requireValue(row.record.adapter === input.id && row.record.artifact === input.artifact
    && row.record.platform === input.platform && row.record.mode === 'advisory'
    && row.record.disposition === 'passed',
  'adapter conformance does not pass for the exact adapter, artifact, platform, and advisory mode');
  return row.record;
}

function checkedHandle(input: SessionHarnessAdapterInput, launch: string): HarnessRuntimeHandle {
  const lookup = input.handles.lookup(launch);
  requireValue(lookup.handle, 'machine-local runtime handle is missing; blind fallback is forbidden');
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
  resolveConformance(input);

  const adapter = Object.freeze({
    owner: 'part-ten' as const,
    id: input.id,
    describe: () => Object.freeze({
      artifact: input.artifact,
      platform: input.platform,
      contextModes: Object.freeze(['advisory']),
      outputModes: Object.freeze(['framed']),
      interruptionModes: Object.freeze([]),
      custodyModes: Object.freeze(['machine-local-scoped-handles']),
      observationModes: Object.freeze(['instrumented-boundary']),
      conformance: input.conformance,
    }),
    launch(spec: HarnessLaunchSpec, operation: string, claim: string): Result<HarnessObservation> {
      return boundary('SessionHarnessLaunch', { spec, operation, claim }, input.context, () => {
        requireValue(operation && claim, 'launch requires the existing admitted operation and claim identities');
        requireValue(spec.harness === input.id && spec.artifactDigest === input.artifact
          && spec.machine === input.machine, 'launch targets another exact adapter artifact or machine');
        requireValue(spec.consumptionMode === 'advisory',
          'governed model-context mode is unsupported until the named grounding and runtime seams land');
        const durableSpec = resolveLaunch(input, spec.id);
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
        return observation(input, spec, 'launched', processIdentity,
          'actual process launch observed and machine-local handle retained', at);
      });
    },
    deliver(delivery: Readonly<{ launch: string; intake: string; digest: Hash; incarnation: string; operation: string }>): Result<HarnessObservation> {
      return boundary('SessionHarnessDeliver', delivery, input.context, () => {
        const handle = checkedHandle(input, delivery.launch);
        const spec = resolveLaunch(input, delivery.launch);
        requireValue(handleMatchesSpec(handle, spec), 'durable handle and owner-resolved launch disagree');
        requireValue(delivery.incarnation === handle.incarnation, 'delivery targets a stale process incarnation');
        requireValue(delivery.intake === spec.input && delivery.digest === spec.inputDigest,
          'landed Ten port can deliver only the immutable original launch input');
        const accepted = take(input.driver.deliver({
          operation: delivery.operation, processIdentity: handle.processIdentity,
          intake: delivery.intake, digest: delivery.digest, incarnation: delivery.incarnation,
        }));
        return observation(input, spec, 'input-accepted', accepted,
          'driver witnessed input acceptance; consumption is not inferred', input.clock());
      });
    },
    observe(request: Readonly<{ launch: string; delivery: string; operation: string }>): Result<HarnessObservation> {
      return boundary('SessionHarnessObserve', request, input.context, () => {
        const handle = checkedHandle(input, request.launch);
        const spec = resolveLaunch(input, request.launch);
        requireValue(handleMatchesSpec(handle, spec), 'durable handle and owner-resolved launch disagree');
        const observed = take(input.driver.observe({ operation: request.operation, processIdentity: handle.processIdentity }));
        if (observed.phase === 'context-consumed') {
          requireValue(observed.evidence.startsWith('model-context:'), 'terminal appearance cannot prove context consumption');
          requireValue(input.context.history, 'context consumption requires Ten signed history');
          const source = take(input.context.history.lookup(observed.evidence));
          requireValue(source?.record?.type === 'HarnessObservation'
            && source.record.phase === 'context-consumed'
            && source.record.launch === spec.id && source.record.run === spec.run
            && source.record.input === spec.input && source.record.incarnation === spec.incarnation
            && source.conflicts.length === 0 && source.taint.length === 0
            && source.completeness === 'complete',
          'context consumption source is missing, unavailable, conflicted, or names another subject');
          requireValue(take(input.context.history.resolve(source.record)).admitted,
            'context consumption source history is not admitted');
        }
        return observation(input, spec, observed.phase, observed.evidence, observed.detail, input.clock());
      });
    },
  });

  return Object.freeze({ owner: 'part-thirteen' as const, family: 'session-harness', adapter });
}

export function createClaudeCodeHarnessAdapter(input: Omit<SessionHarnessAdapterInput, 'platform'>): SessionHarnessAdapterPackage {
  return createSessionHarnessAdapter({ ...input, platform: 'claude-code' });
}

export function createCodexHarnessAdapter(input: Omit<SessionHarnessAdapterInput, 'platform'>): SessionHarnessAdapterPackage {
  return createSessionHarnessAdapter({ ...input, platform: 'codex' });
}

export function createFutureHarnessAdapter(input: SessionHarnessAdapterInput): SessionHarnessAdapterPackage {
  return createSessionHarnessAdapter(input);
}

export function createHarnessRuntimeEventDecoder(harness: string): HarnessRuntimeEventDecoderPort {
  requireValue(harness, 'runtime event decoder requires exact harness identity');
  return Object.freeze({
    owner: 'part-thirteen' as const,
    harness,
    decode(raw: unknown, context: SessionHarnessAdapterInput['context']) {
      return boundary('HarnessScopedRuntimeEvent', raw, context, () => {
        const event = take(decodeHarnessRuntimeEvent(raw, context));
        requireValue(event.harness === harness, 'runtime event names another harness');
        return event;
      });
    },
  });
}
