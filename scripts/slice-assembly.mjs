// ============================================================================
// The part-eleven vertical-slice assembly (docs/15 section 7).
//
// The durable slice engine below owns no production wiring. Production callers
// enter through `bootProductionSliceAssembly`, which boots Part Ten's public
// coordinator, replaces its Part Five-through-Eight handles with these exact
// durable ports before admission, and executes only through the returned handles.
// Part Nine's verifier and platform witness remain independently supplied owner
// ports. Everything consumed here is a published package export from `dist/`.
//
// `bootSliceAssembly` is the ONE public boot path. Every restart in the kill
// schedule re-enters through it and reconstructs the whole plane from the durable
// home directory.
// ============================================================================
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';

import { authorizationRequestDigest, canonical, consumeResult, decode, decodeMeasurement, defineDecoder, deriveThrough } from '../dist/index.js';
import { authorAndAppend, createFactStore, genesisHash, hashBytes, prepareSnapshot } from '../dist/facts/index.js';
import { decodeGenerationRecord, decodeShape, generateRegister, generationOf, loadRegister } from '../dist/register/index.js';
import { createIntakePort, intakeFactSchemas, intakeStopRegistration, intakeVerifiedActFactSchemas, intakeVerifiedActRegistration,
  intakeWorkRegistration } from '../dist/intake/index.js';
import { createRunGraph, recordWire, runFactSchemas, runIdFor } from '../dist/rungraph/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies, transportSchemas } from '../dist/transport/index.js';
import { createJudgmentDoorway, createJudgmentSpine, createModelAdapter, judgmentSchemas, registerJudgmentBodies } from '../dist/judgment/index.js';
import { consumeEffectSettlement, createEffectDoorway, createEffectSpine, decodeOutboundMessage, effectSchemas, installOperationDefinition, registerEffectBodies } from '../dist/effects/index.js';
import { checkpoint, foldProjection, rebuildProjection, restoreCheckpoint, signCheckpoint, verifyRebuild } from '../dist/projections/index.js';
import { assemblySchemas, bootProductionAssembly, createAssemblyRuntime, createAssemblySpine,
  registerAssemblyBodies } from '../dist/assembly/index.js';
import { createOperatorSurface, minimalPlaneProjectionIds, minimalPlaneProjections,
  requiredMinimalDependencies } from '../dist/operator/index.js';
import { createVerificationRuntime, createVerificationSpine, registerVerificationBodies,
  verificationSchemas } from '../dist/verification/index.js';

import { createTransportFileStorage } from './transport-file-storage.mjs';
import { createEffectReplicaStorage } from './effect-replica-storage.mjs';
import { createEffectFileCaptures } from './effect-file-captures.mjs';
import { createJudgmentCaptures } from './judgment-captures.mjs';
import { createSliceService, readServiceJournal } from './slice-service.mjs';

export { readServiceJournal };
/** The durability peer ANNOUNCES itself, per part eight's slice rule. */
export const PEER_STANDIN_ID = 'slice-peer-directory-STAND-IN';

// ---------------------------------------------------------------- primitives
export const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(`${r.reason}: ${r.detail}`); } });
export const refusal = r => consumeResult(r, { Success: () => null, Refused: r => `${r.reason}: ${r.detail}` });
export const settled = r => consumeResult(r, { Success: v => ({ ok: true, value: v }), Refused: r => ({ ok: false, detail: `${r.reason}: ${r.detail}` }) });
const json = v => JSON.parse(JSON.stringify(v));
const bytesOf = v => take(canonical(v)).bytes;
const hashOf = v => take(canonical(v)).hash;
const textHash = text => `sha256:${createHash('sha256').update(text).digest('hex')}`;

/**
 * Public section-7 boot. Part Ten re-resolves the signed manifest and returns the
 * only handles this wrapper exposes. Authority completion is performed by the
 * returned Part Eleven surface, whose intake handle is the returned Part Four
 * operation. The displayed result is the independently administered Part Nine
 * witness result, never the effect adapter's self-report.
 */
export function bootProductionSliceAssembly(input) {
  const suppliedConfig = input.config ?? sliceConfig();
  const slice = bootSliceAssembly(input.home, input.restartRecovery === true
    ? { ...suppliedConfig, productionRestart: true }
    : suppliedConfig);
  const restart = input.restartRecovery === true ? restartProductionAssembly(slice) : null;
  const assembly = restart?.assembly ?? input.assembly;
  const manifest = restart?.manifest ?? input.manifest;
  const scope = restart?.scope ?? input.scope;
  if (!assembly?.production) throw new Error('production slice requires Part Ten production composition');
  const supplied = assembly.production;
  const production = Object.freeze({ ...supplied,
    run: Object.freeze({ ...supplied.run, port: slice.runGraph() }),
    lease: Object.freeze({ ...supplied.lease, port: slice.transport }),
    judgment: Object.freeze({ ...supplied.judgment, port: slice.judgment }),
    effect: Object.freeze({ ...supplied.effect, port: slice.effects }),
  });
  const coordinator = take(bootProductionAssembly({ ...assembly, production }, manifest, scope));
  const admitCurrentDependencies = () => {
    for (const name of requiredMinimalDependencies) {
      const reference = coordinator.references.find(row => row.name === `dependency:${name}`);
      if (!reference) return { admitted: false, name, detail: `required production dependency reference is missing: ${name}` };
      try {
        const admission = settled(coordinator.handles.dependencyAdmission.admit({ name, fact: reference.fact,
          completeness: reference.completeness, missing: reference.missing }));
        if (!admission.ok) return { admitted: false, name, detail: admission.detail };
      } catch (error) {
        return { admitted: false, name, detail: error instanceof Error ? error.message : String(error) };
      }
    }
    return { admitted: true };
  };
  return Object.freeze({ ...slice, coordinator,
    async drive() {
      let request = null, authority = null;
      if (restart) {
        request = restart.authorizationRequest;
        authority = restart.completeAuthority();
      } else {
        request = input.authorizationRequest;
        if (typeof request !== 'string' || !request) throw new Error('production slice requires one durable authorization request');
        const challenge = take(coordinator.handles.surface.challenge(request));
        authority = take(coordinator.handles.surface.confirm({ challenge, proof: input.operatorProof ?? 'verified-operator-proof', decision: 'approve' }));
      }
      // Part Ten's boot-time handles are evidence of the initial composition,
      // not a lease on future availability. Re-enter the public live-admission
      // port inside every drive, after Part Four has preserved the input and
      // before any run/effect work can begin.
      const report = await slice.drive(admitCurrentDependencies);
      const assemblyBoot = Object.freeze({ owner: coordinator.owner, admission: coordinator.admission.id,
        scope: coordinator.scope, references: coordinator.references.map(row => Object.freeze({ name: row.name,
          fact: row.fact.id, completeness: row.completeness })) });
      const operation = report.outbound?.operation;
      const applied = typeof operation === 'string' && operation.length > 0
        && report.externalApplications?.some(row => row.operation === operation) === true;
      if (!applied) {
        if (!restart) throw new Error('production slice produced no admitted outbound operation');
        const verification = take(coordinator.handles.verification.port.inspectCurrent());
        const observed = verification.find(row => row.record?.type === 'ProbeRecord'
          && row.record.id === 'probe:production' && row.record.operation === 'operation:assembly-boot'
          && row.taint.length === 0 && row.conflicts.length === 0);
        if (!observed) throw new Error('production restart without an outbound operation has no clean same-execution Part Nine boot witness');
        return Object.freeze({ ...report, assemblyBoot,
          authorityCompletion: Object.freeze({ request, disposition: authority.id, owner: authority.owner }),
          independentlyWitnessedResult: Object.freeze({ owner: 'part-nine', administration: 'independent',
            operation: null, platform: coordinator.handles.deliveryWitness.platform, stage: 'not-reached',
            disposition: 'owned-uncertain', reason: typeof operation === 'string' && operation
              ? 'the execution retained an owned operation without a platform application'
              : 'the profile retained owned pending work before outbound admission',
            probe: observed.record }),
          verificationFacts: verification.map(row => row.fact.id),
          verificationRecords: verification.map(row => row.record.id),
        });
      }
      const witnessed = take(coordinator.handles.deliveryWitness.observe(operation));
      // `observe` may durably append the provider's probe. Resolve Part Nine only
      // after that append so this decision is based on the current fact projection,
      // never on a pre-observation snapshot or the provider's returned object.
      const verification = take(coordinator.handles.verification.port.inspectCurrent());
      const witnessRecord = witnessed && typeof witnessed === 'object' ? witnessed : null;
      const probe = witnessRecord?.probe && typeof witnessRecord.probe === 'object' ? witnessRecord.probe : null;
      const observed = verification.find(row => row.record?.type === 'ProbeRecord' && row.record.id === probe?.id
        && row.record.operation === operation && row.taint.length === 0 && row.conflicts.length === 0);
      // A clean signed ProbeRecord is still only a claim about its witness ids.
      // Ask Part Nine's public posture operation to re-resolve the selected
      // probe against its current Evidence/capture inventory. Requiring this
      // exact record as both the last attempt and last success prevents another
      // probe under the same plan from lending it a healthy label.
      // Part Nine may administer a clock distinct from the slice harness. Use
      // the signed probe completion instant to ask whether its witness
      // references still resolve in Part Nine's *current* evidence inventory;
      // do not manufacture staleness by imposing the caller's unrelated clock.
      const postureClock = observed
        ? Object.freeze({ ...slice.now(), value: observed.record.completedAt, at: observed.record.completedAt })
        : null;
      const posture = observed
        ? settled(coordinator.handles.verification.port.posture(observed.record.plan, postureClock))
        : { ok: false, detail: 'selected probe is absent from current Part Nine history' };
      const arm = posture.ok
        ? posture.value.arms.find(row => row.arm === observed.record.arm)
        : null;
      if (witnessRecord?.owner !== 'part-nine' || witnessRecord.administration !== 'independent'
        || witnessRecord.operation !== operation || witnessRecord.platform !== coordinator.handles.deliveryWitness.platform
        || witnessRecord.stage !== report.declaredStage || !observed || !posture.ok
        || posture.value.posture !== 'healthy' || arm?.lastAttempt !== observed.record.id
        || arm?.lastSuccess !== observed.record.id)
        throw new Error(`production slice delivery result is unwitnessed or does not bind the admitted operation: ${JSON.stringify({
          operation, declaredStage: report.declaredStage, witness: witnessRecord,
          posture: posture.ok ? posture.value : { refused: posture.detail },
          verification: verification.map(row => ({ id: row.record?.id, type: row.record?.type,
            operation: row.record?.operation, taint: row.taint, conflicts: row.conflicts })),
        })}`);
      const independentlyWitnessedResult = Object.freeze({ owner: 'part-nine', administration: 'independent', operation,
        platform: coordinator.handles.deliveryWitness.platform, stage: report.declaredStage, probe: observed.record });
      // The witness append advances the durable vector after `drive`'s initial
      // rebuild. Return rebuild evidence pinned to the same current history that
      // supplied the displayed Part Nine record.
      const rebuilds = slice.rebuildAll();
      return Object.freeze({ ...report,
        rebuilds,
        assemblyBoot,
        authorityCompletion: Object.freeze({ request, disposition: authority.id, owner: authority.owner }),
        independentlyWitnessedResult,
        verificationFacts: verification.map(row => row.fact.id),
        verificationRecords: verification.map(row => row.record.id),
      });
    } });
}

// The process-restart worker has no test fixture object to smuggle across the
// process cut. It therefore assembles a fresh, signed Part Ten production
// composition on every boot and lets Part Ten re-resolve all 24 bindings before
// the recovered slice is driven. Its Part Eleven surface completes authority
// through Part Four, and its Part Nine runtime witnesses that same execution.
function restartProductionAssembly(slice) {
  const h = c => `sha256:${c.repeat(64)}`;
  const scope = 'scope:minimal';
  const required = (reference, expectedKind) => ({ reference, expectedKind, required: true });
  const dependencyKinds = {
    'local-facts': 'fact-local-durable-segment', register: 'register-generation-record', 'identity-keys': 'identity-key-set',
    clock: 'clock-source', lease: 'transport-Lease', fence: 'transport-FenceToken',
    'replication-peer': 'fact-replication-receipt', 'conversation-binding': 'conversation-binding',
    route: 'conversation-route', 'delivery-evidence': 'delivery-evidence-service',
  };
  slice.install();
  const definitions = minimalPlaneProjections(slice.kinds());
  const boundaryContext = Object.freeze({ ...slice.boundaryContext, validateReferences: true });
  const host = { machine: slice.config.machine, principal: slice.bob, scope: slice.scope, boundary: boundaryContext,
    current: () => ({ facts: slice.factContext, generation: 'generation:1', stopped: false, clock: slice.now() }) };
  const verificationHost = { machine: slice.config.machine, principal: slice.observer, scope: slice.scope, boundary: boundaryContext,
    current: () => ({ decode: slice.decodeContext, clock: slice.now(), generation: 'generation:1', stopped: false,
      facts: slice.factContext, evidence: slice.decodeContext.evidence ?? [] }) };
  const ownerSchemas = [...assemblySchemas(host), ...verificationSchemas(verificationHost)];
  const schemaBase = slice.factContext.schemas[0];
  const referenceKinds = [...new Set(['check-run-record', 'verification-ProbeRecord', 'assembly-reference-evidence',
    'operator-surface-registration', 'operator-challenge-verifier-binding', 'intake-verified-act-binding',
    'minimal-plane-projection-binding', 'minimal-plane-replay-binding', 'minimal-responder-binding',
    ...Object.values(dependencyKinds), 'assembly-lifecycle-control-binding', 'platform-delivery-witness-binding'])];
  const schemas = [...slice.factContext.schemas, ...ownerSchemas,
    ...referenceKinds.filter(kind => ![...slice.factContext.schemas, ...ownerSchemas].some(schema => schema.kind === kind))
      .map(kind => ({ ...schemaBase, kind, fields: { id: { kind: 'text', maxLength: 4096 } },
        causallyBound: false, requiredReferences: [], authority: 'none' }))]
    .filter((schema, index, all) => all.findIndex(candidate => candidate.kind === schema.kind && candidate.version === schema.version) === index);
  const verifiedActGeneration = { owner: 'part-three', name: 'RegisterGeneration',
    id: take(generationOf(slice.governance.register, slice.governance.context)).id };
  const registrations = [...slice.factContext.ownedBodies ?? [],
    take(intakeVerifiedActRegistration(boundaryContext, slice.observer.id, verifiedActGeneration)), ...take(registerAssemblyBodies(host)),
    ...take(registerVerificationBodies(verificationHost))]
    .filter((row, index, all) => all.findIndex(candidate => candidate.owner === row.owner && candidate.name === row.name) === index);
  Object.assign(slice.factContext, { schemas, ownedBodies: registrations });
  const spine = createAssemblySpine(host, { context: slice.factContext, privateKey: slice.privateKey }, slice.store);
  const noValue = () => slice.result(() => undefined);
  const base = { host, spine, harnesses: [], model: { owner: 'part-ten', describe: () => ({ owner: 'part-ten', provider: 'restart', model: 'none', route: 'none',
    automaticRetries: 0, maxInputBytes: 1, maxOutputBytes: 1, maxCharge: 0, measured: false, basis: 'restart composition only' }),
    prepare: noValue, exchange: async () => noValue() },
    persistence: { owner: 'part-ten', id: 'restart:persistence', describe: () => ({ backend: 'file', policy: 'durable-slice-home', encrypted: true, appendAtomic: true }),
      appendExact: noValue, readExact: noValue, flushEvidence: noValue },
    independentProtection: { owner: 'part-nine', posture: () => slice.result(() => 'protected') } };
  const runtime = createAssemblyRuntime(base);
  const verificationSpine = createVerificationSpine(verificationHost,
    { context: slice.factContext, privateKey: slice.privateKey }, slice.store);
  const verification = createVerificationRuntime(verificationHost, verificationSpine);
  const rows = () => take(runtime.inspect());
  const verificationRows = () => take(verification.inspect());
  const currentRecord = (type, id) => rows().find(row => row.record.type === type && row.record.id === id)?.record;
  const appendReference = (kind, id) => {
    const existing = slice.facts().find(row => row.kind === kind && (row.id === id || row.body?.id === id));
    if (existing) return existing;
    return take(authorAndAppend({ kind, schemaVersion: 1, machine: host.machine,
      principal: json(slice.bob), provenance: json(slice.bob.provenance), at: json(slice.now()), body: { id }, required: [] },
    slice.factContext, slice.store, slice.privateKey)).fact;
  };
  const probeInput = (id, operation, comparison) => { const at = slice.now().value; return {
    type: 'ProbeRecord', schemaVersion: 1, id, predecessors: [], plan: 'plan:restart-production', planVersion: 'bar:1',
    arm: 'delivery', slot: operation, attempt: operation, subject: 'platform-delivery', challengeDigest: hashOf(operation),
    run: 'slice-run', operation, startedAt: at, completedAt: at, witnesses: [`witness:${operation}`], comparison,
    disposition: 'passed', missingPhases: [], captureStatus: 'available', costs: [{ resource: 'money', amount: 0 }],
  }; };
  const recordProbe = (id, operation, comparison) => take(verification.record('ProbeRecord', probeInput(id, operation, comparison)));
  const deliveryPlanInput = operation => ({
    type: 'VerificationPlan', schemaVersion: 1, id: `plan:delivery:${operation}`, predecessors: [],
    subject: { rules: [26, 89], holder: 'part-nine', governed: 'platform-delivery', scope, generation: 'generation:1' },
    arms: [{ id: 'delivery', kind: 'runtime', executable: 'witness:platform', fixture: 'P11-NF-47',
      outputContract: 'ProbeRecord+Evidence', canFail: 'supporting evidence unavailable', required: true }],
    bar: { version: 'delivery:v1', predicates: ['occurrence'], sources: ['slice-witness'], minimumStrength: 'observation',
      subjectDigest: hashOf('platform-delivery'), captureRequired: true, freshness: 1000000, complete: true },
    independence: { testedPrincipal: slice.bob.id, observerPrincipal: slice.observer.id,
      witnessController: 'slice-witness', commonFailures: ['fixture service journal loss'] },
    scheduling: { owner: 'part-nine', run: 'slice-run', loopPolicy: 'single observation', cadence: 1000000,
      freshnessWindow: 1000000, dueAction: 'observe delivery', recoveryBudget: 'bounded by slice fixture' },
    bounds: [{ resource: 'attempts', limit: 1 }],
    consumers: [{ id: 'operator-surface', direction: 'closed', enforcedRecord: 'ProbeRecord',
      decoder: 'probeBoundToCurrentEvidence', preserved: operation }],
    privacy: { readers: ['operator'], providers: ['slice-witness'], captureClass: 'delivery-observation',
      secretCustody: 'part-ten fixture custody', destinations: ['operator-surface'] },
    activation: { unit: ['P11-NF-47'], integration: ['P11-NF-47'], lifecycle: ['P11-NF-47'],
      semantic: ['P11-NF-47'], limits: ['one attempt'], evidence: ['check-run:production'] },
  });
  const recordDeliveryProbe = (operation, application, existing = null) => {
    const plan = verificationRows().find(row => row.record.type === 'VerificationPlan'
      && row.record.id === `plan:delivery:${operation}`)?.record
      ?? take(verification.record('VerificationPlan', deliveryPlanInput(operation)));
    const at = slice.now();
    const probe = existing ?? { ...probeInput(`delivery:${operation}`, operation, `application:${application.messageId}`),
      plan: plan.id, planVersion: plan.bar.version, arm: 'delivery', slot: operation, attempt: operation,
      subject: plan.subject.governed, challengeDigest: hashOf(operation), startedAt: at.value, completedAt: at.value,
      witnesses: [`witness:${operation}`] };
    const claim = { subject: probe.subject, predicate: 'probe-passed', value: { challengeDigest: probe.challengeDigest,
      subjectDigest: plan.bar.subjectDigest, plan: probe.plan, planVersion: probe.planVersion, arm: probe.arm,
      slot: probe.slot, attempt: probe.attempt, run: probe.run, operation: probe.operation, comparison: probe.comparison } };
    const bytes = JSON.stringify({ application, claim });
    const capture = take(slice.custody.capture(bytes));
    slice.decodeContext.captures[capture.reference] = bytes;
    const witness = take(decode('Evidence', { type: 'Evidence', schemaVersion: 1, id: `witness:${operation}`,
      claim, source: 'slice-witness', observedAt: at, freshFor: 1000000, capture, strength: 'observation' }, slice.decodeContext));
    const prior = slice.decodeContext.evidence.findIndex(row => row.id === witness.id);
    if (prior >= 0) slice.decodeContext.evidence.splice(prior, 1, witness);
    else slice.decodeContext.evidence.push(witness);
    return existing ?? take(verification.record('ProbeRecord', probe));
  };
  let manifest = currentRecord('AssemblyManifest', 'manifest:restart-production');
  let binding;
  if (manifest) binding = manifest.productionBindings.find(row => row.scope === scope);
  if (!binding) {
    const installed = slice.install();
    slice.liveFence();
    const lease = slice.transportFacts().filter(row => row.record.type === 'Lease').at(-1)?.fact;
    if (!lease || !installed.binding) throw new Error('restart assembly requires actual Part Six lease and Part Four conversation binding records');
    binding = {
      scope,
      surface: {
        adapter: { implementation: 'surface:phone', fact: required('binding:surface', 'operator-surface-registration') },
        challengeVerifier: { implementation: 'verifier:phone', administration: 'independent',
          fact: required('binding:challenge-verifier', 'operator-challenge-verifier-binding') },
      },
      verifiedActIntake: { implementation: 'intake:verified-act', operation: 'admitVerifiedAct',
        fact: required('binding:verified-act-intake', 'intake-verified-act-binding') },
      minimalPlane: {
        folds: definitions.map(row => ({ projection: row.id, implementation: `fold:${row.id}`,
          fact: required(`binding:fold:${row.id}`, 'minimal-plane-projection-binding') })),
        sourceOnlyReplay: { implementation: 'replay:source-only', fact: required('binding:source-only-replay', 'minimal-plane-replay-binding') },
      },
      minimalResponder: { implementation: 'responder:minimal', fact: required('binding:minimal-responder', 'minimal-responder-binding'),
        budgets: { worker: 1, storage: 4096, queue: 8, transport: 4, effect: 20 } },
      dependencies: Object.entries(dependencyKinds).map(([name, kind]) => ({ name, fact: required(
        name === 'lease' ? lease.id : name === 'conversation-binding' ? installed.binding.id : `binding:dependency:${name}`, kind) })),
      lifecycle: {
        cut: { implementation: 'lifecycle:cut', fact: required('binding:lifecycle:cut', 'assembly-lifecycle-control-binding') },
        recovery: { implementation: 'lifecycle:recovery', fact: required('binding:lifecycle:recovery', 'assembly-lifecycle-control-binding') },
      },
      deliveryWitness: { implementation: 'witness:platform', identity: 'principal:witness', platform: 'telegram',
        requester: 'principal:requester', effectAdapter: 'adapter:telegram',
        fact: required('binding:delivery-witness', 'platform-delivery-witness-binding') },
    };
    const bindingFacts = [binding.surface.adapter.fact, binding.surface.challengeVerifier.fact, binding.verifiedActIntake.fact,
      ...binding.minimalPlane.folds.map(row => row.fact), binding.minimalPlane.sourceOnlyReplay.fact,
      binding.minimalResponder.fact, ...binding.dependencies.map(row => row.fact), binding.lifecycle.cut.fact,
      binding.lifecycle.recovery.fact, binding.deliveryWitness.fact];
    for (const row of bindingFacts) if (![lease.id, installed.binding.id].includes(row.reference)) appendReference(row.expectedKind, row.reference);
  }
  const checkRun = appendReference('check-run-record', 'check-run:production');
  const bootstrapProbe = verificationRows().find(row => row.record.type === 'ProbeRecord' && row.record.id === 'probe:production')?.record
    ?? recordProbe('probe:production', 'operation:assembly-boot', 'assembly:production-boot');
  const probeFact = verificationRows().find(row => row.record.type === 'ProbeRecord' && row.record.id === bootstrapProbe.id)?.fact;
  if (!probeFact) throw new Error('restart assembly failed to resolve its Part Nine boot probe');
  const bar = appendReference('assembly-reference-evidence', 'bar:production');
  const common = (type, id = type) => ({ type, schemaVersion: 1, id, predecessors: [], dependencyFacts: [] });
  const capabilities = ['stable-lookup', 'application-stage', 'decisive-non-occurrence', 'delayed-execution-exclusion',
    'final-charge', 'prerequisite-durability'];
  const contract = currentRecord('AdapterEvidenceContract', 'contract:restart-production') ?? take(runtime.record('AdapterEvidenceContract', { ...common('AdapterEvidenceContract', 'contract:restart-production'),
    adapter: 'surface:phone', artifact: h('1'), parserDeclaration: 'parser:restart', stimulusClass: 'bot-workspace',
    authenticatedFields: ['account', 'tenant', 'conversation', 'sender', 'event'], authenticationMethod: 'signed fact verification',
    credentialBinding: 'secretref:restart', senderNamespace: 'principal', conversationNamespace: 'scope',
    stabilityRules: ['signed identity'], forwardingTreatment: 'quoted data', impersonationTreatment: 'never identity',
    churnDetector: 'generation', revocationResponse: 'refuse boot', eventIdAuthority: 'provider', replayPolicy: 'retained durable ids',
    ackPolicy: 'bound-only', disclosureScopes: [scope], positiveFixtures: ['P11-V29'],
    negativeFixtures: ['wrong-kind'], probes: ['probe:production'], capabilities: capabilities.map(name => ({ name, support: 'supported',
      source: `source:${name}`, predicate: `predicate:${name}`, subjectBinding: 'signed operation', horizon: 'one production boot',
      budget: 1, conformance: 'check-run:production', reason: '' })), contractVersion: 'restart:v1' }));
  const conformance = currentRecord('AdapterConformance', 'AdapterConformance') ?? take(runtime.record('AdapterConformance', { ...common('AdapterConformance'), contract: contract.id,
    adapter: 'surface:phone', package: 'slice', artifact: h('1'), platform: 'darwin-arm64', mode: 'recovery', portVersion: '1',
    schemaVersions: ['assembly-v1'], generation: 'generation:1', fixtureDigests: [h('2')], sourceProvenance: ['signed-restart-composition'],
    stageChecks: [{ stage: 'boot', checkRun: 'check-run:production', positive: ['production coordinator admitted'], negative: ['wrong kind refused'] }],
    probes: ['probe:production'], bars: ['bar:production'], limitations: [], testedAt: 0, validUntil: 100000000, disposition: 'passed' }));
  const policy = currentRecord('StoreCustodyPolicy', 'StoreCustodyPolicy') ?? take(runtime.record('StoreCustodyPolicy', { ...common('StoreCustodyPolicy'), governedVersion: 'policy:v1', store: 'store:restart',
    locations: [{ class: 'segment', location: 'memory://restart' }], custodians: ['service:restart'], readOperation: 'operation:restart-read',
    disclosureScopes: [scope], grants: ['grant:restart'], stalenessPolicy: 'per-process',
    encryption: { suite: 'AES-256-GCM', version: '1', implementationEvidence: ['production assembly fixture isolation'] },
    wrappingKey: 'secretref:restart', dataKeys: [{ id: 'restart-key', epoch: 1 }], recoveryCustody: 'restart-worker',
    restoreProcedure: 'rebuild from signed facts', rotationProcedure: 'new process', migrationBound: 1,
    plaintextRestrictions: ['ephemeral only'], metadataExposure: ['counts'], auditBound: 100, rateBound: 100, resourceBound: 4096,
    compromiseResponse: 'refuse boot' }));
  const harness = currentRecord('HarnessObservation', 'HarnessObservation') ?? take(runtime.record('HarnessObservation', { ...common('HarnessObservation'), launch: 'restart-production-boot', run: 'slice-run',
    step: 'production-assembly', input: 'signed-history', incarnation: slice.incarnation, sourceEvidence: ['bootProductionAssembly'],
    contextDigests: [h('3')], generation: 'generation:1', causalReferences: [], observedAt: 0, freshFor: 100000000,
    phase: 'context-consumed', boundaryEvidence: 'production-coordinator', detail: 'Part Ten production coordinator admitted before recovery drive' }));
  const access = currentRecord('StorageAccessObservation', 'StorageAccessObservation') ?? take(runtime.record('StorageAccessObservation', { ...common('StorageAccessObservation'), store: 'store:restart', objectClass: 'segment',
    requester: 'restart-worker', service: 'service:restart', grant: 'grant:restart', policy: 'StoreCustodyPolicy', generation: 'generation:1',
    operation: 'operation:restart-read', observedAt: 0, byteCount: slice.facts().length, result: 'allowed', refusalReference: '' }));
  const factFor = id => rows().find(row => row.record.id === id).fact.id;
  const conformanceFact = factFor(conformance.id), policyFact = factFor(policy.id), harnessFact = factFor(harness.id), accessFact = factFor(access.id);
  const publicPorts = [
    ['OperatorSurfacePort', 'surface:phone', '1'], ['IndependentSurfaceVerifierPort', 'verifier:phone', '2'],
    ['IntakePort.admitVerifiedAct', 'intake:verified-act', '3'], ['RunGraphPort', 'run:graph', '4'],
    ['TransportAuthority', 'lease:authority', '5'], ['JudgmentDoorway', 'judgment:doorway', '6'],
    ['EffectDoorway', 'effect:doorway', '7'], ['VerificationRuntimePort', 'verification:runtime', '8'],
  ].map(([port, implementation, digit]) => ({ port, version: '1', scope, implementation, artifact: h(digit) }));
  manifest = manifest ?? take(runtime.record('AssemblyManifest', { ...common('AssemblyManifest', 'manifest:restart-production'), manifestDigest: h('9'),
    packages: [{ id: 'slice', digest: h('a'), artifact: h('b') }], compatibility: { runtime: 'node', toolchain: 'compiled',
      platforms: ['darwin-arm64'], schemas: ['assembly-v1'], rollback: ['restart'] }, publicPorts,
    requiredGraph: [{ consumer: scope, dependencies: ['source', 'authority', 'route', 'durability', 'observation'] }], generation: 'generation:1',
    declarationSources: ['assembly.contract'], genesisAnchor: 'genesis:restart', trustRoots: ['root:restart'], servicePrincipals: ['service:restart'],
    grants: ['grant:restart'], custodyPolicies: [policy.id], resourcePolicies: [{ class: 'control', resource: 'worker', limit: 1 }],
    requiredChecks: [{ tier: 'unit', ids: ['P11-V29'] }, { tier: 'integration', ids: ['P11-V29'] }, { tier: 'lifecycle', ids: ['P11-V29'] }],
    productionBindings: [binding], dependencyFacts: [conformanceFact, policyFact] }));
  const manifestFact = factFor(manifest.id);
  if (!currentRecord('AssemblyAdmission', 'admission:restart-production')) take(runtime.record('AssemblyAdmission', { ...common('AssemblyAdmission', 'admission:restart-production'), manifest: manifest.id,
    manifestDigest: manifest.manifestDigest, machine: host.machine, incarnation: slice.incarnation, scope, sourceGeneration: 'generation:1',
    sourceVector: h('c'), artifacts: ['slice'], environmentEvidence: ['node-process'], conformance: [conformanceFact],
    isolationEvidence: [harnessFact], custodyEvidence: [accessFact], probeEvidence: [probeFact.id], resourceReservation: 'reservation:restart',
    observedAt: 0, validUntil: 100000000, priorAdmission: '', disposition: 'active', reason: 'production restart prerequisites admitted',
    repairOwner: 'restart-worker', dependencyFacts: [manifestFact, conformanceFact, policyFact] }));
  const ok = value => slice.result(() => value);
  const operator = slice.restartOperator(verification);
  const cutDependencies = new Set();
  const production = {
    requesterIdentity: binding.deliveryWitness.requester, effectAdapterIdentity: binding.deliveryWitness.effectAdapter,
    surface: operator.surface,
    challengeVerifier: { id: 'verifier:phone', port: operator.verifier },
    verifiedActIntake: { owner: 'part-four', id: 'intake:verified-act', operation: 'admitVerifiedAct',
      port: slice.intake },
    folds: definitions.map(row => ({ owner: 'part-eleven', id: row.id, implementation: `fold:${row.id}`, definition: row })),
    replay: { owner: 'part-ten', id: 'replay:source-only', sourceOnly: true, rebuild: () => ok(slice.rebuildAll()) },
    minimalResponder: { owner: 'part-eleven', id: 'responder:minimal', budgets: binding.minimalResponder.budgets,
      respond: () => ok('limited response') },
    run: { id: 'run:graph', port: slice.runGraph() }, lease: { id: 'lease:authority', port: slice.transport },
    judgment: { id: 'judgment:doorway', port: slice.judgment }, effect: { id: 'effect:doorway', port: slice.effects },
    verification: { id: 'verification:runtime', port: verification },
    dependencyAdmission: { owner: 'part-ten', id: 'dependency:admission', admit: input => slice.result(() => {
      if (cutDependencies.has(input.name)) throw new Error(`deterministic prerequisite cut: ${input.name}`);
      const commonHandle = { name: input.name, reference: input.fact.id, provider: `provider:${input.name}`, current: true };
      const extras = { 'local-facts': { durability: 'local-durable' }, register: { generation: 'generation:1' },
        'identity-keys': { keys: 'keys:restart' }, clock: { clock: 'clock:restart' }, lease: { exclusive: true }, fence: { exclusive: true },
        'replication-peer': { replicas: 1, distinctPeer: true }, 'conversation-binding': { binding: 'binding:restart' },
        route: { route: 'route:restart' }, 'delivery-evidence': { administration: 'independent' } };
      return { ...commonHandle, ...extras[input.name] }; }) },
    lifecycle: { owner: 'part-ten', cutId: 'lifecycle:cut', recoveryId: 'lifecycle:recovery',
      cut: name => { cutDependencies.add(name); return ok(undefined); },
      recover: name => { cutDependencies.delete(name); return ok(undefined); } },
    deliveryWitness: { owner: 'part-nine', administration: 'independent', id: 'witness:platform', identity: 'principal:witness',
      platform: 'telegram', observe: operation => ok((() => {
        const application = slice.service.journal().applications.find(row => row.operation === operation);
        if (!application) throw new Error('the recovered execution has no platform application for this operation');
        const existing = verificationRows().find(row => row.record.type === 'ProbeRecord' && row.record.operation === operation)?.record;
        // Evidence is a current dependency, not a property frozen into the
        // signed probe. Re-observe the same service application after restart so
        // Part Nine can resolve the stored probe's witness references now.
        const recorded = recordDeliveryProbe(operation, application, existing);
        return { owner: 'part-nine', administration: 'independent', operation, platform: 'telegram',
          stage: slice.declaredStage(), probe: recorded };
      })()) },
  };
  return { assembly: { ...base, production }, manifest: manifest.id, scope,
    authorizationRequest: operator.request, completeAuthority: operator.complete };
}

const syncDir = directory => { const fd = openSync(directory, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
const readLines = file => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);
function appendLine(file, directory, row) {
  const fd = openSync(file, 'a', 0o600);
  try { writeSync(fd, `${JSON.stringify(row)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  syncDir(directory);
}
function writeDurable(file, directory, text) {
  const pending = `${file}.pending`, fd = openSync(pending, 'w', 0o600);
  try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(pending, file); syncDir(directory);
}

const SECRET = createPrivateKey({ key: Buffer.from(`302e020100300506032b657004220420${'11'.repeat(32)}`, 'hex'), format: 'der', type: 'pkcs8' });
const PRIVATE_KEY = SECRET.export({ format: 'pem', type: 'pkcs8' }).toString();
const PUBLIC_KEY = createPublicKey(SECRET).export({ format: 'pem', type: 'spki' }).toString();

// -------------------------------------------------------------- configuration
/** Pinned installation configuration; deterministic test identities only. */
export function sliceConfig(overrides = {}) {
  return Object.freeze({
    // 'full' is the PRIMARY single-chain profile: docs/15 section 7 in ONE profile,
    // in section 7's own order. 'reply' and 'judgment' are the reduced controls.
    profile: 'full',                  // 'full' | 'reply' | 'judgment'
    adapter: 'telegram-slice',        // 'telegram-slice' | 'telegram-opaque'
    machine: 'machine-a',
    domain: 'conversation:1',
    channel: 'chat-a',
    sender: 'platform-alice',
    identityEpoch: 'account-1',
    eventId: 'event-1',
    account: 'bot:slice',
    conversation: 'chat:slice',
    ask: 'Please classify and acknowledge this request.',
    quiescenceTicks: 2,
    serviceCharge: 3,
    maxCharge: 20,
    leaseTerm: 90000,
    maxLeaseTerm: 100000,
    budget: 1000,
    judgmentDeadline: 900000,
    cuts: [],
    productionRestart: false,
    ...overrides,
  });
}

// ------------------------------------------------------------- the boundaries
// ONE source. `boundary()` refuses a name that is not declared here, so a fired
// boundary can never be missing from the enumeration; the control executions in
// the suite assert the converse, that every declared name in a profile is fired.
const REBUILD_BOUNDARIES = minimalPlaneProjectionIds.map(id => `rebuild:${id}`);

/**
 * What each profile ACTUALLY fires, in executed order. `full` is FIRST because it is
 * the primary single-chain profile; `reply` and `judgment` are the reduced controls.
 *
 * `full` and `judgment` fire the SAME list, and that equality is itself the finding:
 * the single chain stops at exactly the boundary the reduced control stops at,
 * because no published seam can resolve a part-seven model operation. See
 * `.instar/lanes/slice-six-seven-resolution-gap.md`.
 */
export const PROFILE_BOUNDARIES = Object.freeze({
  full: Object.freeze(['preservation', 'authentication', 'standing', 'run-creation', 'grounding',
    'judgment-request', 'judgment-reservation', 'judgment-claim', 'judgment-dispatch',
    'model-invocation', 'judgment-resolution', 'outbound-preparation', ...REBUILD_BOUNDARIES]),
  reply: Object.freeze(['preservation', 'authentication', 'standing', 'run-creation', 'grounding',
    'outbound-preparation', 'outbound-reservation', 'outbound-claim', 'outbound-consume',
    'external-send', 'delivery-evidence', 'settlement', 'settlement-application', ...REBUILD_BOUNDARIES]),
  judgment: Object.freeze(['preservation', 'authentication', 'standing', 'run-creation', 'grounding',
    'judgment-request', 'judgment-reservation', 'judgment-claim', 'judgment-dispatch',
    'model-invocation', 'judgment-resolution', 'outbound-preparation', ...REBUILD_BOUNDARIES]),
});

/** The union of what is actually fired. This is NOT an idealized design list. */
export const SLICE_BOUNDARIES = Object.freeze([...new Set(Object.values(PROFILE_BOUNDARIES).flat())]);

/**
 * Declared but never reached on this base, with the reason. Currently empty:
 * `grounding` moved into the profile lists when part five accepted the message
 * capture through the stimulus fact's capture-bearing ancestor (slice-five-gap.md
 * option 1) and the reader's consumption receipt began binding delivered context.
 */
export const UNREACHED_BOUNDARIES = Object.freeze({});

/**
 * Declared, and reached ONLY on a recovery path, so no CONTROL execution (a single
 * adjacent-pair cut) fires them. `operation-close` is six's conditional close of a
 * prepared operation whose reserving fence died with its worker. It is reachable only
 * after a cut that leaves a reservation prepared and unclaimed — the
 * `outbound-reservation` cut in the reply profile and the `judgment-reservation` cut in
 * the single chain. A recovery-only boundary is still CUTTABLE as the SECOND cut of a
 * dedicated recovery pair (see `RECOVERY_CUT_PAIRS`); the schedule cuts it there and the
 * suite asserts the recovery reconstructs the terminal obligation with released credit.
 */
export const RECOVERY_BOUNDARIES = Object.freeze({
  'operation-close': 'six conditionally closes a prepared operation whose reserving fence is gone; reached only '
    + 'after a cut that leaves a reservation unclaimed (outbound-reservation, or judgment-reservation in the single chain)',
});

/**
 * The recovery-triggered cut pairs: a first cut that creates the dead-fence
 * condition, then a cut AT the recovery boundary it makes reachable. A recovery-only
 * boundary is not uncuttable — calling it recovery-only only means no control pair
 * reaches it. These pairs put the recovery path itself under the SIGKILL discipline,
 * so a cut that interrupts the terminal obligation write must be reconstructed on the
 * next boot rather than left retaining the released credit. (astra R2)
 */
export const RECOVERY_CUT_PAIRS = Object.freeze({
  full: Object.freeze([Object.freeze(['judgment-reservation', 'operation-close'])]),
  reply: Object.freeze([Object.freeze(['outbound-reservation', 'operation-close'])]),
});

/** Every name `boundary()` may use. */
export const DECLARED_BOUNDARIES = Object.freeze([...SLICE_BOUNDARIES,
  ...Object.keys(UNREACHED_BOUNDARIES), ...Object.keys(RECOVERY_BOUNDARIES)]);

// ------------------------------------------------------------ the boot path
/**
 * THE public boot path.
 * @param {string} home durable slice home directory
 * @param {object} config pinned installation configuration (see sliceConfig)
 */
export function bootSliceAssembly(home, config = sliceConfig()) {
  mkdirSync(home, { recursive: true });
  const paths = {
    home,
    facts: join(home, 'facts'), peer: join(home, 'peer'),
    captures: join(home, 'captures'), peerCaptures: join(home, 'peer-captures'),
    proofs: join(home, 'proof-captures'),
    intake: join(home, 'intake-captures'), judgment: join(home, 'judgment-custody'),
    boots: join(home, 'boots.jsonl'), cuts: join(home, 'cuts.jsonl'), steps: join(home, 'steps.jsonl'),
    placement: join(home, 'placement.jsonl'), checkpoints: join(home, 'checkpoints'),
  };
  for (const d of [paths.facts, paths.peer, paths.intake, paths.judgment, paths.checkpoints, paths.proofs]) mkdirSync(d, { recursive: true });

  const bootStartedAt = Date.now();
  const priorBoots = readLines(paths.boots);
  const bootIndex = priorBoots.filter(r => r.event === 'start').length + 1;
  appendLine(paths.boots, home, { event: 'start', boot: bootIndex, pid: process.pid, wallMs: bootStartedAt,
    rss: process.memoryUsage().rss, profile: config.profile, adapter: config.adapter });
  const incarnation = `worker:${bootIndex}`, authorityIncarnation = `authority:${bootIndex}`;
  if (!existsSync(paths.placement)) appendLine(paths.placement, home, { worker: `slice-worker:${config.machine}`, harness: 'slice-harness:1' });

  // ------------------------------------------------------- cut instrumentation
  const requested = new Set(config.cuts);
  /** A durable boundary completed. Record it; if it is cut, record then SIGKILL. */
  const alreadyCut = new Set(readLines(paths.cuts).map(r => r.boundary));
  const boundary = (name, extra = {}) => {
    if (!DECLARED_BOUNDARIES.includes(name)) throw new Error(`undeclared durable boundary: ${name}`);
    // Every boundary is also an RSS sample. The row is fsynced BEFORE any cut, so
    // a killed boot still contributes its samples to the execution's high-water mark.
    appendLine(paths.steps, home, { boot: bootIndex, boundary: name, rss: process.memoryUsage().rss,
      atMs: Date.now() - bootStartedAt, ...extra });
    if (!requested.has(name) || alreadyCut.has(name)) return;
    appendLine(paths.cuts, home, { boot: bootIndex, boundary: name });
    process.kill(process.pid, 'SIGKILL');
    throw new Error('a cut worker must be killed, never resumed');
  };
  const reached = () => readLines(paths.steps);
  const cutsFired = () => readLines(paths.cuts);

  // ------------------------------------------------------------- decode context
  const captures = {};
  const principals = [], grants = [], revocations = [], authorizations = [], directives = [], evidence = [];
  const recordSubjects = {};
  const baseEntries = ['types.decode', 'host', 'probe', 'machine-a', 'machine-b', 'project-a', 'project-b', 'repo',
    'chat-a', 'intent:1', 'approval:1', 'bound', 'vault', 'judgment', 'model', 'route', 'rule:94',
    'facts.admit', 'intake.admit', 'intake-slice', 'reply', 'telegram-slice', 'telegram-opaque', 'telegram-stage-probe', 'slice-witness',
    'surface:phone'];
  const registerShape = {
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'generation:1' },
    entries: baseEntries, producers: ['probe', 'host', 'slice-witness', 'surface:phone'],
    methods: ['signed-envelope', 'telegram-sender', 'github-review', 'github-merge'],
    actions: { work: { protected: false, repository: false }, other: { protected: false, repository: false },
      merge: { protected: true, repository: true }, delegate: { protected: false, repository: false } },
    subjects: { clock: ['unix-ms'], 'detection-latency': ['ms', 's'], 'time-remaining': ['ms'], 'elapsed-time': ['ms'], 'run-work': ['steps'] },
    sites: { 'types.decode': 'closed', delivery: 'open', 'facts.admit': 'closed', 'intake.admit': 'closed' },
    keys: { host: { algorithm: 'ed25519', publicKey: PUBLIC_KEY, owner: 'machine-a',
      methods: ['signed-envelope', 'github-review', 'github-merge', 'fact-envelope'],
      adapters: ['host', 'telegram-slice', 'telegram-opaque', 'telegram-stage-probe', 'surface:phone'] } },
    allowRedelegation: false,
    conflictStanding: { ordinary: 'delegate', authority: 'operator' },
  };
  const decodeContext = { register: registerShape, preserved: 'capture:input',
    captures, principals, grants, revocations, authorizations, directives, evidence, recordSubjects };

  // ONE stable, mutable capture index. Every producer writes into this object, so a
  // consumer that snapshotted the context still sees a capture written after it.
  const captureIndex = {};
  const indexCapture = (reference, bytes) => { captureIndex[reference] = { hash: hashBytes(bytes), bytes,
    status: 'available', byteLength: Buffer.byteLength(bytes) }; };
  const capture = (text, reference) => { const hash = textHash(text); const key = reference ?? hash;
    captures[key] = text; indexCapture(key, text); return hash; };
  const persistProofCapture = (text, reference) => { const hash = textHash(text);
    if (reference !== `record:${hash}`) throw new Error('integrity: durable proof capture reference/hash mismatch');
    const file = join(paths.proofs, hash.slice(7));
    if (existsSync(file)) {
      if (readFileSync(file, 'utf8') !== text) throw new Error(`integrity: proof capture ${hash} changed bytes`);
    } else writeDurable(file, paths.proofs, text);
    captures[reference] = text; indexCapture(reference, text);
  };
  // Dynamic surface proofs are not reproducible from configuration alone. Recover
  // their exact signed preimages under both hash-addressed and provenance-record
  // references before any historical owner decoder traverses the causal cone.
  for (const name of readdirSync(paths.proofs)) {
    if (!/^[a-f0-9]{64}$/.test(name)) continue;
    const bytes = readFileSync(join(paths.proofs, name), 'utf8'), hash = `sha256:${name}`;
    if (hashBytes(bytes) !== hash) throw new Error(`integrity: durable proof capture ${hash} no longer matches its content hash`);
    captures[hash] = bytes; captures[`record:${hash}`] = bytes;
    indexCapture(hash, bytes); indexCapture(`record:${hash}`, bytes);
  }
  // The durable segment only ever grows, so its byte length is a sound cache key for
  // every read-only derivation. It never suppresses an owner's own verification.
  const segmentFile = join(paths.facts, 'facts.json');
  const segmentSize = () => (existsSync(segmentFile) ? statSync(segmentFile).size : 0);
  const memoOn = (keyOf, read) => { let key = -1, value; return () => { const k = keyOf();
    if (value === undefined || key !== k) { value = read(); key = k; } return value; }; };
  const memo = read => memoOn(segmentSize, read);
  const rawFacts = memo(() => (existsSync(segmentFile) ? JSON.parse(readFileSync(segmentFile, 'utf8')) : []));
  const tick = () => 1000 + rawFacts().length;
  const clockAt = at => take(decodeMeasurement('clock', { type: 'Measurement', schemaVersion: 1,
    subject: { kind: 'clock', instance: config.machine }, value: at, unit: 'unix-ms', at, by: 'probe' }, decodeContext));
  const genesisClock = clockAt(1000);
  const now = () => clockAt(tick());

  const proof = (payload, actor, recordType, attested, adapter = 'host', verifiedAt = genesisClock, durable = false) => {
    const recordBytes = bytesOf({ principal: actor, recordType, payload });
    const reference = `record:${textHash(recordBytes)}`;
    const hash = capture(recordBytes, reference);
    if (durable) persistProofCapture(recordBytes, reference);
    return { type: 'Provenance', schemaVersion: 1, adapter: attested ? config.adapter : adapter,
      method: attested ? 'telegram-sender' : 'signed-envelope', record: { reference, hash }, verifiedAt,
      machine: config.machine,
      evidence: attested ? { kind: 'channel', authenticated: true }
        : { kind: 'signature', keyId: 'host', signature: sign(null, Buffer.from(recordBytes), PRIVATE_KEY).toString('hex') } };
  };
  const makePrincipal = (id, kind) => {
    const provenance = take(decode('Provenance', proof({ id, kind }, { id, kind }, 'identity', false), decodeContext));
    const principal = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id, kind }, { ...decodeContext, provenance }));
    principals.push(principal); return principal;
  };
  const alice = makePrincipal('alice', 'person');
  const bob = makePrincipal('bob', 'agent');
  const observer = makePrincipal('intake-observer', 'system');
  const scope = take(decode('Scope', { type: 'Scope', schemaVersion: 1, kind: 'project', members: ['project-a'] }, decodeContext));

  const makeGrant = (id, grantee) => {
    const payload = { id, grantee, standing: 'operator', scope,
      grantor: { kind: 'org-intent', documentVersion: 'intent:1', approvedIn: 'approval:1' }, issuedAt: genesisClock };
    const source = take(decode('Provenance', proof(payload, { id: 'alice', kind: 'person' }, 'intent-approval', false), decodeContext));
    const grant = take(decode('StandingGrant', { type: 'StandingGrant', schemaVersion: 1, ...payload, source },
      { ...decodeContext, provenance: source }));
    grants.push(grant); return grant;
  };
  const bindingGrant = makeGrant('slice-binding-grant', alice);
  makeGrant('slice-agent-grant', bob);

  const floor = take(decode('ActionFloor', { type: 'ActionFloor', schemaVersion: 1, actions: ['work'], default: 'work' }, decodeContext));
  for (const id of ['slice-e1', 'slice-e2']) evidence.push(take(decode('Evidence', { type: 'Evidence', schemaVersion: 1, id,
    claim: { subject: 'requested-reply', predicate: id === 'slice-e1' ? 'is-permitted' : 'is-bounded', value: true },
    source: 'probe', observedAt: genesisClock, freshFor: 1000000,
    capture: { reference: `capture:${id}`, hash: capture(`observed evidence bytes for ${id}`, `capture:${id}`) },
    strength: 'proof' }, decodeContext)));

  // --------------------------------------------------------------- the register
  const intakeDeclarations = JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8'));
  const runDeclarations = JSON.parse(readFileSync('src/rungraph/rungraph.declarations.json', 'utf8'));
  const parserDeclaration = { type: 'Declaration', schemaVersion: 1, id: config.adapter, kind: 'parsers', status: 'live',
    requiredFacts: { fixture: 'check', authenticationClass: [{ stimulusType: 'message', class: 'channel-attested' }],
      eventIdAuthority: { mintedBy: 'provider', uniquenessScope: 'channel-and-sender', replayWindow: 1000,
        fallbackFingerprint: { policy: 'none', basis: 'provider id required' } }, ackPolicy: 'bound-only' },
    profile: { type: 'Profile', schemaVersion: 1, consequence: 'none', reversibility: 'reversible', reach: 'internal', surface: 'none', repeats: { kind: 'no' } },
    standards: [], holds: [] };
  const surfaceDeclaration = { type: 'Declaration', schemaVersion: 1, id: 'surface:phone', kind: 'parsers', status: 'live',
    requiredFacts: { fixture: 'check', authenticationClass: [{ stimulusType: 'operator-act', class: 'verified' }],
      eventIdAuthority: { mintedBy: 'provider', uniquenessScope: 'challenge', replayWindow: 300000,
        fallbackFingerprint: { policy: 'none', basis: 'challenge id required' } }, ackPolicy: 'bound-only' },
    profile: { type: 'Profile', schemaVersion: 1, consequence: 'control', reversibility: 'irreversible', reach: 'operator',
      surface: 'device', repeats: { kind: 'no' } }, standards: [], holds: [] };
  const declarations = [...intakeDeclarations, ...runDeclarations, parserDeclaration, surfaceDeclaration];
  const fullEntries = [...baseEntries, ...declarations.map(d => d.id)];
  const registerRegister = { ...registerShape, entries: fullEntries };
  const shape = take(decodeShape(JSON.parse(readFileSync('register-source/bootstrap-shape.json', 'utf8')),
    { site: 'types.decode', preserved: decodeContext.preserved, register: registerRegister }));
  const registerProvenance = take(decode('Provenance', proof({ commit: 'slice-commit:1' }, { id: 'alice', kind: 'person' }, 'approval', false), decodeContext));
  const registerContext = { site: 'types.decode', preserved: decodeContext.preserved, register: registerRegister,
    types: { ...decodeContext, register: registerRegister }, shape, provenance: registerProvenance,
    source: { path: 'scripts/slice-assembly.mjs', symbol: 'bootSliceAssembly' },
    references: [{ provider: 'probe', id: 'probe' }, { provider: 'fixture', id: 'check' },
      { provider: 'fixture', id: 'check', kind: 'captured-bytes' }, { provider: 'fixture', id: 'P4-NF-06' },
      { provider: 'fixture', id: 'P5-NF-54' }, { provider: 'probe', id: 'P5-NF-55' }, { provider: 'decoder', id: 'decode:Profile' },
      ...['readProjection', 'authorAndAppend', 'decode:Provenance', 'decode:VerifiedPrincipal',
        'decodeRun', 'decodeRunStep', 'decodeRunTransition', 'decodeRunExit', 'decodeSessionGrounding'].map(id => ({ provider: 'decoder', id }))] };
  const approvalReference = { owner: 'part-two', name: 'FactEnvelope', id: 'slice:register-approval' };
  const extract = { type: 'ChainExtract', schemaVersion: 1,
    vector: { owner: 'part-two', name: 'FactPositionVector', id: 'vector:genesis' },
    rows: declarations.map(d => ({ id: d.id, version: `slice-version:${d.id}`, status: 'live', since: 'slice-installation',
      supersedes: [], approvedIn: approvalReference, landedIn: 'slice-installation', base: 'slice-base', contentHash: hashOf(d) })) };
  const registerInput = { commit: 'slice-commit:1', complete: true,
    sources: declarations.map(d => ({ declaration: d, path: 'scripts/slice-assembly.mjs', symbol: 'bootSliceAssembly' })),
    extract, instances: {} };
  const candidate = take(generateRegister(registerInput, registerContext));
  const registerGeneration = take(generationOf(candidate, registerContext));
  const forceRecord = take(decodeGenerationRecord({ type: 'GenerationRecord', schemaVersion: 1, generation: registerGeneration, at: genesisClock }, registerContext));
  const registerChecks = [];
  const registerReply = payload => deriveThrough(take(defineDecoder({ name: 'SliceRegisterReply', owner: 'part-ten', currentVersion: 1,
    versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {}, decodeCurrent: () => ({ ok: true, value: payload }) },
  registerContext.preserved)), { type: 'SliceRegisterReply', schemaVersion: 1 }, registerContext);
  const verifiedRegister = take(loadRegister(candidate, registerGeneration, registerContext, {
    owner: 'part-two',
    verifyExtract(supplied) { registerChecks.push('extract');
      if (bytesOf(supplied) !== bytesOf(candidate.extract)) throw new Error('slice extract mismatch');
      return registerReply(approvalReference); },
    enteringForce(generation) { registerChecks.push('force');
      if (generation.id !== registerGeneration.id) throw new Error('slice generation mismatch');
      return registerReply(forceRecord); },
    isCurrent(vector) { registerChecks.push('current'); return registerReply(vector.id === candidate.extract.vector.id); },
  }, genesisClock));
  const governance = { register: verifiedRegister, context: registerContext };

  // ------------------------------------------------------------ host results
  const boundaryContext = { site: 'facts.admit', preserved: decodeContext.preserved, register: registerShape };
  const result = run => deriveThrough(take(defineDecoder({ name: 'SliceHostResult', owner: 'part-ten', currentVersion: 1,
    versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: () => { try { return { ok: true, value: run() }; } catch (e) { return { ok: false, detail: String(e && e.message ? e.message : e) }; } } },
  boundaryContext.preserved)), { type: 'SliceHostResult', schemaVersion: 1 }, boundaryContext);

  // --------------------------------------------------------------- custody
  const fileCustody = createEffectFileCaptures([paths.captures, paths.peerCaptures], result);
  Object.assign(captureIndex, fileCustody.captures);
  // Reading state back includes the capture BYTES: a P1 decoder resolves an
  // Evidence capture through the decode context, not through the fact index.
  for (const [reference, content] of Object.entries(captureIndex)) if (content && content.bytes !== null) captures[reference] = content.bytes;
  const custody = Object.freeze({ ...fileCustody, capture: bytes => {
    const r = fileCustody.capture(bytes);
    consumeResult(r, { Success: v => { captureIndex[v.reference] = { hash: v.hash, bytes, status: 'available', byteLength: Buffer.byteLength(bytes) }; }, Refused: () => undefined });
    return r;
  } });
  // The judgment custody port writes its own metadata straight into the index.
  // The judgment custody root sits beside the segment file so its own boot-time
  // metadata reconstruction reads this plane's facts.
  const judgmentCustody = createJudgmentCaptures(paths.facts, captureIndex, result, 1048576, captures);
  // Durable custody is content-addressed, so its integrity is checkable at boot.
  // A tampered capture refuses HERE, naming the capture and the failure class,
  // rather than surfacing later as an unrelated appender-wiring complaint.
  for (const name of readdirSync(paths.intake)) {
    if (!/^[a-f0-9]{64}$/.test(name)) continue;
    const bytes = readFileSync(join(paths.intake, name), 'utf8'), hash = `sha256:${name}`;
    if (hashBytes(bytes) !== hash) throw new Error(`integrity: durable intake capture ${hash} no longer matches its content hash`);
    indexCapture(hash, bytes); captures[hash] = bytes;
  }

// --------------------------------------------------- the declared adapter contract
  const sliceContracts = JSON.parse(readFileSync('scripts/slice-contracts.json', 'utf8'));
  const adapterContract = () => {
    const contract = sliceContracts.adapters[config.adapter];
    if (!contract) throw new Error(`no declared evidence contract for adapter ${config.adapter}`);
    return contract;
  };
  // The stage any evidence may claim is READ from the adapter's declared contract.
  // Nothing in this file names a stage; the contract is the ceiling.
  const declaredStage = () => {
    const declared = adapterContract().capabilities.applicationAndDeliveryStage;
    if (declared.status !== 'supported' || !declared.stage) throw new Error('the adapter declares no observable delivery stage');
    return declared.stage;
  };

  const service = createSliceService(home, { adapter: config.adapter, quiescenceTicks: config.quiescenceTicks,
    charge: config.serviceCharge,
    // Evidence completeness follows the DECLARED contract, never the adapter's name.
    decisive: adapterContract().capabilities.decisiveNonOccurrence.status === 'supported',
    hooks: { afterApply: row => boundary('external-send', { operation: row.operation, messageId: row.messageId }) } });

  // ------------------------------------------------------------------- hosts
  const transportHost = { domain: config.domain, machine: config.machine, incarnation, authorityIncarnation,
    principal: bob, scope, maxLeaseTerm: config.maxLeaseTerm, budget: config.budget, monotonic: tick,
    // Part ten's custody reader, required by six before it will release reserved
    // credit for a REPLICATED operation. It is the SAME reader part eight demands
    // durability through, so accounting and effect durability cannot disagree.
    get accountingDurability() { return replicas.durability; },
    current: () => ({ decode: decodeContext, clock: now(), generation: registerShape.generation, stopped: false }) };
  const effectHost = { machine: config.machine, incarnation, principal: bob, scope, boundary: boundaryContext,
    capture: custody.capture,
    current: () => ({ decode: decodeContext, clock: now(), stopped: false, versions: governedVersions(), authority: authorityClosure() }) };
  const judgmentHost = { transport: transportHost, point: 'judgment', floor,
    description: { owner: 'part-ten', provider: 'deterministic-slice-double', model: 'model', route: 'route',
      automaticRetries: 0, maxInputBytes: 16384, maxOutputBytes: 16384, maxCharge: config.maxCharge, measured: false,
      basis: 'deterministic in-process test double; NO live provider call is claimed' },
    refreshFacts: () => result(() => {
      for (const entry of take(store.readForProjection()).entries) {
        if (entry.taint.length || entry.conflicts.length) throw new Error('cannot refresh from tainted facts');
        for (const historical of entry.historical) {
          const view = historical.view;
          if (view.type === 'Evidence' && !evidence.some(old => old.id === view.id)) evidence.push(take(decode('Evidence', view, decodeContext)));
        }
      }
    }) };

  // ------------------------------------------------------------ fact context
  const shared = { version: 1, machineScope: 'shared', standing: 'requester', action: 'work', scope,
    causallyBound: false, requiredReferences: [], authority: 'none' };
  const short = { kind: 'text', maxLength: 1024 };
  const sliceSchemas = [
    { ...shared, kind: 'genesis-grant', fields: { grantId: short, principalId: short, grant: { kind: 'constitutional', type: 'StandingGrant' } } },
    { ...shared, kind: 'slice-accountable-owner', fields: { ownerKey: short, principal: { kind: 'constitutional', type: 'VerifiedPrincipal' } } },
    // Installation evidence must live on the spine: a historical read of a later
    // Decision or Outcome resolves its evidence from the causal cone, never from a
    // pinned in-memory context.
    { ...shared, kind: 'slice-context-evidence', fields: { evidenceId: short, evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...shared, kind: 'slice-placement', fields: { worker: short, harness: short } },
    { ...shared, kind: 'slice-consumption', fields: { worker: short, harness: short,
      hashes: { kind: 'text', maxLength: 65536 }, classes: { kind: 'text', maxLength: 65536 } } },
    { ...shared, kind: 'slice-reply-source', fields: { semanticMessage: short, basis: short,
      text: { kind: 'text', maxLength: 4096 }, result: { kind: 'constitutional', type: 'Result' } } },
    { ...shared, kind: 'slice-delivery-evidence', fields: { operation: short, stage: short, decisive: short,
      evidence: { kind: 'constitutional', type: 'Evidence' }, outcome: { kind: 'constitutional', type: 'Outcome' } } },
    { ...shared, kind: 'slice-obligation', fields: { operation: short, blocker: short, semanticMessage: short,
      state: short, owner: short, exposure: short, detail: { kind: 'text', maxLength: 4096 } } },
  ];

  const factContext = {
    site: 'facts.admit', preserved: decodeContext.preserved, decode: decodeContext, schemas: [],
    keys: [{ id: 'host', machine: config.machine, publicKey: PUBLIC_KEY, from: { epoch: 0, position: 0 } }],
    facts: [], grants: [], revocations: [], genesis: { hash: genesisHash, clock: genesisClock }, timeAnchors: [],
    captures: captureIndex,
    folded: {}, ownedBodies: [],
  };

  const peerBase = createTransportFileStorage(paths.peer, result);
  const peerFile = join(paths.peer, 'facts.json');
  const peerCached = memoOn(() => (existsSync(peerFile) ? statSync(peerFile).size : 0), () => peerBase.read());
  const peerStorage = Object.freeze({ owner: 'part-ten', read: peerCached, append: peerBase.append });
  const peerStore = createFactStore(factContext, peerStorage);
  const replicas = createEffectReplicaStorage(paths.facts, { id: PEER_STANDIN_ID, store: peerStore }, result);
  const originCached = memo(() => replicas.storage.read());
  const originStorage = Object.freeze({ owner: 'part-ten', read: originCached, append: replicas.storage.append });
  const store = createFactStore(factContext, originStorage);
  const author = { context: factContext, privateKey: PRIVATE_KEY };

  // `intakeOwners` is the installation's resolution of part four's opaque accountable
  // work-owner key. Every run decode context carries it as a LIVE accessor, because
  // part five's owned-body decoders close over the context they were registered with
  // and must still see the durable owner fact this boot reads back.
  const makeRunContext = factsValue => ({ site: boundaryContext.site, preserved: boundaryContext.preserved,
    register: registerShape, types: decodeContext, stimulusKinds: ['intake-admitted'],
    evidenceSources: { settlement: 'slice-service', exit: 'probe' }, facts: factsValue,
    get intakeOwners() { const f = ownerFact(); return f
      ? { 'slice-run-owner': { type: 'VerifiedPrincipal', id: bob.id, fact: factRef(f), field: 'principal' } } : {}; } });
  factContext.schemas = [...sliceSchemas, ...intakeFactSchemas(scope), ...intakeVerifiedActFactSchemas(scope), ...transportSchemas(transportHost),
    ...judgmentSchemas(judgmentHost), ...effectSchemas(effectHost)];
  const runRegistration = take(runFactSchemas(makeRunContext(factContext)));
  factContext.schemas = [...factContext.schemas, ...runRegistration.schemas];
  const intakeBoundary = { site: 'intake.admit', preserved: decodeContext.preserved, register: registerShape };
  factContext.ownedBodies = [
    // Part four's owner decoders must also be present for replication and rebuild;
    // the intake port installs its own copies for its own calls.
    take(intakeWorkRegistration(intakeBoundary, observer.id)),
    take(intakeStopRegistration(intakeBoundary, observer.id)),
    ...take(registerTransportBodies(transportHost, boundaryContext, consumeEffectSettlement)),
    ...take(registerJudgmentBodies(judgmentHost, boundaryContext)),
    ...take(registerEffectBodies(effectHost)),
    ...runRegistration.registrations,
  ];
  // A restart must be able to decode the prior process's production-composition
  // records on its first durable read. Install the real Part Ten and Part Nine
  // owner schemas before any projection touches the segment; only dependency
  // reference kinds with no owner schema receive the narrow id-only adapter.
  if (config.productionRestart === true) {
    const restartBoundary = Object.freeze({ ...boundaryContext, validateReferences: true });
    const restartAssemblyHost = { machine: config.machine, principal: bob, scope, boundary: restartBoundary,
      current: () => ({ facts: factContext, generation: 'generation:1', stopped: false, clock: now() }) };
    const restartVerificationHost = { machine: config.machine, principal: observer, scope, boundary: restartBoundary,
      current: () => ({ decode: decodeContext, clock: now(), generation: 'generation:1', stopped: false,
        facts: factContext, evidence: decodeContext.evidence ?? [] }) };
    const ownerSchemas = [...assemblySchemas(restartAssemblyHost), ...verificationSchemas(restartVerificationHost)];
    const dependencyKinds = ['fact-local-durable-segment', 'register-generation-record', 'identity-key-set',
      'clock-source', 'transport-Lease', 'transport-FenceToken', 'fact-replication-receipt', 'conversation-binding',
      'conversation-route', 'delivery-evidence-service'];
    const referenceKinds = [...new Set(['check-run-record', 'verification-ProbeRecord', 'assembly-reference-evidence',
      'operator-surface-registration', 'operator-challenge-verifier-binding', 'intake-verified-act-binding',
      'minimal-plane-projection-binding', 'minimal-plane-replay-binding', 'minimal-responder-binding',
      ...dependencyKinds, 'assembly-lifecycle-control-binding', 'platform-delivery-witness-binding'])];
    const schemaBase = factContext.schemas[0];
    factContext.schemas = [...factContext.schemas, ...ownerSchemas,
      ...referenceKinds.filter(kind => ![...factContext.schemas, ...ownerSchemas].some(schema => schema.kind === kind))
        .map(kind => ({ ...schemaBase, kind, fields: { id: { kind: 'text', maxLength: 4096 } },
          causallyBound: false, requiredReferences: [], authority: 'none' }))]
      .filter((schema, index, all) => all.findIndex(candidate => candidate.kind === schema.kind && candidate.version === schema.version) === index);
    const verifiedActGeneration = { owner: 'part-three', name: 'RegisterGeneration', id: registerGeneration.id };
    factContext.ownedBodies = [...factContext.ownedBodies,
      take(intakeVerifiedActRegistration(restartBoundary, observer.id, verifiedActGeneration)),
      ...take(registerAssemblyBodies(restartAssemblyHost)), ...take(registerVerificationBodies(restartVerificationHost))]
      .filter((row, index, all) => all.findIndex(candidate => candidate.owner === row.owner && candidate.name === row.name) === index);
  }
  const kinds = () => [...new Set(factContext.schemas.map(s => s.kind))];

  // -------------------------------------------------------------- fact helpers
  // Hoisted: part five's owned-body decoders read the live owner fact through
  // `runDecodeSeed`'s getter while the schemas are still being registered.
  const readFacts = memo(() => take(store.read()));
  function facts() { return readFacts(); }
  function factOfKind(kind) { return facts().find(f => f.kind === kind); }
  function factsOfKind(kind) { return facts().filter(f => f.kind === kind); }
  function factRef(fact) { return { owner: 'part-two', name: 'FactEnvelope', id: fact.id }; }
  function ownerFact() { return factOfKind('slice-accountable-owner'); }
  const append = (kind, body, required = [], principal = observer, provenance = observer.provenance) =>
    take(authorAndAppend({ kind, schemaVersion: 1, machine: config.machine, principal: json(principal),
      provenance: json(provenance), at: json(now()), body: json(body), required }, factContext, store, PRIVATE_KEY)).fact;

  // ----------------------------------------------------- the governed version
  const operationDefinition = { type: 'OperationDefinition', schemaVersion: 1, id: 'slice-reply-definition:1',
    feature: 'reply', version: 'slice-reply-version:1', generation: registerShape.generation.id, adapter: config.adapter,
    account: config.account, conversation: config.conversation, speaker: bob.id, scopeDigest: hashOf(scope),
    durability: 'replicated', replicas: 1,
    lossModel: 'Second local directory is a peer STAND-IN; shared disk loss is NOT covered.',
    maxBytes: 4096, maxCharge: config.maxCharge, timeout: 100000, verificationBar: 'slice-reply-bar:1' };
  const definitionArtifact = capture(bytesOf(operationDefinition));
  const operatorBase = 'slice-base:1';
  const operatorRequestDigest = authorizationRequestDigest({ approver: alice, action: { kind: 'work', scope },
    artifact: definitionArtifact, base: operatorBase });
  Object.assign(decodeContext, { currentBase: operatorBase, artifact: definitionArtifact });
  const approvalPayload = { id: 'slice-reply-approval', at: genesisClock, approver: alice, under: bindingGrant.id,
    action: { kind: 'work', scope }, artifact: definitionArtifact, base: operatorBase, kind: { kind: 'approval' }, requestedBy: bob };
  const signedApproval = { ...approvalPayload, requestDigest: authorizationRequestDigest(approvalPayload) };
  const explicitYes = take(decode('Provenance', proof(signedApproval, { id: 'alice', kind: 'person' }, 'approval', false), decodeContext));
  const approval = take(decode('Authorization', { type: 'Authorization', schemaVersion: 1, ...signedApproval, explicitYes },
    { ...decodeContext, provenance: explicitYes }));
  authorizations.push(approval);
  const governedVersions = () => [{ id: operationDefinition.version, subject: operationDefinition.feature,
    content: json(operationDefinition), contentHash: hashOf(operationDefinition), since: 'slice-installation',
    supersedes: [], approvedIn: approval, base: approval.base, landedIn: null }];
  const authorityClosure = () => { const f = factOfKind('slice-reply-source'); return f ? [f.id] : []; };

  // ------------------------------------------------------------------ adapters
  const intakeAdapter = { id: config.adapter,
    authenticate: (raw, route) => result(() => {
      const provenance = proof({ id: alice.id, kind: 'person' }, { id: alice.id, kind: 'person' }, 'identity', true);
      boundary('authentication', { channel: route.channel, sender: route.sender });
      return { provenance, principalId: alice.id, principalKind: 'person',
        channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch };
    }),
    parse: raw => JSON.parse(raw) };
  const intakeCapturePort = { owner: 'part-ten', preserve: raw => result(() => {
    const hash = hashBytes(raw);
    writeDurable(join(paths.intake, hash.slice(7)), paths.intake, raw);
    indexCapture(hash, raw); captures[hash] = raw;
    boundary('preservation', { capture: hash });
    return { reference: hash, hash };
  }) };
  // Production-restart authority is control-plane evidence completed before the
  // section-7 data-plane drive. It uses the same durable capture store, but must
  // not masquerade as another message-preservation boundary in the slice's
  // enumerated chain (which would duplicate `preservation` on every clean boot).
  const operatorCapturePort = { owner: 'part-ten', preserve: raw => result(() => {
    const hash = hashBytes(raw);
    writeDurable(join(paths.intake, hash.slice(7)), paths.intake, raw);
    indexCapture(hash, raw); captures[hash] = raw;
    return { reference: hash, hash };
  }) };

  // Six is constructed WITH eight's published settlement consumer, so `settle` can
  // apply an authentic eight-issued settlement and mark the operation RESOLVED.
  const transport = createTransportAuthority(transportHost, createTransportSpine(transportHost, author, store), boundaryContext, consumeEffectSettlement);
  const transportFacts = memo(() => take(transport.inspect()));
  const currentFenceEpoch = () => { const l = transportFacts().filter(v => v.record.type === 'Lease').at(-1); return l ? l.record.epoch : 0; };

  const operationAdapter = { owner: 'part-ten', id: config.adapter,
    describe: () => ({ contract: `${config.adapter}-evidence:1`, account: config.account, conversation: config.conversation,
      maxCharge: config.maxCharge, timeout: operationDefinition.timeout, hiddenRetries: 0 }),
    invoke: input => result(() => {
      const row = service.apply({ operation: input.operation, claim: input.claim, digest: input.digest,
        account: input.message.account, conversation: input.message.conversation,
        semanticMessage: input.message.semanticMessage, text: input.message.text, fenceEpoch: currentFenceEpoch() });
      return JSON.stringify({ ok: true, result: { message_id: row.messageId, chat: { id: row.conversation }, text: row.text } });
    }),
    observe: input => result(() => JSON.stringify(service.lookup(input.operation))) };

  // ------------------------------------------- part nine STAND-IN assessment
  // ANNOUNCED STAND-IN. Part nine is unbuilt on this base. It consumes the
  // eight-owned EffectAssessmentPort contract and reads ONLY durable
  // slice-delivery-evidence facts written by the independent witness reader.
  let assessmentGuards = 0;
  const evidenceRowFor = operation => factsOfKind('slice-delivery-evidence').find(f => f.body.operation === operation);
  const assessmentView = input => {
    const row = evidenceRowFor(input.reservation.operation);
    if (!row) throw new Error('no independent delivery evidence is recorded for this operation');
    return Object.freeze({ outcome: take(decode('Outcome', row.body.outcome, decodeContext)),
      finalCharge: row.body.decisive === 'decisive' ? service.finalCharge(input.reservation.operation) : null,
      delayedExecutionExcluded: row.body.decisive === 'decisive',
      required: Object.freeze([row.id]) });
  };
  const assessor = { owner: 'part-nine',
    assess: input => result(() => {
      if (assessmentGuards) throw new Error('assessment is held by a synchronous consumer');
      const row = evidenceRowFor(input.reservation.operation);
      if (!row) throw new Error('no independent delivery evidence is recorded for this operation');
      return { owner: 'part-nine', name: 'VerificationAssessment', id: row.id };
    }),
    read: (reference, input) => result(() => assessmentView(input)),
    consumeCurrent: (reference, input, consume) => result(() => {
      const current = assessmentView(input);
      assessmentGuards++;
      try { return consume(current); } finally { assessmentGuards--; }
    }) };

  // Instrumented view of six for the doorways. It changes NOTHING: every call and
  // every value passes through unchanged. It only observes that a six-owned durable
  // boundary completed, so the kill schedule can cut there.
  const observedTransport = Object.freeze({ ...transport,
    reserve: input => { const r = transport.reserve(input); if (refusal(r) === null)
      boundary(String(input.command).startsWith('judgment:') ? 'judgment-reservation' : 'outbound-reservation', { command: input.command }); return r; },
    claim: (command, fence, operation) => { const r = transport.claim(command, fence, operation); if (refusal(r) === null)
      boundary(String(command).startsWith('judgment:') ? 'judgment-claim' : 'outbound-claim', { operation }); return r; },
    consume: (capability, fence) => { const r = transport.consume(capability, fence); if (refusal(r) === null)
      boundary(String(capability.operation).length && judgmentOperations().includes(capability.operation) ? 'judgment-dispatch' : 'outbound-consume', { operation: capability.operation }); return r; },
  });
  const judgmentOperations = () => transportFacts().filter(v => v.record.type === 'AdmissionReservation'
    && String(v.record.command).startsWith('judgment:')).map(v => v.record.operation);

  const baseEffectSpine = createEffectSpine(effectHost, author, store);
  // Spine-level instrumentation: the boundary fires only AFTER the owner's durable
  // append receipt, so a cut is genuinely "after that durable boundary".
  const effectSpine = Object.freeze({ store: baseEffectSpine.store, append: (record, required) => {
    const r = baseEffectSpine.append(record, required);
    if (refusal(r) === null) {
      if (record.type === 'EffectRequest') boundary('outbound-preparation', { request: record.id, semanticMessage: record.semanticMessage, digest: record.digest });
      if (record.type === 'EffectSettlement') boundary('settlement', { operation: record.operation });
    }
    return r;
  } });
  const effects = createEffectDoorway({ host: effectHost, spine: effectSpine, transport: observedTransport,
    durability: replicas.durability, custody: custody.custody, adapter: operationAdapter, assessment: assessor });

  // ------------------------------------------------------------------- seven
  const modelClient = { automaticRetries: 0, execute: async send => { await send(); } };
  const modelInvoke = async () => {
    boundary('model-invocation');
    return { state: 'complete', providerOperation: 'slice-double-operation:1', retryBlocked: false,
      usage: { inputTokens: 17, outputTokens: 11, charge: 2, source: 'deterministic in-process double; NOT a billing receipt' },
      bytes: JSON.stringify({ type: 'Decision', schemaVersion: 1, id: 'slice-decision:1', at: json(now()),
        by: { judgment: 'judgment', model: 'model', route: 'route' },
        conclusion: { subject: 'requested-reply', predicate: 'classification', value: 'permitted-and-bounded', evidence: ['slice-e1'] },
        reason: { subject: 'requested-reply', predicate: 'supported', value: true, evidence: ['slice-e1', 'slice-e2'] },
        floor: { allowed: json(floor), chosen: 'work' } }) };
  };
  const model = take(createModelAdapter(judgmentHost.description, modelClient, modelInvoke, observedTransport, transportHost, boundaryContext));
  const baseJudgmentSpine = createJudgmentSpine(judgmentHost, author, store);
  const judgmentSpine = Object.freeze({ store: baseJudgmentSpine.store, append: (record, attachments) => {
    const r = baseJudgmentSpine.append(record, attachments);
    if (refusal(r) === null) {
      if (record.type === 'JudgmentRequest') boundary('judgment-request', { judgmentRequest: record.id, logicalKey: record.logicalKey, inputDigest: record.inputDigest });
      if (record.type === 'JudgmentResolution') boundary('judgment-resolution', { judgmentResolution: record.id });
    }
    return r;
  } });
  const judgment = createJudgmentDoorway({ host: judgmentHost, authority: observedTransport,
    spine: judgmentSpine, captures: judgmentCustody, model, boundary: boundaryContext });

  // -------------------------------------------------------------------- four
  // The lineage head is observed AT the head fact's own recorded clock, never at a
  // later reader clock: a reader must never claim to have observed the future.
  const lineages = () => { const head = rawFacts().at(-1); return { [config.machine]: {
    head: head ? { epoch: head.segment.epoch, position: head.segment.position } : null,
    observedAt: head ? head.at.value : genesisClock.value, closed: false } }; };
  const generation = () => ({ reference: registerShape.generation, kinds: kinds(), lineages: lineages() });
  const intake = take(createIntakePort({ adapter: intakeAdapter, capture: intakeCapturePort, storage: originStorage,
    context: () => factContext,
    author: { machine: config.machine, principal: observer, provenance: observer.provenance, privateKey: PRIVATE_KEY },
    clock: now, governance, scope, workOwner: 'slice-run-owner', holdMaxAge: 1000000, holdMaxActive: 2,
    dedupGeneration: generation, dedupStalenessBound: 1000000 }));

  // The restart worker cannot carry a fixture object through SIGKILL. Build its
  // operator confirmation from this execution's own signed Part Two history and
  // the real Part Four intake port instead. The request and disposition are
  // durable, so later boots reuse the completed act rather than replaying proof.
  const operatorSnapshots = new WeakMap();
  function ensureOperatorRequest() {
    install();
    const existing = factsOfKind('authorization-request').find(row => row.body.requestId === 'slice-operator-request:1');
    if (existing) return existing;
    const evidence = take(operatorCapturePort.preserve('restart operator request evidence', now()));
    const root = factOfKind('genesis-grant');
    if (!root) throw new Error('restart operator request requires the installed genesis grant');
    return append('authorization-request', { requestId: 'slice-operator-request:1', requestDigest: operatorRequestDigest,
      action: 'work', scope, audience: 'operator', artifact: definitionArtifact, base: operatorBase,
      expiresAt: 100000000, grantExpiresAt: 90000000, approverId: alice.id, requestedById: bob.id, consequence: 'control',
      reversibility: 'irreversible', blockedWork: 'the recovered attributable reply',
      recurrence: JSON.stringify(['the same durable slice resumes after a process cut']),
      requesterProse: 'complete the already-bound recovered reply', evidence }, [root.id], alice, alice.provenance);
  }
  function restartOperator(verification) {
    const surfaceGeneration = { owner: 'part-three', name: 'RegisterGeneration', id: registerGeneration.id };
    const surfaceDecode = { ...decodeContext, register: { ...decodeContext.register, generation: surfaceGeneration } };
    const history = { owner: 'part-two',
      current: () => result(() => {
        const size = segmentSize(), rows = facts();
        const current = take(prepareSnapshot(rows, { ...factContext, facts: rows }, () => segmentSize() === size));
        operatorSnapshots.set(current, size); return current;
      }),
      isCurrent: current => result(() => operatorSnapshots.get(current) === segmentSize()),
      decode: () => surfaceDecode, clock: now, generation: () => surfaceGeneration,
      expectedKind: reference => facts().find(row => row.id === reference)?.kind ?? null };
    const used = new Set();
    const verifier = { owner: 'part-nine', administration: 'independent',
      issue: subject => result(() => ({ id: `challenge:${subject.request}`, ...subject })),
      verify: (challenge, _proof, decision) => result(() => {
        if (used.has(challenge.id)) throw new Error('restart operator challenge was already consumed');
        used.add(challenge.id);
        const actPayload = { id: `act:${challenge.request}`, at: now(), approver: alice, under: bindingGrant.id,
          action: { kind: challenge.action, scope: challenge.scope }, artifact: challenge.artifact, base: challenge.base,
          kind: { kind: 'approval' }, requestedBy: bob, requestDigest: challenge.requestDigest };
        const actProofInput = proof(actPayload, { id: alice.id, kind: 'person' }, 'approval', false, 'surface:phone',
          clockAt(challenge.issuedAt), true);
        const actProof = take(decode('Provenance', actProofInput, { ...decodeContext, preserved: challenge.request }));
        const act = decision === 'decline' ? null : take(decode('Authorization', {
          type: 'Authorization', schemaVersion: 1, ...actPayload, explicitYes: actProof,
        }, { ...decodeContext, provenance: actProof, currentBase: challenge.base, artifact: challenge.artifact,
          now: now(), actAt: now() }));
        const actDigest = act === null ? 'none' : hashOf(act);
        const challengePayload = { type: 'VerifiedOperatorChallenge', schemaVersion: 1, challenge: challenge.id,
          request: challenge.request, requestDigest: challenge.requestDigest, renderingDigest: challenge.renderingDigest,
          action: challenge.action, scope: challenge.scope, audience: challenge.audience, operator: challenge.operator,
          requestedBy: challenge.requestedBy, artifact: challenge.artifact, base: challenge.base,
          issuedAt: challenge.issuedAt, expiresAt: challenge.expiresAt, singleUse: true, decision, actDigest,
          surface: challenge.surface, generation: challenge.generation };
        const challengeProofInput = proof(challengePayload, { id: alice.id, kind: 'person' },
          'verified-operator-challenge', false, 'surface:phone', clockAt(challenge.issuedAt), true);
        const challengeProof = take(decode('Provenance', challengeProofInput, { ...decodeContext, preserved: challenge.request }));
        const bundle = JSON.stringify({ type: 'VerifiedActProofBundle', schemaVersion: 1,
          challenge: challengeProofInput, act: act === null ? null : actProofInput });
        const captureReference = take(operatorCapturePort.preserve(bundle, now()));
        return { challenge: challenge.id, principal: alice, provenance: challengeProof, act, capture: captureReference };
      }) };
    const verificationView = { ...verification, probeBound: () => result(() => false) };
    const surface = take(createOperatorSurface({ id: 'surface:phone', boundary: boundaryContext, history, verifier,
      intake: { owner: 'part-four', operation: 'admitVerifiedAct', port: intake },
      emergencyStop: { owner: 'part-four', stop: () => result(() => factRef(ensureOperatorRequest())) },
      broker: { owner: 'part-nine', install: () => result(() => { throw new Error('restart broker mutation is unavailable'); }),
        query: () => result(() => null), posture: () => result(() => 'unprotected') },
      verification: verificationView, requestKind: 'authorization-request', terminalKinds: ['intake-verified-act'],
      bindingKind: 'conversation-binding', maxPending: 8, challengeLifetime: 300000, witnessFreshness: 300000,
      isolation: { owner: 'part-ten', live: () => result(() => false) } }));
    const request = ensureOperatorRequest();
    return { surface, verifier, request: request.id,
      complete() {
        const existing = factsOfKind('intake-verified-act').find(row => row.body.request === request.id);
        if (existing) return factRef(existing);
        const challenge = take(surface.challenge(request.id));
        return take(surface.confirm({ challenge, proof: 'verified-restart-operator-proof', decision: 'approve' }));
      } };
  }

  // -------------------------------------------------------------------- five
  let fenceCache;
  const liveFence = () => {
    const all = transportFacts();
    const lease = all.filter(v => v.record.type === 'Lease').at(-1);
    if (fenceCache && lease && lease.record.state === 'held' && lease.record.incarnation === incarnation) return fenceCache;
    fenceCache = take(transport.acquire(`slice-acquire:${incarnation}`, all.at(-1)?.fact.id ?? '', config.leaseTerm));
    return fenceCache;
  };
  const admitPrefix = key => `slice-run-admit:${key}:`;
  const fencedAppend = (key, write) => {
    take(transport.admitWrite(`${admitPrefix(key)}${incarnation}`, liveFence()));
    return take(write());
  };
  const runAdmission = { owner: 'part-six',
    // Six realizes exclusion AT the append boundary: a fenced write admission is
    // committed to six's own ledger immediately before the callback appends, so
    // `verify` later reads six's own durable Lease-write fact, not a side ledger.
    create: (opening, run, write) => result(() => fencedAppend(`open:${run}`, write)),
    commit: (request, write) => result(() => fencedAppend(`commit:${request.run}:${request.operation}`, write)),
    verify: reference => result(() => {
      const all = facts(), index = all.findIndex(f => f.id === reference.id);
      if (index < 0) throw new Error('admitted run fact is absent');
      const fact = all[index];
      const key = fact.kind === 'run-opening' ? `open:${fact.body.run}` : `commit:${fact.body.run}:`;
      const prefix = admitPrefix(key);
      const witnessed = all.slice(0, index).some(f => f.kind === 'transport-Lease'
        && f.body.record.operation === 'write' && String(f.body.record.command).startsWith(prefix));
      if (!witnessed) throw new Error('no six-owned fenced write admission precedes this run fact');
      return reference;
    }),
    execution: (run, ownership) => result(() => {
      const placement = readLines(paths.placement).at(-1);
      if (!placement) throw new Error('no durable placement record on this machine');
      const lease = transportFacts().filter(v => v.record.type === 'Lease').at(-1);
      if (!lease || ownership.id !== `slice-lease:${lease.record.epoch}`) throw new Error('ownership reference is not the live lease');
      const contextFact = factsOfKind('slice-placement').at(-1);
      if (!contextFact) throw new Error('no durable execution-context fact');
      return { worker: placement.worker, harness: placement.harness, ownership, context: factRef(contextFact) };
    }),
    reservation: (reference, step) => result(() => {
      const row = transportFacts().find(v => v.record.type === 'AdmissionReservation' && v.record.operation === reference.id);
      if (!row) throw new Error('no six-owned reservation names this step');
      if (row.record.digest !== step.operation.digest) throw new Error('reservation digest differs from the admitted step');
      return factRef(row.fact);
    }) };

  const groundingPolicy = { entry: 'bound', threshold: 20, maxAge: 1000000,
    briefingClasses: ['identity', 'rules', 'directives', 'pending-work'] };
  const groundingRead = { owner: 'part-ten', read: request => result(() => {
    const all = facts();
    const stimuli = all.filter(f => f.kind === 'intake-admitted').sort((a, b) => a.segment.position - b.segment.position);
    const messages = stimuli.map(f => ({ fact: factRef(f), sequence: f.segment.position,
      capture: f.body.rawHash, hash: f.body.rawHash }));
    // Ten's consumption receipt binds what was actually delivered to the worker:
    // the exact message capture hashes and the governed briefing classes.
    const consumption = append('slice-consumption', { worker: request.worker, harness: request.harness,
      hashes: JSON.stringify(messages.map(m => m.hash)), classes: JSON.stringify(groundingPolicy.briefingClasses) }, []);
    const at = now();
    return { type: 'SessionGrounding', schemaVersion: 2, id: `slice-grounding:${consumption.id}`, run: request.run.run.id,
      expected: request.run.head, worker: request.worker, harness: request.harness, reason: request.reason,
      ownership: request.execution.ownership, executionContext: request.execution.context,
      at, previousActivity: genesisClock,
      elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: request.worker },
        value: at.value - genesisClock.value, unit: 'ms', at, by: 'probe' },
      principal: request.run.run.owner, intake: factRef(stimuli[0]), binding: request.run.run.resultDestination.binding,
      directives: [], generation: registerShape.generation,
      frontier: { [config.machine]: { epoch: consumption.segment.epoch, position: consumption.segment.position } },
      knownLineages: [config.machine], threshold: groundingPolicy.threshold, messages,
      lastInbound: factRef(stimuli[stimuli.length - 1]), pendingOperations: request.run.pending.map(s => s.operation.key),
      children: [], receipts: [], briefingClasses: groundingPolicy.briefingClasses, consumption: factRef(consumption) };
  }) };

  const settlementConsumer = { owner: 'part-eight', read: reference => result(() => {
    const settlementFact = facts().find(f => f.id === reference.id);
    if (!settlementFact) throw new Error('settlement fact is absent');
    const value = take(effects.settle(settlementFact.body.record.operation));
    return take(consumeEffectSettlement(value, boundaryContext, current => ({ record: reference,
      outcome: take(decode('Outcome', current.outcome, decodeContext)),
      claimClosed: current.retryEligible === false, chargeSettled: current.finalCharge !== null })));
  }) };
  const controlConsumer = { owner: 'part-four', verify: (kind, fact) => result(() => {
    const stop = facts().find(f => f.id === fact.id && f.kind === 'intake-stop');
    if (!stop) throw new Error('no authenticated part-four stop names this trigger');
    return factRef(stop);
  }) };
  // Part nine is unbuilt: the exit check has NO published seam. It REFUSES rather
  // than manufacture an exit witness, so a run stays in an owned-pending state.
  const exitCheck = { owner: 'part-nine', verify: () => result(() => {
    throw new Error('part-nine exit verification is unbuilt on this base; no exit witness can be produced');
  }) };

  const runGovernance = { register: verifiedRegister, context: registerContext,
    capture: { owner: 'part-two', preserve: input => result(() => {
      const encoded = take(canonical(input)), reference = `gate-input:${encoded.hash}`;
      indexCapture(reference, encoded.bytes);
      return reference;
    }) } };
  const runContext = () => makeRunContext({ ...factContext, facts: facts() });
  const runDeps = { governance: runGovernance, store, admission: runAdmission, grounding: groundingRead,
    settlement: settlementConsumer, control: controlConsumer, exitCheck, groundingPolicy, generation, clock: now,
    writer: { owner: 'part-ten', append: (kind, run, record, required) => result(() =>
      take(authorAndAppend({ kind, schemaVersion: 1, machine: config.machine, principal: json(bob), provenance: json(bob.provenance),
        at: json(now()), body: json({ run, record: recordWire(record) }), required }, factContext, store, PRIVATE_KEY))) } };
  const runGraph = () => take(createRunGraph({ ...runDeps, context: runContext() }));

  // -------------------------------------------------------- installation facts
  function install() {
    let root = factOfKind('genesis-grant');
    if (!root) {
      // The genesis grant is installation input; its act provenance is the grant's
      // own approved org-intent source, so it needs a context pinned to that act.
      const grantContext = { ...factContext, decode: { ...decodeContext, provenance: bindingGrant.source } };
      root = take(authorAndAppend({ kind: 'genesis-grant', schemaVersion: 1, machine: config.machine,
        principal: json(alice), provenance: json(bindingGrant.source), at: json(now()),
        body: json({ grantId: bindingGrant.id, principalId: alice.id, grant: bindingGrant }), required: [] },
      grantContext, createFactStore(grantContext, originStorage), PRIVATE_KEY)).fact;
    }
    factContext.grants = [{ factId: root.id, grant: bindingGrant }];
    let binding = factOfKind('conversation-binding');
    if (!binding) binding = take(authorAndAppend({ kind: 'conversation-binding', schemaVersion: 1, machine: config.machine,
      principal: json(alice), provenance: json(alice.provenance), at: json(now()),
      body: json({ adapter: config.adapter, channel: config.channel, sender: config.sender, identityEpoch: config.identityEpoch,
        principalId: alice.id, grantId: bindingGrant.id, scope, supersedes: 'none' }), required: [root.id] },
    factContext, store, PRIVATE_KEY)).fact;
    for (const e of evidence.filter(e => e.id.startsWith('slice-e'))) {
      if (!factsOfKind('slice-context-evidence').some(f => f.body.evidenceId === e.id))
        append('slice-context-evidence', { evidenceId: e.id, evidence: e }, [], alice, alice.provenance);
    }
    let owner = ownerFact();
    if (!owner) owner = append('slice-accountable-owner', { ownerKey: 'slice-run-owner', principal: bob }, [], bob, bob.provenance);
    let placement = factOfKind('slice-placement');
    if (!placement) placement = append('slice-placement', { worker: `slice-worker:${config.machine}`, harness: 'slice-harness:1' }, []);
    return { root, binding, owner, placement };
  }
  // Restoring `factContext.grants` on every boot is part of reading state back.
  const restoreGrants = () => { const root = factOfKind('genesis-grant'); if (root) factContext.grants = [{ factId: root.id, grant: bindingGrant }]; };
  restoreGrants();
  /**
   * Delivery evidence written by an earlier boot is read back into the live context.
   * Its witness bytes come from durable custody, reloaded at boot; if a capture is
   * genuinely gone the evidence stays absent and consequential use refuses.
   */
  const restoreEvidence = () => {
    for (const row of factsOfKind('slice-delivery-evidence')) {
      const raw = row.body.evidence;
      if (evidence.some(e => e.id === raw.id)) continue;
      try { evidence.push(take(decode('Evidence', raw, decodeContext))); } catch { /* absent evidence refuses at use */ }
    }
  };

  // ======================================================================
  // The chain. Level-triggered: every step derives what to do next from the
  // durable facts, so a restart after ANY cut resumes without a recovery helper.
  // ======================================================================
  // The conversation delivers inbound through the SAME adapter's own durable journal,
  // so a pre-receipt crash is an ordinary redelivery of the identical row.
  const delivery = () => service.deliverInbound({ channel: config.channel, sender: config.sender,
    identityEpoch: config.identityEpoch, eventId: config.eventId,
    raw: JSON.stringify({ schemaVersion: 1, kind: 'message', text: config.ask }) });
  const steps = [];
  let traceMark = Date.now();
  const record = (step, state, extra = {}) => {
    const elapsed = Date.now() - traceMark; traceMark = Date.now();
    if (process.env.SLICE_TRACE) process.stderr.write(`[slice] ${step}=${state} ${elapsed}ms\n`);
    steps.push({ step, state, elapsedMs: elapsed, ...extra }); return extra;
  };

  const obligation = (fields) => append('slice-obligation', {
    operation: fields.operation, blocker: fields.blocker ?? 'none', semanticMessage: fields.semanticMessage,
    state: fields.state, owner: fields.owner, exposure: String(fields.exposure ?? 0), detail: fields.detail ?? '' }, fields.required ?? []);

  async function drive(admitRequiredDependencies) {
    install(); restoreGrants(); restoreEvidence();

    // ---- 1. preserve, authenticate, resolve standing, admit -----------------
    let admitted = factOfKind('intake-admitted');
    if (!admitted) {
      const receipts = facts().filter(f => f.kind === 'intake-receipt');
      const inbound = delivery();
      const outcome = receipts.length ? settled(intake.recover(receipts[receipts.length - 1].id))
        : settled(intake.receive(inbound.raw, inbound.route));
      record('intake', outcome.ok ? outcome.value.kind : 'refused', { detail: outcome.ok ? null : outcome.detail });
      admitted = factOfKind('intake-admitted');
      if (!admitted) return report();
      boundary('standing', { logicalId: admitted.body.logicalId });
    } else record('intake', 'already-admitted');

    // A production wrapper supplies Part Ten's live dependency admission. The
    // check happens only after intake is durable and before any run, judgment,
    // reply, or effect can begin. The outage is itself durable and owned; a
    // matching recovery appends a closure before normal execution resumes.
    if (typeof admitRequiredDependencies === 'function') {
      const admission = admitRequiredDependencies();
      const prior = factsOfKind('slice-obligation')
        .filter(f => String(f.body.operation).startsWith('prerequisite:')).at(-1);
      if (!admission.admitted) {
        const operation = `prerequisite:${admission.name}`;
        if (!prior || prior.body.operation !== operation || prior.body.state !== 'owned-pending-prerequisite-outage')
          obligation({ operation, blocker: admission.name, semanticMessage: 'minimal-path-prerequisite',
            state: 'owned-pending-prerequisite-outage', owner: 'part-ten', exposure: 0,
            detail: `live dependency admission refused after durable intake preservation: ${admission.detail}` });
        record('prerequisites', 'refused', { dependency: admission.name, detail: admission.detail });
        return report(rebuildAll());
      }
      if (prior?.body.state === 'owned-pending-prerequisite-outage')
        obligation({ operation: prior.body.operation, blocker: 'none', semanticMessage: prior.body.semanticMessage,
          state: 'recovered', owner: 'part-ten', exposure: 0,
          detail: 'matching Part Ten lifecycle recovery restored live dependency admission' });
      record('prerequisites', 'admitted');
    }

    // ---- 2. admit one durable run ------------------------------------------
    let opening = factOfKind('run-opening');
    if (!opening) {
      const outcome = settled(runGraph().open(buildRun(admitted)));
      record('run', outcome.ok ? 'opened' : 'refused', { detail: outcome.ok ? null : outcome.detail });
      opening = factOfKind('run-opening');
      if (opening) boundary('run-creation', { run: opening.body.run, owner: opening.body.record.owner.id });
    } else record('run', 'already-open');

    // ---- 3. actual-start grounding -----------------------------------------
    // Attempted ONCE per execution: a refusal is recorded as an owned-pending
    // obligation, so later boots neither re-attempt it nor grow the plane.
    const groundingHeld = () => factsOfKind('slice-obligation').some(f => f.body.operation.startsWith('grounding:'));
    if (opening && !factOfKind('session-grounding') && !groundingHeld()) {
      liveFence();
      const outcome = settled(runGraph().ground(opening.body.run, `slice-worker:${config.machine}`, 'slice-harness:1', 'start',
        { owner: 'part-six', name: 'Lease', id: `slice-lease:${currentFenceEpoch()}` }));
      record('grounding', outcome.ok ? 'grounded' : 'refused', { detail: outcome.ok ? null : outcome.detail });
      if (factOfKind('session-grounding')) boundary('grounding');
      else obligation({ operation: `grounding:${opening.body.run}`, blocker: 'part-five', semanticMessage: 'actual-start-grounding',
        state: 'owned-pending-unadmitted', owner: 'part-five', exposure: 0, detail: String(outcome.detail).slice(0, 3000) });
    } else if (opening && !factOfKind('session-grounding')) record('grounding', 'held', { detail: 'recorded owned-pending; not re-attempted' });

    // ---- 4. six's bounded observation wake (required before any reservation) --
    if (opening && !transportFacts().some(v => v.record.type === 'LoopRecord')) {
      const policy = take(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'slice-observation-policy', maxAttempts: 3,
        minDelay: 1, maxDuration: 1000000, timeout: 1000, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, boundaryContext));
      const outcome = settled(transport.schedule(`slice-schedule:${incarnation}`, liveFence(),
        { owner: 'part-five', name: 'Run', id: opening.body.run }, policy));
      record('loop', outcome.ok ? 'scheduled' : 'refused', { detail: outcome.ok ? null : outcome.detail });
    }

    // ---- 5. one bounded model judgment through the registered doorway --------
    if (asksJudgment()) { await driveJudgment(opening); ownModelOperation(); }
    else record('judgment', 'declared-out-of-this-profile',
      { detail: 'six admits ONE operation per run in this domain; this profile spends it on the reply. See .instar/lanes/slice-six-gap.md' });

    // ---- 6. render one attributable ordinary reply --------------------------
    // In a judgment-bearing profile the reply is the judgment's; an unresolved
    // judgment produces NO reply, only an owned-pending obligation.
    if (!factOfKind('slice-reply-source') && opening) {
      if (asksJudgment() && !factOfKind('judgment-JudgmentResolution')) {
        obligation({ operation: 'pending:slice-semantic-reply:judgment', blocker: 'part-seven',
          semanticMessage: 'slice-semantic-reply:judgment', state: 'owned-pending-no-answer', owner: 'part-seven',
          exposure: config.maxCharge, detail: 'the durable question has no provider receipt; no reply may be rendered' });
        record('reply', 'withheld', { detail: 'no recorded judgment answer' });
      } else renderReply();
    }

    // ---- 6b. RESOLVE the model operation, so the reply may reserve ----------
    // docs/10 line 671: an unresolved execution or charge blocks a new attempt.
    // The single chain therefore has to resolve part seven's model operation
    // before part eight's reply can be admitted in the SAME run.
    if (config.profile === 'full' && opening) resolveModelOperation();

    // ---- 7. admit and send it through the effect doorway --------------------
    if (factOfKind('slice-reply-source') && opening) driveOutbound(opening);

    // ---- 8. rebuild every resulting projection from facts -------------------
    const rebuilds = rebuildAll();
    return report(rebuilds);
  }

  /** Profiles that ask part seven a real question: the single chain and its control. */
  const asksJudgment = () => config.profile === 'full' || config.profile === 'judgment';

  // Six's LATEST reservation row per operation, plus the first row, which is the one
  // that carries the reserving command and therefore the operation's section-7 ROLE.
  const sixOperationRows = () => {
    const first = new Map(), latest = new Map();
    for (const v of transportFacts()) {
      if (v.record.type !== 'AdmissionReservation') continue;
      if (!first.has(v.record.operation)) first.set(v.record.operation, v.record);
      latest.set(v.record.operation, v.record);
    }
    return [...latest.entries()].map(([operation, record]) => ({ operation, record, opened: first.get(operation) }));
  };
  const roleOf = opened => (String(opened.command).startsWith('judgment:') ? 'model-judgment' : 'outbound-reply');
  const modelOperation = () => sixOperationRows().find(row => roleOf(row.opened) === 'model-judgment');
  const applicationFor = operation => transportFacts()
    .filter(v => v.record.type === 'SettlementApplication' && v.record.operation === operation).at(-1);
  const obligationNames = operation => factsOfKind('slice-obligation')
    .some(f => f.body.operation === operation || f.body.operation.endsWith(`:${operation}`));
  // The LATEST obligation directly naming an operation — the current one, since the
  // ledger is append-only. Recovery must reconcile against THIS, not against whether
  // any historical row of a kind ever existed (astra C1: a `.some()` over all history
  // let a superseded refusal keep the exposure current after a verified recovery).
  const latestObligation = operation => {
    const rows = factsOfKind('slice-obligation').filter(f => f.body.operation === operation);
    return rows.length ? rows[rows.length - 1].body : null;
  };
  const hasClosedObligation = operation => factsOfKind('slice-obligation')
    .some(f => f.body.operation === operation && f.body.state === 'closed-unexecuted');

  /**
   * Six already recorded a conditional close, but a cut AT the operation-close
   * boundary interrupted the terminal obligation write. Reconstruct it from six's
   * OWN already-closed record — never dispatch, settle or reclose the operation —
   * so the released credit is not left masked by a stale open obligation from an
   * earlier boot. Level-triggered: it runs only while the terminal row is missing.
   * (astra R2)
   */
  function reconcileClosed(operation, semanticMessage) {
    if (hasClosedObligation(operation)) return;
    obligation({ operation, semanticMessage, state: 'closed-unexecuted', owner: 'part-six', exposure: 0,
      detail: 'recovery reconstructed the terminal obligation from six\'s already-closed record: the committed '
        + 'prefix proves the operation is closed with its reserved credit released; no dispatch, settlement or reclose was performed' });
    record('close', 'reconciled', { operation });
  }

  /**
   * An unresolved six operation retains its reserved exposure and blocks this run's
   * next attempt. Record that ownership explicitly rather than leaving a live
   * reservation nobody names — the model operation is charge-bearing and, on this
   * base, permanently unresolvable.
   */
  function ownModelOperation() {
    const row = modelOperation();
    if (!row || obligationNames(row.operation)) return;
    if (applicationFor(row.operation) || row.record.state === 'closed') return;
    obligation({ operation: row.operation, blocker: 'part-six', semanticMessage: row.record.semanticMessage,
      state: 'owned-unresolved-model', owner: 'part-seven', exposure: row.record.charge,
      detail: `six-owned model operation in state ${row.record.state}; its reserved exposure is retained and blocks a second reservation for this run` });
  }

  /**
   * Apply an AUTHENTIC eight-issued settlement through six's public seam, so the
   * operation becomes RESOLVED and stops blocking its run. Six re-enters eight's
   * `consumeEffectSettlement` itself; nothing here forges or copies a settlement.
   *
   * A durable SettlementApplication fact is HISTORY, not live accounting authority:
   * a replacement process must RECONSUME current eight authority through six before
   * the once-only application can fund new admission (src/transport/settlement.ts).
   * So this always re-enters eight's producer and six's settle — idempotent on the
   * once-only application identity, verified 1→1 — and fires the durable boundary
   * only the FIRST time the application row is written. (astra R1)
   */
  function applySettlement(operation) {
    const firstApplication = !applicationFor(operation);
    const issued = settled(effects.settle(operation));
    if (!issued.ok) return issued;
    const applied = settled(transport.settle(liveFence(), issued.value));
    if (!applied.ok) return applied;
    if (firstApplication) boundary('settlement-application', { operation, released: applied.value.released,
      exposure: applied.value.exposure, unresolved: applied.value.unresolved });
    return { ok: true, value: applied.value, reconsumed: !firstApplication };
  }

  /**
   * The single chain's resolution step. Part seven's model operation is dispatched
   * and consumed, so six's rule (b) keeps it blocking until it is RESOLVED. Both
   * published resolution seams are ENTERED here — eight's settlement producer and
   * six's conditional close — and both refusals are recorded verbatim. Nothing is
   * relabelled, minted or worked around; see
   * `.instar/lanes/slice-six-seven-resolution-gap.md`.
   *
   * Attempted ONCE per execution: the recorded obligation is the guard, so a refused
   * step does not grow the plane on every boot.
   */
  function resolveModelOperation() {
    const row = modelOperation();
    if (!row) return;
    // A model operation six already CLOSED (a cut at operation-close interrupted the
    // terminal write on an earlier boot) is reconstructed from six's record, never
    // reclosed — reclosing refuses and would leave the stale open obligation. (astra R2)
    if (row.record.state === 'closed') { reconcileClosed(row.operation, row.record.semanticMessage); return; }
    if (applicationFor(row.operation)) { record('resolve', 'already-resolved'); return; }
    if (factsOfKind('slice-obligation').some(f => f.body.operation === `resolve:${row.operation}`)) {
      record('resolve', 'held', { detail: 'recorded owned-pending; not re-attempted' }); return;
    }
    const applied = applySettlement(row.operation);
    if (applied.ok) { record('resolve', 'applied', { released: applied.value.released, unresolved: applied.value.unresolved }); return; }
    // A model operation that was reserved and NEVER claimed — part seven refuses to
    // re-ask a durable question with no provider receipt — is exactly what six's
    // conditional close is for: terminal, unexecuted, and its credit released.
    const closed = settled(transport.close(`slice-close-model:${incarnation}`, liveFence(), row.operation));
    if (closed.ok) {
      boundary('operation-close', { operation: row.operation });
      record('resolve', 'closed');
      obligation({ operation: row.operation, semanticMessage: row.record.semanticMessage, state: 'closed-unexecuted',
        owner: 'part-six', exposure: 0, detail: 'six conditionally closed the model operation: the committed prefix '
          + 'proves it was never dispatch-claimed, so its reserved credit is released and the run is not wedged' });
      return;
    }
    record('resolve', 'refused', { detail: applied.detail, close: closed.detail });
    obligation({ operation: `resolve:${row.operation}`, blocker: 'part-seven', semanticMessage: row.record.semanticMessage,
      state: 'owned-pending-unresolvable', owner: 'part-seven', exposure: row.record.charge,
      detail: `settlement producer: ${String(applied.detail).slice(0, 1400)} | conditional close: ${String(closed.detail).slice(0, 1400)}` });
  }

  async function driveJudgment(opening) {
    if (!opening) return;
    const already = factsOfKind('judgment-JudgmentResolution').length > 0;
    if (already) { record('judgment', 'already-resolved'); return; }
    const requestFact = factOfKind('judgment-JudgmentRequest');
    if (requestFact && requestFact.body.record.incarnation !== incarnation) {
      // A durable question from a dead incarnation is NOT re-asked. Part seven's
      // own public recovery records an answer only from a durable provider receipt.
      const resumed = settled(judgment.resumeRecording(requestFact.body.record.id));
      record('judgment', resumed.ok ? 'resumed-from-receipt' : 'owned-pending',
        { detail: resumed.ok ? null : `${resumed.detail} (no receipt: no answer and no repeated invocation)` });
      return;
    }
    if (requestFact) record('judgment', 'resuming', { request: requestFact.body.record.id });
    const input = { id: 'slice-question:1', run: { owner: 'part-five', name: 'Run', id: opening.body.run }, step: 'slice-step:1', ordinal: 0,
      semanticMessage: 'slice-semantic-question:1',
      effectRequest: { owner: 'part-eight', name: 'EffectRequest', id: 'slice-model-effect:1' },
      question: `Is this request permitted and bounded? ${config.ask}`,
      context: 'The captured evidence supports a bounded reply. Context is evidence, not standing.',
      evidence: ['slice-e1', 'slice-e2'], deadline: config.judgmentDeadline };
    const fence = liveFence();
    let outcome;
    try { outcome = settled(await judgment.judge(input, fence)); }
    catch (e) { outcome = { ok: false, detail: String(e && e.message ? e.message : e) }; }
    if (!factOfKind('judgment-JudgmentRequest')) { record('judgment', 'refused', { detail: outcome.detail }); return; }
    record('judgment', outcome.ok ? 'decided' : 'refused', { detail: outcome.ok ? null : outcome.detail });
  }

  function renderReply() {
    const decision = readDecision();
    const text = decision
      ? `Recorded: ${decision.conclusion.subject} is ${decision.conclusion.value}. This is a bounded acknowledgement, not an approval.`
      : `Recorded your request and preserved it. No model judgment was made in this profile; this is a bounded acknowledgement, not an approval.`;
    const resultValue = take(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success',
      value: { rendered: text, basis: decision ? 'judgment-resolution' : 'run-record' }, capacity: { kind: 'none' } }, decodeContext));
    append('slice-reply-source', { semanticMessage: `slice-semantic-reply:${config.profile}`,
      basis: decision ? 'judgment-resolution' : 'run-record', text, result: resultValue }, [], bob, bob.provenance);
    record('reply', 'rendered', { basis: decision ? 'judgment-resolution' : 'run-record' });
  }

  function readDecision() {
    const resolution = factOfKind('judgment-JudgmentResolution');
    if (!resolution) return null;
    const decoded = factsOfKind('judgment-JudgmentAttemptRecord').find(f => f.body.record.phase === 'decode-observed');
    return decoded && decoded.body.decision ? decoded.body.decision : null;
  }

  function driveOutbound(opening) {
    const source = factOfKind('slice-reply-source');
    const definitionFact = factOfKind('effect-OperationDefinition');
    if (!definitionFact) {
      const outcome = settled(installOperationDefinition(operationDefinition, effectHost, effectSpine));
      record('definition', outcome.ok ? 'installed' : 'refused', { detail: outcome.ok ? null : outcome.detail });
      if (!factOfKind('effect-OperationDefinition')) return;
    }
    const loop = transportFacts().filter(v => v.record.type === 'LoopRecord').at(-1);
    if (!loop) { record('outbound', 'refused', { detail: 'no six-owned observation wake' }); return; }
    const messageInput = { type: 'OutboundMessage', schemaVersion: 1, id: 'slice-message:1',
      semanticMessage: source.body.semanticMessage, run: opening.body.run, speaker: bob.id,
      account: config.account, conversation: config.conversation, text: source.body.text,
      purpose: 'ordinary-reply', sourceResult: source.id };
    const message = take(decodeOutboundMessage(messageInput, effectHost));
    let request = factOfKind('effect-EffectRequest');
    if (!request || !reservationFor(request.body.record.id)) {
      const outcome = settled(effects.prepare({ definition: operationDefinition.id, message,
        run: { owner: 'part-five', name: 'Run', id: opening.body.run }, pending: source.id, attempt: 'slice-attempt:1',
        verificationOwner: 'slice-reply-verifier', obligation: loop.fact.id, closure: [], fence: liveFence() }));
      record('outbound-prepare', outcome.ok ? 'prepared' : 'refused', { detail: outcome.ok ? null : outcome.detail });
      request = factOfKind('effect-EffectRequest');
      if (!request) {
        obligation({ operation: `unreserved:${message.semanticMessage}`, blocker: 'part-eight', semanticMessage: message.semanticMessage,
          state: 'refused-before-preparation', owner: 'part-eight', exposure: 0, detail: String(outcome.detail).slice(0, 3000) });
        return;
      }
      if (!reservationFor(request.body.record.id)) {
        // Prepared and durable, but six refused to admit the operation. The
        // obligation stays OWNED and PENDING with its maximum exposure retained.
        obligation({ operation: `unreserved:${request.body.record.id}`, blocker: 'part-six', semanticMessage: message.semanticMessage,
          state: 'owned-pending-unadmitted', owner: 'part-six', exposure: operationDefinition.maxCharge,
          detail: String(outcome.detail).slice(0, 3000), required: [request.id] });
        record('outbound', 'blocked-at-six', { detail: outcome.detail });
        return;
      }
      obligation({ operation: reservationFor(request.body.record.id).record.operation, semanticMessage: message.semanticMessage,
        state: 'prepared', owner: 'part-eight', exposure: operationDefinition.maxCharge, required: [request.id] });
    }
    const record8 = request.body.record;
    const reservation = reservationFor(record8.id);
    if (!reservation) { record('outbound', 'blocked-at-six', { detail: 'no six-owned reservation for the prepared request' }); return; }
    const operation = reservation.record.operation;

    // An operation six already CLOSED (a cut at operation-close on an earlier boot
    // interrupted the terminal obligation write) is reconstructed from six's record
    // and never recovered, settled or reclosed — otherwise recovery leaves a stale
    // open obligation retaining the very credit the close released. (astra R2)
    if (reservation.record.state === 'closed') { reconcileClosed(operation, record8.semanticMessage); return; }

    // ---- dispatch, or RECOVER an already-claimed operation ------------------
    const stages = () => factsOfKind('effect-OperationObservation').map(f => f.body.record.stage);
    const resolvedStage = () => stages().some(v => ['response', 'unknown', 'lookup'].includes(v));
    if (reservation.record.state === 'prepared') {
      const outcome = settled(effects.dispatch(rebuildRequest(record8), liveFence()));
      record('dispatch', outcome.ok ? outcome.value.stage : 'refused', { detail: outcome.ok ? null : outcome.detail });
      obligation({ operation, semanticMessage: record8.semanticMessage, state: outcome.ok ? `observed-${outcome.value.stage}` : 'dispatch-uncertain',
        owner: 'part-eight', exposure: operationDefinition.maxCharge, detail: outcome.ok ? '' : String(outcome.detail).slice(0, 3000) });
    } else if (!resolvedStage()) {
      // Crash after dispatch-claim. The replacement NEVER re-invokes: it drives
      // six's recovery wake, which asks eight for a read-only observation.
      const outcome = settled(transport.recover(`slice-recover:${incarnation}`, liveFence(), operation, effects));
      record('recovery', outcome.ok ? outcome.value.disposition : 'refused', { detail: outcome.ok ? null : outcome.detail, stages: stages() });
      obligation({ operation, semanticMessage: record8.semanticMessage, state: `recovered-${stages().at(-1) ?? 'none'}`,
        blocker: resolvedStage() ? 'none' : 'adapter-evidence', owner: 'part-eight', exposure: operationDefinition.maxCharge,
        detail: outcome.ok ? '' : String(outcome.detail).slice(0, 3000) });
    }

    // ---- independent delivery evidence for the DECLARED stage ---------------
    if (!evidenceRowFor(operation)) collectDeliveryEvidence(operation, record8);

    // ---- the dead-fence wedge: six's conditional close ----------------------
    // A crash between the reservation and its claim leaves a PREPARED operation
    // under a fence that died with its worker. It can never be claimed, so it can
    // never be settled either, and it used to wedge the run with its whole
    // exposure retained. Six's conditional close proves from the COMMITTED PREFIX
    // that no dispatch-claim exists, makes the operation terminal and releases the
    // reserved credit. It never settles an effect and never reopens dispatch.
    if (closeDeadFenced(operation, record8)) return;

    // ---- settlement ---------------------------------------------------------
    if (!factOfKind('effect-EffectSettlement') && evidenceRowFor(operation)) {
      const outcome = settled(effects.settle(operation));
      record('settlement', outcome.ok ? 'settled' : 'refused', { detail: outcome.ok ? null : outcome.detail });
      const settlementFact = factOfKind('effect-EffectSettlement');
      if (settlementFact) {
        const r = settlementFact.body.record;
        obligation({ operation, semanticMessage: record8.semanticMessage, state: `settled-${r.outcome.kind}`,
          owner: 'part-eight', exposure: r.retainedExposure, detail: `finalCharge=${r.finalCharge}`, required: [settlementFact.id] });
        record('settlement-accounting', r.outcome.kind, { finalCharge: r.finalCharge, retainedExposure: r.retainedExposure });
      } else {
        const row = evidenceRowFor(operation);
        const decisiveAbsence = row && row.body.decisive === 'decisive' && row.body.evidence.claim.value === 'did-not-happen';
        obligation({ operation, semanticMessage: record8.semanticMessage,
          state: decisiveAbsence ? 'owned-unapplied-unsettled' : 'owned-uncertain',
          blocker: decisiveAbsence ? 'part-six' : 'adapter-evidence', owner: 'part-eight',
          exposure: operationDefinition.maxCharge, detail: String(outcome.detail).slice(0, 3000) });
      }
    }

    // ---- six APPLIES the settlement, and RECONSUMES it on every recovery ----
    // docs/10 §4 + src/transport/settlement.ts: the application is once-only, but a
    // replacement process must reconsume live eight authority before the preserved
    // application can fund a new admission — a durable row is history, not authority.
    // So this reconsumes on EVERY boot a settlement exists (idempotent), and (re)writes
    // the derived obligation a cut at the settlement-application boundary skipped. The
    // guard is now the OBLIGATION, not the application fact: a cut writes the row before
    // the boundary fires, so guarding on the fact left recovery neither reconsuming nor
    // restoring the obligation. (astra R1)
    if (factOfKind('effect-EffectSettlement')) {
      const applied = applySettlement(operation);
      // Reconcile against the CURRENT (latest) obligation, and append a superseding
      // row only when the current one differs from what this boot's outcome requires —
      // so a verified recovery corrects a stale refusal, a temporary loss supersedes a
      // stale applied row, and a steady state writes nothing (astra C1).
      const current = latestObligation(operation);
      const matches = (state, exposure) => current && current.state === state && Number(current.exposure) === exposure;
      if (applied.ok) {
        const state = applied.value.unresolved === 0 ? 'applied-resolved' : 'applied-unresolved';
        if (!matches(state, applied.value.exposure)) {
          obligation({ operation, semanticMessage: record8.semanticMessage, state, owner: 'part-six',
            exposure: applied.value.exposure,
            detail: `released=${applied.value.released}; actualCharge=${applied.value.actualCharge}` });
          record('settlement-application', applied.reconsumed ? 'reconsumed-and-restored' : 'applied',
            { released: applied.value.released, exposure: applied.value.exposure, unresolved: applied.value.unresolved });
        } else if (applied.reconsumed) record('settlement-application', 'reconsumed',
          { released: applied.value.released, exposure: applied.value.exposure, unresolved: applied.value.unresolved });
      } else if (!matches('owned-unapplied-unsettled', operationDefinition.maxCharge)) {
        // Authority is temporarily unavailable: retaining maximum exposure is correct,
        // and it supersedes even a prior applied row until authority returns.
        obligation({ operation, semanticMessage: record8.semanticMessage, state: 'owned-unapplied-unsettled',
          blocker: 'part-six', owner: 'part-eight', exposure: operationDefinition.maxCharge,
          detail: String(applied.detail).slice(0, 3000) });
        record('settlement-application', 'refused', { detail: applied.detail });
      }
    }
  }

  /** True when six conditionally closed a prepared operation whose fence is gone. */
  function closeDeadFenced(operation, record8) {
    const current = reservationFor(record8.id);
    if (!current || current.record.state !== 'prepared') return false;
    if (current.record.fence.epoch === currentFenceEpoch()) return false;
    const closed = settled(transport.close(`slice-close:${incarnation}`, liveFence(), operation));
    record('close', closed.ok ? 'closed' : 'refused', { detail: closed.ok ? null : closed.detail });
    if (!closed.ok) return false;
    boundary('operation-close', { operation });
    obligation({ operation, semanticMessage: record8.semanticMessage, state: 'closed-unexecuted', owner: 'part-six',
      exposure: 0, detail: 'six conditionally closed a prepared operation whose reserving fence is gone: the committed '
        + 'prefix proves no dispatch-claim exists, so the reserved credit is released and the run is not wedged' });
    return true;
  }

  // The LATEST reservation row carries the current state; the first is always 'prepared'.
  const reservationFor = requestId => transportFacts().filter(v => v.record.type === 'AdmissionReservation' && v.record.request === requestId).at(-1);
  const rebuildRequest = record8 => Object.freeze({ ...record8 });

  function collectDeliveryEvidence(operation, record8) {
    // The witness reads the service's OWN durable journal directly. It never asks
    // the adapter whether the adapter applied anything.
    const journal = readServiceJournal(home);
    const applied = journal.applications.find(r => r.operation === operation);
    // Bounded quiescence observation, capped by the adapter's DECLARED budget.
    // An adapter that declares no quiescence capability observes nothing here.
    const budget = adapterContract().capabilities.exclusionOfDelayedExecution.status === 'supported'
      ? adapterContract().capabilities.exclusionOfDelayedExecution.observationBudget + 2 : 0;
    let observations = 0;
    while (observations < budget) {
      const state = service.quiescence(operation);
      if (state && state.quiescent) break;
      service.observeQuiescence(operation); observations++;
    }
    const lookup = service.lookup(operation);
    const quiescence = service.quiescence(operation);
    const decisive = service.decisive && (applied ? quiescence && quiescence.quiescent : lookup.status === 'not-applied') ? 'decisive' : 'indecisive';
    const kind = applied ? 'happened' : (service.decisive && lookup.status === 'not-applied' && decisive === 'decisive') ? 'did-not-happen' : 'uncertain';
    if (kind === 'uncertain' && !applied) {
      obligation({ operation, semanticMessage: record8.semanticMessage, state: 'owned-uncertain', blocker: 'adapter-evidence',
        owner: 'part-eight', exposure: operationDefinition.maxCharge,
        detail: `adapter declares no decisive non-occurrence; lookup=${JSON.stringify(lookup)}` });
      record('delivery-evidence', 'uncertain', { lookup });
      return;
    }
    const stage = declaredStage();
    const witnessBytes = JSON.stringify({ operation, applied: applied ?? null, lookup, quiescence, observations,
      finalCharge: service.finalCharge(operation), stage });
    // The witness reading is preserved in durable custody, so a later boot can
    // still resolve the evidence it produced.
    const witnessCapture = take(custody.capture(witnessBytes));
    captures[witnessCapture.reference] = witnessBytes;
    const evidenceInput = { type: 'Evidence', schemaVersion: 1, id: `slice-delivery:${operation}`,
      claim: { subject: operation, predicate: record8.digest, value: kind }, source: 'slice-witness',
      observedAt: now(), freshFor: 1000000, capture: witnessCapture, strength: 'observation' };
    const decoded = take(decode('Evidence', evidenceInput, decodeContext));
    if (!evidence.some(e => e.id === decoded.id)) evidence.push(decoded);
    const outcome = take(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind, evidence: [decoded.id] }, decodeContext));
    append('slice-delivery-evidence', { operation, stage, decisive, evidence: decoded, outcome }, [], bob, bob.provenance);
    boundary('delivery-evidence', { operation, kind, decisive });
    record('delivery-evidence', kind, { decisive, stage });
  }

  function buildRun(admittedFact) {
    const openingRef = factRef(admittedFact);
    const binding = factOfKind('conversation-binding');
    const owner = { type: 'VerifiedPrincipal', id: bob.id, fact: factRef(ownerFact()), field: 'principal' };
    const intentId = admittedFact.body.intent.id;
    return { type: 'Run', schemaVersion: 1, id: runIdFor(openingRef), opening: openingRef,
      intent: { type: 'Intent', id: intentId, fact: openingRef, field: 'intent' },
      directives: [], owner, scope, authority: { resolution: openingRef, grants: [] },
      exitTest: { check: 'probe', version: 'slice-v1', subject: 'requested-reply',
        acceptance: hashOf('attributable reply delivered'), evidenceKinds: ['observation'], freshFor: 1000000 },
      budget: { type: 'RunBudget', schemaVersion: 1, id: 'slice-budget:1', bounds: ['bound'],
        resources: [{ type: 'Measurement', schemaVersion: 1, subject: { kind: 'run-work', instance: 'slice-budget:1' },
          value: 3, unit: 'steps', at: json(genesisClock), by: 'probe' }],
        maxWorkers: 1, maxProcesses: 1, maxOutstanding: 3, maxChildren: 0, maxDepth: 1, maxAttempts: 3,
        repetitionPolicy: { owner: 'part-six', name: 'LoopPolicy', id: 'slice-observation-policy' },
        safetyCeiling: json(clockAt(100000000)), exhaustedOwner: owner },
      cadence: { bound: 'bound', milliseconds: 3600000 },
      nextWake: { owner, at: json(clockAt(tick() + 1000)), reason: 'continue' }, blockedOn: { kind: 'nothing' },
      resultDestination: { binding: { owner: 'part-four', name: 'ConversationBinding', id: binding.id }, route: openingRef },
      generation: registerShape.generation, createdAt: json(admittedFact.at), depth: 1 };
  }

  // ---------------------------------------------------- projection rebuilding
  function rebuildAll() {
    const rows = [];
    for (const definition of minimalPlaneProjections(kinds())) {
      boundary(`rebuild:${definition.id}`);
      rows.push(rebuildOne(definition));
    }
    return rows;
  }
  function rebuildOne(definition) {
    const all = facts();
    const snapshot = take(prepareSnapshot(all, { ...factContext, facts: all }));
    const gen = generation();
    // Clean genesis rebuild.
    const genesis = checkpoint(take(foldProjection(definition, snapshot, gen, boundaryContext)));
    // Durable checkpoint, then a checkpoint-resumed rebuild at the SAME vector.
    const file = join(paths.checkpoints, `${definition.id}.json`);
    writeDurable(file, paths.checkpoints, JSON.stringify(signCheckpoint(genesis, 'host', PRIVATE_KEY)));
    const restored = take(restoreCheckpoint(JSON.parse(readFileSync(file, 'utf8')), snapshot, boundaryContext,
      [{ id: 'host', publicKey: PUBLIC_KEY, algorithm: 'ed25519' }]));
    const resumed = take(rebuildProjection(definition, snapshot, gen, boundaryContext, [restored]));
    const resumedCheckpoint = checkpoint(resumed.view);
    const equal = settled(verifyRebuild(genesis, resumedCheckpoint, boundaryContext));
    return { projection: definition.id, hash: genesis.hash, vector: genesis.vector, resumedHash: resumedCheckpoint.hash,
      resumedFrom: resumed.resumedFrom, folded: resumed.folded, equal: equal.ok ? 'equal' : equal.detail,
      values: JSON.parse(bytesOf(genesis.view.values)), conflicts: genesis.view.conflicts.map(c => c.kind), taint: [...genesis.view.taint] };
  }

  /**
   * The recorded accounting docs/15 section 7 names by name. Duration and memory are
   * MEASURED across every boot of this execution, including boots that were killed:
   * each boot writes a durable start row, every durable boundary writes an RSS
   * sample, and each surviving boot writes an end row. `notifications` is stated
   * plainly for what it is — the external application count under another name,
   * because the reply IS this slice's only user-visible notification.
   */
  function accounting(all, journal) {
    const endedAt = Date.now();
    appendLine(paths.boots, home, { event: 'end', boot: bootIndex, wallMs: endedAt,
      rss: process.memoryUsage().rss, durationMs: endedAt - bootStartedAt });
    const bootRows = readLines(paths.boots), stepRows = readLines(paths.steps);
    const starts = bootRows.filter(r => r.event === 'start');
    const samples = [...bootRows, ...stepRows].map(r => r.rss).filter(v => Number.isSafeInteger(v));
    // A killed boot writes no end row; its duration is bounded by the next boot's
    // start, which is why the per-boot list carries an explicit `bounded` flag.
    const perBoot = starts.map((start, index) => {
      const end = bootRows.find(r => r.event === 'end' && r.boot === start.boot);
      const next = starts[index + 1];
      if (end) return { boot: start.boot, durationMs: end.durationMs, bounded: false };
      return { boot: start.boot, durationMs: next ? next.wallMs - start.wallMs : null, bounded: true };
    });
    const known = perBoot.map(r => r.durationMs).filter(v => Number.isSafeInteger(v));
    return {
      facts: all.length, bytes: Buffer.byteLength(readFileSync(join(paths.facts, 'facts.json'), 'utf8')),
      boots: starts.length, attempts: transportFacts().filter(v => v.record.type === 'AdmissionReservation').length,
      notifications: journal.applications.length,
      tokens: (() => { const a = factsOfKind('judgment-JudgmentAttemptRecord').find(f => f.body.record.phase === 'response-observed');
        if (!a) return null; const bytes = factContext.captures[a.body.record.receipt.reference]?.bytes;
        return bytes ? JSON.parse(bytes).usage : null; })(),
      money: journal.charges.reduce((n, c) => n + c.charge, 0),
      // Wall duration of the WHOLE execution, first boot start to this boot end.
      durationMs: endedAt - starts[0].wallMs,
      perBootDurationMs: perBoot, measuredBoots: known.length,
      // The maximum RSS observed at any durable boundary of any boot, killed boots
      // included. It is a real high-water mark, not one instant in the last process.
      peakRssBytes: Math.max(...samples),
      peakRssSamples: samples.length,
    };
  }

  function report(rebuilds = []) {
    const all = facts();
    const journal = readServiceJournal(home);
    const settlementFact = factOfKind('effect-EffectSettlement');
    const requestFact = factOfKind('effect-EffectRequest');
    const reservation = requestFact ? reservationFor(requestFact.body.record.id) : undefined;
    return {
      boot: bootIndex, incarnation, profile: config.profile, adapter: config.adapter,
      registerChecks, steps, kinds: all.map(f => f.kind),
      // Every identity a boundary recorded, grouped by name, ACROSS every boot of
      // this execution. A stable logical identity through takeover has exactly one.
      identityTrail: (() => {
        const trail = {};
        for (const row of reached()) for (const [key, value] of Object.entries(row)) {
          if (['boot', 'boundary'].includes(key) || value === null || value === undefined) continue;
          (trail[key] ??= []).push(String(value));
        }
        return Object.fromEntries(Object.entries(trail).map(([k, v]) => [k, [...new Set(v)]]));
      })(),
      operations: [...new Set(transportFacts().filter(v => v.record.type === 'AdmissionReservation').map(v => v.record.operation))],
      // Every six-owned operation of this run with its section-7 ROLE, its terminal
      // state, and six's own accounting for it. `resolved` is six's word, not
      // eleven's: an operation is resolved when six either applied an authentic
      // eight settlement to it (unresolved 0) or conditionally closed it.
      sixOperations: sixOperationRows().map(row => {
        const application = applicationFor(row.operation);
        return { operation: row.operation, role: roleOf(row.opened), run: row.record.run,
          state: row.record.state, charge: row.record.charge,
          application: application ? { exposure: application.record.exposure, released: application.record.released,
            unresolved: application.record.unresolved, actualCharge: application.record.actualCharge } : null,
          resolved: row.record.state === 'closed' || (application ? application.record.unresolved === 0 : false) };
      }),
      semanticKeys: [...new Set(transportFacts().filter(v => v.record.type === 'AdmissionReservation').map(v => v.record.semanticMessage))],
      routes: [...new Set(factsOfKind('effect-OperationObservation').map(f => `${f.body.record.account}/${f.body.record.conversation}`))],
      adapterCapabilities: adapterContract().capabilities,
      declaredStage: declaredStage(),
      boundariesReached: reached().map(r => r.boundary), cutsFired: cutsFired(),
      intake: (() => { const f = factOfKind('intake-admitted'); return f ? { logicalId: f.body.logicalId, rawHash: f.body.rawHash,
        receipt: f.body.receipt, boundOperator: f.body.binding !== 'none', arrivalAt: f.body.intent.receivedAt.value } : null; })(),
      preservedInput: (() => { const f = facts().find(x => x.kind === 'intake-receipt');
        return f ? { capture: f.body.capture.reference, bytes: factContext.captures[f.body.capture.reference]?.bytes ?? null } : null; })(),
      run: (() => { const f = factOfKind('run-opening'); return f ? { id: f.body.run, owner: f.body.record.owner.id,
        opening: f.body.record.opening.id } : null; })(),
      grounding: factOfKind('session-grounding') ? 'grounded' : 'absent',
      judgment: (() => { const q = factOfKind('judgment-JudgmentRequest'), r = factOfKind('judgment-JudgmentResolution');
        return { request: q ? q.body.record.id : null, logicalKey: q ? q.body.record.logicalKey : null,
          resolution: r ? r.body.record.id : null, disposition: r ? r.body.record.disposition : null,
          capture: q ? q.body.record.submitted.reference : null, meter: (() => {
            const a = factsOfKind('judgment-JudgmentAttemptRecord').find(f => f.body.record.phase === 'response-observed');
            return a ? a.body.record.receipt.reference : null; })() }; })(),
      reply: (() => { const f = factOfKind('slice-reply-source'); return f ? { semanticMessage: f.body.semanticMessage,
        basis: f.body.basis, text: f.body.text } : null; })(),
      outbound: requestFact ? { request: requestFact.body.record.id, digest: requestFact.body.record.digest,
        semanticMessage: requestFact.body.record.semanticMessage,
        operation: reservation ? reservation.record.operation : null,
        charge: reservation ? reservation.record.charge : null,
        observations: factsOfKind('effect-OperationObservation').map(f => f.body.record.stage) } : null,
      settlement: settlementFact ? { outcome: settlementFact.body.record.outcome.kind,
        // The wire form records an unknown charge as the exact token 'unknown'.
        finalCharge: settlementFact.body.record.finalCharge === 'unknown' ? null : settlementFact.body.record.finalCharge,
        retainedExposure: settlementFact.body.record.retainedExposure,
        delayedExecutionExcluded: settlementFact.body.record.delayedExecutionExcluded } : null,
      deliveryEvidence: factsOfKind('slice-delivery-evidence').map(f => ({ operation: f.body.operation, stage: f.body.stage,
        decisive: f.body.decisive, value: f.body.evidence.claim.value })),
      obligations: factsOfKind('slice-obligation').map(f => ({ operation: f.body.operation, state: f.body.state,
        owner: f.body.owner, blocker: f.body.blocker, exposure: f.body.exposure })),
      externalApplications: journal.applications.map(r => ({ operation: r.operation, digest: r.digest,
        semanticMessage: r.semanticMessage, messageId: r.messageId })),
      serviceIntents: journal.intents.length, charges: journal.charges,
      serviceInbound: journal.inbound.length,
      rebuilds,
      accounting: accounting(all, journal),
    };
  }

  return Object.freeze({
    home, config, paths, bootIndex, incarnation, authorityIncarnation,
    registerChecks, governance, decodeContext, factContext, boundaryContext, effectHost, judgmentHost, transportHost,
    alice, bob, observer, scope, floor, bindingGrant, approval, operationDefinition, governedVersions, authorityClosure,
    store, peerStore, replicas, custody, judgmentCustody, service, captureIndex,
    intake, transport, transportFacts, judgment, effects, runGraph, assessor, model,
    facts, factsOfKind, factOfKind, factRef, append, kinds, generation, now, tick, result,
    adapterContract, declaredStage, install, restoreGrants, restoreEvidence, liveFence, currentFenceEpoch, boundary, reached, cutsFired,
    drive, report, buildRun, rebuildAll, rebuildOne, obligation, restartOperator,
    minimalProjections: () => minimalPlaneProjections(kinds()),
    snapshot: () => { const all = facts(); return take(prepareSnapshot(all, { ...factContext, facts: all })); },
    projectionTools: { checkpoint, foldProjection, rebuildProjection, restoreCheckpoint, signCheckpoint, verifyRebuild },
    decodeLoopPolicy, decodeOutboundMessage, installOperationDefinition, runIdFor,
    privateKey: PRIVATE_KEY,
  });
}
