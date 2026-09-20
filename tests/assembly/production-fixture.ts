import { canonical } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { decodeAssemblyManifest, installationRoleOwners, loadProductionBootstrap,
  recordInstallationSelection, recordProductionSignerReference } from '../../src/assembly/index.js';
import type { AssemblyManifest, AssemblyProductionBindingSet, AssemblyProductionComposition, InstallationRecordWriter,
  InstallationRole, ProductionSignerAdmission, VerifiedProductionBootstrap } from '../../src/assembly/index.js';
import { createFactStore, hashBytes } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { minimalPlaneProjections, requiredMinimalDependencies } from '../../src/operator/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import type { TransportAuthority, TransportHost } from '../../src/transport/index.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture, productionReferenceKinds } from './round8-extended-fixture.js';
import type { intakeFixture } from '../intake/fixtures.js';
import { privateKey, value } from '../facts/fixtures.js';

/** The scope every fixed-installation selection and the approved package carry. */
export const productionScope = 'scope:minimal';
const digest = (input: unknown) => value(canonical(input)).hash;
type IntakeFixture = ReturnType<typeof intakeFixture>;
interface PreparedInstallation {
  readonly bootstrap: VerifiedProductionBootstrap; readonly transport: { host: TransportHost; api: TransportAuthority };
  readonly lease: FactEnvelope; readonly reservation: FactEnvelope; readonly binding: FactEnvelope;
  readonly selections: readonly { reference: string; record: Json }[]; readonly signer: Json;
}
const prepared = new WeakMap<object, PreparedInstallation>();

/** Fixture-approved owner declarations the selections reference; each path names its public owner directory. */
export function productionInstallationSources(f: IntakeFixture) {
  const doc = (id: string, path: string) => ({ declaration: f.r.declaration(id, 'governed documents',
    { location: 'docs/14-the-assembly/16-the-fixed-single-machine-installation-contract.md', changelog: 'git-history:docs/14-the-assembly.changelog.md' }), path, symbol: id });
  const folds = minimalPlaneProjections(productionReferenceKinds).map(definition => doc(`fold:${definition.id}`, 'src/operator/live.ts'));
  return [
    doc('surface:phone', 'src/operator/live.ts'), doc('responder:minimal', 'src/operator/live.ts'), ...folds,
    doc('verifier:phone', 'src/verification/records.ts'), doc('verifier:domain', 'src/verification/records.ts'), doc('verifier:trust', 'src/verification/records.ts'),
    doc('clock:verification', 'src/verification/records.ts'), doc('clock:trust', 'src/verification/records.ts'),
    doc('witness:platform', 'src/verification/records.ts'), doc('evidence:telegram', 'src/verification/records.ts'),
    doc('platform:telegram', 'src/conversation/telegram.ts'),
    doc('intake:verified-act', 'src/intake/port.ts'), doc('intake:route', 'src/intake/port.ts'),
    doc('segment:local', 'src/facts/store.ts'),
    doc('replay:source-only', 'src/assembly/production-installation-replay.ts'), doc('lifecycle:cut', 'src/assembly/production-installation-replay.ts'),
    doc('lifecycle:recovery', 'src/assembly/production-installation-replay.ts'), doc('lifecycle:repair', 'src/assembly/production-installation-replay.ts'),
  ];
}

/** The closed selection table for the fixed profile: one row per production name resolved by Ten's selection body. */
function selectionRows(scope: string, references: { binding: string; reservation: string }) {
  const folds = minimalPlaneProjections(productionReferenceKinds).map(definition => ({ reference: `binding:fold:${definition.id}`,
    role: 'minimal-plane-fold' as const, instance: definition.id, implementation: `fold:${definition.id}`, refs: [`fold:${definition.id}`, 'part-two:run-input'] }));
  const rows: readonly { reference: string; role: InstallationRole; instance: string; implementation: string; refs: readonly string[] }[] = [
    { reference: 'binding:surface', role: 'operator-surface', instance: 'surface', implementation: 'surface:phone', refs: ['surface:phone'] },
    { reference: 'binding:challenge-verifier', role: 'challenge-verifier', instance: 'verifier', implementation: 'verifier:phone', refs: ['verifier:domain', 'verifier:phone', 'verifier:trust'] },
    { reference: 'binding:verified-act-intake', role: 'verified-act-intake', instance: 'intake', implementation: 'intake:verified-act', refs: ['intake:verified-act'] },
    ...folds,
    { reference: 'binding:source-only-replay', role: 'minimal-plane-replay', instance: 'source-only', implementation: 'replay:source-only', refs: ['installation-replay-matrix', 'replay:source-only'] },
    { reference: 'binding:minimal-responder', role: 'minimal-responder', instance: 'responder', implementation: 'responder:minimal', refs: ['responder:minimal', 'rungraph.contract', references.reservation] },
    { reference: 'binding:lifecycle:cut', role: 'prerequisite-cut', instance: 'prerequisite-cut', implementation: 'lifecycle:cut', refs: ['lifecycle:cut', 'lifecycle:repair'] },
    { reference: 'binding:lifecycle:recovery', role: 'prerequisite-recovery', instance: 'prerequisite-recovery', implementation: 'lifecycle:recovery', refs: ['lifecycle:recovery', 'lifecycle:repair'] },
    { reference: 'binding:delivery-witness', role: 'delivery-witness', instance: 'witness', implementation: 'witness:platform', refs: ['platform:telegram', 'witness:platform'] },
    { reference: 'binding:dependency:local-facts', role: 'fact-segment', instance: 'local-durable', implementation: 'segment:local', refs: ['part-two:run-input', 'segment:local'] },
    { reference: 'binding:dependency:replication-peer', role: 'fact-segment', instance: 'replication', implementation: 'segment:local', refs: ['part-two:run-input', 'segment:local'] },
    { reference: 'binding:dependency:clock', role: 'verification-clock', instance: 'clock', implementation: 'clock:verification', refs: ['clock:trust', 'clock:verification'] },
    { reference: 'binding:dependency:route', role: 'conversation-route', instance: 'route', implementation: 'intake:route', refs: ['intake:route', 'platform:telegram', references.binding] },
    { reference: 'binding:dependency:delivery-evidence', role: 'delivery-evidence-service', instance: 'evidence', implementation: 'evidence:telegram', refs: ['evidence:telegram', 'platform:telegram'] },
  ];
  return rows.map(row => {
    const fields = { type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a', scope,
      role: row.role, instance: row.instance, implementation: row.implementation, owner: installationRoleOwners[row.role],
      generation: '', references: [...row.refs].sort(), validUntil: 'not-time-bound' };
    return { reference: row.reference, fields };
  });
}

/** Chooser for fixedRecordFixture: the whole production package (selections + signer), plus the Six lease and
 * reservation the responder and fence rows reference. Runs before the package is approved, so every
 * referenced fact is real owner history by the time any selection is recorded. */
export function productionPackageRecords(input: { generation: string; scopeId: string; boundary: import('../../src/index.js').DecodeContext & import('../../src/index.js').BoundaryContext; fixture: IntakeFixture }): Json[] {
  const { generation, scopeId, boundary, fixture: f } = input;
  
  const context = f.context;
  const host: TransportHost = { domain: 'conversation:production', machine: 'machine-a', incarnation: 'worker:production',
    authorityIncarnation: 'authority:production', principal: f.f.alice, scope: f.f.scope, maxLeaseTerm: 1000, budget: 100,
    monotonic: () => 100, current: () => ({ decode: context.decode, clock: f.f.clock(100), generation: context.decode.register.generation, stopped: false }) };
  const known = new Set(context.schemas.map(schema => `${schema.kind}:${schema.version}`));
  Object.assign(context, { schemas: [...context.schemas, ...transportSchemas(host).filter(schema => !known.has(`${schema.kind}:${schema.version}`))],
    ownedBodies: [...context.ownedBodies ?? [], ...value(registerTransportBodies(host, f.f.c))] });
  const store = createFactStore(context, f.storage);
  const api = createTransportAuthority(host, createTransportSpine(host, { context, privateKey }, store), f.f.c);
  const token = value(api.acquire('acquire', '', 500)); 
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'loop-policy:production', maxAttempts: 3,
    minDelay: 10, maxDuration: 100, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, f.f.c));
  const run = { owner: 'part-five' as const, name: 'Run' as const, id: 'run:production' };
  value(api.schedule('schedule', token, run, policy)); 
  value(api.reserve({ command: 'reserve', fence: token, request: { owner: 'part-eight', name: 'EffectRequest', id: 'request:production' },
    attempt: 'attempt:1', payloadDigest: `sha256:${'a'.repeat(64)}`, charge: 20, run, semanticMessage: 'message:five-owned', durability: 'local-durable', replicas: 0 }));
  const facts = f.facts();
  const lease = facts.filter(fact => fact.kind === 'transport-Lease').at(-1)!;
  const reservation = facts.filter(fact => fact.kind === 'transport-AdmissionReservation').at(-1)!;
  const binding = facts.find(fact => fact.kind === 'conversation-binding')!;
  const selections = selectionRows(scopeId, { binding: binding.id, reservation: reservation.id })
    .map(row => { const fields = { ...row.fields, generation }; return { reference: row.reference, record: { ...fields, id: digest(fields) } as Json }; });
  const signerRef = { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'machine-signer' };
  const bytes = JSON.stringify({ installation: 'host', machine: 'machine-a', genesisHash: context.genesis.hash, generation,
    trustRoots: [context.keys[0]!.publicKey], key: context.keys[0], signer: signerRef });
  const bootstrap = value(loadProductionBootstrap({ root: '/tmp/installed-root', bootstrapLocator: '/tmp/operator/bootstrap.json',
    expectedBootstrapDigest: hashBytes(bytes) }, { read: locator => f.f.success({ realPath: locator, bytes }) }, boundary));
  const signerFields = { type: 'ProductionSignerReference', schemaVersion: 1, installation: 'host', machine: 'machine-a',
    signer: signerRef, keySet: context.keys[0]!.id, generation, bootstrapDigest: bootstrap.digest };
  const signer = { ...signerFields, id: digest(signerFields) } as Json;
  prepared.set(f, { bootstrap, transport: { host, api }, lease, reservation, binding, selections, signer });
  return [...selections.map(row => row.record), signer];
}

export function preparedInstallation(f: RuntimeFixture): PreparedInstallation { return preparedInstallationFor(f.intake); }
export function preparedInstallationFor(intake: IntakeFixture): PreparedInstallation {
  const ready = prepared.get(intake);
  if (!ready) throw new Error('production installation package was not prepared for this fixture');
  return ready;
}

type RuntimeFixture = ReturnType<typeof assemblyRuntimeFixture>;
const h = (c: string) => `sha256:${c.repeat(64)}` as const;
const fact = (reference: string, expectedKind: string) => ({ reference, expectedKind, required: true as const });

export function productionBindingSet(scope = productionScope): AssemblyProductionBindingSet {
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

export function productionPublicPorts(scope = productionScope): AssemblyManifest['publicPorts'] {
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
    lease: { id: 'lease:authority', port: f.transport.api as unknown as AssemblyProductionComposition['lease']['port'] },
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
          case 'register': return ok({ ...common, name: input.name, generation: f.host.current().generation });
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

/** Owner-produced binding evidence (P10-SI-07/20). Selection rows go through Ten's real producer against the
 * independently approved package; direct-owner rows resolve to the facts their owners already appended
 * (Three's generation record, Four's conversation binding, Six's lease, Ten's signer reference). Returns the
 * symbolic reference -> fact id map; a caller-supplied reference that is not symbolic passes through unchanged. */
export function appendProductionBindingFacts(f: RuntimeFixture, binding: AssemblyProductionBindingSet): ReadonlyMap<string, string> {
  const ready = preparedInstallation(f), installed = f.installed;
  f.generation(installed.record.generation);
  // The signer body was registered against this exact admission object; its origin guard is keyed on it.
  const admission: ProductionSignerAdmission = f.signerAdmission;
  // The live host context knows every kind in this history (owner history plus the assembly rows appended at boot).
  const writer: InstallationRecordWriter = { ...installed.writer, context: f.host.current().facts, store: f.store };
  
  const resolved = new Map<string, string>();
  for (const row of ready.selections) { resolved.set(row.reference, value(recordInstallationSelection(row.record, writer)).id); }
  resolved.set('binding:dependency:identity-keys', value(recordProductionSignerReference(ready.signer, { ...writer, admission })).id); 
  resolved.set('binding:dependency:register', installed.admission.generationFact);
  resolved.set('binding:dependency:lease', ready.lease.id);
  resolved.set('binding:dependency:fence', ready.lease.id);
  resolved.set('binding:dependency:conversation-binding', ready.binding.id);
  for (const row of bindingFacts(binding)) if (!resolved.has(row.reference) && !value(f.c.history!.lookup(row.reference)))
    throw new Error(`production binding reference has no owner-produced fact: ${row.reference}`);
  return resolved;
}

function resolveBindingReferences(binding: AssemblyProductionBindingSet, resolved: ReadonlyMap<string, string>): AssemblyProductionBindingSet {
  const translate = <T extends { fact: { reference: string } }>(row: T): T => ({ ...row, fact: { ...row.fact, reference: resolved.get(row.fact.reference) ?? row.fact.reference } });
  return { ...binding,
    surface: { adapter: translate(binding.surface.adapter), challengeVerifier: translate(binding.surface.challengeVerifier) },
    verifiedActIntake: translate(binding.verifiedActIntake),
    minimalPlane: { folds: binding.minimalPlane.folds.map(translate), sourceOnlyReplay: translate(binding.minimalPlane.sourceOnlyReplay) },
    minimalResponder: translate(binding.minimalResponder), dependencies: binding.dependencies.map(translate),
    lifecycle: { cut: translate(binding.lifecycle.cut), recovery: translate(binding.lifecycle.recovery) },
    deliveryWitness: translate(binding.deliveryWitness) };
}

export function installProduction(f: RuntimeFixture, requested = productionBindingSet(), options: { uncheckedManifest?: boolean } = {}) {
  const binding = resolveBindingReferences(requested, appendProductionBindingFacts(f, requested));
  const current = f.host.current().generation;
  const withGeneration = <T extends object>(input: T): T => 'generation' in input ? { ...input, generation: current } : input;
  const conformance = value(f.runtime.record('AdapterConformance', withGeneration(assemblyInput('AdapterConformance'))));
  const policy = value(f.runtime.record('StoreCustodyPolicy', withGeneration(assemblyInput('StoreCustodyPolicy'))));
  const harness = value(f.runtime.record('HarnessObservation', withGeneration(assemblyInput('HarnessObservation'))));
  const access = value(f.runtime.record('StorageAccessObservation', withGeneration(assemblyInput('StorageAccessObservation'))));
  const rows = value(f.runtime.inspect());
  const factId = (id: string) => rows.find(row => row.record.id === id)!.fact.id;
  const conformanceFact = factId(conformance.id), policyFact = factId(policy.id), harnessFact = factId(harness.id), accessFact = factId(access.id);
  // Records this helper itself creates carry the host's current generation (the real register generation
  // once owner-produced bindings are installed), never the generic fixture literal.
  const manifestInput = { ...assemblyInput('AssemblyManifest'), id: 'manifest:production', generation: f.host.current().generation,
    publicPorts: productionPublicPorts(binding.scope), productionBindings: [binding], dependencyFacts: [conformanceFact, policyFact] };
  const manifest = options.uncheckedManifest
    ? value(decodeAssemblyManifest(manifestInput, { ...f.c, validateReferences: false }))
    : value(f.runtime.record('AssemblyManifest', manifestInput));
  if (options.uncheckedManifest) value(f.spine.append(manifest));
  const manifestFact = value(f.runtime.inspect()).find(row => row.record.id === manifest.id)!.fact.id;
  const admission = value(f.runtime.record('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), id: 'admission:production', sourceGeneration: f.host.current().generation,
    manifest: manifest.id, scope: binding.scope, conformance: [conformanceFact], isolationEvidence: [harnessFact],
    custodyEvidence: [accessFact], dependencyFacts: [manifestFact, conformanceFact, policyFact] }));
    return { binding, manifest, admission, manifestFact, conformanceFact, policyFact, harnessFact, accessFact };
}

export function assertDependencyRoster(binding: AssemblyProductionBindingSet): void {
  if (binding.dependencies.map(row => row.name).join(',') !== requiredMinimalDependencies.join(','))
    throw new Error('fixture dependency order differs from Part Eleven');
}
