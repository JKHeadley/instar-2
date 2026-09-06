import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { decode } from '../../src/index.js';
import type { CapturedContent, SegmentStoragePort } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import { createJudgmentDoorway, createJudgmentSpine, createModelAdapter, judgmentSchemas, registerJudgmentBodies } from '../../src/judgment/index.js';
import type { JudgmentCapturePort, JudgmentHost, JudgmentPorts, ModelClient, ProviderObservation, QuestionInput } from '../../src/judgment/index.js';
import { transportFixture } from '../transport/fixture.js';
import { json, privateKey, value, refused } from '../facts/fixtures.js';
// @ts-expect-error Reference host adapter outside pure core.
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
export { value, refused };
export function judgmentFixture(options: { directory?: string; client?: ModelClient; observation?: ProviderObservation;
  invoke?: (bytes: string, operation: string) => Promise<ProviderObservation>; capacity?: number;
  storage?: (base: SegmentStoragePort) => SegmentStoragePort } = {}) {
  const f = transportFixture(options.directory);
  const host: JudgmentHost = { transport: f.host, point: 'judgment', floor: f.floor,
    refreshFacts: () => f.result(() => {
      const snapshot = value(store.readForProjection());
      for (const entry of snapshot.entries) {
        if (entry.taint.length || entry.conflicts.length) throw new Error('cannot refresh from tainted facts');
        for (const historical of entry.historical) {
          const view = historical.view;
          if (view.type === 'Evidence' && !f.evidence.some(old => old.id === view.id)) f.evidence.push(value(decode('Evidence', view, f.ctx.decode)));
        }
      }
    }),
    description: { owner: 'part-ten', provider: 'fake-deterministic', model: 'model', route: 'route', automaticRetries: 0,
      maxInputBytes: 16384, maxOutputBytes: 16384, maxCharge: 20, measured: false, basis: 'synthetic slice fixture; no live provider call' } };
  const metadata: Record<string, CapturedContent> = {};
  for (const e of f.evidence) metadata[e.capture.reference] = { hash: e.capture.hash, bytes: f.captures[e.capture.reference]!,
    byteLength: Buffer.byteLength(f.captures[e.capture.reference]!), status: 'available' };
  const captures: JudgmentCapturePort = createJudgmentCaptures(f.directory, metadata, f.result, options.capacity ?? 1048576, f.ctx.decode.captures);
  const ctx = { ...f.ctx, captures: metadata, schemas: [...transportSchemas(f.host), ...judgmentSchemas(host),
    { ...f.schema, kind: 'judgment-context-evidence', fields: { evidence: { kind: 'constitutional' as const, type: 'Evidence' as const } } }],
    ownedBodies: [...value(registerTransportBodies(f.host, f.c)), ...value(registerJudgmentBodies(host, f.c))] };
  const storage = options.storage?.(f.storage) ?? f.storage;
  const store = createFactStore(ctx, storage);
  if (!value(store.read()).length) for (const evidence of f.evidence) value(authorAndAppend({ kind: 'judgment-context-evidence', schemaVersion: 1,
    machine: f.host.machine, principal: json(f.alice), provenance: json(f.alice.provenance), at: json(f.now), body: json({ evidence }), required: [] }, ctx, store, privateKey));
  const six = createTransportAuthority(f.host, createTransportSpine(f.host, { context: ctx, privateKey }, store), f.c);
  const observation: ProviderObservation = options.observation ?? { state: 'complete', bytes: JSON.stringify(f.decisionInput()),
    providerOperation: 'fake-operation:1', usage: { inputTokens: 11, outputTokens: 9, charge: 2, source: 'fake captured billing receipt' }, retryBlocked: false };
  const calls: { bytes: string; operation: string }[] = [];
  const client = options.client ?? { automaticRetries: 0, execute: async send => { await send(); } };
  const model = value(createModelAdapter(host.description, client, async (bytes, operation) => {
    calls.push({ bytes, operation }); return options.invoke ? options.invoke(bytes, operation) : observation;
  }, six, f.host, f.c));
  const spine = createJudgmentSpine(host, { context: ctx, privateKey }, store);
  const ports: JudgmentPorts = { host, authority: six, spine, captures, model, boundary: f.c };
  const door = createJudgmentDoorway(ports);
  const input: QuestionInput = { id: 'question:1', run: f.run, step: 'step:1', ordinal: 0,
    semanticMessage: 'five-owned:semantic-question:1', effectRequest: { owner: 'part-eight', name: 'EffectRequest', id: 'eight-owned:model-effect:1' },
    question: 'Should the permitted work proceed?', context: 'The captured evidence supports work. Context does not grant standing.', evidence: ['e1', 'e2'], deadline: 400 };
  const start = () => { const token = value(six.acquire('acquire', '', 500)); value(six.schedule('schedule', token, f.run, f.policy)); return token; };
  return { ...f, host, metadata, ctx, storage, store, six, observation, captures, model, spine, ports, door, input, start, calls };
}
