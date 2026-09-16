import type { Clock, FactEnvelopeReference, Hash, Result } from '../index.js';
import { registerProductionGroundingReader } from '../rungraph/index.js';
import type { RunView, SessionGrounding, GroundingReadPort } from '../rungraph/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import type { AssemblyDecodeContext, AssemblyHistoryReadPort, AssemblyRuntimePort, ContextDeliverySpecification,
  HarnessAdapterPort, HarnessLaunchSpec, HarnessObservation } from './contracts.js';

export const contextDeliveryIdFor = (launch: string, operation: string): string =>
  `context-delivery:${encoded({ launch, operation }).hash}`;

export interface ContextDeliveryExecutionPort {
  readonly owner: 'part-eight';
  deliver(input: Readonly<{ specification: ContextDeliverySpecification; processIdentity: string;
    operation: string; claim: string }>): Result<string>;
  observe(input: Readonly<{ specification: ContextDeliverySpecification; processIdentity: string;
    operation: string }>): Result<Readonly<{ phase: 'context-consumed' | 'refused' | 'uncertain'; evidence: string; detail: string }>>;
}

export interface ConfinedContextDeliveryDriverPort {
  readonly owner: 'part-ten';
  deliver(specification: ContextDeliverySpecification, effect: Readonly<{ operation: string; claim: string }>): Result<HarnessObservation>;
  observe(specification: ContextDeliverySpecification, operation: string): Result<HarnessObservation>;
}

export function createConfinedContextDeliveryDriver(input: Readonly<{
  history: AssemblyHistoryReadPort; runtime: AssemblyRuntimePort; execution: ContextDeliveryExecutionPort;
  liveProcess: Readonly<{ owner: 'part-ten'; resolve(launch: HarnessLaunchSpec): Result<Readonly<{
    launch: string; run: string; incarnation: string; harness: string; artifactDigest: Hash; machine: string; processIdentity: string;
  }>> }>;
  context: AssemblyDecodeContext; clock: () => number;
}>): ConfinedContextDeliveryDriverPort {
  const { history, runtime, execution, liveProcess, context } = input;
  ensure(history.owner === 'part-ten' && runtime.owner === 'part-ten' && liveProcess.owner === 'part-ten', 'context delivery requires Ten-owned history/runtime/process resolution');
  ensure(execution.owner === 'part-eight', 'context delivery requires an Eight-owned executor');
  const invoked = new Set<string>();
  const exact = <N extends 'HarnessLaunchSpec' | 'ContextDeliverySpecification'>(reference: string, type: N) => {
    const row = take(history.lookup(reference));
    ensure(row?.fact.id === reference || row?.record?.id === reference, `exact signed ${type} reference unavailable`);
    ensure(row.record?.type === type && row.fact.kind === `assembly-${type}` && row.completeness === 'complete'
      && row.taint.length === 0 && row.conflicts.length === 0, `${type} reference is partial, tainted, or conflicted`);
    const verdict = row.record.type === 'ContextDeliverySpecification'
      ? (ensure(history.resolveContextDelivery, 'context delivery history resolver required'), take(history.resolveContextDelivery(row.record)))
      : take(history.resolve(row.record));
    ensure(verdict.admitted, `${type} reference is not admitted`);
    return row.record as Extract<NonNullable<typeof row.record>, { type: N }>;
  };
  const admitted = (candidate: ContextDeliverySpecification) => {
    const spec = exact(candidate.id, 'ContextDeliverySpecification');
    ensure(encoded(spec).bytes === encoded(candidate).bytes, 'adapter may not construct or alter the context delivery specification');
    ensure(spec.reason !== 'compaction', 'NON-EXECUTABLE-UNTIL-live-path-unit-compaction');
    const launch = exact(spec.launch, 'HarnessLaunchSpec');
    ensure(launch.run === spec.run && launch.incarnation === spec.incarnation && launch.harness === spec.harness
      && launch.artifactDigest === spec.artifactDigest && launch.machine === spec.machine, 'context delivery attempted to replace the immutable launch or incarnation');
    const live = take(liveProcess.resolve(launch));
    ensure(live.launch === launch.id && live.run === spec.run && live.incarnation === spec.incarnation
      && live.harness === spec.harness && live.artifactDigest === spec.artifactDigest && live.machine === spec.machine
      && live.processIdentity, 'live process no longer matches the admitted launch');
    return { spec, live };
  };
  const observation = (spec: ContextDeliverySpecification, phase: HarnessObservation['phase'], evidence: string, detail: string): HarnessObservation => {
    const signed = take(history.lookup(spec.id));
    ensure(signed?.record?.type === 'ContextDeliverySpecification'
      && encoded(signed.record).bytes === encoded(spec).bytes, 'signed delivery identity unavailable');
    const deliveryFact = signed.fact.id;
    return take(runtime.record('HarnessObservation', { type: 'HarnessObservation', schemaVersion: 1,
      id: `harness-observation:${encoded({ delivery: spec.id, phase }).hash}`, predecessors: [],
      dependencyFacts: [...new Set([deliveryFact, spec.launch, spec.operation, spec.claim, spec.executionContext, evidence].filter(Boolean))],
      launch: spec.launch, run: spec.run, step: spec.step, input: spec.input, incarnation: spec.incarnation,
      contextDelivery: deliveryFact, sourceEvidence: evidence ? [evidence] : [], contextDigests: spec.contextManifest.map(row => row.digest),
      generation: spec.generation, causalReferences: [],
      observedAt: input.clock(), freshFor: 60_000, phase, boundaryEvidence: evidence, detail }));
  };
  return freeze({ owner: 'part-ten' as const,
    deliver(specification, effect) {
      return boundary('ConfinedContextDelivery', { specification, effect }, context, () => {
        const { spec, live } = admitted(specification);
        ensure(effect.operation === spec.operation && effect.claim === spec.claim, 'current admitted effect or one-use claim differs');
        ensure(!invoked.has(spec.id), 'context delivery was already invoked; observe the durable one-use claim instead');
        invoked.add(spec.id);
        const evidence = take(execution.deliver({ specification: spec, processIdentity: live.processIdentity,
          operation: effect.operation, claim: effect.claim }));
        ensure(evidence, 'executor acceptance evidence required');
        return observation(spec, 'input-accepted', evidence, 'admitted context delivery accepted by the live process');
      });
    },
    observe(specification, operation) {
      return boundary('ConfinedContextConsumption', { specification, operation }, context, () => {
        const { spec, live } = admitted(specification);
        ensure(operation === spec.operation, 'observation operation differs from the admitted delivery');
        const result = take(execution.observe({ specification: spec, processIdentity: live.processIdentity, operation }));
        ensure(['context-consumed', 'refused', 'uncertain'].includes(result.phase), 'executor returned an unsupported context observation');
        ensure(result.evidence, 'context observation requires independently resolvable boundary evidence');
        return observation(spec, result.phase, result.evidence, result.detail);
      });
    },
  });
}

export interface ProductionGroundingReaderInput {
  readonly runtime: AssemblyRuntimePort;
  readonly harness: HarnessAdapterPort;
  readonly clock: () => Clock;
  readonly context: AssemblyDecodeContext;
  sample(request: Parameters<GroundingReadPort['read']>[0], at: Clock): Result<Readonly<{
    specification: unknown;
    grounding(consumption: FactEnvelopeReference): unknown;
  }>>;
}

/** Production GroundingReadPort: the fresh clock/history sample, immutable Ten
 * specification, real delivery, witnessed consumption and returned grounding
 * are one synchronous read. No pre-completed receipt can be injected. */
export function createProductionGroundingReader(input: ProductionGroundingReaderInput): GroundingReadPort {
  const reader = freeze({ owner: 'part-ten' as const, production: true as const,
    read(request: Parameters<GroundingReadPort['read']>[0]) {
      return boundary('ProductionGroundingRead', request, input.context, () => {
      const at = input.clock();
      // This read is deliberately before sample() and again after consumption;
      // it makes current signed assembly history part of this invocation.
      take(input.runtime.inspectCurrent());
      const sampled = take(input.sample(request, at));
      const specification = take(input.runtime.recordContextDelivery(sampled.specification));
      ensure(specification.reason !== 'compaction', 'NON-EXECUTABLE-UNTIL-live-path-unit-compaction');
      ensure(take(input.runtime.resolve(specification)).admitted, 'context delivery specification is not admitted');
      const deliveryRow = take(input.runtime.inspectCurrent()).find(row =>
        row.record.type === 'ContextDeliverySpecification' && row.record.id === specification.id
        && row.taint.length === 0 && row.conflicts.length === 0);
      ensure(deliveryRow, 'signed delivery fact unavailable');
      const deliveryReference = deliveryRow.fact.id;
      const accepted = take(input.harness.deliver({ launch: specification.launch, intake: specification.input,
        digest: specification.inputDigest, incarnation: specification.incarnation, operation: specification.operation,
        contextDelivery: deliveryReference, claim: specification.claim }));
      ensure(accepted.contextDelivery === deliveryReference && accepted.phase === 'input-accepted', 'adapter did not accept the exact context delivery');
      const consumed = take(input.harness.observe({ launch: specification.launch, delivery: accepted.id, operation: specification.operation }));
      ensure(consumed.contextDelivery === deliveryReference && consumed.phase === 'context-consumed', 'adapter did not witness context consumption');
      const recorded = take(input.runtime.record('HarnessObservation', consumed));
      ensure(take(input.runtime.resolve(recorded)).admitted, 'signed context-consumed observation is not admitted');
      const row = take(input.runtime.inspectCurrent()).find(candidate => candidate.record.type === 'HarnessObservation'
        && candidate.record.id === recorded.id && candidate.conflicts.length === 0 && candidate.taint.length === 0);
      ensure(row && row.fact.kind === 'assembly-HarnessObservation', 'exact signed context-consumed fact unavailable');
      const candidate = sampled.grounding({ owner: 'part-two', name: 'FactEnvelope', id: row.fact.id }) as SessionGrounding;
      ensure(candidate.at.value === at.value && candidate.step === specification.step
        && candidate.incarnation === specification.incarnation && candidate.contextDeliveryReason === specification.reason,
      'grounding was pre-completed, retimestamped, or detached from its context delivery');
      return request.invocation ? freeze({ invocation: request.invocation, grounding: candidate }) : candidate;
      });
    },
  });
  return registerProductionGroundingReader(reader);
}
