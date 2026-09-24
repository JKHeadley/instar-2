import { decodeAssemblyManifest } from '../../src/assembly/index.js';
import type { AssemblyManifest, AssemblyProductionBindingSet, AssemblyProductionComposition } from '../../src/assembly/index.js';
import { minimalPlaneProjections, requiredMinimalDependencies } from '../../src/operator/index.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture, productionReferenceKinds } from './round8-extended-fixture.js';
import { value } from '../facts/fixtures.js';
import { fixedRecordFixture } from './fixed-installation-contract.test.js';
import { installationRoleOwners, installationSelectionSlots, recordInstallationSelectionSet } from '../../src/assembly/index.js';
import { capacityPolicyArtifact, createTransportAuthority, createTransportSpine, registerTransportBodies,
  transportSchemas } from '../../src/transport/index.js';
import type { CapacityParentPolicy, CapacityVector, TransportAuthority, TransportHost } from '../../src/transport/index.js';
import { authorizationRequestDigest, canonical, decodeMeasurement } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { privateKey } from '../facts/fixtures.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import { loadProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import type { VerifiedProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import { productionSignerReferenceSchemas, recordProductionSignerReference,
  registerProductionSignerReferenceBody } from '../../src/assembly/production-signer-reference.js';

type RuntimeFixture = ReturnType<typeof assemblyRuntimeFixture>;
const ownerAuthorities = new WeakMap<RuntimeFixture, TransportAuthority>();
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
    lease: { id: 'lease:authority', port: ownerAuthorities.get(f) ?? { inspect: noValue, acquire: noValue, renew: noValue, release: noValue,
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

export function prepareProductionSelectionSet(f: RuntimeFixture, binding: AssemblyProductionBindingSet,
  options: { capacityHolder?: 'bob'; installation?: (generation: string) => import('../../src/assembly/production-installation.js').ProductionInstallation } = {}) {
  if (!f.ownerFixture) throw new Error('production set fixture requires the same owner source store');
  const baseline = productionBindingSet(binding.scope);
  let capacityFact = '', conversationFact = '', leaseFact = '';
  let bootstrap!: VerifiedProductionBootstrap;
  let capacityAuthority!: TransportAuthority;
  let capacityPolicy!: CapacityParentPolicy;
  const owners: Record<string, string> = { 'part-two': 'facts', 'part-four': 'intake', 'part-five': 'rungraph',
    'part-nine': 'verification', 'part-ten': 'assembly', 'part-eleven': 'operator', 'part-twelve': 'conversation' };
  const implementations = new Map<string, string>();
  const slot = (role: string, instance: string) => `${role}:${instance}`;
  implementations.set(slot('operator-surface', 'operator-surface-registration'), binding.surface.adapter.implementation);
  implementations.set(slot('challenge-verifier', 'operator-challenge-verifier-binding'), binding.surface.challengeVerifier.implementation);
  implementations.set(slot('verified-act-intake', 'intake-verified-act-binding'), binding.verifiedActIntake.implementation);
  for (const row of binding.minimalPlane.folds) implementations.set(slot('minimal-plane-fold', row.projection), row.implementation);
  implementations.set(slot('minimal-plane-replay', 'minimal-plane-replay-binding'), binding.minimalPlane.sourceOnlyReplay.implementation);
  implementations.set(slot('minimal-responder', 'minimal-responder-binding'), binding.minimalResponder.implementation);
  implementations.set(slot('prerequisite-cut', 'prerequisite-cut'), binding.lifecycle.cut.implementation);
  implementations.set(slot('prerequisite-recovery', 'prerequisite-recovery'), binding.lifecycle.recovery.implementation);
  implementations.set(slot('delivery-witness', 'platform-delivery-witness-binding'), binding.deliveryWitness.implementation);
  const dependency = (name: string) => binding.dependencies.find(row => row.name === name)!.name;
  for (const [role, instance, name] of [
    ['fact-segment', 'fact-local-durable-segment', 'local-facts'],
    ['fact-segment', 'fact-replication-receipt', 'replication-peer'],
    ['verification-clock', 'clock-source', 'clock'],
    ['conversation-route', 'conversation-route', 'route'],
    ['delivery-evidence-service', 'delivery-evidence-service', 'delivery-evidence'],
  ]) implementations.set(slot(role!, instance!), dependency(name!));
  implementations.set(slot('scope-protection', 'protected'), 'installation-replay');
  const declarationOwners = new Map<string, string>();
  const add = (id: string, owner: string) => { if (id !== 'installation-artifacts' && id !== 'installation-replay'
    && id !== 'installation-replay-matrix') declarationOwners.set(id, owner); return id; };
  const support = (owner: string, name: string) => add(`fixture:${owner}:${name}`, owner);
  const refs = (role: string, instance: string): string[] => {
    const owner = installationRoleOwners[role as keyof typeof installationRoleOwners];
    const implementation = add(implementations.get(slot(role, instance))!, owner);
    switch (role) {
      case 'operator-surface': case 'verified-act-intake': return [implementation];
      case 'challenge-verifier': return [implementation, support('part-nine', 'trust'), support('part-nine', 'administration')];
      case 'minimal-plane-fold': return [implementation, support('part-two', `fold:${instance}`)];
      case 'minimal-plane-replay': return [implementation, 'installation-replay-matrix'];
      case 'minimal-responder': return [implementation, support('part-five', 'minimal-run-policy'), capacityFact];
      case 'conversation-route': return [implementation, support('part-twelve', 'route-identity'), conversationFact];
      case 'delivery-witness': case 'delivery-evidence-service': return [implementation, support('part-twelve', 'delivery-stage')];
      case 'scope-protection': return [implementation, 'installation-artifacts'];
      default: return [implementation, support(owner, `${role}:${instance}:support`)];
    }
  };
  for (const [role, instance] of installationSelectionSlots)
    if (role !== 'fact-segment' || instance !== 'fact-replication-receipt') refs(role, instance);
  refs('scope-protection', 'protected');
  const fixed = fixedRecordFixture(({ generation, scopeId, boundary }) => {
    const rows = installationSelectionSlots
      .filter(([role, instance]) => role !== 'fact-segment' || instance !== 'fact-replication-receipt')
      .map(([role, instance]) => {
        const fields = { type: 'InstallationSelection' as const, schemaVersion: 1 as const,
          installation: 'host', machine: 'machine-a', scope: scopeId, role, instance,
          implementation: implementations.get(slot(role, instance))!, owner: installationRoleOwners[role as keyof typeof installationRoleOwners],
          generation, references: refs(role, instance).sort(), validUntil: 'not-time-bound' };
        return { ...fields, id: value(canonical(fields)).hash };
      });
    const protection = { type: 'InstallationSelection' as const, schemaVersion: 1 as const,
      installation: 'host', machine: 'machine-a', scope: scopeId, role: 'scope-protection' as const,
      instance: 'protected', implementation: 'installation-replay', owner: 'part-ten' as const,
      generation, references: refs('scope-protection', 'protected').sort(), validUntil: 'not-time-bound' };
    rows.push({ ...protection, id: value(canonical(protection)).hash });
    rows.sort((a, b) => a.role < b.role ? -1 : a.role > b.role ? 1
      : a.instance < b.instance ? -1 : a.instance > b.instance ? 1 : 0);
    const fields = { type: 'InstallationSelectionSet' as const, schemaVersion: 1 as const,
      installation: 'host', machine: 'machine-a', scope: scopeId, generation, rows };
    const signer = { type: 'SecretRef' as const, schemaVersion: 1 as const, vault: 'vault', name: 'machine-signer' };
    const bytes = JSON.stringify({ installation: 'host', machine: 'machine-a', genesisHash: f.ownerFixture!.context.genesis.hash,
      generation, trustRoots: [f.ownerFixture!.context.keys[0]!.publicKey],
      key: f.ownerFixture!.context.keys[0], signer });
    bootstrap = value(loadProductionBootstrap({ root: '/tmp/installed-root', bootstrapLocator: '/tmp/operator/bootstrap.json',
      expectedBootstrapDigest: hashBytes(bytes) }, { read: locator => f.success({ realPath: locator, bytes }) }, boundary));
    const signerFields = { type: 'ProductionSignerReference' as const, schemaVersion: 1 as const,
      installation: 'host', machine: 'machine-a', signer, keySet: f.ownerFixture!.context.keys[0]!.id,
      generation, bootstrapDigest: bootstrap.digest };
    return [{ ...fields, id: value(canonical(fields)).hash } as Json,
      { ...signerFields, id: value(canonical(signerFields)).hash } as Json];
  }, {
    fixture: f.ownerFixture, scopeId: binding.scope,
    ...(options.installation ? { installation: options.installation } : {}),
    extraSources: owner => [...declarationOwners].map(([id, roleOwner]) => ({
      declaration: owner.r.declaration(id), path: `src/${owners[roleOwner]}/fixture.ts`, symbol: id })),
    beforePackage: ({ fixture: owner, store, boundary, generation }) => {
      conversationFact = owner.facts().find(fact => fact.kind === 'conversation-binding')!.id;
      const holder = options.capacityHolder === 'bob' ? owner.f.bob : owner.f.alice;
      let grantFact = owner.facts().find(fact => fact.kind === 'genesis-grant'
        && (fact.body as { grant?: { grantee?: { id?: string } } }).grant?.grantee?.id === holder.id);
      if (!grantFact && options.capacityHolder === 'bob') {
        const heldGrant = owner.f.grant({ id: 'live-input-agent-grant', grantee: holder });
        owner.syncCaptures();
        const grantContext = { ...owner.context, decode: { ...owner.context.decode, provenance: heldGrant.source } };
        grantFact = value(authorAndAppend({ kind: 'genesis-grant', schemaVersion: 1, machine: 'machine-a',
          principal: JSON.parse(JSON.stringify(owner.f.alice)),
          provenance: JSON.parse(JSON.stringify(heldGrant.source)),
          at: JSON.parse(JSON.stringify(owner.f.now)), body: { grant: JSON.parse(JSON.stringify(heldGrant)) },
          required: [] }, grantContext, createFactStore(grantContext, owner.storage), privateKey)).fact;
        Object.assign(owner.context, { grants: [...owner.context.grants, { factId: grantFact.id, grant: heldGrant }] });
      }
      const grant = grantFact!.id;
      const amount = (quantity: number) => ({ quantity, unit: 'charge', window: 'installation' });
      const vector = (quantity: number): CapacityVector => ({ worker: amount(quantity), memory: amount(quantity),
        storage: amount(quantity), queue: amount(quantity), transport: amount(quantity), effect: amount(quantity) });
      const clock = (instant: number) => value(decodeMeasurement('clock',
        { ...owner.f.now, value: instant, at: instant }, owner.context.decode));
      const fields = { owner: 'part-ten' as const, installation: 'host', machine: 'machine-a',
        scope: binding.scope, generation, ordinaryDomain: options.capacityHolder === 'bob' ? 'conversation:1' : 'conversation:fixture',
        responderDomain: 'responder:fixture', grant, parent: vector(options.capacityHolder === 'bob' ? 1000 : 100), required: vector(20),
        validUntil: clock(450) };
      const artifact = capacityPolicyArtifact(fields);
      owner.f.capture(value(canonical(fields)).bytes, artifact); owner.syncCaptures();
      const requestDigest = authorizationRequestDigest({ approver: owner.f.alice,
        action: { kind: 'work', scope: owner.f.scope }, artifact, base: 'host' });
      Object.assign(owner.context, { decode: { ...owner.context.decode, currentBase: 'host', artifact } });
      const earlierGrants = [...owner.context.grants];
      const act = owner.verifiedAct({ request: { requestId: 'request:capacity-policy', artifact, base: 'host', requestDigest },
        generation: { owner: 'part-three', name: 'RegisterGeneration', id: generation } });
      const approval = value(owner.port().admitVerifiedAct(act.input)).fact.id;
      Object.assign(owner.context, { grants: [...earlierGrants, ...owner.context.grants] });
      const policy = { ...fields, reference: artifact, approval };
      capacityPolicy = policy;
      const host: TransportHost = { domain: policy.ordinaryDomain, machine: 'machine-a',
        incarnation: options.capacityHolder === 'bob' ? 'incarnation:one' : 'worker:fixture',
        authorityIncarnation: options.capacityHolder === 'bob' ? 'authority:1' : 'authority:fixture', principal: holder,
        scope: owner.f.scope, maxLeaseTerm: options.capacityHolder === 'bob' ? 1000 : 500,
        budget: options.capacityHolder === 'bob' ? 1000 : 100, capacityPolicy: policy,
        monotonic: () => owner.f.now.value, current: () => ({ decode: owner.context.decode, clock: owner.f.now,
          generation: { owner: 'part-three', name: 'RegisterGeneration', id: generation }, stopped: false }) };
      Object.assign(owner.context, { schemas: [...owner.context.schemas, ...transportSchemas(host)],
        ownedBodies: [...owner.context.ownedBodies!, ...value(registerTransportBodies(host, boundary))] });
      const spine = createTransportSpine(host, { context: owner.context, privateKey }, store);
      const authority = createTransportAuthority(host, spine, boundary);
      capacityAuthority = authority;
      const fence = value(authority.acquire('capacity:lease', '', 450));
      leaseFact = value(authority.inspect()).find(row => row.record.type === 'Lease')!.fact.id;
      const expected = value(authority.inspect()).at(-1)!.fact.id;
      value(authority.reserveCapacity({ command: 'capacity:reserve', expected, fence,
        installation: 'host', scope: binding.scope, instance: 'minimal-responder-binding',
        approval, grant, allocation: policy.required, validUntil: clock(400) }));
      capacityFact = value(authority.inspectCapacity()).heads[0]!.fact;
    },
  });
  const set = value(recordInstallationSelectionSet(fixed.records[0]!, fixed.writer));
  f.setGeneration(fixed.f.context.decode.register.generation.id);
  const signerAdmission = { ...fixed.admission, bootstrap };
  Object.assign(f.ownerFixture.context, { schemas: [...f.ownerFixture.context.schemas,
    ...productionSignerReferenceSchemas(f.ownerFixture.f.scope)],
    ownedBodies: [...f.ownerFixture.context.ownedBodies!, value(registerProductionSignerReferenceBody(signerAdmission))] });
  const signerFact = value(recordProductionSignerReference(fixed.records[1]!,
    { ...fixed.writer, admission: signerAdmission }));
  Object.assign(f.c, { ...f.ownerFixture.context, history: f.c.history, validateReferences: true });
  const selected = (row: { reference: string; expectedKind: string; required: true }, original: string) =>
    row.reference === original ? { reference: set.id, expectedKind: 'assembly-InstallationSelectionSet', required: true as const } : row;
  const prepared: AssemblyProductionBindingSet = {
    ...binding,
    surface: { adapter: { ...binding.surface.adapter, fact: selected(binding.surface.adapter.fact, baseline.surface.adapter.fact.reference) },
      challengeVerifier: { ...binding.surface.challengeVerifier,
        fact: selected(binding.surface.challengeVerifier.fact, baseline.surface.challengeVerifier.fact.reference) } },
    verifiedActIntake: { ...binding.verifiedActIntake,
      fact: selected(binding.verifiedActIntake.fact, baseline.verifiedActIntake.fact.reference) },
    minimalPlane: { folds: binding.minimalPlane.folds.map((row, index) => ({ ...row,
      fact: selected(row.fact, baseline.minimalPlane.folds[index]!.fact.reference) })),
      sourceOnlyReplay: { ...binding.minimalPlane.sourceOnlyReplay,
        fact: selected(binding.minimalPlane.sourceOnlyReplay.fact, baseline.minimalPlane.sourceOnlyReplay.fact.reference) } },
    minimalResponder: { ...binding.minimalResponder,
      fact: selected(binding.minimalResponder.fact, baseline.minimalResponder.fact.reference) },
    dependencies: binding.dependencies.map((row, index) => ({ ...row,
      fact: ['local-facts', 'clock', 'replication-peer', 'route', 'delivery-evidence'].includes(row.name)
        ? selected(row.fact, baseline.dependencies[index]!.fact.reference)
        : row.name === 'conversation-binding' && row.fact.reference === baseline.dependencies[index]!.fact.reference
          ? { reference: conversationFact, expectedKind: 'conversation-binding', required: true as const }
        : row.name === 'lease' && row.fact.reference === baseline.dependencies[index]!.fact.reference
          ? { reference: leaseFact, expectedKind: 'transport-Lease', required: true as const }
        : row.name === 'fence' && row.fact.reference === baseline.dependencies[index]!.fact.reference
          ? { reference: leaseFact, expectedKind: 'transport-Lease', required: true as const }
        : row.name === 'register' && row.fact.reference === baseline.dependencies[index]!.fact.reference
          ? { reference: fixed.generationFact.id, expectedKind: 'generation-record', required: true as const }
        : row.name === 'identity-keys' && row.fact.reference === baseline.dependencies[index]!.fact.reference
          ? { reference: signerFact.id, expectedKind: 'assembly-ProductionSignerReference', required: true as const }
        : row.fact })),
    lifecycle: { cut: { ...binding.lifecycle.cut, fact: selected(binding.lifecycle.cut.fact, baseline.lifecycle.cut.fact.reference) },
      recovery: { ...binding.lifecycle.recovery,
        fact: selected(binding.lifecycle.recovery.fact, baseline.lifecycle.recovery.fact.reference) } },
    deliveryWitness: { ...binding.deliveryWitness,
      fact: selected(binding.deliveryWitness.fact, baseline.deliveryWitness.fact.reference) },
  };
  return { prepared, fixed, set, leaseFact, capacityFact, conversationFact, capacityAuthority, capacityPolicy };
}

export function appendProductionBindingFacts(f: RuntimeFixture, binding: AssemblyProductionBindingSet): void {
  for (const row of bindingFacts(binding)) {
    if (value(f.c.history!.lookup(row.reference))) continue;
    f.appendReference(row.expectedKind, { id: row.reference });
  }
}

export function installProduction(f: RuntimeFixture, binding = productionBindingSet(), options: { uncheckedManifest?: boolean } = {}) {
  const prepared = prepareProductionSelectionSet(f, binding);
  ownerAuthorities.set(f, prepared.capacityAuthority);
  binding = prepared.prepared;
  appendProductionBindingFacts(f, binding);
  const conformance = value(f.runtime.record('AdapterConformance', assemblyInput('AdapterConformance')));
  const policy = value(f.runtime.record('StoreCustodyPolicy', assemblyInput('StoreCustodyPolicy')));
  const harness = value(f.runtime.record('HarnessObservation', assemblyInput('HarnessObservation')));
  const access = value(f.runtime.record('StorageAccessObservation', assemblyInput('StorageAccessObservation')));
  const rows = value(f.runtime.inspect());
  const factId = (id: string) => rows.find(row => row.record.id === id)!.fact.id;
  const conformanceFact = factId(conformance.id), policyFact = factId(policy.id), harnessFact = factId(harness.id), accessFact = factId(access.id);
  const manifestInput = { ...assemblyInput('AssemblyManifest'), id: 'manifest:production',
    generation: f.host.current().generation,
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
