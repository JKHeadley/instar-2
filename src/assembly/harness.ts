import { hashBytes } from '../facts/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { decodeHarnessObservation } from './records.js';
import type { AssemblyDecodeContext, HarnessAdapterPort, HarnessLaunchSpec, HarnessObservation } from './contracts.js';

export interface NativeHarnessDriverPort {
  readonly owner: 'part-eight';
  launch(input: Readonly<{ operation: string; claim: string; artifact: string; incarnation: string; workingScope: string; handles: readonly string[] }>): import('../index.js').Result<string>;
  deliver(input: Readonly<{ operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }>): import('../index.js').Result<string>;
  observe(input: Readonly<{ operation: string; processIdentity: string }>): import('../index.js').Result<Readonly<{ phase: HarnessObservation['phase']; evidence: string; detail: string }>>;
}

export function createNativeHarnessAdapter(input: Readonly<{ id: string; artifact: string; platform: string; conformance: string;
  driver: NativeHarnessDriverPort; context: AssemblyDecodeContext; clock: () => number; generation: () => string }>): HarnessAdapterPort {
  const { driver, context } = input; ensure(driver.owner === 'part-eight', 'native harness requires eight-owned operation driver');
  const launches = new Map<string, { spec: HarnessLaunchSpec; processIdentity: string }>(); let ordinal = 0;
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
        const launched = launches.get(delivery.launch); ensure(launched && launched.spec.incarnation === delivery.incarnation, 'unknown or stale launch incarnation');
        ensure(delivery.digest === launched.spec.inputDigest, 'delivery digest differs from admitted launch input');
        const accepted = take(driver.deliver({ operation: delivery.operation, processIdentity: launched.processIdentity,
          intake: delivery.intake, digest: delivery.digest, incarnation: delivery.incarnation }));
        return observation(launched.spec, 'input-accepted', accepted, 'durable input accepted; consumption not yet claimed', launched.spec.dependencyFacts);
      });
    },
    observe(request) {
      return boundary('NativeHarnessObserve', request, context, () => {
        const launched = launches.get(request.launch); ensure(launched, 'unknown launch'); const observed = take(driver.observe({ operation: request.operation, processIdentity: launched.processIdentity }));
        ensure(observed.phase !== 'context-consumed' || observed.evidence.startsWith('model-context:'), 'stdin or prompt echo cannot prove context consumption');
        return observation(launched.spec, observed.phase, observed.evidence, observed.detail, launched.spec.dependencyFacts);
      });
    },
  };
  return Object.freeze(port);
}
