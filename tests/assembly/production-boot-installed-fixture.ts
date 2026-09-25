// @ts-nocheck -- U4-G fixture admissions are enumerated in production-holds.ts.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
import { productionBindingSet, productionComposition, appendProductionBindingFacts, productionPublicPorts } from './production-fixture.js';
import { assemblyInput } from './fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { value, privateKey, json } from '../facts/fixtures.js';
import { productionStorageIO, createProductionNativeContextIO } from '../../scripts/production-boot-io.mjs';
import { createProductionRunAdmission } from '../../src/transport/index.js';

export const fixtureAdmissionNames = productionBindingHolds.join(', ');
/** Recorded offline defaults are unchanged. A live-shaped caller (the preview
 * successive adapter) may supply the configured bot identity, physical Telegram
 * IO, declaration, SecretRef resolver and bounded judgment settings; it then
 * never reads the recorded getMe/poll/send bytes. */
export function installedFixtureHost(root, route, options = {}) {
  const live = !!options.telegramIO || !!options.telegramIOFactory;
  const getMe = live ? null : readFileSync('tests/assembly/telegram-recorded/getMe.json', 'utf8');
  const poll = live ? null : options.pollResponse ?? readFileSync('tests/assembly/telegram-recorded/poll-0.json', 'utf8');
  const sent = live ? null : readFileSync('tests/assembly/telegram-recorded/sendMessage.json', 'utf8');
  const bot = options.bot ?? JSON.parse(getMe).result, t = conversationFixture({ botId: String(bot.id), skipInitialAdmission: true });
  const c = { ...t.intake.context.decode, site: t.intake.f.c.site, preserved: t.intake.f.c.preserved };
  c.register = { ...c.register, generation: { ...c.register.generation, id: 'generation:fixture' },
    entries: [...new Set([...c.register.entries, ...options.registerEntries ?? []])] };
  const secret = name => ({ type: 'SecretRef', schemaVersion: 1, vault: 'vault', name });
  const record = { type: 'ProductionInstallation', schemaVersion: 1, id: 'host', generation: c.register.generation.id,
    botDeclaration: 'phone-surface', providerRoute: 'route', machineIdentity: 'machine-a', storageRoot: root,
    botCredential: t.declaration.token, providerCredential: secret('provider'), storageCredential: secret('storage'),
    ...options.record };
  let underlyingAdmission, state;
  // Same landed Six fixture binding, constructed inside configure over the root.
  const admission = createProductionRunAdmission({ resolve: () => underlyingAdmission });
  const admittedDependencies = () => Object.fromEntries(requiredMinimalDependencies.map(name => [name, true]));
  const host = { context: c, storageIO: options.storageIO ?? productionStorageIO, storagePolicy: 'StoreCustodyPolicy',
    store: 'store:fact', repairOwner: 'operator', runAdmission: admission, missingBindings: [],
    dependencies: admittedDependencies, resolveSecret: options.resolveSecret ?? (reference => reference.name === 'storage' ? '13'.repeat(32)
      : reference.name === 'provider' ? 'synthetic-recorded-provider-credential' : '8820318295:synthetic_recorded_test_only_value'),
    configure(installation, storage) {
      const initial = t.intake.context;
      Object.assign(initial, { ownedBodies: [value(intakeWorkRegistration(c, t.intake.deps.author.principal.id)),
        value(intakeStopRegistration(c, t.intake.deps.author.principal.id))] });
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
            authorityIncarnation: 'authority:1', budget: 1000, monotonic: () => base.now.value,
            current: () => ({ decode: dc, clock: base.now, stopped: false, generation: dc.register.generation }) };
          const judgment = { transport: th, point: 'judgment', floor: base.floor,
            description: { owner: 'part-ten', provider: 'test-provider', model: 'model', route: 'route', automaticRetries: 0,
              maxInputBytes: 4096, maxOutputBytes: 4096, maxCharge: 20, measured: false, basis: 'recorded HTTP provider' },
            refreshFacts: () => base.success(undefined) };
          const verification = { ...assemblyHost, boundary, current: () => ({ decode: dc, clock: base.now,
            stopped: false, generation: dc.register.generation.id, facts: context, evidence: base.evidence }) };
          context.ownedBodies.push(...value(registerVerificationBodies(verification)),
            ...value(registerProviderJudgmentBodies(judgment, boundary)), ...value(registerProviderEffectBodies(th)),
            value(registerProductionInstallationBody({ ...dc, ...boundary })));
          context.migrations = providerEffectMigrations;
          const grantRoot = storage.segment.read().find(row => row.kind === 'note' && row.body.identity === 'installation-grant-root');
          if (grantRoot) context.grants.push({ factId: grantRoot.id, grant: t.intake.f.g });
          // Retained Evidence must be resolvable before the first store read: a
          // live answer's Decision cites turn-specific evidence, not only e1/e2.
          for (const row of storage.segment.read().filter(row => row.kind === 'evidence-record'))
            if (!base.evidence.some(e => e.id === row.body.evidence.id))
              base.evidence.push(value(decode('Evidence', row.body.evidence, dc)));
        } : undefined,
        native: { captures: storage.captures, io: nativeIO },
        intake: { ...initial, facts: [], opening: undefined } });
      underlyingAdmission = createProductionRunAdmission({ authority: f.effects.transport, store: f.store, context: f.c });
      f.deps.admission = admission;
      const context = f.ctx, dc = context.decode, boundary = { ...f.c, register: dc.register };
      for (const entry of options.registerEntries ?? []) if (!dc.register.entries.includes(entry)) dc.register.entries.push(entry);
      f.deps.context.evidenceSources.settlement = f.bob.provenance.adapter;
      const captures = value(createProductionJudgmentCaptures({ custody: storage.captures, context: boundary,
        capacity: options.judgment?.captureCapacity ?? 1048576, metadata: context.captures, decodeCaptures: dc.captures }));
      for (const [reference, bytes] of Object.entries(dc.captures)) {
        context.captures[reference] ??= { bytes, hash: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), byteLength: Buffer.byteLength(bytes), status: 'available' };
        storage.captures.preserve(reference, bytes);
      }
      f.owners.host.capture = bytes => captures.put(bytes, 262144);
      const th = { ...f.owners.host, domain: 'conversation:1', authorityIncarnation: 'authority:1',
        budget: 1000, monotonic: () => f.deps.clock().value,
        current: () => ({ ...f.owners.host.current(), generation: f.run.generation }) };
      const judgmentHost = { transport: th, point: 'judgment', floor: f.floor,
        description: options.judgment?.description ?? { owner: 'part-ten', provider: 'test-provider', model: 'model', route: 'route', automaticRetries: 0,
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
      const recordedDeclaration = { ...t.declaration, bot: { ...t.declaration.bot, username: `@${bot.username}` } };
      const declaration = options.declaration ? options.declaration(recordedDeclaration) : recordedDeclaration;
      const identityPlan = value(t.verification.inspectCurrent()).find(row => row.record.type === 'VerificationPlan').record;
      const calls = [];
      const physicalTelegram = options.telegramIOFactory ? options.telegramIOFactory(storage) : options.telegramIO;
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
          arm: identityPlan.arms.find(arm => arm.required).id, generation: 'generation:fixture' },
        io: live ? { invoke: (request, credential) => {
          calls.push(request.method);
          return physicalTelegram.invoke(request, credential);
        } } : { invoke: request => {
          calls.push(request.method);
          if (request.method === 'sendMessage') options.physicalCheckpoint?.('reply-before-response', state);
          const reply = options.dynamicReplyResponse && request.method === 'sendMessage'
            ? JSON.stringify({ ...JSON.parse(sent), result: { ...JSON.parse(sent).result,
              // The Bot API returns the decoded text of an HTML-mode send, never the escaped request bytes.
              text: request.body.text.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&'),
              chat: { ...JSON.parse(sent).result.chat, id: Number(request.body.chat_id) },
              ...(request.body.message_thread_id ? { message_thread_id: request.body.message_thread_id } : {}),
              entities: [] } }) : sent;
          const response = { kind: 'response', status: 200,
            bytes: request.method === 'getMe' ? getMe : request.method === 'getUpdates'
              ? typeof poll === 'function' ? poll(request) : poll : reply };
          if (request.method === 'sendMessage') options.physicalCheckpoint?.('reply-after-response', state);
          return response;
        } } }));
      if (recovery && options.sequentialPoll) {
        // Ten's readable update set is process-local. Re-witness the first durable
        // poll after restart so the existing Four receipt can rebuild its cursor.
        value(api.poll({ token: declaration.token, apiVersion: declaration.apiVersion,
          offset: 0, limit: 100, timeout: 0 }));
      }
      const admitted = value(admitTelegramAdapter(declaration, { ...t.admissionDependencies, api }));
      const intake = { ...t.intake.deps, context: () => ({ ...context, decode: { ...dc, provenance: t.intake.deps.author.principal.provenance } }), governance: t.governed.governance,
        adapter: createTelegramIntakeAdapter(admitted, api), storage: storage.segment,
        capture: { owner: 'part-ten', preserve: (bytes, at) => {
          const captured = value(t.intake.deps.capture.preserve(bytes, at));
          if (!telegramCaptures.preserve(captured.reference, bytes)) throw Error('intake custody failed');
          const update = extractTelegramUpdate(bytes, declaration);
          const witnessed = `capture:telegram:update-${update.updateId}:${captured.hash.slice(7)}`;
          const readable = api.readCapture(witnessed);
          return f.success(readable.kind === 'Success' && readable.value === bytes
            ? { ...captured, reference: witnessed } : captured);
        } }, dedupGeneration: () => ({ reference: dc.register.generation, kinds: context.schemas.map(s => s.kind),
          lineages: { 'machine-a': { head: storage.segment.read().at(-1)?.segment ?? null, observedAt: 100, closed: false } } }) };
      const binding = productionBindingSet();
      binding.dependencies = binding.dependencies.map(row => row.name === 'lease' ? { ...row,
        fact: { ...row.fact, reference: f.effects.leaseFact.id } } : row);
      const grounding = f.groundingFor({ scope: binding.scope });
      const placements = new Map();
      const originalStart = f.start;
      const originalMessage = f.effects.message;
      const originalPrepare = f.effects.prepare;
      const placeRun = () => {
        const prior = placements.get(f.opening.id);
        if (prior) return prior;
        const rows = value(f.store.read());
        const inputs = rows.filter(row => row.kind === 'intake-admitted'
          && row.segment.position <= f.opening.segment.position);
        const material = rows.filter(row => row.kind === 'rungraph-briefing-material');
        const captureFor = row => rows.find(fact => fact.id === row.body.receipt)?.body.capture
          ?? { reference: row.body.rawHash, hash: row.body.rawHash };
        const manifest = [...inputs.map(row => ({ class: 'message', reference: captureFor(row).reference, digest: captureFor(row).hash })),
          ...material.map(row => ({ class: row.body.class, reference: row.id, digest: row.contentHash }))];
        const accepted = (state?.contextHistory ?? []).filter(item => item.acceptedReply)
          .map(item => storage.captures.read(item.acceptedReply));
        const message = f.effects.message(f.id, options.contextDeliveryText
          ? options.contextDeliveryText(accepted) : ['actual delivered Telegram input', ...accepted].join('\n'));
        const wireMessage = value(decodeOutboundMessage({ ...message, sourceResult: f.opening.id,
          context: { input: { fact: f.opening.id, ...captureFor(f.opening) }, manifest } }, f.owners.host));
        const admitted = f.effects.prepare(wireMessage);
        const reservation = value(f.effects.transport.inspect()).find(row =>
          row.record.type === 'AdmissionReservation' && row.record.operation === admitted.operation);
        value(f.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'), id: `production-live-input-launch:${f.id}`,
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
        const placement = { admitted, reservation };
        placements.set(f.opening.id, placement);
        return placement;
      };
      const bindings = productionComposition(f, binding);
      const operator = operatorFixture();
      const operatorRoot = f.append('note', { identity: 'installation-grant-root', amount: '0' }).fact;
      context.grants.push({ factId: operatorRoot.id, grant: t.intake.f.g });
      const installationContext = { ...context, decode: { ...dc, provenance: t.intake.f.alice.provenance } };
      const installationFact = value(recordProductionInstallation({ record: installation, context: installationContext,
        boundary: { ...dc, ...boundary }, store: createFactStore(installationContext, storage.segment), privateKey, principal: t.intake.f.alice, at: f.now, required: [operatorRoot.id] }));
      for (const id of ['check-run:context', 'check:unit', 'check:integration', 'check:lifecycle']) f.appendReference('check-run-record', { id });
      for (const id of ['probe:native', 'probe:1', 'probe:word-count']) f.appendReference('verification-ProbeRecord', { record: { ...verificationInput('ProbeRecord'), id } });
      f.appendReference('assembly-reference-evidence', { id: 'bar:isolation' });
      value(f.runtime.record('AdapterEvidenceContract', assemblyInput('AdapterEvidenceContract')));
      const conversationBinding = value(f.store.read()).find(row => row.kind === 'conversation-binding' && row.body.channel === 'boot-fixture-channel') ?? value(authorAndAppend({ kind: 'conversation-binding', schemaVersion: 1,
        machine: f.host.machine, principal: json(t.intake.f.alice), provenance: json(t.intake.f.alice.provenance), at: json(f.now),
        required: [operatorRoot.id], body: { adapter: intake.adapter.id, channel: 'boot-fixture-channel', sender: 'boot-fixture-sender',
          identityEpoch: 'installation-1', principalId: t.intake.f.alice.id, grantId: t.intake.f.g.id,
          scope: json(f.scope), supersedes: 'none' } }, installationContext, createFactStore(installationContext, storage.segment), privateKey)).fact;
      binding.dependencies = binding.dependencies.map(row => row.name === 'conversation-binding'
        ? { ...row, fact: { ...row.fact, reference: conversationBinding.id } } : row);
      appendProductionBindingFacts(f, binding);
      const artifact = grounding.harness.describe().artifact;
      const conformance = value(f.runtime.record('AdapterConformance', { ...assemblyInput('AdapterConformance'), artifact }));
      const policy = value(f.runtime.record('StoreCustodyPolicy', assemblyInput('StoreCustodyPolicy')));
      const isolation = value(f.runtime.record('HarnessObservation', assemblyInput('HarnessObservation')));
      const access = value(f.runtime.record('StorageAccessObservation', assemblyInput('StorageAccessObservation')));
      const factId = id => value(f.runtime.inspect()).find(row => row.record.id === id).fact.id;
      const conformanceFact = factId(conformance.id), policyFact = factId(policy.id);
      const publicPorts = productionPublicPorts(binding.scope).map(row => row.port === 'HarnessAdapterPort' ? { ...row, artifact }
        : row.port === 'ModelAdapterPort' ? { ...row, implementation:
          `${judgmentHost.description.provider}:${judgmentHost.description.model}:${judgmentHost.description.route}` }
        : row.port === 'PersistenceAdapterPort' ? { ...row, implementation: storage.persistence.id } : row);
      const manifest = value(f.runtime.record('AssemblyManifest', { ...assemblyInput('AssemblyManifest'), id: 'manifest:production',
        publicPorts, productionBindings: [binding], dependencyFacts: [conformanceFact, policyFact] }));
      value(f.runtime.record('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), id: 'admission:production',
        manifest: manifest.id, scope: binding.scope, conformance: [conformanceFact], isolationEvidence: [factId(isolation.id)],
        custodyEvidence: [factId(access.id)], dependencyFacts: [factId(manifest.id), conformanceFact, policyFact] }));
      const owners = { assembly: { ...f.composition, persistence: storage.persistence }, grounding: { ...grounding, scope: binding.scope },
        run: f.deps, intake, telegram: api, effect: f.effects.composition,
        provider: { judgment: { host: judgmentHost, boundary, authority: f.effects.transport, captures, store: f.store, context, privateKey,
          settings: options.judgment?.settings ?? { automaticRetries: 0, maxTokens: 128 }, outputSchema: { type: 'Decision' },
          maxTokens: options.judgment?.settings?.maxTokens ?? 128, maxCaptureBytes: options.judgment?.maxCaptureBytes ?? 65536,
          timeout: options.judgment?.timeout ?? 100, disclosure: options.judgment?.disclosure ?? 'recorded provider' }, verification: vh, route,
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
          f.bindIntake(opening); const placement = placeRun(); Object.assign(state, { raw, extracted, placement }); return received;
        } };
      state.placeTurn = opening => { f.bindIntake(opening); return placeRun(); };
      options.mutate?.(state, owners);
      return assemblyBoundary('RecordedInstallationHost', null, boundary, () => () => ({ owners, manifest: manifest.id, scope: binding.scope, installationFact }));
    } };
  return { host, record, state: () => state,
    boot: () => { const application = value(bootProductionApplication(record, host)); state.application = application; return state; } };
}
