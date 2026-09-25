// @ts-nocheck -- U4-G fixture admissions are enumerated in production-holds.ts.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { boundary as assemblyBoundary } from '../../src/assembly/boundary.js';
import { canonical, decode } from '../../src/index.js';
import { createFactStore, authorAndAppend } from '../../src/facts/index.js';
import { intakeWorkRegistration, intakeStopRegistration } from '../../src/intake/index.js';
import { admitTelegramAdapter, createTelegramIntakeAdapter, extractTelegramUpdate } from '../../src/conversation/index.js';
import { createVerificationRuntime, createVerificationSpine, verificationSchemas, registerVerificationBodies, createEffectAssessmentPort } from '../../src/verification/index.js';
import { providerJudgmentSchemas, registerProviderJudgmentBodies } from '../../src/judgment/index.js';
import { decodeOutboundMessage, providerEffectSchemas, providerEffectMigrations, registerProviderEffectBodies } from '../../src/effects/index.js';
import { bootProductionApplication } from '../../src/assembly/production-application.js';
import { createProductionTelegramCustodian } from '../../src/assembly/production-telegram.js';
import { createProductionJudgmentCaptures } from '../../src/assembly/production-captures.js';
import { productionInstallationSchemas, registerProductionInstallationBody, recordProductionInstallation } from '../../src/assembly/production-installation.js';
import { productionBindingHolds } from '../../src/assembly/production-holds.js';
import { requiredMinimalDependencies } from '../../src/operator/index.js';
import { conversationFixture } from '../conversation/fixture.js';
import { operatorFixture } from '../operator/fixture.js';
import { createProductionBootOwnerFixture } from './production-boot-owner-fixture.js';
import { productionBindingSet, productionComposition, prepareProductionSelectionSet,
  appendProductionBindingFacts, productionPublicPorts } from './production-fixture.js';
import { assemblyInput } from './fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { value, privateKey, json } from '../facts/fixtures.js';
import { productionStorageIO, createProductionNativeContextIO } from '../../scripts/production-boot-io.mjs';
import { createProductionRunAdmission } from '../../src/transport/index.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { createFixedPeerReplication, receiveFixedPeerRequest } from '../../src/assembly/production-replication.js';

export const fixtureAdmissionNames = productionBindingHolds.join(', ');
export function installedFixtureHost(root, route, options = {}) {
  const getMe = readFileSync('tests/assembly/telegram-recorded/getMe.json', 'utf8');
  const poll = readFileSync('tests/assembly/telegram-recorded/poll-0.json', 'utf8');
  const sent = readFileSync('tests/assembly/telegram-recorded/sendMessage.json', 'utf8');
  const bot = JSON.parse(getMe).result, t = conversationFixture({ botId: String(bot.id), skipInitialAdmission: true });
  const secret = name => ({ type: 'SecretRef', schemaVersion: 1, vault: 'vault', name });
  const initialRecord = { type: 'ProductionInstallation', schemaVersion: 1, id: 'host', generation: 'generation:fixture',
    botDeclaration: 'phone-surface', providerRoute: 'route', machineIdentity: 'machine-a', storageRoot: root,
    botCredential: t.declaration.token, providerCredential: secret('provider'), storageCredential: secret('storage') };
  const prepared = prepareProductionSelectionSet({ ownerFixture: t.intake, setGeneration: () => {},
    success: t.intake.f.success, c: {} },
    productionBindingSet(), { capacityHolder: 'bob', peerBacked: true,
      installation: generation => ({ ...initialRecord, generation }) });
  const c = { ...t.intake.context.decode, site: t.intake.f.c.site, preserved: t.intake.f.c.preserved };
  const record = { ...initialRecord, generation: c.register.generation.id };
  // Offline channel authentication and failure domain are simulated. The receiver
  // has a different encrypted store identity, persisted under this fixture root.
  const peerDescriptor = { installation: record.id, studio: record.machineIdentity, laptop: 'm_cc2ec651a91f',
    store: 'store:fixture-laptop', epoch: 0, trust: 'offline-fixture-channel', custody: 'offline-fixture-receiver',
    captureReferences: Object.keys(t.intake.context.captures),
    capturePrefixes: ['sha256:', 'message:', 'record:', 'capture:', 'live-input-capture:', 'effect-capture:', 'judgment-capture:'], limits: {
      maxRequestBytes: 32 * 1024 * 1024, maxResponseBytes: 1024 * 1024, maxFacts: 4096,
      maxCaptures: 1024, maxCaptureBytes: 2 * 1024 * 1024, maxDiskBytes: 128 * 1024 * 1024,
      maxQueue: 1, timeoutMs: 3000, maxAttempts: 1 } };
  let peerConnected = true, channelPeer = peerDescriptor.laptop, replayLastResponse = false, incompleteResponse = false;
  let lastResponse;
  const peerAdapter = (local, context, boundary) => value(createFixedPeerReplication({
    descriptor: peerDescriptor, local, context, captures: () => context.captures,
    boundary, transport: { owner: 'part-ten', roundTrip: request => {
      if (!peerConnected) throw Error('offline receiver channel disconnected');
      const receiver = value(openProductionStorage({ root: join(root, 'fixture-peer'), machine: peerDescriptor.laptop,
        key: Buffer.alloc(32, 23), policy: peerDescriptor.custody, store: peerDescriptor.store,
        context: boundary, io: productionStorageIO }));
      try {
        const response = value(receiveFixedPeerRequest({ request, descriptor: peerDescriptor,
          authenticatedStudio: peerDescriptor.studio, context, storage: receiver.segment,
          captures: receiver.captures, boundary,
          reserve: bytes => { if (bytes * 2 + 4096 > peerDescriptor.limits.maxDiskBytes) throw Error('receiver disk bound'); } }));
        const returned = replayLastResponse && lastResponse ? lastResponse
          : incompleteResponse ? { ...response, persistedFacts: response.persistedFacts.slice(0, -1) } : response;
        lastResponse = response;
        return { peer: channelPeer, trust: peerDescriptor.trust, response: returned };
      } finally { receiver.close(); }
    } } }));
  const currentPeer = (local, context, boundary, setFactId) => {
    const sourceRows = local.read();
    const source = sourceRows.find(row => row.id === setFactId);
    if (!source || source.kind !== 'assembly-InstallationSelectionSet') return false;
    const receipts = value(peerAdapter(local, context, boundary).durability.ensure(sourceRows));
    return receipts.some(row => row.fact.id === source.id && row.fact.contentHash === source.contentHash
      && !row.taint.length && row.durability.kind === 'replicated' && row.durability.n === 1
      && row.durability.peers.length === 1 && row.durability.peers[0] === peerDescriptor.laptop);
  };
  let activePeer = { local: t.intake.storage, context: t.intake.context, boundary: t.intake.f.c };
  let configured = false;
  const currentSelectedPeer = setFactId => currentPeer(activePeer.local, activePeer.context, activePeer.boundary, setFactId);
  const recoveryPeerPreflight = () => {
    if (!peerConnected || channelPeer !== peerDescriptor.laptop) return false;
    const receiver = value(openProductionStorage({ root: join(root, 'fixture-peer'), machine: peerDescriptor.laptop,
      key: Buffer.alloc(32, 23), policy: peerDescriptor.custody, store: peerDescriptor.store,
      context: t.intake.f.c, io: productionStorageIO }));
    try {
      return receiver.segment.read().some(row => row.id === prepared.set.id
        && row.contentHash === prepared.set.contentHash && row.kind === 'assembly-InstallationSelectionSet');
    } finally { receiver.close(); }
  };
  let underlyingAdmission, state;
  // Same landed Six fixture binding, constructed inside configure over the root.
  const admission = createProductionRunAdmission({ resolve: () => underlyingAdmission });
  const admittedDependencies = () => Object.fromEntries(requiredMinimalDependencies.map(name => [name,
    name === 'replication-peer' ? options.recovery && !configured
      ? recoveryPeerPreflight() : currentSelectedPeer(prepared.set.id) : true]));
  const host = { context: c, storageIO: options.storageIO ?? productionStorageIO, storagePolicy: 'StoreCustodyPolicy',
    store: 'store:fact', repairOwner: 'operator', runAdmission: admission, missingBindings: [],
    dependencies: admittedDependencies, resolveSecret: reference => reference.name === 'storage' ? '13'.repeat(32)
      : reference.name === 'provider' ? 'synthetic-recorded-provider-credential' : '8820318295:synthetic_recorded_test_only_value',
    configure(installation, storage) {
      const initial = t.intake.context;
      const intakeOwners = [value(intakeWorkRegistration(c, t.intake.deps.author.principal.id)),
        value(intakeStopRegistration(c, t.intake.deps.author.principal.id))];
      Object.assign(initial, { ownedBodies: [...(initial.ownedBodies ?? []).filter(row =>
        !intakeOwners.some(own => own.owner === row.owner && own.name === row.name)), ...intakeOwners] });
      const recovery = options.recovery ? { ...options.recovery,
        captureBytes: Object.fromEntries(options.recovery.captures.map(reference => {
          const bytes = storage.captures.read(reference); if (bytes === null) throw Error(`recovery capture absent: ${reference}`);
          return [reference, bytes];
        })) } : undefined;
      const physical = createProductionNativeContextIO(storage.captures);
      let nativeOrdinal = 0;
      const nativeIO = { ...physical, consume(reference, bytes) {
        const ordinal = ++nativeOrdinal;
        options.physicalCheckpoint?.(`native-before-consume-${ordinal}`, state);
        const result = physical.consume(reference, bytes);
        options.physicalCheckpoint?.(`native-after-consume-${ordinal}`, state);
        return result;
      } };
      const f = createProductionBootOwnerFixture(() => storage.segment, { minimal: true, deferred: true, recovery,
        prepareContext: recovery ? (context, assemblyHost, base) => {
          const dc = context.decode, boundary = { ...base.c, register: dc.register };
          const th = { ...assemblyHost, domain: 'conversation:1', incarnation: 'incarnation:one',
            authorityIncarnation: 'authority:1', monotonic: () => base.now.value,
            current: () => ({ decode: dc, clock: base.now, stopped: false, generation: dc.register.generation }) };
          const judgment = { transport: th, point: 'judgment', floor: base.floor,
            description: { owner: 'part-ten', provider: 'test-provider', model: 'model', route: 'route', automaticRetries: 0,
              maxInputBytes: 4096, maxOutputBytes: 4096, maxCharge: 20, measured: false, basis: 'recorded HTTP provider' },
            refreshFacts: () => base.success(undefined) };
          const verification = { ...assemblyHost, boundary, current: () => ({ decode: dc, clock: base.now,
            stopped: false, generation: dc.register.generation.id, facts: context, evidence: base.evidence }) };
          context.ownedBodies = context.ownedBodies.filter(row =>
            row.owner !== 'part-ten' || row.name !== 'ProductionInstallation');
          context.ownedBodies.push(...value(registerVerificationBodies(verification)),
            ...value(registerProviderJudgmentBodies(judgment, boundary)), ...value(registerProviderEffectBodies(th)),
            value(registerProductionInstallationBody({ ...dc, ...boundary })));
          context.migrations = providerEffectMigrations;
          const grantRoot = storage.segment.read().find(row => row.kind === 'note' && row.body.identity === 'installation-grant-root');
          if (grantRoot) context.grants.push({ factId: grantRoot.id, grant: t.intake.f.g });
        } : undefined,
        native: { captures: storage.captures, io: nativeIO },
        intake: { ...initial, facts: t.intake.facts(), opening: undefined }, capacityPolicy: prepared.capacityPolicy });
      underlyingAdmission = createProductionRunAdmission({ authority: f.effects.transport, store: f.store, context: f.c });
      f.deps.admission = admission;
      const context = f.ctx, dc = context.decode, boundary = { ...f.c, register: dc.register };
      activePeer = { local: storage.segment, context, boundary };
      configured = true;
      f.deps.context.evidenceSources.settlement = f.bob.provenance.adapter;
      const captures = value(createProductionJudgmentCaptures({ custody: storage.captures, context: boundary,
        capacity: 1048576, metadata: context.captures, decodeCaptures: dc.captures }));
      for (const [reference, bytes] of Object.entries(dc.captures)) {
        context.captures[reference] ??= { bytes, hash: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), byteLength: Buffer.byteLength(bytes), status: 'available' };
        storage.captures.preserve(reference, bytes);
      }
      f.owners.host.capture = bytes => captures.put(bytes, 262144);
      const th = { ...f.owners.host, domain: 'conversation:1', authorityIncarnation: 'authority:1',
        monotonic: () => f.deps.clock().value, current: () => ({ ...f.owners.host.current(), generation: f.run.generation }) };
      const judgmentHost = { transport: th, point: 'judgment', floor: f.floor,
        description: { owner: 'part-ten', provider: 'test-provider', model: 'model', route: 'route', automaticRetries: 0,
          maxInputBytes: 4096, maxOutputBytes: 4096, maxCharge: 20, measured: false, basis: 'recorded HTTP provider' },
        refreshFacts: () => f.success(undefined) };
      const vh = { machine: f.host.machine, principal: f.host.principal, scope: f.host.scope, boundary,
        current: () => ({ decode: dc, clock: f.deps.clock(), stopped: false, generation: f.run.generation.id,
          facts: { ...context, facts: value(f.store.read()) }, evidence: f.evidence }) };
      const registrations = [...value(registerVerificationBodies(vh)),
        ...value(registerProviderJudgmentBodies(judgmentHost, boundary)), ...value(registerProviderEffectBodies(f.owners.host)),
        value(registerProductionInstallationBody({ ...dc, ...boundary }))];
      Object.assign(context, { migrations: providerEffectMigrations,
        schemas: [...context.schemas.filter(s => !['verification-', 'judgment-provider-', 'effect-provider-'].some(prefix => s.kind.startsWith(prefix))
          && s.kind !== 'assembly-ProductionInstallation'), ...verificationSchemas(vh),
          ...providerJudgmentSchemas(judgmentHost), ...providerEffectSchemas(f.owners.host), ...productionInstallationSchemas(f.scope)],
        ownedBodies: [...context.ownedBodies.filter(row => !registrations.some(next => next.owner === row.owner && next.name === row.name)),
          ...registrations] });
      if (recovery) {
        for (const row of storage.segment.read().filter(row => row.kind === 'evidence-record')) {
          if (!f.evidence.some(e => e.id === row.body.evidence.id)) f.evidence.push(value(decode('Evidence', row.body.evidence, dc)));
        }
        const priorCurrent = f.owners.host.current;
        const versions = recovery.versions.map(version => ({ ...version, approvedIn: f.authorize({
          id: version.approvedIn.id, artifact: version.approvedIn.artifact, base: version.approvedIn.base }) }));
        f.owners.host.current = () => ({ ...priorCurrent(), versions });
      }
      const runtime = createVerificationRuntime(vh, createVerificationSpine(vh, { context, privateKey }, f.store));
      const realAssessment = createEffectAssessmentPort(vh, runtime);
      Object.assign(f.effects.composition.assessment, realAssessment);
      const declaration = { ...t.declaration, bot: { ...t.declaration.bot, username: `@${bot.username}` } };
      const identityPlan = value(t.verification.inspectCurrent()).find(row => row.record.type === 'VerificationPlan').record;
      const calls = [];
      const telegramCaptures = { owner: 'part-ten', read: reference => storage.captures.read(reference), preserve: (reference, bytes) => {
        const saved = storage.captures.preserve(reference, bytes);
        if (saved && !reference.includes(':sealed-getMe:')) {
          t.intake.f.captures[reference] = bytes; t.intake.syncCaptures();
          dc.captures[reference] = bytes;
          context.captures[reference] = { bytes, hash: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), byteLength: Buffer.byteLength(bytes), status: 'available' };
        }
        return saved;
      } };
      const api = value(createProductionTelegramCustodian({ context: c, declaration, credential: declaration.token,
        resolveSecret: host.resolveSecret, captures: telegramCaptures, machine: 'machine-a', now: () => f.deps.clock(), freshFor: 50,
        identityEvidence: { verification: t.verification, plan: identityPlan.id,
          arm: identityPlan.arms.find(arm => arm.required).id, generation: identityPlan.subject.generation },
        io: { invoke: request => {
          calls.push(request.method);
          if (request.method === 'sendMessage') options.physicalCheckpoint?.('reply-before-response', state);
          const response = { kind: 'response', status: 200,
            bytes: request.method === 'getMe' ? getMe : request.method === 'getUpdates' ? poll : sent };
          if (request.method === 'sendMessage') options.physicalCheckpoint?.('reply-after-response', state);
          return response;
        } } }));
      const admitted = value(admitTelegramAdapter(declaration, { ...t.admissionDependencies, api }));
      const intake = { ...t.intake.deps, context: () => ({ ...context, decode: { ...dc, provenance: t.intake.deps.author.principal.provenance } }), governance: t.governed.governance,
        adapter: createTelegramIntakeAdapter(admitted, api), storage: storage.segment,
        capture: { owner: 'part-ten', preserve: (bytes, at) => {
          const captured = value(t.intake.deps.capture.preserve(bytes, at));
          if (!telegramCaptures.preserve(captured.reference, bytes)) throw Error('intake custody failed');
          return f.success(captured);
        } }, dedupGeneration: () => ({ reference: dc.register.generation, kinds: context.schemas.map(s => s.kind),
          lineages: { 'machine-a': { head: storage.segment.read().at(-1)?.segment ?? null, observedAt: 100, closed: false } } }) };
      const binding = prepared.prepared;
      binding.dependencies = binding.dependencies.map(row => row.name === 'lease' ? { ...row,
        fact: { ...row.fact, reference: f.effects.leaseFact.id } } : row);
      const grounding = f.groundingFor({ scope: binding.scope });
      let placement;
      const originalStart = f.start;
      const originalMessage = f.effects.message;
      const originalPrepare = f.effects.prepare;
      const placeRun = () => {
        if (placement) return placement;
        const rows = value(f.store.read());
        const inputs = rows.filter(row => row.kind === 'intake-admitted');
        const material = rows.filter(row => row.kind === 'rungraph-briefing-material');
        const manifest = [...inputs.map(row => ({ class: 'message', reference: row.body.rawHash, digest: row.body.rawHash })),
          ...material.map(row => ({ class: row.body.class, reference: row.id, digest: row.contentHash }))];
        const message = f.effects.message(f.id, 'actual delivered Telegram input');
        const wireMessage = value(decodeOutboundMessage({ ...message, sourceResult: f.opening.id,
          context: { input: { fact: f.opening.id, reference: f.opening.body.rawHash, hash: f.opening.body.rawHash }, manifest } }, f.owners.host));
        const admitted = f.effects.prepare(wireMessage);
        const reservation = value(f.effects.transport.inspect()).find(row =>
          row.record.type === 'AdmissionReservation' && row.record.operation === admitted.operation);
        value(f.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'), id: 'production-live-input-launch',
          run: f.id, principal: 'w', machine: 'machine-a', incarnation: 'incarnation:one', harness: f.harnessId,
          artifactDigest: grounding.harness.describe().artifact, input: f.opening.id, inputDigest: f.opening.body.rawHash,
          processOperation: admitted.operation, resourceReferences: [reservation.fact.id] }));
        let pendingPlacementDelivery = true;
        f.effects.message = (...args) => pendingPlacementDelivery ? message : originalMessage(...args);
        f.effects.prepare = (...args) => {
          if (pendingPlacementDelivery) { pendingPlacementDelivery = false; return admitted; }
          return originalPrepare(...args);
        };
        f.start = (view, ground, key) => {
          const transition = originalStart(view, ground, key);
          transition.step.id = ground.body.record.step;
          transition.step.operation.digest = reservation.record.digest;
          transition.step.allocation.reservation.id = reservation.fact.id;
          transition.blockedOn.reference = transition.step.id;
          return transition;
        };
        placement = { admitted, reservation };
        return placement;
      };
      const bindings = productionComposition(f, binding, { peerReceipt: setFactId =>
        currentPeer(storage.segment, context, boundary, setFactId) });
      const effectPeer = peerAdapter(storage.segment, context, boundary);
      Object.assign(f.effects.composition, { durability: { owner: 'part-ten', ensure: requested =>
        assemblyBoundary('InstalledFixtureEffectDurability', requested.map(fact => fact.id), boundary, () => {
          // Five names a narrow effect closure. The selected set has other causal
          // ancestors, so verify the complete current source before returning C's
          // exact receipts for only the facts Five requested.
          const current = storage.segment.read();
          const receipts = value(effectPeer.durability.ensure(current));
          return requested.map(fact => {
            const exact = receipts.find(row => row.fact.id === fact.id
              && value(canonical(row.fact)).bytes === value(canonical(fact)).bytes && !row.taint.length);
            if (!exact) throw Error(`current peer receipt lacks exact requested fact: ${fact.id}`);
            return exact;
          });
        }) } });
      bindings.lease.port = f.effects.transport;
      const operator = operatorFixture();
      const operatorRoot = value(f.store.read()).find(row => row.kind === 'genesis-grant'
        && row.body.grant.grantee.id === t.intake.f.alice.id);
      if (!operatorRoot) throw Error('prepared owner genesis grant absent');
      const installationContext = { ...context, decode: { ...dc, provenance: t.intake.f.alice.provenance } };
      const installationFact = value(f.store.read()).find(row => row.id === prepared.fixed.installationFact.id);
      if (!installationFact) throw Error('prepared installation fact absent from opened source');
      for (const id of ['check-run:context', 'check:unit', 'check:integration', 'check:lifecycle']) f.appendReference('check-run-record', { id });
      for (const id of ['probe:native', 'probe:1', 'probe:word-count']) f.appendReference('verification-ProbeRecord', { record: { ...verificationInput('ProbeRecord'), id } });
      f.appendReference('assembly-reference-evidence', { id: 'bar:isolation' });
      value(f.runtime.record('AdapterEvidenceContract', assemblyInput('AdapterEvidenceContract')));
      const conversationBinding = value(f.store.read()).find(row => row.kind === 'conversation-binding' && row.body.channel === 'boot-fixture-channel') ?? value(authorAndAppend({ kind: 'conversation-binding', schemaVersion: 1,
        machine: f.host.machine, principal: json(t.intake.f.alice), provenance: json(t.intake.f.alice.provenance), at: json(f.now),
        required: [operatorRoot.id], body: { adapter: intake.adapter.id, channel: 'boot-fixture-channel', sender: 'boot-fixture-sender',
          identityEpoch: 'installation-1', principalId: t.intake.f.alice.id, grantId: operatorRoot.body.grant.id,
          scope: json(f.scope), supersedes: 'none' } }, installationContext, createFactStore(installationContext, storage.segment), privateKey)).fact;
      binding.dependencies = binding.dependencies.map(row => row.name === 'conversation-binding'
        ? { ...row, fact: { ...row.fact, reference: conversationBinding.id } } : row);
      appendProductionBindingFacts(f, binding);
      const artifact = grounding.harness.describe().artifact;
      const conformance = value(f.runtime.record('AdapterConformance', { ...assemblyInput('AdapterConformance'),
        generation: dc.register.generation.id, artifact }));
      const policy = value(f.runtime.record('StoreCustodyPolicy', assemblyInput('StoreCustodyPolicy')));
      const isolation = value(f.runtime.record('HarnessObservation', assemblyInput('HarnessObservation')));
      const access = value(f.runtime.record('StorageAccessObservation', assemblyInput('StorageAccessObservation')));
      const factId = id => value(f.runtime.inspect()).find(row => row.record.id === id).fact.id;
      const conformanceFact = factId(conformance.id), policyFact = factId(policy.id);
      const publicPorts = productionPublicPorts(binding.scope).map(row => row.port === 'HarnessAdapterPort' ? { ...row, artifact }
        : row.port === 'ModelAdapterPort' ? { ...row, implementation: 'test-provider:model:route' }
        : row.port === 'PersistenceAdapterPort' ? { ...row, implementation: storage.persistence.id } : row);
      const manifest = value(f.runtime.record('AssemblyManifest', { ...assemblyInput('AssemblyManifest'), id: 'manifest:production',
        generation: dc.register.generation.id,
        publicPorts, productionBindings: [binding], dependencyFacts: [conformanceFact, policyFact] }));
      value(f.runtime.record('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), id: 'admission:production',
        sourceGeneration: dc.register.generation.id,
        manifest: manifest.id, scope: binding.scope, conformance: [conformanceFact], isolationEvidence: [factId(isolation.id)],
        custodyEvidence: [factId(access.id)], dependencyFacts: [factId(manifest.id), conformanceFact, policyFact] }));
      const owners = { assembly: { ...f.composition, persistence: storage.persistence }, grounding: { ...grounding, scope: binding.scope },
        run: f.deps, intake, telegram: api, effect: f.effects.composition,
        provider: { judgment: { host: judgmentHost, boundary, authority: f.effects.transport, captures, store: f.store, context, privateKey,
          settings: { automaticRetries: 0, maxTokens: 128 }, outputSchema: { type: 'Decision' }, maxTokens: 128,
          maxCaptureBytes: 65536, timeout: 100, disclosure: 'recorded provider' }, verification: vh, route,
          effect: { host: f.owners.host, durability: f.effects.composition.durability, custody: f.effects.composition.custody, plan: 'boot-provider-plan' } },
        operator: { ...operator.composition, id: binding.surface.adapter.implementation }, bindings,
        names: { intake: 'intake:verified-act', run: 'run:graph', lease: 'lease:authority', judgment: 'judgment:doorway',
          effect: 'effect:doorway', verification: 'verification:runtime', responder: 'responder:minimal' },
        budgets: binding.minimalResponder.budgets, repairOwner: 'operator', dependencies: admittedDependencies };
      if (recovery) {
        const opening = value(f.store.read()).find(row => row.kind === 'intake-admitted');
        if (opening) f.bindIntake(opening);
        f.deps.settlement.read = (reference, step) => state.application.owners.provider.eight.readRunSettlement(reference, step);
      }
      state = { f, t, root, storage, api, admitted, declaration, calls, captures, judgmentHost, vh, runtime, realAssessment, owners,
        receive(application) {
          const batch = value(api.poll({ token: declaration.token, apiVersion: declaration.apiVersion, offset: 0, limit: 100, timeout: 0 }));
          const raw = batch.updates[0], extracted = extractTelegramUpdate(raw, declaration);
          const received = value(application.owners.intake.receive(raw, extracted.route));
          if (received.kind !== 'admitted') throw Error('Four input not admitted');
          const opening = value(f.store.read()).find(row => row.id === received.fact.id);
          f.bindIntake(opening); placeRun(); Object.assign(state, { raw, extracted, placement }); return received;
        } };
      options.mutate?.(state, owners);
      return assemblyBoundary('RecordedInstallationHost', null, boundary, () => () => ({ owners, manifest: manifest.id, scope: binding.scope, installationFact }));
    } };
  return { host, record, state: () => state,
    peer: { setFactId: prepared.set.id, current: setFactId => currentSelectedPeer(setFactId),
      disconnect: () => { peerConnected = false; }, reconnect: () => { peerConnected = true; },
      channelPeer: id => { channelPeer = id; },
      replayLastResponse: value => { replayLastResponse = value; },
      incompleteResponse: value => { incompleteResponse = value; }, captures: t.intake.context.captures },
    boot: () => { const application = value(bootProductionApplication(record, host)); state.application = application; return state; } };
}
