import { verify } from 'node:crypto';
import { consumeResult, defineDecoder } from '../index.js';
import type { DecodeContext, Json, Result } from '../index.js';
import { authorAndAppend, causalCone, factId, preimage, registerOwnedBody } from '../facts/index.js';
import type { ConflictClass, FactEnvelope, FactSchema, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import type { AssemblyAuthor, AssemblyComparison, AssemblyDecodeContext, AssemblyHost, AssemblyIdentity,
  AssemblyRecord, AssemblyRecordName, AssemblySpine, CurrentAssemblyFact } from './types-internal.js';

const text = { kind: 'text', maxLength: 4096 } as const;
const integer = { kind: 'integer' } as const;
const bool = { kind: 'boolean' } as const;
const texts = { kind: 'array', maxLength: 1024, items: text } as const;
const common = { type: text, schemaVersion: integer, id: text, predecessors: texts, dependencyFacts: texts };
const pair = (fields: Readonly<Record<string, OwnedShape>>, optional: readonly string[] = []): OwnedShape =>
  ({ kind: 'object', fields, ...(optional.length ? { optional } : {}) });
const list = (items: OwnedShape, maxLength = 1024): OwnedShape => ({ kind: 'array', maxLength, items });
const hash = text;
const resource = pair({ resource: text, limit: integer });

export const assemblyShapes: Readonly<Record<AssemblyRecordName, OwnedShape>> = freeze({
  AssemblyManifest: pair({ ...common, manifestDigest: hash,
    packages: list(pair({ id: text, digest: hash, artifact: hash })),
    compatibility: pair({ runtime: text, toolchain: text, platforms: texts, schemas: texts, rollback: texts }),
    publicPorts: list(pair({ port: text, version: text, scope: text, implementation: text, artifact: hash })),
    requiredGraph: list(pair({ consumer: text, dependencies: texts })), generation: text, declarationSources: texts,
    genesisAnchor: text, trustRoots: texts, servicePrincipals: texts, grants: texts, custodyPolicies: texts,
    resourcePolicies: list(pair({ class: text, resource: text, limit: integer })),
    requiredChecks: list(pair({ tier: text, ids: texts })),
  }),
  AssemblyAdmission: pair({ ...common, manifest: text, manifestDigest: hash, machine: text, incarnation: text,
    scope: text, sourceGeneration: text, sourceVector: hash, artifacts: texts, environmentEvidence: texts,
    conformance: texts, isolationEvidence: texts, custodyEvidence: texts, probeEvidence: texts,
    resourceReservation: text, observedAt: integer, validUntil: integer, priorAdmission: text,
    disposition: text, reason: text, repairOwner: text,
  }),
  HarnessLaunchSpec: pair({ ...common, run: text, step: text, principal: text, incarnation: text, harness: text,
    artifactDigest: hash, machine: text, workingScope: text, processOperation: text, resourceReferences: texts,
    portHandles: texts, environment: list(pair({ name: text, valueDigest: hash })),
    contextManifest: list(pair({ class: text, reference: text, digest: hash })), input: text, inputDigest: hash, consumptionMode: text,
  }),
  HarnessObservation: pair({ ...common, launch: text, run: text, step: text, input: text, incarnation: text,
    sourceEvidence: texts, contextDigests: list(hash), generation: text, causalReferences: texts, observedAt: integer,
    freshFor: integer, phase: text, boundaryEvidence: text, detail: text,
  }),
  AdapterEvidenceContract: pair({ ...common, adapter: text, artifact: hash, parserDeclaration: text, stimulusClass: text,
    authenticatedFields: texts, authenticationMethod: text, credentialBinding: text, senderNamespace: text,
    conversationNamespace: text, stabilityRules: texts, forwardingTreatment: text, impersonationTreatment: text,
    churnDetector: text, revocationResponse: text, eventIdAuthority: text, replayPolicy: text, ackPolicy: text,
    disclosureScopes: texts, positiveFixtures: texts, negativeFixtures: texts, probes: texts,
    capabilities: list(pair({ name: text, support: text, source: text, predicate: text, subjectBinding: text,
      horizon: text, budget: integer, conformance: text, reason: text })), contractVersion: text,
  }),
  AdapterConformance: pair({ ...common, contract: text, adapter: text, package: text, artifact: hash, platform: text,
    mode: text, portVersion: text, schemaVersions: texts, generation: text, fixtureDigests: list(hash), sourceProvenance: texts,
    stageChecks: list(pair({ stage: text, checkRun: text, positive: texts, negative: texts })), probes: texts, bars: texts,
    limitations: texts, testedAt: integer, validUntil: integer, disposition: text,
  }),
  StoreCustodyPolicy: pair({ ...common, governedVersion: text, store: text,
    locations: list(pair({ class: text, location: text })), custodians: texts, readOperation: text, disclosureScopes: texts,
    grants: texts, stalenessPolicy: text, encryption: pair({ suite: text, version: text, implementationEvidence: texts }),
    wrappingKey: text, dataKeys: list(pair({ id: text, epoch: integer })), recoveryCustody: text, restoreProcedure: text,
    rotationProcedure: text, migrationBound: integer, plaintextRestrictions: texts, metadataExposure: texts,
    auditBound: integer, rateBound: integer, resourceBound: integer, compromiseResponse: text,
  }),
  StorageAccessObservation: pair({ ...common, store: text, objectClass: text, requester: text, service: text,
    grant: text, policy: text, generation: text, operation: text, observedAt: integer, byteCount: integer,
    result: text, refusalReference: text,
  }),
  LocalCapabilityPackage: pair({ ...common, namespace: text, ownerPrincipal: text, version: text, contentDigest: hash,
    sourceDigest: hash, parent: text, upstream: text, priorPackage: text,
    portRequirements: list(pair({ port: text, version: text })), dependencies: list(pair({ package: text, digest: hash, contract: text })),
    entrypoints: list(pair({ id: text, path: text, digest: hash })), declarationIds: texts, dataScopes: texts,
    custodyScopes: texts, grants: texts, resources: list(resource), platforms: texts, modes: texts,
    migrationCompatibility: texts, rollbackCompatibility: texts,
    checks: pair({ unit: texts, integration: texts, lifecycle: texts }), maturation: texts, probes: texts, awarenessSource: text,
  }),
  PackageTransition: pair({ ...common, package: text, manifestDigest: hash, priorActiveDigest: text, machine: text,
    scope: text, cause: text, responsiblePrincipal: text, grants: texts, generation: text, testEvidence: texts,
    migrationEvidence: texts, probeEvidence: texts, operation: text, claim: text, observedArtifactDigest: text,
    from: text, to: text, outstandingWork: texts,
  }),
  GrowthPolicy: pair({ ...common, policyVersion: text, storeScope: text, projectionScope: text,
    subjects: list(pair({ subject: text, producer: text, unit: text, cadence: integer, freshness: integer,
      workloadSizes: list(integer), softThreshold: integer, hardThreshold: integer })), replayTimeCeiling: integer,
    replayMemoryCeiling: integer, loopPolicy: text, sampleCap: integer, breaker: text, notificationBudget: integer,
    ownerRun: text, diagnosticBudget: text,
  }),
  GrowthObservation: pair({ ...common, policy: text, policyGeneration: text, machine: text, subjectScope: text,
    pinnedVector: hash, assemblyProfile: text, backendProfile: text, hardwareProfile: text, startedAt: integer,
    endedAt: integer, clockUncertainty: integer, workloadSizes: list(integer), measurements: texts, sampleCount: integer,
    denominator: integer, timeouts: integer, partialScans: integer, unavailableInputs: texts,
    comparisons: list(pair({ subject: text, kind: text, value: integer, threshold: integer, result: text })),
    completion: text, episode: text, investigationRun: text,
  }),
});

function shapeCheck(value: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') { ensure(typeof value === 'string' && value.length <= shape.maxLength && (value.length === 0 || value.trim().length > 0), 'bounded substantive text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(value), 'safe integer required'); return; }
  if (shape.kind === 'boolean') { ensure(typeof value === 'boolean', 'boolean required'); return; }
  if (shape.kind === 'null') { ensure(value === null, 'null required'); return; }
  if (shape.kind === 'capture') { shapeCheck(value, pair({ reference: text, hash: text })); return; }
  if (shape.kind === 'array') { ensure(Array.isArray(value) && value.length <= shape.maxLength, 'bounded array required'); value.forEach(item => shapeCheck(item, shape.items)); return; }
  ensure(value && typeof value === 'object' && !Array.isArray(value), 'closed object required');
  const record = value as Record<string, unknown>; const optional = new Set(shape.optional ?? []);
  ensure(Object.keys(record).every(key => Object.hasOwn(shape.fields, key)), 'undeclared field');
  ensure(Object.keys(shape.fields).every(key => optional.has(key) || Object.hasOwn(record, key)), 'missing field');
  for (const [key, field] of Object.entries(shape.fields)) if (record[key] !== undefined) shapeCheck(record[key], field);
}

const choices = (value: string, allowed: readonly string[], field: string) => ensure(allowed.includes(value), `${field} outside closed set`);
const nonnegative = (value: number, field: string) => ensure(Number.isSafeInteger(value) && value >= 0, `${field} must be nonnegative`);
const unique = (values: readonly string[], field: string) => ensure(new Set(values).size === values.length, `${field} contains duplicates`);
const substantive = (value: string, field: string) => ensure(value.trim().length > 0, `${field} must be substantive`);
const completeCapabilitySet = ['stable-lookup', 'application-stage', 'decisive-non-occurrence', 'delayed-execution-exclusion', 'final-charge', 'prerequisite-durability'];
const growthSubjects = ['sequence-length', 'segment-bytes', 'append-rate', 'genesis-replay-duration', 'checkpoint-replay-duration',
  'boot-rebuild-duration', 'replication-lag', 'refusal-rate', 'unattributable-wrap-rate', 'retraction-count', 'conflict-backlog-age',
  'pending-set-depth', 'known-segment-set-size', 'machine-key-count', 'historical-encoder-count'];

function validate(record: AssemblyRecord): void {
  ensure(record.schemaVersion === 1 && record.id.trim().length > 0, 'assembly identity/version');
  unique(record.predecessors, 'predecessors'); unique(record.dependencyFacts, 'dependency facts');
  ensure(!record.dependencyFacts.some(id => id === record.id), 'record cannot depend on its own payload id');
  switch (record.type) {
    case 'AssemblyManifest':
      ensure(/^sha256:[a-f0-9]{64}$/.test(record.manifestDigest), 'manifest digest malformed');
      ensure(record.packages.length > 0 && record.publicPorts.length > 0 && record.requiredGraph.length > 0, 'exact assembly inventory required');
      unique(record.publicPorts.map(row => `${row.scope}:${row.port}`), 'port scope bindings');
      record.resourcePolicies.forEach(row => { choices(row.class, ['ordinary', 'repair', 'control'], 'resource class'); nonnegative(row.limit, 'resource limit'); });
      for (const tier of ['unit', 'integration', 'lifecycle']) ensure(record.requiredChecks.some(row => row.tier === tier && row.ids.length > 0), `missing ${tier} checks`);
      ensure(record.generation && record.genesisAnchor && record.trustRoots.length > 0, 'independent source anchors required'); break;
    case 'AssemblyAdmission':
      substantive(record.manifest, 'manifest');
      choices(record.disposition, ['prepared', 'active', 'inhibited', 'draining', 'retired'], 'admission disposition');
      nonnegative(record.observedAt, 'observation clock'); nonnegative(record.validUntil, 'validity clock');
      ensure(record.validUntil >= record.observedAt, 'admission validity interval inverted');
      ensure(record.reason && record.repairOwner, 'admission reason and owner required');
      if (record.disposition === 'active') ensure(record.conformance.length > 0 && record.isolationEvidence.length > 0
        && record.custodyEvidence.length > 0 && record.probeEvidence.length > 0, 'active admission needs separate actual evidence'); break;
    case 'HarnessLaunchSpec':
      substantive(record.incarnation, 'incarnation');
      choices(record.consumptionMode, ['model-context-boundary', 'advisory'], 'consumption mode');
      ensure(record.contextManifest.length > 0 && record.portHandles.length > 0 && record.processOperation, 'launch context/handles/operation required'); break;
    case 'HarnessObservation':
      substantive(record.launch, 'launch');
      choices(record.phase, ['launched', 'input-accepted', 'context-consumed', 'output-observed', 'pause-observed', 'exit-observed', 'uncertain'], 'harness phase');
      nonnegative(record.observedAt, 'observed clock'); nonnegative(record.freshFor, 'freshness');
      if (record.phase === 'context-consumed') ensure(record.boundaryEvidence && record.contextDigests.length > 0, 'context consumption requires boundary evidence'); break;
    case 'AdapterEvidenceContract':
      substantive(record.authenticationMethod, 'authentication method');
      choices(record.stimulusClass, ['bot-workspace', 'device-conversation', 'web-conversation', 'webhook', 'scheduler-ipc', 'model-provider', 'host-review', 'agent-transport'], 'stimulus class');
      choices(record.ackPolicy, ['always', 'bound-only', 'never'], 'ack policy');
      unique(record.capabilities.map(row => row.name), 'adapter capabilities');
      ensure(completeCapabilitySet.every(name => record.capabilities.some(row => row.name === name)), 'complete adapter capability matrix required');
      record.capabilities.forEach(row => { choices(row.support, ['supported', 'unsupported'], 'capability support'); nonnegative(row.budget, 'capability budget');
        ensure(row.support === 'supported' ? !!row.source && !!row.predicate && !!row.subjectBinding && !!row.horizon && !!row.conformance : !!row.reason,
          'supported capability needs proof contract; unsupported capability needs reason'); }); break;
    case 'AdapterConformance':
      substantive(record.contract, 'contract');
      choices(record.disposition, ['passed', 'failed', 'unsupported'], 'conformance disposition');
      nonnegative(record.testedAt, 'tested clock'); nonnegative(record.validUntil, 'conformance validity');
      ensure(record.validUntil >= record.testedAt, 'conformance validity interval inverted');
      if (record.disposition === 'passed') ensure(record.stageChecks.length > 0 && record.stageChecks.every(row => row.checkRun.trim().length > 0
        && row.positive.length > 0 && row.negative.length > 0 && row.positive.every(value => value.trim().length > 0)
        && row.negative.every(value => value.trim().length > 0)), 'passing conformance needs substantive evidence for both neighbors'); break;
    case 'StoreCustodyPolicy':
      substantive(record.store, 'store');
      ensure(record.encryption.suite === 'AES-256-GCM' && record.encryption.implementationEvidence.length > 0, 'reviewed AES-256-GCM required');
      ensure(record.locations.length > 0 && record.custodians.length > 0 && record.grants.length > 0 && record.wrappingKey && record.dataKeys.length > 0
        && record.recoveryCustody && record.restoreProcedure && record.rotationProcedure && record.plaintextRestrictions.length > 0, 'complete store custody policy required');
      for (const n of [record.migrationBound, record.auditBound, record.rateBound, record.resourceBound]) nonnegative(n, 'custody bound'); break;
    case 'StorageAccessObservation':
      substantive(record.policy, 'policy');
      choices(record.result, ['allowed', 'refused', 'uncertain'], 'storage access result'); nonnegative(record.observedAt, 'access clock'); nonnegative(record.byteCount, 'access bytes');
      ensure(record.result === 'allowed' || record.refusalReference, 'non-allowed access needs custody-safe refusal'); break;
    case 'LocalCapabilityPackage':
      substantive(record.contentDigest, 'content digest');
      ensure(record.namespace.startsWith(`${record.ownerPrincipal}.`) && record.entrypoints.length > 0, 'package namespace/entrypoints invalid');
      ensure(record.checks.unit.length > 0 && record.checks.integration.length > 0 && record.checks.lifecycle.length > 0, 'package requires three test tiers');
      record.entrypoints.forEach(row => ensure(safePackagePath(row.path), 'package entrypoint escapes staging'));
      record.resources.forEach(row => nonnegative(row.limit, 'package resource limit')); break;
    case 'PackageTransition': {
      substantive(record.operation, 'operation');
      const edges: Readonly<Record<string, readonly string[]>> = { none: ['staged'], staged: ['validated', 'inhibited'], validated: ['eligible', 'inhibited'], eligible: ['activating', 'inhibited'], activating: ['active', 'inhibited'], active: ['inhibited', 'retired'], inhibited: ['staged', 'eligible', 'retired'], retired: [] };
      ensure(edges[record.from]?.includes(record.to), 'invalid package lifecycle edge');
      if (record.to === 'active') ensure(record.testEvidence.length > 0 && record.probeEvidence.length > 0 && record.observedArtifactDigest, 'active package needs observed switch and evidence'); break;
    }
    case 'GrowthPolicy':
      substantive(record.storeScope, 'store scope');
      ensure(growthSubjects.every(subject => record.subjects.some(row => row.subject === subject)), 'complete inherited growth subject roster required');
      unique(record.subjects.map(row => row.subject), 'growth subjects');
      record.subjects.forEach(row => { nonnegative(row.cadence, 'sample cadence'); nonnegative(row.freshness, 'sample freshness'); nonnegative(row.softThreshold, 'soft threshold'); nonnegative(row.hardThreshold, 'hard threshold'); ensure(row.hardThreshold >= row.softThreshold && row.producer && row.unit && row.workloadSizes.length > 0, 'growth subject contract invalid'); });
      for (const n of [record.replayTimeCeiling, record.replayMemoryCeiling, record.sampleCap, record.notificationBudget]) nonnegative(n, 'growth policy bound');
      ensure(record.loopPolicy && record.breaker && record.ownerRun && record.diagnosticBudget, 'growth ownership incomplete'); break;
    case 'GrowthObservation':
      substantive(record.policy, 'policy');
      choices(record.completion, ['complete', 'incomplete'], 'growth completion');
      for (const n of [record.startedAt, record.endedAt, record.clockUncertainty, record.sampleCount, record.denominator, record.timeouts, record.partialScans]) nonnegative(n, 'growth observation count');
      ensure(record.endedAt >= record.startedAt && record.sampleCount <= record.denominator, 'growth observation interval/denominator invalid');
      record.comparisons.forEach(row => { choices(row.kind, ['measured', 'estimate', 'policy-bound'], 'comparison kind'); choices(row.result, ['within', 'soft-breach', 'hard-breach', 'unknown'], 'comparison result');
        if (row.kind === 'measured' && row.result !== 'unknown') ensure((row.result === 'within') === (row.value <= row.threshold), 'growth comparison label disagrees with measured value'); });
      if (record.completion === 'complete') ensure(record.timeouts === 0 && record.partialScans === 0 && record.unavailableInputs.length === 0 && record.sampleCount === record.denominator, 'complete sample cannot omit failures');
      if (record.completion === 'incomplete') ensure(record.timeouts > 0 || record.partialScans > 0 || record.unavailableInputs.length > 0, 'incomplete sample needs retained omission'); break;
  }
}

export function safePackagePath(path: string): boolean {
  return path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(part => !part || part === '.' || part === '..');
}

function decoderFor<N extends AssemblyRecordName>(name: N, context: AssemblyDecodeContext) {
  return defineDecoder<Extract<AssemblyRecord, { type: N }>, AssemblyDecodeContext>({
    name, owner: 'part-ten', currentVersion: 1, versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
    decodeCurrent: value => {
      try { shapeCheck(value, assemblyShapes[name]); const record = value as unknown as Extract<AssemblyRecord, { type: N }>;
        ensure(record.type === name, 'owned assembly type mismatch'); validate(record); return { ok: true, value: freeze(record) }; }
      catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'assembly decode failed' }; }
    },
  }, context.preserved);
}

export function decodeAssemblyRecord<N extends AssemblyRecordName>(name: N, input: unknown, context: AssemblyDecodeContext): Result<Extract<AssemblyRecord, { type: N }>> {
  return boundary('AssemblyRecordDecode', input, context, () => {
    const record = take(take(decoderFor(name, context)).decode(input, context));
    if (context.validateReferences) validateAssemblyRecordReferences(record, context);
    return record;
  });
}
export const decodeAssemblyManifest = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('AssemblyManifest', input, context);
export const decodeAssemblyAdmission = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('AssemblyAdmission', input, context);
export const decodeHarnessLaunchSpec = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('HarnessLaunchSpec', input, context);
export const decodeHarnessObservation = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('HarnessObservation', input, context);
export const decodeAdapterEvidenceContract = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('AdapterEvidenceContract', input, context);
export const decodeAdapterConformance = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('AdapterConformance', input, context);
export const decodeStoreCustodyPolicy = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('StoreCustodyPolicy', input, context);
export const decodeStorageAccessObservation = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('StorageAccessObservation', input, context);
export const decodeLocalCapabilityPackage = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('LocalCapabilityPackage', input, context);
export const decodePackageTransition = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('PackageTransition', input, context);
export const decodeGrowthPolicy = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('GrowthPolicy', input, context);
export const decodeGrowthObservation = (input: unknown, context: AssemblyDecodeContext) => decodeAssemblyRecord('GrowthObservation', input, context);

export function assemblyLogicalKey(record: AssemblyRecord): string {
  switch (record.type) {
    case 'AssemblyManifest': return `manifest:${record.id}`;
    case 'AssemblyAdmission': return `admission:${record.manifest}:${record.machine}:${record.scope}:${record.incarnation}`;
    case 'HarnessLaunchSpec': return `launch:${record.run}:${record.step}:${record.incarnation}`;
    case 'HarnessObservation': return `harness-observation:${record.launch}:${record.phase}:${record.id}`;
    case 'AdapterEvidenceContract': return `adapter-contract:${record.adapter}:${record.contractVersion}`;
    case 'AdapterConformance': return `adapter-conformance:${record.contract}:${record.artifact}:${record.platform}:${record.mode}`;
    case 'StoreCustodyPolicy': return `custody:${record.store}:${record.governedVersion}`;
    case 'StorageAccessObservation': return `storage-access:${record.operation}:${record.id}`;
    case 'LocalCapabilityPackage': return `package:${record.namespace}:${record.version}`;
    case 'PackageTransition': return `package-transition:${record.package}:${record.scope}:${record.operation}`;
    case 'GrowthPolicy': return `growth-policy:${record.storeScope}:${record.policyVersion}`;
    case 'GrowthObservation': return `growth-observation:${record.policy}:${record.subjectScope}:${record.id}`;
  }
}
export function assemblyIdentity(record: AssemblyRecord): AssemblyIdentity { return freeze({ id: record.id, logicalKey: assemblyLogicalKey(record), canonicalHash: encoded(record).hash }); }
export function compareAssemblyRecords<N extends AssemblyRecordName>(name: N, left: unknown, right: unknown, context: AssemblyDecodeContext): Result<AssemblyComparison> {
  return boundary('CompareAssemblyRecords', { name, left, right }, context, () => {
    const a = take(decodeAssemblyRecord(name, left, context)), b = take(decodeAssemblyRecord(name, right, context));
    const ai = assemblyIdentity(a), bi = assemblyIdentity(b);
    if (ai.id !== bi.id && ai.logicalKey !== bi.logicalKey) return freeze({ equal: false });
    if (ai.canonicalHash === bi.canonicalHash) return freeze({ equal: true });
    const conflict: ConflictClass = { key: ai.logicalKey, kind: 'immutable-disagreement', facts: [ai.canonicalHash, bi.canonicalHash].sort(), detail: `divergent canonical content for ${name} logical identity ${ai.logicalKey}` };
    return freeze({ equal: false, conflict });
  });
}

export const assemblyKindFor = (name: AssemblyRecordName): string => `assembly-${name}`;
export interface AssemblyReference {
  readonly id: string;
  readonly expected?: AssemblyRecordName | 'CheckRunRecord' | 'ProbeRecord' | 'Measurement' | undefined;
  readonly field: string;
  readonly requiredWhenSigned: boolean;
}
const refs = (ids: readonly string[], field: string, expected?: AssemblyReference['expected'], requiredWhenSigned = false): AssemblyReference[] =>
  ids.filter(Boolean).map(id => ({ id, expected, field, requiredWhenSigned }));
export function assemblyReferences(record: AssemblyRecord): readonly AssemblyReference[] {
  const generic = [...refs(record.predecessors, 'predecessors', undefined, true), ...refs(record.dependencyFacts, 'dependencyFacts', undefined, true)];
  switch (record.type) {
    case 'AssemblyManifest': return [...generic, ...refs(record.custodyPolicies, 'custodyPolicies', 'StoreCustodyPolicy')];
    case 'AssemblyAdmission': return [...generic, ...refs([record.priorAdmission], 'priorAdmission', 'AssemblyAdmission'),
      ...refs(record.conformance, 'conformance', 'AdapterConformance', true),
      ...refs(record.isolationEvidence, 'isolationEvidence', 'HarnessObservation', true),
      ...refs(record.custodyEvidence, 'custodyEvidence', 'StorageAccessObservation', true),
      ...refs(record.probeEvidence, 'probeEvidence', 'ProbeRecord', true)];
    case 'HarnessLaunchSpec': return [...generic, ...refs([record.processOperation], 'processOperation')];
    case 'HarnessObservation': return [...generic, ...refs([record.launch], 'launch', 'HarnessLaunchSpec'), ...refs(record.causalReferences, 'causalReferences')];
    case 'AdapterEvidenceContract': return [...generic, ...refs([record.parserDeclaration], 'parserDeclaration')];
    case 'AdapterConformance': return [...generic, ...refs([record.contract], 'contract', 'AdapterEvidenceContract', true),
      ...refs(record.stageChecks.map(row => row.checkRun), 'stageChecks.checkRun', 'CheckRunRecord', true),
      ...refs(record.probes, 'probes', 'ProbeRecord', true), ...refs(record.bars, 'bars', undefined, true)];
    case 'StoreCustodyPolicy': return [...generic, ...refs(record.grants, 'grants')];
    case 'StorageAccessObservation': return [...generic, ...refs([record.policy], 'policy', 'StoreCustodyPolicy')];
    case 'LocalCapabilityPackage': return [...generic, ...refs([record.priorPackage], 'priorPackage', 'LocalCapabilityPackage', true)];
    case 'PackageTransition': return [...generic, ...refs([record.operation], 'operation'), ...refs(record.testEvidence, 'testEvidence', undefined, true),
      ...refs(record.migrationEvidence, 'migrationEvidence', undefined, true), ...refs(record.probeEvidence, 'probeEvidence', undefined, true)];
    case 'GrowthPolicy': return [...generic, ...refs([record.loopPolicy], 'loopPolicy')];
    case 'GrowthObservation': return [...generic, ...refs([record.policy], 'policy', 'GrowthPolicy', true), ...refs(record.measurements, 'measurements', 'Measurement', true)];
  }
}
export function assemblyRowForReference(reference: string, rows: readonly CurrentAssemblyFact[]): CurrentAssemblyFact | undefined {
  return rows.find(row => row.fact.id === reference || row.record.id === reference);
}

function object(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : undefined;
}

export function factReferenceAliases(fact: FactEnvelope): readonly string[] {
  const body = object(fact.body); const nested = object(body?.record); const measurement = object(body?.measurement);
  return [...new Set([fact.id, body?.id, nested?.id, measurement?.id].filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

export function referenceHasExpectedKind(reference: AssemblyReference, fact: FactEnvelope, record?: AssemblyRecord): boolean {
  if (!reference.expected) return true;
  if (record) return record.type === reference.expected || reference.expected === 'Measurement' && record.type === 'GrowthObservation';
  const body = object(fact.body); const nested = object(body?.record); const measurement = object(body?.measurement);
  switch (reference.expected) {
    case 'CheckRunRecord': return fact.kind === 'check-run-record';
    case 'ProbeRecord': return fact.kind === 'verification-ProbeRecord';
    case 'Measurement': return body?.type === 'Measurement' || nested?.type === 'Measurement' || measurement?.type === 'Measurement';
    default: return false;
  }
}

export function validateAssemblyRecordReferences(record: AssemblyRecord, context: AssemblyDecodeContext): void {
  ensure(context.history, 'signed history resolver required');
  for (const reference of assemblyReferences(record)) {
    const status = take(context.history.lookup(reference.id));
    if (!status) {
      ensure(!reference.requiredWhenSigned && !/^[^:]+:\d+:\d+$/.test(reference.id), `${reference.field} reference missing from signed history: ${reference.id}`);
      continue;
    }
    ensure(referenceHasExpectedKind(reference, status.fact, status.record),
      `${reference.field} reference has wrong signed record kind; expected ${reference.expected ?? 'signed fact'}`);
    ensure(reference.expected || !status.record || reference.field === 'predecessors' || reference.field === 'dependencyFacts',
      `${reference.field} reference resolves to a Part Ten record owned by the wrong semantic boundary`);
    ensure(status.taint.length === 0 && status.conflicts.length === 0,
      `${reference.field} reference is unavailable or conflicted: ${reference.id}`);
    ensure(status.completeness === 'complete' || reference.field === 'predecessors' || reference.field === 'dependencyFacts',
      `${reference.field} reference is incomplete: ${reference.id}`);
  }
}
export function assemblyRecordFrom(fact: FactEnvelope, context: AssemblyDecodeContext): AssemblyRecord {
  const body = fact.body as { record: Json }; ensure(body.record && typeof body.record === 'object' && !Array.isArray(body.record), 'assembly record body missing');
  const name = (body.record as Readonly<Record<string, Json>>).type; ensure(typeof name === 'string' && Object.hasOwn(assemblyShapes, name), 'unknown assembly record type');
  ensure(fact.id === factId(fact.segment) && fact.machine === fact.segment.machine, 'assembly envelope origin mismatch');
  ensure(fact.kind === assemblyKindFor(name as AssemblyRecordName), 'assembly fact kind mismatch');
  ensure(preimage(fact).hash === fact.contentHash, 'assembly envelope content hash mismatch');
  const signature = Buffer.from(fact.signature, 'hex');
  const keys = (context.register as unknown as Pick<DecodeContext['register'], 'keys'>).keys;
  ensure(keys, 'assembly envelope verification keys unavailable');
  const key = Object.values(keys).find(candidate => candidate.algorithm === 'ed25519' && candidate.owner === fact.machine
    && candidate.methods.includes('fact-envelope') && /^[a-f0-9]{128}$/.test(fact.signature)
    && verify(null, Buffer.from(fact.contentHash, 'utf8'), candidate.publicKey, signature));
  ensure(key, 'assembly envelope signature or origin invalid');
  return take(decodeAssemblyRecord(name as AssemblyRecordName, body.record, { ...context, validateReferences: false }));
}
export function assemblyRows(facts: readonly FactEnvelope[], context: AssemblyDecodeContext): readonly { fact: FactEnvelope; record: AssemblyRecord }[] {
  const kinds = new Set(Object.keys(assemblyShapes).map(name => assemblyKindFor(name as AssemblyRecordName)));
  return facts.filter(fact => kinds.has(fact.kind)).map(fact => ({ fact, record: assemblyRecordFrom(fact, context) }));
}
export function assemblySchemas(host: AssemblyHost): readonly FactSchema[] {
  return (Object.keys(assemblyShapes) as AssemblyRecordName[]).map(name => ({ kind: assemblyKindFor(name), version: 1,
    fields: { record: { kind: 'owned', owner: 'part-ten', name } }, machineScope: 'shared', standing: 'requester', action: 'work',
    scope: host.scope, causallyBound: true, requiredReferences: [], authority: 'none' }));
}
export function registerAssemblyBodies(host: AssemblyHost): Result<readonly OwnedBodyRegistration[]> {
  return boundary('AssemblyRegistrations', null, host.boundary, () => (Object.keys(assemblyShapes) as AssemblyRecordName[]).map(name =>
    take(registerOwnedBody({ name, owner: 'part-ten', currentVersion: 1, versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
      decodeCurrent: (value, context) => {
        try { ensure(context.origin.machine === host.machine && context.origin.principal.id === host.principal.id && context.origin.principal.kind === host.principal.kind, 'foreign assembly recorder');
          const record = take(decodeAssemblyRecord(name, value, context)); ensure(context.origin.kind === assemblyKindFor(name), 'assembly fact kind mismatch');
          const cone = new Set(causalCone(context.origin, context.facts.facts).map(fact => fact.id));
          ensure(record.predecessors.every(id => cone.has(id)), 'assembly predecessor outside causal cone');
          ensure(record.dependencyFacts.every(id => cone.has(id)), 'assembly dependency outside causal cone');
          return { ok: true, value: json(record) };
        } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'assembly body refused' }; }
      },
    }, assemblyShapes[name], host.boundary))));
}
export function createAssemblySpine(host: AssemblyHost, author: AssemblyAuthor, store: AssemblySpine['store']): AssemblySpine {
  return Object.freeze({ store, append: (record: AssemblyRecord, required: readonly string[] = [...new Set([...record.predecessors, ...record.dependencyFacts])]) => authorAndAppend({
    kind: assemblyKindFor(record.type), schemaVersion: 1, machine: host.machine, principal: json(host.principal), provenance: json(host.principal.provenance),
    at: json(host.current().clock), body: { record: json(record) }, required,
  }, author.context, store, author.privateKey) });
}
