import { authorAndAppend, createFactStore, registerOwnedBody } from '../../src/facts/index.js';
import type { FactContext, FactSchema, FactStorePort, OwnedShape, SegmentStoragePort } from '../../src/facts/index.js';
import { decodeCheckRun } from '../../src/register/index.js';
import type { RegisterContext } from '../../src/register/index.js';
import { createAssemblyRuntime, createAssemblySpine, currentAssemblyRows, registerAssemblyBodies,
  resolveAssemblyHistory, assemblySchemas } from '../../src/assembly/index.js';
import { factReferenceAliases } from '../../src/assembly/records.js';
import type { AssemblyComposition, AssemblyDecodeContext, AssemblyHost, AssemblySpine,
  HarnessAdapterPort, PersistenceAdapterPort } from '../../src/assembly/index.js';
import type { ModelAdapterPort } from '../../src/judgment/index.js';
import { registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { assemblyInput } from './fixture.js';

const text = { kind: 'text' as const, maxLength: 65_536 };
const checkRunShape: OwnedShape = { kind: 'object', fields: {
  type: text, schemaVersion: { kind: 'integer' }, id: text, commit: text, branch: text, providerRun: text, outcome: text,
  fixtures: { kind: 'array', maxLength: 16_384, items: { kind: 'object', fields: { id: text, stage: text, outcome: text } } },
  at: { kind: 'object', fields: {
    type: text, schemaVersion: { kind: 'integer' }, subject: { kind: 'object', fields: { kind: text, instance: text } },
    value: { kind: 'integer' }, unit: text, at: { kind: 'integer' }, by: text,
  } },
} };

/** Dedicated additive fixture: package activity references real Part Three and Part Nine owner records. */
export function packageActivityRuntimeFixture(storageFactory?: (f: ReturnType<typeof factsFixture>) => SegmentStoragePort) {
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
        completeness: assembly?.record.type === 'GrowthObservation' && assembly.record.completion === 'incomplete'
          ? 'partial' as const : 'complete' as const } : null);
    },
    resolve: (record: import('../../src/assembly/index.js').AssemblyRecord) => resolveAssemblyHistory(record, spine, historyContext),
  });
  historyContext = Object.freeze({ ...f.c, history, validateReferences: true });
  const host: AssemblyHost = { machine: 'machine-a', principal: f.alice, scope: f.scope, boundary: historyContext,
    current: () => ({ facts: context, generation: 'generation:fixture', stopped, clock: f.clock(now) }) };
  const registerContext = (): RegisterContext => ({ ...historyContext, register: context.decode.register, types: context.decode,
    shape: { factSchemas: [] } as unknown as RegisterContext['shape'], provenance: f.alice.provenance,
    source: { path: 'tests/assembly/package-activity-fixture.ts', symbol: 'CheckRunRecord' } });
  const checkRunRegistration = value(registerOwnedBody({ name: 'CheckRunRecord', owner: 'part-three', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
    decodeCurrent: input => {
      try { return { ok: true as const, value: value(decodeCheckRun(input, registerContext())) }; }
      catch (error) { return { ok: false as const, detail: error instanceof Error ? error.message : 'check run refused' }; }
    },
  }, checkRunShape, historyContext));
  const registrations = value(registerAssemblyBodies(host));
  const referenceSchemas: FactSchema[] = [
    { ...f.schema, kind: 'check-run-record', fields: { record: { kind: 'owned', owner: 'part-three', name: 'CheckRunRecord' } } },
    ...verificationSchemas(host as any),
    { ...f.schema, kind: 'assembly-reference-evidence', fields: { id: { kind: 'text', maxLength: 2048 } } },
    { ...f.schema, kind: 'astra-source-evidence', fields: { evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...f.schema, kind: 'assembly-measurement-reference', fields: {
      id: { kind: 'text', maxLength: 2048 }, measurement: { kind: 'constitutional', type: 'Measurement' },
    } },
  ];
  context = { ...context, schemas: [...context.schemas, ...assemblySchemas(host), ...referenceSchemas],
    ownedBodies: [...context.ownedBodies ?? [], checkRunRegistration, ...registrations, ...value(registerVerificationBodies(host as any))] };
  const raw: unknown[] = [];
  const storage = storageFactory?.(f) ?? { owner: 'part-ten' as const, read: () => raw,
    append: (bytes: string, expected: string | null) => { const prior = raw.at(-1) as { contentHash?: string } | undefined;
      if ((prior?.contentHash ?? null) !== expected) throw new Error('compare-head mismatch'); raw.push(JSON.parse(bytes));
      return f.success({ kind: 'local-durable' as const }); } };
  store = createFactStore(context, storage); spine = createAssemblySpine(host, { context, privateKey }, store);
  const appendReference = (kind: string, body: object) => value(authorAndAppend({ kind, schemaVersion: 1, machine: host.machine,
    principal: JSON.parse(JSON.stringify(f.alice)), provenance: JSON.parse(JSON.stringify(f.alice.provenance)),
    at: JSON.parse(JSON.stringify(f.clock(now))), body: JSON.parse(JSON.stringify(body)), required: [],
  }, context, store, privateKey));
  for (const [index, id] of ['check-run:context', 'check:unit', 'check:integration', 'check:lifecycle'].entries())
    appendReference('check-run-record', { record: { type: 'CheckRunRecord', schemaVersion: 1, id,
      commit: 'commit:package-activity', branch: 'impl-part-ten-package-activity', providerRun: `ci:${index}`,
      outcome: 'passed', fixtures: [{ id: `P10-NF-${index === 0 ? '40' : ['41', '42', '43'][index - 1]}`, stage: 'owner', outcome: 'passed' }], at: f.now } });
  for (const id of ['probe:native', 'probe:1', 'probe:word-count']) appendReference('verification-ProbeRecord',
    { record: { ...verificationInput('ProbeRecord'), id } });
  appendReference('assembly-reference-evidence', { id: 'bar:isolation' });
  appendReference('assembly-measurement-reference', { id: 'measurement:replay', measurement: f.now });
  const harness: HarnessAdapterPort = { owner: 'part-ten', id: 'native', describe: () => ({ artifact: `sha256:${'4'.repeat(64)}`,
    platform: 'darwin-arm64', contextModes: ['model-context-boundary'], outputModes: ['framed'], interruptionModes: ['registered-operation'],
    custodyModes: ['scoped'], observationModes: ['instrumented'], conformance: 'conformance:1' }),
    launch: () => { throw new Error('not used'); }, deliver: () => { throw new Error('not used'); }, observe: () => { throw new Error('not used'); } };
  const model: ModelAdapterPort = { owner: 'part-ten', describe: () => ({ owner: 'part-ten', provider: 'provider', model: 'model', route: 'route',
    automaticRetries: 0, maxInputBytes: 1024, maxOutputBytes: 1024, maxCharge: 1, measured: false, basis: 'fixture' }),
    prepare: () => f.success('{}'), exchange: async () => f.success({ state: 'complete', bytes: '{}', providerOperation: 'provider:1',
      usage: { inputTokens: 1, outputTokens: 1, charge: 1, source: 'fixture' }, retryBlocked: false }) };
  const persistence: PersistenceAdapterPort = { owner: 'part-ten', id: 'encrypted-store', describe: () => ({ backend: 'fixture',
    policy: 'StoreCustodyPolicy', encrypted: true, appendAtomic: true }), appendExact: () => { throw new Error('not used'); },
    readExact: () => { throw new Error('not used'); }, flushEvidence: () => { throw new Error('not used'); } };
  let protectedPosture: 'protected' | 'unprotected' = 'protected';
  const composition: AssemblyComposition = { host, spine, harnesses: [harness], model, persistence,
    independentProtection: { owner: 'part-nine', posture: () => f.success(protectedPosture) } };
  const runtime = createAssemblyRuntime(composition);
  value(runtime.record('AdapterEvidenceContract', assemblyInput('AdapterEvidenceContract')));
  value(runtime.record('GrowthPolicy', assemblyInput('GrowthPolicy')));
  const exposedContext = { ...context, schemas: [...context.schemas] };
  return { ...f, c: historyContext, host, context: exposedContext, raw, storage, store, spine, composition, runtime,
    stop: (next = true) => { stopped = next; }, time: (next: number) => { now = next; },
    protection: (next: typeof protectedPosture) => { protectedPosture = next; } };
}
