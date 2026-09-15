import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { FactContext, FactSchema, FactStorePort, SegmentStoragePort } from '../../src/facts/index.js';
import { createAssemblyRuntime, createAssemblySpine, currentAssemblyRows, registerAssemblyBodies, resolveAssemblyHistory, assemblySchemas } from '../../src/assembly/index.js';
import { factReferenceAliases } from '../../src/assembly/records.js';
import type { AssemblyComposition, AssemblyDecodeContext, AssemblyHost, AssemblySpine, HarnessAdapterPort, PersistenceAdapterPort } from '../../src/assembly/index.js';
import type { ModelAdapterPort } from '../../src/judgment/index.js';
import { registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { assemblyInput } from './fixture.js';

export function assemblyRuntimeFixture(storageFactory?: (f: ReturnType<typeof factsFixture>) => SegmentStoragePort,
  options: { verifiedProbes?: boolean } = {}) {
  const f = factsFixture(); let stopped = false; let now = 100; let context: FactContext = f.ctx;
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
    current: () => ({ facts: context, generation: 'generation:fixture', stopped, clock: f.clock(now) }) };
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
  ];
  context = { ...context,
    schemas: [...context.schemas, ...assemblySchemas(host), ...referenceSchemas],
    ownedBodies: [...context.ownedBodies ?? [], ...registrations,
      ...(options.verifiedProbes ? value(registerVerificationBodies(host as any)) : [])] };
  const raw: unknown[] = [];
  const storage = storageFactory?.(f) ?? { owner: 'part-ten' as const, read: () => raw,
    append: (bytes: string, expected: string | null) => { const prior = raw.at(-1) as { contentHash?: string } | undefined;
      if ((prior?.contentHash ?? null) !== expected) throw new Error('compare-head mismatch'); raw.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' as const }); } };
  store = createFactStore(context, storage); spine = createAssemblySpine(host, { context, privateKey }, store);
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
  return { ...f, c: historyContext, host, context: exposedContext, raw, storage, store, spine, composition, runtime,
    stop: (value = true) => { stopped = value; }, time: (value: number) => { now = value; }, protection: (value: typeof protectedPosture) => { protectedPosture = value; } };
}
