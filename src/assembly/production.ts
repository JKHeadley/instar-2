import { consumeResult } from '../index.js';
import type { Result } from '../index.js';
import { requiredMinimalDependencies } from '../operator/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { factReferenceAliases } from './records.js';
import { currentAssemblyRows } from './history.js';
import { createAssemblyRuntime } from './service.js';
import type { FactSnapshot, FactStatus } from '../facts/index.js';
import type { AssemblyComposition, AssemblyImplementationBinding, AssemblyManifest, AssemblyProductionBindingSet,
  AssemblyLiveDependencyHandle, AssemblyProductionCoordinator, AssemblyResolvedProductionBinding, AssemblyRuntimePort } from './contracts.js';

interface NamedBinding {
  readonly name: string;
  readonly requiredKind: string;
  readonly row: AssemblyImplementationBinding | Readonly<{ implementation: string; fact: AssemblyImplementationBinding['fact'] }>;
}

function namedBindings(binding: AssemblyProductionBindingSet): readonly NamedBinding[] {
  const dependencyKinds: Readonly<Record<(typeof requiredMinimalDependencies)[number], string>> = {
    'local-facts': 'fact-local-durable-segment', register: 'register-generation-record', 'identity-keys': 'identity-key-set',
    clock: 'clock-source', lease: 'transport-Lease', fence: 'transport-FenceToken',
    'replication-peer': 'fact-replication-receipt', 'conversation-binding': 'conversation-binding',
    route: 'conversation-route', 'delivery-evidence': 'delivery-evidence-service',
  };
  return [
    { name: 'surface-adapter', requiredKind: 'operator-surface-registration', row: binding.surface.adapter },
    { name: 'challenge-verifier', requiredKind: 'operator-challenge-verifier-binding', row: binding.surface.challengeVerifier },
    { name: 'verified-act-intake', requiredKind: 'intake-verified-act-binding', row: binding.verifiedActIntake },
    ...binding.minimalPlane.folds.map(row => ({ name: `projection-fold:${row.projection}`, requiredKind: 'minimal-plane-projection-binding', row })),
    { name: 'source-only-replay', requiredKind: 'minimal-plane-replay-binding', row: binding.minimalPlane.sourceOnlyReplay },
    { name: 'minimal-responder', requiredKind: 'minimal-responder-binding', row: binding.minimalResponder },
    ...binding.dependencies.map(row => ({ name: `dependency:${row.name}`, requiredKind: dependencyKinds[row.name],
      row: { implementation: row.name, fact: row.fact } })),
    { name: 'prerequisite-cut', requiredKind: 'assembly-lifecycle-control-binding', row: binding.lifecycle.cut },
    { name: 'prerequisite-recovery', requiredKind: 'assembly-lifecycle-control-binding', row: binding.lifecycle.recovery },
    { name: 'platform-delivery-witness', requiredKind: 'platform-delivery-witness-binding', row: binding.deliveryWitness },
  ];
}

function statusFor(snapshot: FactSnapshot, reference: string): FactStatus | null {
  const exact = snapshot.entries.filter(row => row.fact.id === reference);
  if (exact.length) {
    ensure(exact.length === 1, `required binding reference is ambiguous in signed history: ${reference}`);
    return exact[0]!;
  }
  const aliases = snapshot.entries.filter(row => factReferenceAliases(row.fact).includes(reference));
  ensure(aliases.length <= 1, `required binding reference is ambiguous in signed history: ${reference}`);
  return aliases[0] ?? null;
}

function resolveOne(name: string, requiredKind: string, declaredKind: string, reference: string, snapshot: FactSnapshot,
    partialAssemblyFacts: ReadonlySet<string>, unavailableAssemblyFacts: ReadonlySet<string>): AssemblyResolvedProductionBinding {
  const root = statusFor(snapshot, reference);
  ensure(root, `required production binding is missing from signed history: ${name}:${reference}`);
  const honestPartialPlaceholder = root.fact.kind === 'assembly-GrowthObservation' && partialAssemblyFacts.has(root.fact.id);
  ensure(honestPartialPlaceholder || (declaredKind === requiredKind && root.fact.kind === requiredKind),
    `required production binding has wrong signed kind: ${name}:${root.fact.kind}:expected:${requiredKind}`);
  ensure(root.taint.length === 0 && root.conflicts.length === 0,
    `required production binding is unavailable or conflicted: ${name}:${reference}`);
  ensure(!unavailableAssemblyFacts.has(root.fact.id),
    `required production binding is unavailable or conflicted: ${name}:${reference}`);
  const missing = new Set<string>();
  let completeness: 'complete' | 'partial' = partialAssemblyFacts.has(root.fact.id) ? 'partial' : 'complete';
  const visited = new Set<string>();
  const queue = [...root.fact.predecessors.required];
  while (queue.length) {
    const dependency = queue.shift()!;
    if (visited.has(dependency)) continue;
    visited.add(dependency);
    const status = statusFor(snapshot, dependency);
    if (!status) { missing.add(dependency); completeness = 'partial'; continue; }
    ensure(status.taint.length === 0 && status.conflicts.length === 0,
      `required production binding is unavailable or conflicted: ${name}:${dependency}`);
    ensure(!unavailableAssemblyFacts.has(status.fact.id),
      `required production binding is unavailable or conflicted: ${name}:${dependency}`);
    if (partialAssemblyFacts.has(status.fact.id)) completeness = 'partial';
    queue.push(...status.fact.predecessors.required);
  }
  return freeze({ name, reference, expectedKind: requiredKind, fact: root.fact, completeness, missing: [...missing].sort() });
}

function selected(runtime: AssemblyRuntimePort, manifestId: string, scope: string): Readonly<{
  manifest: AssemblyManifest;
  binding: AssemblyProductionBindingSet;
}> {
  const manifests = take(runtime.inspectCurrent()).filter((row): row is typeof row & { record: AssemblyManifest } =>
    row.record.type === 'AssemblyManifest' && row.record.id === manifestId);
  ensure(manifests.length === 1, 'production manifest missing or ambiguous in signed history');
  const manifest = manifests[0]!.record;
  const bindings = (manifest.productionBindings ?? []).filter(row => row.scope === scope);
  ensure(bindings.length === 1, 'manifest has no exact production binding set for scope');
  return { manifest, binding: bindings[0]! };
}

function resolveReferences(composition: AssemblyComposition, runtime: AssemblyRuntimePort, manifestId: string, scope: string): Readonly<{
  manifest: AssemblyManifest;
  binding: AssemblyProductionBindingSet;
  references: readonly AssemblyResolvedProductionBinding[];
}> {
  const { manifest, binding } = selected(runtime, manifestId, scope);
  const snapshot = take(composition.spine.store.readForProjection());
  const assembly = currentAssemblyRows(snapshot, composition.host.boundary);
  const partialAssemblyFacts = new Set(assembly.filter(row => row.record.type === 'GrowthObservation'
    && row.record.completion === 'incomplete').map(row => row.fact.id));
  const unavailableAssemblyFacts = new Set(assembly.filter(row => row.taint.length > 0 || row.conflicts.length > 0).map(row => row.fact.id));
  const references = namedBindings(binding).map(({ name, requiredKind, row }) =>
    resolveOne(name, requiredKind, row.fact.expectedKind, row.fact.reference, snapshot, partialAssemblyFacts, unavailableAssemblyFacts));
  return freeze({ manifest, binding, references });
}

/**
 * Re-resolve every production binding from the current verified Part Two view.
 * Partial causal references are returned as partial; this read never promotes
 * them into boot eligibility or turns a missing predecessor into availability.
 */
export function inspectProductionAssemblyBindings(composition: AssemblyComposition, manifestId: string,
  scope: string): Result<readonly AssemblyResolvedProductionBinding[]> {
  return boundary('AssemblyProductionBindingInspection', { manifestId, scope }, composition.host.boundary, () => {
    const runtime = createAssemblyRuntime(composition);
    return resolveReferences(composition, runtime, manifestId, scope).references;
  });
}

function requireMethod(value: unknown, name: string): void {
  ensure(typeof value === 'function', `production composition binding is unavailable: ${name}`);
}

function requirePublicPort(manifest: AssemblyManifest, scope: string, port: string, implementation: string): void {
  const rows = manifest.publicPorts.filter(row => row.scope === scope && row.port === port);
  ensure(rows.length === 1 && rows[0]!.implementation === implementation,
    `production public-port binding is missing or differs: ${port}:${implementation}`);
}

function equalBudgets(left: AssemblyProductionBindingSet['minimalResponder']['budgets'],
  right: AssemblyProductionBindingSet['minimalResponder']['budgets']): boolean {
  return left.worker === right.worker && left.storage === right.storage && left.queue === right.queue
    && left.transport === right.transport && left.effect === right.effect;
}

function validateDependencyHandle(name: AssemblyLiveDependencyHandle['name'], resolution: AssemblyResolvedProductionBinding,
  handle: AssemblyLiveDependencyHandle, currentGeneration: string | null): AssemblyLiveDependencyHandle {
  ensure(handle.name === name && handle.reference === resolution.fact.id && handle.current === true
    && handle.provider.trim().length > 0, `live dependency handle differs or is stale: ${name}`);
  switch (handle.name) {
    case 'local-facts': ensure(handle.durability === 'local-durable', 'minimal fact segment is not local-durable'); break;
    case 'register':
      ensure(handle.generation.trim().length > 0, 'current decoder/register generation is unavailable');
      ensure(currentGeneration !== null && handle.generation === currentGeneration,
        `live register dependency generation differs from current assembly generation: dependency=${handle.generation}; current=${currentGeneration ?? 'unavailable'}`);
      break;
    case 'identity-keys': ensure(handle.keys.trim().length > 0, 'current identity keys are unavailable'); break;
    case 'clock': ensure(handle.clock.trim().length > 0, 'current clock is unavailable'); break;
    case 'lease':
    case 'fence': ensure(handle.exclusive === true, `minimal ${handle.name} is not exclusive`); break;
    case 'replication-peer': ensure(handle.replicas === 1 && handle.distinctPeer === true,
      'replicated(1) requires one distinct authenticated peer acknowledgement'); break;
    case 'conversation-binding': ensure(handle.binding.trim().length > 0, 'current conversation binding is unavailable'); break;
    case 'route': ensure(handle.route.trim().length > 0, 'current conversation route is unavailable'); break;
    case 'delivery-evidence': ensure(handle.administration === 'independent',
      'delivery-evidence service must be independently administered'); break;
  }
  return handle;
}

/** Boot the additive Part Ten production composition and return its sole coordinator. */
export function bootProductionAssembly(composition: AssemblyComposition, manifestId: string,
  scope: string): Result<AssemblyProductionCoordinator> {
  return boundary('AssemblyProductionBoot', { manifestId, scope }, composition.host.boundary, () => {
    const production = composition.production;
    ensure(production, 'production composition bindings are unavailable');
    const runtime = createAssemblyRuntime(composition);
    const { manifest, binding, references } = resolveReferences(composition, runtime, manifestId, scope);
    const partial = references.filter(row => row.completeness === 'partial');
    ensure(partial.length === 0, `production binding remains honestly partial: ${partial.map(row => row.name).join(', ')}`);

    ensure(production.surface.owner === 'part-eleven' && production.surface.id === binding.surface.adapter.implementation,
      'registered operator surface binding differs from the manifest');
    for (const [name, operation] of Object.entries({
      render: production.surface.render,
      pending: production.surface.pending,
      challenge: production.surface.challenge,
      confirm: production.surface.confirm,
      binding: production.surface.binding,
      protection: production.surface.protection,
      stopChallenge: production.surface.stopChallenge,
      stop: production.surface.stop,
    })) requireMethod(operation, `OperatorSurfacePort.${name}`);
    ensure(production.challengeVerifier.id === binding.surface.challengeVerifier.implementation
      && production.challengeVerifier.port.owner === 'part-nine'
      && production.challengeVerifier.port.administration === 'independent',
    'independent challenge verifier binding differs from the manifest');
    requireMethod(production.challengeVerifier.port.issue, 'IndependentSurfaceVerifierPort.issue');
    requireMethod(production.challengeVerifier.port.verify, 'IndependentSurfaceVerifierPort.verify');
    ensure(production.verifiedActIntake.owner === 'part-four'
      && production.verifiedActIntake.id === binding.verifiedActIntake.implementation
      && production.verifiedActIntake.operation === 'admitVerifiedAct',
    'Part Four verified-act intake binding differs from the manifest');
    requireMethod(production.verifiedActIntake.port.admitVerifiedAct, 'IntakePort.admitVerifiedAct');

    requirePublicPort(manifest, scope, 'OperatorSurfacePort', production.surface.id);
    requirePublicPort(manifest, scope, 'IndependentSurfaceVerifierPort', production.challengeVerifier.id);
    requirePublicPort(manifest, scope, 'IntakePort.admitVerifiedAct', production.verifiedActIntake.id);
    for (const [port, handle] of [
      ['RunGraphPort', production.run], ['TransportAuthority', production.lease], ['JudgmentDoorway', production.judgment],
      ['EffectDoorway', production.effect], ['VerificationRuntimePort', production.verification],
    ] as const) requirePublicPort(manifest, scope, port, handle.id);
    requirePublicPort(manifest, scope, 'VerificationClockPort', production.verificationClock.id);
    for (const [name, operation] of Object.entries({
      'RunGraphPort.open': production.run.port.open,
      'RunGraphPort.ground': production.run.port.ground,
      'RunGraphPort.transition': production.run.port.transition,
      'RunGraphPort.readExit': production.run.port.readExit,
      'TransportAuthority.inspect': production.lease.port.inspect,
      'TransportAuthority.renew': production.lease.port.renew,
      'TransportAuthority.release': production.lease.port.release,
      'TransportAuthority.admitWrite': production.lease.port.admitWrite,
      'TransportAuthority.schedule': production.lease.port.schedule,
      'TransportAuthority.reserve': production.lease.port.reserve,
      'TransportAuthority.claim': production.lease.port.claim,
      'TransportAuthority.consume': production.lease.port.consume,
      'TransportAuthority.recover': production.lease.port.recover,
      'TransportAuthority.close': production.lease.port.close,
      'TransportAuthority.settle': production.lease.port.settle,
      'JudgmentDoorway.resumeRecording': production.judgment.port.resumeRecording,
      'JudgmentDoorway.readAnswer': production.judgment.port.readAnswer,
      'JudgmentDoorway.inspect': production.judgment.port.inspect,
      'EffectDoorway.prepare': production.effect.port.prepare,
      'EffectDoorway.handoff': production.effect.port.handoff,
      'EffectDoorway.observe': production.effect.port.observe,
      'EffectDoorway.settle': production.effect.port.settle,
      'EffectDoorway.inspect': production.effect.port.inspect,
      'VerificationRuntimePort.record': production.verification.port.record,
      'VerificationRuntimePort.inspect': production.verification.port.inspect,
      'VerificationRuntimePort.due': production.verification.port.due,
    })) requireMethod(operation, name);
    requireMethod(production.run.port.read, 'RunGraphPort.read');
    requireMethod(production.lease.port.acquire, 'TransportAuthority.acquire');
    requireMethod(production.judgment.port.judge, 'JudgmentDoorway.judge');
    ensure(production.effect.port.owner === 'part-eight', 'effect doorway must be issued by Part Eight');
    requireMethod(production.effect.port.dispatch, 'EffectDoorway.dispatch');
    ensure(production.verification.port.owner === 'part-nine', 'verification runtime must be issued by Part Nine');
    requireMethod(production.verification.port.inspectCurrent, 'VerificationRuntimePort.inspectCurrent');
    requireMethod(production.verification.port.posture, 'VerificationRuntimePort.posture');
    ensure(production.verificationClock.owner === 'part-nine'
      && production.verificationClock.administration === 'independent',
    'verification clock must belong to the independently administered Part Nine domain');
    requireMethod(production.verificationClock.current, 'AssemblyVerificationClockPort.current');

    ensure(production.folds.length === binding.minimalPlane.folds.length, 'minimal-plane fold binding count differs');
    for (const row of binding.minimalPlane.folds) {
      const matches = production.folds.filter(fold => fold.id === row.projection && fold.implementation === row.implementation
        && fold.definition.id === row.projection && fold.definition.class === 'informational');
      ensure(matches.length === 1, `minimal-plane projection fold is missing or ambiguous: ${row.projection}`);
    }
    ensure(production.replay.owner === 'part-ten' && production.replay.sourceOnly === true
      && production.replay.id === binding.minimalPlane.sourceOnlyReplay.implementation,
    'source-only replay provider differs from the manifest');
    requireMethod(production.replay.rebuild, 'AssemblySourceOnlyReplayPort.rebuild');
    ensure(production.minimalResponder.owner === 'part-eleven'
      && production.minimalResponder.id === binding.minimalResponder.implementation
      && equalBudgets(production.minimalResponder.budgets, binding.minimalResponder.budgets),
    'minimal responder identity or reserved budgets differ from the manifest');
    ensure(Object.values(production.minimalResponder.budgets).every(value => Number.isSafeInteger(value) && value > 0),
      'minimal responder production budgets must be finite positive reserves');
    requireMethod(production.minimalResponder.respond, 'AssemblyMinimalResponderPort.respond');

    ensure(production.dependencyAdmission.owner === 'part-ten', 'live dependency admission is not Part Ten-owned');
    requireMethod(production.dependencyAdmission.admit, 'AssemblyDependencyAdmissionPort.admit');
    const dependencyHandles = Object.fromEntries(requiredMinimalDependencies.map(name => {
      const resolution = references.find(row => row.name === `dependency:${name}`)!;
      const handle = take(production.dependencyAdmission.admit({ name, fact: resolution.fact,
        completeness: resolution.completeness, missing: resolution.missing }));
      const currentGeneration = name === 'register' ? composition.host.current().generation : null;
      return [name, validateDependencyHandle(name, resolution, handle, currentGeneration)];
    })) as AssemblyProductionCoordinator['handles']['dependencies'];

    ensure(production.lifecycle.owner === 'part-ten' && production.lifecycle.cutId === binding.lifecycle.cut.implementation
      && production.lifecycle.recoveryId === binding.lifecycle.recovery.implementation,
    'deterministic prerequisite cut/recovery controls differ from the manifest');
    requireMethod(production.lifecycle.cut, 'AssemblyPrerequisiteLifecyclePort.cut');
    requireMethod(production.lifecycle.recover, 'AssemblyPrerequisiteLifecyclePort.recover');

    const witness = production.deliveryWitness;
    ensure(typeof witness.platform === 'string' && witness.platform.trim().length > 0,
      'platform delivery witness must name a non-empty platform');
    ensure(witness.owner === 'part-nine' && witness.administration === 'independent'
      && witness.id === binding.deliveryWitness.implementation && witness.identity === binding.deliveryWitness.identity
      && witness.platform === binding.deliveryWitness.platform,
    'platform delivery witness binding differs from the manifest');
    const actualIdentities = [witness.identity, production.requesterIdentity, production.surface.id, production.effectAdapterIdentity];
    ensure(new Set(actualIdentities).size === actualIdentities.length
      && production.requesterIdentity === binding.deliveryWitness.requester
      && production.effectAdapterIdentity === binding.deliveryWitness.effectAdapter,
    'platform delivery witness must be distinct from requester, surface, and effect adapter');
    requireMethod(witness.observe, 'AssemblyPlatformDeliveryWitnessPort.observe');

    const admission = take(runtime.admit(manifestId, scope));
    const handles = Object.freeze({ persistence: composition.persistence, harnesses: composition.harnesses, model: composition.model,
      intake: production.verifiedActIntake, run: production.run, lease: production.lease, judgment: production.judgment,
      effect: production.effect, verification: production.verification, verificationClock: production.verificationClock,
      surface: production.surface,
      challengeVerifier: production.challengeVerifier, folds: production.folds, replay: production.replay,
      minimalResponder: production.minimalResponder, dependencyAdmission: production.dependencyAdmission,
      dependencies: Object.freeze(dependencyHandles), lifecycle: production.lifecycle, deliveryWitness: witness });
    return Object.freeze({ owner: 'part-ten' as const, scope, admission, runtime, references, handles });
  });
}

// Keep Result consumption explicit at this boundary so no caller can accidentally
// treat a Refused boot as a coordinator through structural truthiness.
export function consumeProductionAssembly<T>(result: Result<T>,
  success: (value: T) => void, refused: (detail: string) => void): void {
  consumeResult(result, { Success: success, Refused: failure => refused(failure.detail) });
}
