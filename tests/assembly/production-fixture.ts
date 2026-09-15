import { decodeAssemblyManifest } from '../../src/assembly/index.js';
import type { AssemblyManifest, AssemblyProductionBindingSet, AssemblyProductionComposition } from '../../src/assembly/index.js';
import { minimalPlaneProjections, requiredMinimalDependencies } from '../../src/operator/index.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture, productionReferenceKinds } from './round8-extended-fixture.js';
import { value } from '../facts/fixtures.js';

type RuntimeFixture = ReturnType<typeof assemblyRuntimeFixture>;
const h = (c: string) => `sha256:${c.repeat(64)}` as const;
const fact = (reference: string, expectedKind: string) => ({ reference, expectedKind, required: true as const });

export function productionBindingSet(scope = 'scope:minimal'): AssemblyProductionBindingSet {
  return {
    scope,
    surface: {
      adapter: { implementation: 'surface:phone', fact: fact('binding:surface', 'operator-surface-registration') },
      challengeVerifier: { implementation: 'verifier:phone', administration: 'independent',
        fact: fact('binding:challenge-verifier', 'operator-challenge-verifier-binding') },
    },
    verifiedActIntake: { implementation: 'intake:verified-act', operation: 'admitVerifiedAct',
      fact: fact('binding:verified-act-intake', 'intake-verified-act-binding') },
    minimalPlane: {
      folds: minimalPlaneProjections(productionReferenceKinds).map(definition => ({ projection: definition.id as typeof definition.id & AssemblyProductionBindingSet['minimalPlane']['folds'][number]['projection'],
        implementation: `fold:${definition.id}`, fact: fact(`binding:fold:${definition.id}`, 'minimal-plane-projection-binding') })),
      sourceOnlyReplay: { implementation: 'replay:source-only', fact: fact('binding:source-only-replay', 'minimal-plane-replay-binding') },
    },
    minimalResponder: { implementation: 'responder:minimal', fact: fact('binding:minimal-responder', 'minimal-responder-binding'),
      budgets: { worker: 1, storage: 4096, queue: 8, transport: 4, effect: 20 } },
    dependencies: [
      ['local-facts', 'fact-local-durable-segment'], ['register', 'register-generation-record'],
      ['identity-keys', 'identity-key-set'], ['clock', 'clock-source'], ['lease', 'transport-Lease'],
      ['fence', 'transport-FenceToken'], ['replication-peer', 'fact-replication-receipt'],
      ['conversation-binding', 'conversation-binding'], ['route', 'conversation-route'],
      ['delivery-evidence', 'delivery-evidence-service'],
    ].map(([name, expectedKind]) => ({ name: name as AssemblyProductionBindingSet['dependencies'][number]['name'],
      fact: fact(`binding:dependency:${name}`, expectedKind!) })),
    lifecycle: {
      cut: { implementation: 'lifecycle:cut', fact: fact('binding:lifecycle:cut', 'assembly-lifecycle-control-binding') },
      recovery: { implementation: 'lifecycle:recovery', fact: fact('binding:lifecycle:recovery', 'assembly-lifecycle-control-binding') },
    },
    deliveryWitness: { implementation: 'witness:platform', identity: 'principal:witness', platform: 'telegram',
      requester: 'principal:requester', effectAdapter: 'adapter:telegram',
      fact: fact('binding:delivery-witness', 'platform-delivery-witness-binding') },
  };
}

export function productionPublicPorts(scope = 'scope:minimal'): AssemblyManifest['publicPorts'] {
  const base = assemblyInput('AssemblyManifest').publicPorts.map(row => ({ ...row, scope }));
  return [...base,
    { port: 'OperatorSurfacePort', version: '1', scope, implementation: 'surface:phone', artifact: h('1') },
    { port: 'IndependentSurfaceVerifierPort', version: '1', scope, implementation: 'verifier:phone', artifact: h('2') },
    { port: 'IntakePort.admitVerifiedAct', version: '1', scope, implementation: 'intake:verified-act', artifact: h('3') },
    { port: 'RunGraphPort', version: '1', scope, implementation: 'run:graph', artifact: h('4') },
    { port: 'TransportAuthority', version: '1', scope, implementation: 'lease:authority', artifact: h('5') },
    { port: 'JudgmentDoorway', version: '1', scope, implementation: 'judgment:doorway', artifact: h('6') },
    { port: 'EffectDoorway', version: '1', scope, implementation: 'effect:doorway', artifact: h('7') },
    { port: 'VerificationRuntimePort', version: '1', scope, implementation: 'verification:runtime', artifact: h('8') },
    { port: 'VerificationClockPort', version: '1', scope, implementation: 'verification:clock', artifact: h('9') },
  ];
}

export function productionComposition(f: RuntimeFixture, binding = productionBindingSet()): AssemblyProductionComposition {
  const ok = <T>(value: T) => f.success(value);
  const noValue = () => ok(undefined as never);
  let cutAt: (typeof requiredMinimalDependencies)[number] | null = null;
  const surface = { owner: 'part-eleven' as const, id: binding.surface.adapter.implementation,
    render: noValue, pending: noValue, challenge: noValue, confirm: noValue, binding: noValue, protection: noValue,
    stopChallenge: noValue, stop: noValue };
  const verifier = { owner: 'part-nine' as const, administration: 'independent' as const, issue: noValue, verify: noValue };
  const intakePort = { receive: noValue, recover: noValue, expireHolds: () => ok(0), admitVerifiedAct: noValue };
  const definitions = minimalPlaneProjections(productionReferenceKinds);
  const folds = binding.minimalPlane.folds.map(row => ({ owner: 'part-eleven' as const, id: row.projection,
    implementation: row.implementation, definition: definitions.find(definition => definition.id === row.projection)! }));
  return {
    requesterIdentity: binding.deliveryWitness.requester,
    effectAdapterIdentity: binding.deliveryWitness.effectAdapter,
    surface,
    challengeVerifier: { id: binding.surface.challengeVerifier.implementation, port: verifier },
    verifiedActIntake: { owner: 'part-four', id: binding.verifiedActIntake.implementation,
      operation: 'admitVerifiedAct', port: intakePort },
    folds,
    replay: { owner: 'part-ten', id: binding.minimalPlane.sourceOnlyReplay.implementation, sourceOnly: true,
      rebuild: () => ok([]) },
    minimalResponder: { owner: 'part-eleven', id: binding.minimalResponder.implementation,
      budgets: binding.minimalResponder.budgets, respond: () => ok('limited response') },
    run: { id: 'run:graph', port: { open: noValue, read: noValue, ground: noValue, transition: noValue, readExit: noValue } as unknown as AssemblyProductionComposition['run']['port'] },
    lease: { id: 'lease:authority', port: { inspect: noValue, acquire: noValue, renew: noValue, release: noValue,
      admitWrite: noValue, schedule: noValue, reserve: noValue, claim: noValue, consume: noValue, recover: noValue,
      close: noValue, settle: noValue } as unknown as AssemblyProductionComposition['lease']['port'] },
    judgment: { id: 'judgment:doorway', port: { judge: async () => noValue(), resumeRecording: noValue,
      readAnswer: noValue, inspect: noValue } as unknown as AssemblyProductionComposition['judgment']['port'] },
    effect: { id: 'effect:doorway', port: { owner: 'part-eight', prepare: noValue, adopt: noValue, dispatch: noValue,
      handoff: noValue, observe: noValue, settle: noValue, inspect: noValue } as unknown as AssemblyProductionComposition['effect']['port'] },
    verification: { id: 'verification:runtime', port: { owner: 'part-nine', record: noValue, inspect: noValue,
      inspectCurrent: noValue, due: noValue, posture: noValue } as unknown as AssemblyProductionComposition['verification']['port'] },
    verificationClock: { owner: 'part-nine', administration: 'independent', id: 'verification:clock',
      current: () => ok(f.host.current().clock) },
    dependencyAdmission: { owner: 'part-ten', id: 'dependency:admission',
      admit: input => {
        if (input.name === cutAt) throw new Error(`deterministic prerequisite cut: ${input.name}`);
        const common = { name: input.name, reference: input.fact.id, provider: `provider:${input.name}`, current: true as const };
        switch (input.name) {
          case 'local-facts': return ok({ ...common, name: input.name, durability: 'local-durable' as const });
          case 'register': return ok({ ...common, name: input.name, generation: 'generation:fixture' });
          case 'identity-keys': return ok({ ...common, name: input.name, keys: 'keys:fixture' });
          case 'clock': return ok({ ...common, name: input.name, clock: 'clock:fixture' });
          case 'lease': return ok({ ...common, name: input.name, exclusive: true as const });
          case 'fence': return ok({ ...common, name: input.name, exclusive: true as const });
          case 'replication-peer': return ok({ ...common, name: input.name, replicas: 1 as const, distinctPeer: true as const });
          case 'conversation-binding': return ok({ ...common, name: input.name, binding: 'binding:fixture' });
          case 'route': return ok({ ...common, name: input.name, route: 'route:fixture' });
          case 'delivery-evidence': return ok({ ...common, name: input.name, administration: 'independent' as const });
        }
      } },
    lifecycle: { owner: 'part-ten', cutId: binding.lifecycle.cut.implementation, recoveryId: binding.lifecycle.recovery.implementation,
      cut: name => { cutAt = name; return ok(undefined); },
      recover: name => { if (cutAt === name) cutAt = null; return ok(undefined); } },
    deliveryWitness: { owner: 'part-nine', administration: 'independent', id: binding.deliveryWitness.implementation,
      identity: binding.deliveryWitness.identity, platform: binding.deliveryWitness.platform, observe: noValue },
  };
}

function bindingFacts(binding: AssemblyProductionBindingSet): readonly { reference: string; expectedKind: string }[] {
  return [binding.surface.adapter.fact, binding.surface.challengeVerifier.fact, binding.verifiedActIntake.fact,
    ...binding.minimalPlane.folds.map(row => row.fact), binding.minimalPlane.sourceOnlyReplay.fact,
    binding.minimalResponder.fact, ...binding.dependencies.map(row => row.fact), binding.lifecycle.cut.fact,
    binding.lifecycle.recovery.fact, binding.deliveryWitness.fact];
}

export function appendProductionBindingFacts(f: RuntimeFixture, binding: AssemblyProductionBindingSet): void {
  for (const row of bindingFacts(binding)) {
    if (value(f.c.history!.lookup(row.reference))) continue;
    f.appendReference(row.expectedKind, { id: row.reference });
  }
}

export function installProduction(f: RuntimeFixture, binding = productionBindingSet(), options: { uncheckedManifest?: boolean } = {}) {
  appendProductionBindingFacts(f, binding);
  const conformance = value(f.runtime.record('AdapterConformance', assemblyInput('AdapterConformance')));
  const policy = value(f.runtime.record('StoreCustodyPolicy', assemblyInput('StoreCustodyPolicy')));
  const harness = value(f.runtime.record('HarnessObservation', assemblyInput('HarnessObservation')));
  const access = value(f.runtime.record('StorageAccessObservation', assemblyInput('StorageAccessObservation')));
  const rows = value(f.runtime.inspect());
  const factId = (id: string) => rows.find(row => row.record.id === id)!.fact.id;
  const conformanceFact = factId(conformance.id), policyFact = factId(policy.id), harnessFact = factId(harness.id), accessFact = factId(access.id);
  const manifestInput = { ...assemblyInput('AssemblyManifest'), id: 'manifest:production',
    publicPorts: productionPublicPorts(binding.scope), productionBindings: [binding], dependencyFacts: [conformanceFact, policyFact] };
  const manifest = options.uncheckedManifest
    ? value(decodeAssemblyManifest(manifestInput, { ...f.c, validateReferences: false }))
    : value(f.runtime.record('AssemblyManifest', manifestInput));
  if (options.uncheckedManifest) value(f.spine.append(manifest));
  const manifestFact = value(f.runtime.inspect()).find(row => row.record.id === manifest.id)!.fact.id;
  const admission = value(f.runtime.record('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), id: 'admission:production',
    manifest: manifest.id, scope: binding.scope, conformance: [conformanceFact], isolationEvidence: [harnessFact],
    custodyEvidence: [accessFact], dependencyFacts: [manifestFact, conformanceFact, policyFact] }));
  return { binding, manifest, admission, manifestFact, conformanceFact, policyFact, harnessFact, accessFact };
}

export function assertDependencyRoster(binding: AssemblyProductionBindingSet): void {
  if (binding.dependencies.map(row => row.name).join(',') !== requiredMinimalDependencies.join(','))
    throw new Error('fixture dependency order differs from Part Eleven');
}
