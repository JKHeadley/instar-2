import type { AssemblyRecord, AssemblyRecordName } from '../../src/assembly/index.js';

const h = (c: string) => `sha256:${c.repeat(64)}` as const;
const common = (type: AssemblyRecordName, id = type) => ({ type, schemaVersion: 1, id, predecessors: [], dependencyFacts: [] });
const capabilities = ['stable-lookup', 'application-stage', 'decisive-non-occurrence', 'delayed-execution-exclusion', 'final-charge', 'prerequisite-durability'] as const;
export const growthSubjects = ['sequence-length', 'segment-bytes', 'append-rate', 'genesis-replay-duration', 'checkpoint-replay-duration',
  'boot-rebuild-duration', 'replication-lag', 'refusal-rate', 'unattributable-wrap-rate', 'retraction-count', 'conflict-backlog-age',
  'pending-set-depth', 'known-segment-set-size', 'machine-key-count', 'historical-encoder-count'] as const;

export const assemblyInputs = {
  AssemblyManifest: { ...common('AssemblyManifest'), manifestDigest: h('1'), packages: [{ id: 'core', digest: h('2'), artifact: h('3') }],
    compatibility: { runtime: 'node-22', toolchain: 'ts-5.9', platforms: ['darwin-arm64'], schemas: ['assembly-v1'], rollback: ['assembly-v1'] },
    publicPorts: [
      { port: 'HarnessAdapterPort', version: '1', scope: 'scope:ordinary', implementation: 'native', artifact: h('4') },
      { port: 'ModelAdapterPort', version: '1', scope: 'scope:ordinary', implementation: 'provider:model:route', artifact: h('5') },
      { port: 'PersistenceAdapterPort', version: '1', scope: 'scope:ordinary', implementation: 'encrypted-store', artifact: h('6') },
    ], requiredGraph: [{ consumer: 'scope:ordinary', dependencies: ['source', 'authority', 'route', 'durability', 'observation'] }],
    generation: 'generation:fixture', declarationSources: ['assembly.contract'], genesisAnchor: 'genesis:fixture', trustRoots: ['root:fixture'],
    servicePrincipals: ['service:assembly'], grants: ['grant:assembly'], custodyPolicies: ['policy:store'],
    resourcePolicies: [{ class: 'ordinary', resource: 'workers', limit: 1 }, { class: 'repair', resource: 'workers', limit: 1 }, { class: 'control', resource: 'queue', limit: 0 }],
    requiredChecks: [{ tier: 'unit', ids: ['P10-NF-01'] }, { tier: 'integration', ids: ['P10-NF-04'] }, { tier: 'lifecycle', ids: ['P10-NF-06'] }] },
  AssemblyAdmission: { ...common('AssemblyAdmission'), manifest: 'AssemblyManifest', manifestDigest: h('1'), machine: 'machine-a', incarnation: 'incarnation:1',
    scope: 'scope:ordinary', sourceGeneration: 'generation:fixture', sourceVector: h('7'), artifacts: ['artifact:assembly'], environmentEvidence: ['environment:1'],
    conformance: ['conformance:1'], isolationEvidence: ['isolation:1'], custodyEvidence: ['custody:1'], probeEvidence: ['probe:1'],
    resourceReservation: 'reservation:repair', observedAt: 10, validUntil: 1000, priorAdmission: '', disposition: 'active', reason: 'all dependencies admitted', repairOwner: 'run:repair' },
  HarnessLaunchSpec: { ...common('HarnessLaunchSpec'), run: 'run:1', step: 'step:1', principal: 'worker:1', incarnation: 'worker-incarnation:1', harness: 'native',
    artifactDigest: h('4'), machine: 'machine-a', workingScope: 'workspace:1', processOperation: 'operation:launch', resourceReferences: ['reservation:launch'],
    portHandles: ['handle:judgment', 'handle:effects'], environment: [{ name: 'LANG', valueDigest: h('8') }],
    contextManifest: [{ class: 'history', reference: 'capture:history', digest: h('9') }], input: 'intake:1', inputDigest: h('a'), consumptionMode: 'model-context-boundary' },
  HarnessObservation: { ...common('HarnessObservation'), launch: 'HarnessLaunchSpec', run: 'run:1', step: 'step:1', input: 'intake:1', incarnation: 'worker-incarnation:1',
    sourceEvidence: ['model-context:1'], contextDigests: [h('9')], generation: 'generation:fixture', causalReferences: [], observedAt: 20, freshFor: 100,
    phase: 'context-consumed', boundaryEvidence: 'model-context:1', detail: 'submitted capture entered model request' },
  AdapterEvidenceContract: { ...common('AdapterEvidenceContract'), adapter: 'telegram', artifact: h('b'), parserDeclaration: 'parser:telegram', stimulusClass: 'bot-workspace',
    authenticatedFields: ['account', 'tenant', 'conversation', 'sender', 'event'], authenticationMethod: 'provider webhook signature', credentialBinding: 'secret:telegram',
    senderNamespace: 'telegram-user', conversationNamespace: 'telegram-chat', stabilityRules: ['tenant scoped'], forwardingTreatment: 'quoted data', impersonationTreatment: 'never identity',
    churnDetector: 'credential epoch', revocationResponse: 'rebind', eventIdAuthority: 'provider', replayPolicy: 'retained durable ids', ackPolicy: 'bound-only',
    disclosureScopes: ['conversation:bound'], positiveFixtures: ['fixture:telegram:positive'], negativeFixtures: ['fixture:telegram:unsigned'], probes: ['probe:telegram'],
    capabilities: capabilities.map(name => ({ name, support: 'supported' as const, source: `source:${name}`, predicate: `predicate:${name}`,
      subjectBinding: 'operation+digest', horizon: 'complete through receipt', budget: 1, conformance: `check:${name}`, reason: '' })), contractVersion: 'telegram:v1' },
  AdapterConformance: { ...common('AdapterConformance'), contract: 'AdapterEvidenceContract', adapter: 'native', package: 'core', artifact: h('4'), platform: 'darwin-arm64', mode: 'governed',
    portVersion: '1', schemaVersions: ['assembly-v1'], generation: 'generation:fixture', fixtureDigests: [h('c')], sourceProvenance: ['git:fixture'],
    stageChecks: [{ stage: 'context', checkRun: 'check-run:context', positive: ['case:consumed'], negative: ['case:stdin-only'] }], probes: ['probe:native'], bars: ['bar:isolation'], limitations: [],
    testedAt: 10, validUntil: 1000, disposition: 'passed' },
  StoreCustodyPolicy: { ...common('StoreCustodyPolicy'), governedVersion: 'policy:v1', store: 'store:fact', locations: [{ class: 'segment', location: 'custody://segments' }, { class: 'backup', location: 'custody://backup' }],
    custodians: ['service:custodian'], readOperation: 'operation:read-facts', disclosureScopes: ['scope:facts'], grants: ['grant:read-facts'], stalenessPolicy: 'current-generation',
    encryption: { suite: 'AES-256-GCM', version: '1', implementationEvidence: ['review:aes'] }, wrappingKey: 'secretref:wrapping-key', dataKeys: [{ id: 'data-key:1', epoch: 1 }],
    recoveryCustody: 'custodian:recovery', restoreProcedure: 'procedure:restore', rotationProcedure: 'procedure:rotate', migrationBound: 100,
    plaintextRestrictions: ['no durable plaintext', 'swap disabled'], metadataExposure: ['opaque size'], auditBound: 1000, rateBound: 10, resourceBound: 1024, compromiseResponse: 'inhibit store and rotate' },
  StorageAccessObservation: { ...common('StorageAccessObservation'), store: 'store:fact', objectClass: 'segment', requester: 'operator:alice', service: 'service:custodian', grant: 'grant:read-facts',
    policy: 'StoreCustodyPolicy', generation: 'generation:fixture', operation: 'operation:read:1', observedAt: 20, byteCount: 5, result: 'allowed', refusalReference: '' },
  LocalCapabilityPackage: { ...common('LocalCapabilityPackage'), namespace: 'alice.word-count', ownerPrincipal: 'alice', version: '1.0.0', contentDigest: h('d'), sourceDigest: h('e'),
    parent: '', upstream: '', priorPackage: '', portRequirements: [{ port: 'OperationAdapterPort', version: '1' }], dependencies: [],
    entrypoints: [{ id: 'word-count', path: 'dist/word-count.js', digest: h('f') }], declarationIds: ['alice.word-count.operation'], dataScopes: ['workspace'], custodyScopes: [], grants: ['grant:workspace'],
    resources: [{ resource: 'cpu-ms', limit: 1000 }], platforms: ['darwin-arm64'], modes: ['governed'], migrationCompatibility: ['none'], rollbackCompatibility: ['1.0.0'],
    checks: { unit: ['P10-NF-41'], integration: ['P10-NF-42'], lifecycle: ['P10-NF-43'] }, maturation: ['dark'], probes: ['probe:word-count'], awarenessSource: 'alice.word-count.operation' },
  PackageTransition: { ...common('PackageTransition'), package: 'alice.word-count', manifestDigest: h('d'), priorActiveDigest: '', machine: 'machine-a', scope: 'workspace', cause: 'install',
    responsiblePrincipal: 'alice', grants: ['grant:workspace'], generation: 'generation:fixture', testEvidence: ['check:unit', 'check:integration', 'check:lifecycle'], migrationEvidence: [],
    probeEvidence: ['probe:word-count'], operation: 'operation:switch:1', claim: 'claim:switch:1', observedArtifactDigest: h('d'), from: 'activating', to: 'active', outstandingWork: [] },
  GrowthPolicy: { ...common('GrowthPolicy'), policyVersion: 'growth:v1', storeScope: 'store:fact', projectionScope: 'all',
    subjects: growthSubjects.map(subject => ({ subject, producer: `producer:${subject}`, unit: subject.includes('duration') ? 'milliseconds' : 'count', cadence: 100,
      freshness: 200, workloadSizes: [1, 10, 100], softThreshold: 10, hardThreshold: 20 })), replayTimeCeiling: 1000, replayMemoryCeiling: 1024,
    loopPolicy: 'loop:growth', sampleCap: 100, breaker: 'closed', notificationBudget: 1, ownerRun: 'run:growth', diagnosticBudget: 'budget:growth' },
  GrowthObservation: { ...common('GrowthObservation'), policy: 'GrowthPolicy', policyGeneration: 'generation:fixture', machine: 'machine-a', subjectScope: 'store:fact', pinnedVector: h('0'),
    assemblyProfile: 'assembly:fixture', backendProfile: 'encrypted-chunks', hardwareProfile: 'fixture-machine', startedAt: 10, endedAt: 20, clockUncertainty: 0,
    workloadSizes: [1, 10, 100], measurements: ['measurement:replay'], sampleCount: 1, denominator: 1, timeouts: 0, partialScans: 0, unavailableInputs: [],
    comparisons: [{ subject: 'genesis-replay-duration', kind: 'measured', value: 5, threshold: 10, result: 'within' }], completion: 'complete', episode: '', investigationRun: '' },
} as const satisfies Record<AssemblyRecordName, object>;

export function assemblyInput<N extends AssemblyRecordName>(name: N): Extract<AssemblyRecord, { type: N }> {
  return assemblyInputs[name] as unknown as Extract<AssemblyRecord, { type: N }>;
}
