import { registerNativeContextHarness } from './grounding-capability.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { decodeHarnessObservation } from './records.js';
import type { ConfinedContextDeliveryDriverPort } from './context-delivery.js';
import type { AssemblyDecodeContext, ContextDeliverySpecification, HarnessAdapterPort, HarnessLaunchSpec, HarnessObservation } from './contracts.js';

export interface NativeHarnessDriverPort {
  readonly owner: 'part-eight';
  launch(input: Readonly<{ operation: string; claim: string; artifact: string; incarnation: string; workingScope: string; handles: readonly string[] }>): import('../index.js').Result<string>;
  deliver(input: Readonly<{ operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }>): import('../index.js').Result<string>;
  observe(input: Readonly<{ operation: string; processIdentity: string }>): import('../index.js').Result<Readonly<{ phase: HarnessObservation['phase']; evidence: string; detail: string }>>;
}

export function createNativeHarnessAdapter(input: Readonly<{ id: string; artifact: string; platform: string; conformance: string;
  driver: NativeHarnessDriverPort; contextDeliveryDriver?: ConfinedContextDeliveryDriverPort;
  context: AssemblyDecodeContext; clock: () => number; generation: () => string }>): HarnessAdapterPort {
  const { driver, context } = input; ensure(driver.owner === 'part-eight', 'native harness requires eight-owned operation driver');
  const launches = new Map<string, { spec: HarnessLaunchSpec; processIdentity: string }>();
  const deliveries = new Map<string, ContextDeliverySpecification>(); let ordinal = 0;
  const observation = (spec: HarnessLaunchSpec, phase: HarnessObservation['phase'], evidence: string, detail: string, dependencies: readonly string[]): HarnessObservation =>
    take(decodeHarnessObservation({ type: 'HarnessObservation', schemaVersion: 1, id: `harness-observation:${spec.id}:${phase}:${++ordinal}`,
      predecessors: [], dependencyFacts: dependencies, launch: spec.id, run: spec.run, step: spec.step, input: spec.input,
      incarnation: spec.incarnation, sourceEvidence: evidence ? [evidence] : [], contextDigests: spec.contextManifest.map(row => row.digest),
      generation: input.generation(), causalReferences: dependencies, observedAt: input.clock(), freshFor: 60_000, phase,
      boundaryEvidence: evidence, detail }, context));
  const port: HarnessAdapterPort = { owner: 'part-ten' as const, id: input.id,
    describe: () => freeze({ artifact: input.artifact as `sha256:${string}`, platform: input.platform,
      contextModes: ['model-context-boundary'], outputModes: ['framed'], interruptionModes: ['registered-operation'],
      custodyModes: ['scoped-handles'], observationModes: ['instrumented-boundary'], conformance: input.conformance }),
    launch(spec, operation, claim) {
      return boundary('NativeHarnessLaunch', { spec, operation, claim }, context, () => {
        ensure(spec.harness === input.id && spec.artifactDigest === input.artifact, 'launch targets another harness artifact');
        const processIdentity = take(driver.launch({ operation, claim, artifact: spec.artifactDigest, incarnation: spec.incarnation,
          workingScope: spec.workingScope, handles: spec.portHandles }));
        ensure(processIdentity, 'driver returned no process identity'); launches.set(spec.id, { spec, processIdentity });
        return observation(spec, 'launched', processIdentity, 'actual process launch observed', spec.dependencyFacts);
      });
    },
    deliver(delivery) {
      return boundary('NativeHarnessDeliver', delivery, context, () => {
        if (delivery.contextDelivery) {
          ensure(input.contextDeliveryDriver && context.history && delivery.claim, 'production context delivery driver, history, and claim required');
          const row = take(context.history.lookup(delivery.contextDelivery));
          ensure(row?.record?.type === 'ContextDeliverySpecification' && row.completeness === 'complete'
            && row.taint.length === 0 && row.conflicts.length === 0 && context.history.resolveContextDelivery
            && take(context.history.resolveContextDelivery(row.record)).admitted,
          'exact owner-decoded context delivery specification unavailable');
          const specification = row.record;
          ensure(specification.launch === delivery.launch && specification.input === delivery.intake
            && specification.inputDigest === delivery.digest && specification.incarnation === delivery.incarnation
            && specification.operation === delivery.operation && specification.claim === delivery.claim,
          'adapter delivery differs from the admitted context delivery specification');
          deliveries.set(specification.id, specification);
          return take(input.contextDeliveryDriver.deliver(specification, { operation: delivery.operation, claim: delivery.claim }));
        }
        const launched = launches.get(delivery.launch); ensure(launched && launched.spec.incarnation === delivery.incarnation, 'unknown or stale launch incarnation');
        ensure(delivery.intake === launched.spec.input && delivery.digest === launched.spec.inputDigest, 'delivery identity or digest differs from admitted launch input');
        const accepted = take(driver.deliver({ operation: delivery.operation, processIdentity: launched.processIdentity,
          intake: delivery.intake, digest: delivery.digest, incarnation: delivery.incarnation }));
        return observation(launched.spec, 'input-accepted', accepted, 'durable input accepted; consumption not yet claimed', launched.spec.dependencyFacts);
      });
    },
    observe(request) {
      return boundary('NativeHarnessObserve', request, context, () => {
        if (input.contextDeliveryDriver && context.history) {
          const accepted = take(context.history.lookup(request.delivery));
          if (accepted?.record?.type === 'HarnessObservation' && accepted.record.contextDelivery) {
            ensure(accepted.fact.kind === 'assembly-HarnessObservation'
              && accepted.completeness === 'complete' && !accepted.taint.length && !accepted.conflicts.length
              && accepted.record.launch === request.launch
              && take(context.history.resolve(accepted.record)).admitted, 'delivery observation unavailable');
            const delivery = take(context.history.lookup(accepted.record.contextDelivery));
            ensure(delivery?.record?.type === 'ContextDeliverySpecification'
              && delivery.fact.id === accepted.record.contextDelivery
              && delivery.record.launch === request.launch && delivery.record.operation === request.operation,
            'observation does not name the exact admitted delivery');
            return take(input.contextDeliveryDriver.observe(delivery.record, request.operation));
          }
        }
        const delivered = [...deliveries.values()].find(specification => specification.launch === request.launch
          && specification.operation === request.operation);
        if (delivered) return take(input.contextDeliveryDriver!.observe(delivered, request.operation));
        const launched = launches.get(request.launch); ensure(launched, 'unknown launch');
        const observed = take(driver.observe({ operation: request.operation, processIdentity: launched.processIdentity }));
        if (observed.phase === 'context-consumed') {
          ensure(observed.evidence.startsWith('model-context:') && context.history, 'context consumption source is not resolvable signed history');
          const rows = take(context.history.current()); const source = rows.find(row => row.fact.id === observed.evidence || row.record.id === observed.evidence);
          ensure(source?.record.type === 'HarnessObservation' && source.conflicts.length === 0 && source.taint.length === 0,
            'context consumption source is missing, unavailable, or conflicted');
          ensure(source.record.run === launched.spec.run && source.record.input === launched.spec.input && source.record.incarnation === launched.spec.incarnation,
            'context consumption source names another run, input, or incarnation');
          ensure(take(context.history.resolve(source.record)).admitted, 'context consumption source history is not admitted');
        }
        return observation(launched.spec, observed.phase, observed.evidence, observed.detail, launched.spec.dependencyFacts);
      });
    },
  };
  if (input.contextDeliveryDriver && context.history) registerNativeContextHarness(port, input.contextDeliveryDriver, context.history);
  return Object.freeze(port);
}
