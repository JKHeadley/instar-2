import { createFactStore } from '../../src/facts/index.js';
import type { FactContext, FactStorePort, SegmentStoragePort } from '../../src/facts/index.js';
import { createAssemblyRuntime, createAssemblySpine, currentAssemblyRows, registerAssemblyBodies, resolveAssemblyHistory, assemblySchemas } from '../../src/assembly/index.js';
import type { AssemblyComposition, AssemblyDecodeContext, AssemblyHost, AssemblySpine, HarnessAdapterPort, PersistenceAdapterPort } from '../../src/assembly/index.js';
import type { ModelAdapterPort } from '../../src/judgment/index.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';

export function assemblyRuntimeFixture(storageFactory?: (f: ReturnType<typeof factsFixture>) => SegmentStoragePort) {
  const f = factsFixture(); let stopped = false; let now = 100; let context: FactContext = f.ctx;
  let store: FactStorePort; let spine: AssemblySpine; let historyContext: AssemblyDecodeContext;
  const history = Object.freeze({ owner: 'part-ten' as const,
    current: () => f.success(currentAssemblyRows(value(store.readForProjection()), historyContext)),
    lookup: (reference: string) => {
      const snapshot = value(store.readForProjection()); const rows = currentAssemblyRows(snapshot, historyContext);
      const assembly = rows.find(row => row.fact.id === reference || row.record.id === reference);
      const status = snapshot.entries.find(row => row.fact.id === (assembly?.fact.id ?? reference));
      return f.success(status ? { fact: status.fact, ...(assembly ? { record: assembly.record } : {}), taint: status.taint,
        conflicts: assembly ? [...status.conflicts, ...assembly.conflicts] : status.conflicts,
        completeness: assembly?.record.type === 'GrowthObservation' && assembly.record.completion === 'incomplete' ? 'partial' as const : 'complete' as const } : null);
    },
    resolve: (record: import('../../src/assembly/index.js').AssemblyRecord) => resolveAssemblyHistory(record, spine, historyContext),
  });
  historyContext = Object.freeze({ ...f.c, history, validateReferences: true });
  const host: AssemblyHost = { machine: 'machine-a', principal: f.alice, scope: f.scope, boundary: historyContext,
    current: () => ({ facts: context, generation: 'generation:fixture', stopped, clock: f.clock(now) }) };
  const registrations = value(registerAssemblyBodies(host)); context = { ...context,
    schemas: [...context.schemas, ...assemblySchemas(host)], ownedBodies: [...context.ownedBodies ?? [], ...registrations] };
  const raw: unknown[] = [];
  const storage = storageFactory?.(f) ?? { owner: 'part-ten' as const, read: () => raw,
    append: (bytes: string, expected: string | null) => { const prior = raw.at(-1) as { contentHash?: string } | undefined;
      if ((prior?.contentHash ?? null) !== expected) throw new Error('compare-head mismatch'); raw.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' as const }); } };
  store = createFactStore(context, storage); spine = createAssemblySpine(host, { context, privateKey }, store);
  const harness: HarnessAdapterPort = { owner: 'part-ten', id: 'native', describe: () => ({ artifact: `sha256:${'4'.repeat(64)}`, platform: 'darwin-arm64', contextModes: ['model-context-boundary'], outputModes: ['framed'], interruptionModes: ['registered-operation'], custodyModes: ['scoped'], observationModes: ['instrumented'], conformance: 'conformance:1' }),
    launch: () => { throw new Error('not used'); }, deliver: () => { throw new Error('not used'); }, observe: () => { throw new Error('not used'); } };
  const model: ModelAdapterPort = { owner: 'part-ten', describe: () => ({ owner: 'part-ten', provider: 'provider', model: 'model', route: 'route', automaticRetries: 0, maxInputBytes: 1024, maxOutputBytes: 1024, maxCharge: 1, measured: false, basis: 'fixture' }),
    prepare: () => f.success('{}'), exchange: async () => f.success({ state: 'complete', bytes: '{}', providerOperation: 'provider:1', usage: { inputTokens: 1, outputTokens: 1, charge: 1, source: 'fixture' }, retryBlocked: false }) };
  const persistence: PersistenceAdapterPort = { owner: 'part-ten', id: 'encrypted-store', describe: () => ({ backend: 'fixture', policy: 'StoreCustodyPolicy', encrypted: true, appendAtomic: true }),
    appendExact: () => { throw new Error('not used'); }, readExact: () => { throw new Error('not used'); }, flushEvidence: () => { throw new Error('not used'); } };
  let protectedPosture: 'protected' | 'unprotected' = 'protected';
  const composition: AssemblyComposition = { host, spine, harnesses: [harness], model, persistence,
    independentProtection: { owner: 'part-nine', posture: () => f.success(protectedPosture) } };
  return { ...f, c: historyContext, host, context, raw, storage, store, spine, composition, runtime: createAssemblyRuntime(composition),
    stop: (value = true) => { stopped = value; }, time: (value: number) => { now = value; }, protection: (value: typeof protectedPosture) => { protectedPosture = value; } };
}
