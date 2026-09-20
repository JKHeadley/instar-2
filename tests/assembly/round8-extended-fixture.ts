import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { FactContext, FactSchema, FactStorePort, SegmentStoragePort } from '../../src/facts/index.js';
import { createAssemblyRuntime, createAssemblySpine, currentAssemblyRows, registerAssemblyBodies, resolveAssemblyHistory, assemblySchemas } from '../../src/assembly/index.js';
import { factReferenceAliases } from '../../src/assembly/records.js';
import type { AssemblyComposition, AssemblyDecodeContext, AssemblyHost, AssemblySpine, HarnessAdapterPort, PersistenceAdapterPort } from '../../src/assembly/index.js';
import type { ModelAdapterPort } from '../../src/judgment/index.js';
import { registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';
import { fixedRecordFixture } from './fixed-installation-contract.test.js';
import { preparedInstallationFor, productionInstallationSources, productionPackageRecords, productionScope } from './production-fixture.js';
import { productionSignerReferenceSchemas, registerProductionSignerReferenceBody } from '../../src/assembly/index.js';
import { createTransportAuthority, createTransportSpine } from '../../src/transport/index.js';
import { verificationInput } from '../verification/fixture.js';
import { assemblyInput } from './fixture.js';

export const productionReferenceKinds = Object.freeze([
  'GrowthPolicy', 'Measurement', 'CheckRunRecord', 'ProbeRecord',
  'operator-surface-registration', 'operator-challenge-verifier-binding', 'intake-verified-act-binding',
  'minimal-plane-projection-binding', 'minimal-plane-replay-binding', 'minimal-responder-binding',
  'fact-local-durable-segment', 'register-generation-record', 'identity-key-set', 'clock-source',
  'transport-Lease', 'transport-FenceToken', 'fact-replication-receipt', 'conversation-binding',
  'conversation-route', 'delivery-evidence-service', 'assembly-lifecycle-control-binding',
  'platform-delivery-witness-binding',
] as const);

export function assemblyRuntimeFixture(storageFactory?: (f: ReturnType<typeof factsFixture>) => SegmentStoragePort,
  options: { verifiedProbes?: boolean } = {}) {
  // P10-SI-20: the store is rooted in real owner history (genesis grant, conversation
  // binding, register generation, installation, approved package) so production bindings
  // can be produced by their owners instead of id-only wrappers.
  const installed = fixedRecordFixture(input => productionPackageRecords(input), { scopeId: productionScope, extraSources: productionInstallationSources });
  const intake = installed.f, f = intake.f; let stopped = false; let now = 100; let generation = 'generation:fixture';
  // Ten's signer reference body is registered against the fixture's externally verified bootstrap.
  const signerAdmission = { ...installed.admission, bootstrap: preparedInstallationFor(intake).bootstrap };
  const signerRegistration = value(registerProductionSignerReferenceBody(signerAdmission));
  let context: FactContext = { ...intake.context, decode: { ...intake.context.decode },
    schemas: [...intake.context.schemas, ...productionSignerReferenceSchemas(f.scope)], ownedBodies: [...intake.context.ownedBodies ?? [], signerRegistration] };
  let store: FactStorePort; let spine: AssemblySpine; let historyContext: AssemblyDecodeContext;
  const history = Object.freeze({ owner: 'part-ten' as const,
    current: () => f.success(currentAssemblyRows(value(store.readForProjection()), historyContext)),
    lookup: (reference: string) => {
      const snapshot = value(store.readForProjection()); const rows = currentAssemblyRows(snapshot, historyContext);
      const assembly = rows.find(row => row.fact.id === reference || row.record.id === reference);
      const status = snapshot.entries.find(row => row.fact.id === (assembly?.fact.id ?? reference))
        ?? snapshot.entries.find(row => factReferenceAliases(row.fact).includes(reference));
      return f.success(status ? { fact: status.fact, ...(assembly ? { record: assembly.record } : {}), taint: status.taint,
        conflicts: assembly ? [...status.conflicts, ...assembly.conflicts] : status.conflicts,
        completeness: assembly?.record.type === 'GrowthObservation' && assembly.record.completion === 'incomplete' ? 'partial' as const : 'complete' as const } : null);
    },
    resolve: (record: import('../../src/assembly/index.js').AssemblyRecord) => resolveAssemblyHistory(record, spine, historyContext),
  });
  historyContext = Object.freeze({ ...f.c, history, validateReferences: true });
  const host: AssemblyHost = { machine: 'machine-a', principal: f.alice, scope: f.scope, boundary: historyContext,
    current: () => ({ facts: context, generation, stopped, clock: f.clock(now) }) };
  const registrations = value(registerAssemblyBodies(host));
  const probeSchemas: readonly FactSchema[] = options.verifiedProbes ? verificationSchemas(host as any)
    : [{ ...f.schema, kind: 'verification-ProbeRecord', fields: { id: { kind: 'text', maxLength: 2048 } } }];
  const referenceSchemas: FactSchema[] = [
    { ...f.schema, kind: 'check-run-record', fields: { id: { kind: 'text', maxLength: 2048 } } },
    ...probeSchemas,
    { ...f.schema, kind: 'assembly-reference-evidence', fields: { id: { kind: 'text', maxLength: 2048 } } },
    { ...f.schema, kind: 'astra-source-evidence', fields: { evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...f.schema, kind: 'assembly-measurement-reference', fields: {
      id: { kind: 'text', maxLength: 2048 }, measurement: { kind: 'constitutional', type: 'Measurement' },
    } },
    ...productionReferenceKinds.map(kind => ({ ...f.schema, kind, fields: { id: { kind: 'text' as const, maxLength: 2048 } } })),
  ];
  const known = new Set(context.schemas.map(schema => `${schema.kind}:${schema.version}`));
  const additive = (schemas: readonly FactSchema[]) => schemas.filter(schema => !known.has(`${schema.kind}:${schema.version}`));
  context = { ...context,
    schemas: [...context.schemas, ...additive(assemblySchemas(host)), ...additive(referenceSchemas)],
    ownedBodies: [...context.ownedBodies ?? [], ...registrations,
      ...(options.verifiedProbes ? value(registerVerificationBodies(host as any)) : [])] };
  // Real owner history already sits in the intake storage; a caller-supplied storage receives
  // the same frames in order so both views share one exact-prefix history.
  const raw: unknown[] = intake.frames;
  const storage = storageFactory?.(f) ?? intake.storage;
  if (storage !== intake.storage) {
    let head: string | null = null;
    for (const frame of intake.frames) { value(storage.append(JSON.stringify(frame), head)); head = (frame as { contentHash: string }).contentHash; }
  }
  store = createFactStore(context, storage); spine = createAssemblySpine(host, { context, privateKey }, store);
  // Six's authority over THIS store (the chooser's authority read a narrower context); same host, same domain.
  const transportHost = preparedInstallationFor(intake).transport.host;
  const transport = { host: transportHost, api: createTransportAuthority(transportHost, createTransportSpine(transportHost, { context, privateKey }, store), f.c) };
  const appendReference = (kind: string, body: object) => value(authorAndAppend({
    kind, schemaVersion: 1, machine: host.machine, principal: JSON.parse(JSON.stringify(f.alice)),
    provenance: JSON.parse(JSON.stringify(f.alice.provenance)), at: JSON.parse(JSON.stringify(f.clock(now))),
    body: JSON.parse(JSON.stringify(body)), required: [],
  }, context, store, privateKey));
  for (const id of ['check-run:context', 'check:unit', 'check:integration', 'check:lifecycle']) appendReference('check-run-record', { id });
  for (const id of ['probe:native', 'probe:1', 'probe:word-count']) appendReference('verification-ProbeRecord',
    options.verifiedProbes ? { record: { ...verificationInput('ProbeRecord'), id } } : { id });
  appendReference('assembly-reference-evidence', { id: 'bar:isolation' });
  appendReference('assembly-measurement-reference', { id: 'measurement:replay', measurement: f.now });
  const harness: HarnessAdapterPort = { owner: 'part-ten', id: 'native', describe: () => ({ artifact: `sha256:${'4'.repeat(64)}`, platform: 'darwin-arm64', contextModes: ['model-context-boundary'], outputModes: ['framed'], interruptionModes: ['registered-operation'], custodyModes: ['scoped'], observationModes: ['instrumented'], conformance: 'conformance:1' }),
    launch: () => { throw new Error('not used'); }, deliver: () => { throw new Error('not used'); }, observe: () => { throw new Error('not used'); } };
  const model: ModelAdapterPort = { owner: 'part-ten', describe: () => ({ owner: 'part-ten', provider: 'provider', model: 'model', route: 'route', automaticRetries: 0, maxInputBytes: 1024, maxOutputBytes: 1024, maxCharge: 1, measured: false, basis: 'fixture' }),
    prepare: () => f.success('{}'), exchange: async () => f.success({ state: 'complete', bytes: '{}', providerOperation: 'provider:1', usage: { inputTokens: 1, outputTokens: 1, charge: 1, source: 'fixture' }, retryBlocked: false }) };
  const persistence: PersistenceAdapterPort = { owner: 'part-ten', id: 'encrypted-store', describe: () => ({ backend: 'fixture', policy: 'StoreCustodyPolicy', encrypted: true, appendAtomic: true }),
    appendExact: () => { throw new Error('not used'); }, readExact: () => { throw new Error('not used'); }, flushEvidence: () => { throw new Error('not used'); } };
  let protectedPosture: 'protected' | 'unprotected' = 'protected';
  const composition: AssemblyComposition = { host, spine, harnesses: [harness], model, persistence,
    independentProtection: { owner: 'part-nine', posture: () => f.success(protectedPosture) } };
  const runtime = createAssemblyRuntime(composition);
  value(runtime.record('AdapterEvidenceContract', assemblyInput('AdapterEvidenceContract')));
  value(runtime.record('GrowthPolicy', assemblyInput('GrowthPolicy')));
  // FactStore seals its validated schema registry on first append. Expose a mutable
  // structural copy for legacy tests that add redundant schemas after fixture boot;
  // the store already owns every schema those tests use.
  const exposedContext = { ...context, schemas: [...context.schemas] };
  return { ...f, c: historyContext, host, context: exposedContext, raw, storage, store, spine, composition, runtime, appendReference,
    installed, intake, signerAdmission, transport,
    stop: (value = true) => { stopped = value; }, time: (value: number) => { now = value; }, protection: (value: typeof protectedPosture) => { protectedPosture = value; },
    /** Switch the host onto the real register generation (installation records require it). */
    generation: (id: string) => { generation = id; },
    /** Extend the live decode context with owner registrations produced after boot. */
    extendContext: (extra: { schemas?: readonly FactSchema[]; ownedBodies?: FactContext['ownedBodies'] }) => {
      context = { ...context, schemas: [...context.schemas, ...additive(extra.schemas ?? [])], ownedBodies: [...context.ownedBodies ?? [], ...extra.ownedBodies ?? []] };
      known.clear(); for (const schema of context.schemas) known.add(`${schema.kind}:${schema.version}`);
      exposedContext.schemas = [...context.schemas]; (exposedContext as { ownedBodies?: FactContext['ownedBodies'] }).ownedBodies = context.ownedBodies;
    } };
}
