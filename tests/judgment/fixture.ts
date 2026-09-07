import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import { canonical, decode } from '../../src/index.js';
import type { CapturedContent, SegmentStoragePort } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import { createJudgmentDoorway, createJudgmentSpine, createModelAdapter, judgmentSchemas, registerJudgmentBodies } from '../../src/judgment/index.js';
import type { EffectDispatchPort, JudgmentCapturePort, JudgmentHost, JudgmentPorts, ModelClient, ProviderObservation, QuestionInput } from '../../src/judgment/index.js';
import { consumeEffectSettlement, createEffectDoorway, createEffectSpine, decodeOutboundMessage, effectSchemas, installOperationDefinition, registerEffectBodies } from '../../src/effects/index.js';
import type { EffectAssessmentPort, EffectHost, EffectRequest, EffectSettlement, OperationAdapterPort, OperationObservation } from '../../src/effects/index.js';
import type { GovernedVersion } from '../../src/facts/index.js';
import { transportFixture } from '../transport/fixture.js';
import { json, privateKey, value, refused } from '../facts/fixtures.js';
// @ts-expect-error Reference host adapter outside pure core.
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
export { value, refused };
export function judgmentFixture(options: { directory?: string; client?: ModelClient; observation?: ProviderObservation;
  invoke?: (bytes: string, operation: string) => Promise<ProviderObservation>; capacity?: number;
  storage?: (base: SegmentStoragePort) => SegmentStoragePort;
  // Compose the REAL eight doorway over the same store and bind seven's
  // EffectDispatchPort to it: the through-eight admitted-dispatch composition.
  effects?: boolean } = {}) {
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

  // ---- optional eight-side composition (built BEFORE the shared context) ----
  let versions: GovernedVersion[] = [];
  let effectAuthority: string[] = [];
  const effectHost: EffectHost = { machine: f.host.machine, incarnation: f.host.incarnation, principal: f.alice, scope: f.scope, boundary: f.c,
    current: () => { const c = f.host.current(); return { decode: c.decode, clock: c.clock, stopped: c.stopped, versions, authority: effectAuthority }; },
    // Eight's observation captures persist through the SAME content-addressed
    // custody seven's capture port reads: seven's evidence binding (R3) re-reads
    // and hash-verifies them from there, never from a port's return value.
    capture: bytes => captures.put(bytes, options.capacity ?? 1048576) };
  const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'judgment-model:1', feature: 'judgment', version: 'judgment-model-version:1',
    generation: f.host.current().generation.id, adapter: 'model', account: 'model-account:fixture', conversation: 'model-conversation:fixture',
    speaker: f.alice.id, scopeDigest: value(canonical(f.scope)).hash, durability: 'local-durable' as const, replicas: 0,
    lossModel: 'single local fsync directory; shared disk loss is NOT covered.', maxBytes: 4096, maxCharge: 20, timeout: 100, verificationBar: 'judgment-bar:1' };

  const ctx = { ...f.ctx, captures: metadata, schemas: [...transportSchemas(f.host), ...judgmentSchemas(host),
    { ...f.schema, kind: 'judgment-context-evidence', fields: { evidence: { kind: 'constitutional' as const, type: 'Evidence' as const } } },
    ...(options.effects ? [f.schema, ...effectSchemas(effectHost)] : [])],
    ownedBodies: [...value(registerTransportBodies(f.host, f.c, ...(options.effects ? [consumeEffectSettlement] as const : []))),
      ...value(registerJudgmentBodies(host, f.c)), ...(options.effects ? value(registerEffectBodies(effectHost)) : [])] };
  const storage = options.storage?.(f.storage) ?? f.storage;
  const store = createFactStore(ctx, storage);
  if (!value(store.read()).length) for (const evidence of f.evidence) value(authorAndAppend({ kind: 'judgment-context-evidence', schemaVersion: 1,
    machine: f.host.machine, principal: json(f.alice), provenance: json(f.alice.provenance), at: json(f.now), body: json({ evidence }), required: [] }, ctx, store, privateKey));
  const six = createTransportAuthority<EffectSettlement>(f.host, createTransportSpine(f.host, { context: ctx, privateKey }, store), f.c,
    ...(options.effects ? [consumeEffectSettlement] as const : []));
  const observation: ProviderObservation = options.observation ?? { state: 'complete', bytes: JSON.stringify(f.decisionInput()),
    providerOperation: 'fake-operation:1', usage: { inputTokens: 11, outputTokens: 9, charge: 2, source: 'fake captured billing receipt' }, retryBlocked: false };
  const calls: { bytes: string; operation: string }[] = [];
  const client = options.client ?? { automaticRetries: 0, execute: async send => { await send(); } };
  const model = value(createModelAdapter(host.description, client, async (bytes, operation) => {
    calls.push({ bytes, operation }); return options.invoke ? options.invoke(bytes, operation) : observation;
  }, six, f.host, f.c));
  const spine = createJudgmentSpine(host, { context: ctx, privateKey }, store);

  // ---- the eight doorway + seven's EffectDispatchPort glue -----------------
  let effectCalls = 0;
  let effects: EffectDispatchPort | undefined;
  let effectDoorway: ReturnType<typeof createEffectDoorway> | undefined;
  let assess: (state: 'happened' | 'uncertain', charge: number | null, excluded?: boolean) => void = () => { throw new Error('effects composition disabled'); };
  if (options.effects) {
    const note = (identity: string) => value(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: f.host.machine,
      principal: json(f.alice), provenance: json(f.alice.provenance), at: json(f.now), body: { identity, amount: '0' }, required: [] }, ctx, store, privateKey)).fact;
    const anchor = note('eight authority closure anchor');
    effectAuthority = [anchor.id];
    // Separate approver: the executor (alice) cannot approve enforced policy.
    f.grant({ id: 'model-approver-grant', grantee: f.bob });
    const approvedIn = f.authorize({ id: 'judgment-model-approval', approver: f.bob, under: 'model-approver-grant',
      artifact: f.capture(value(canonical(definition)).bytes), base: 'judgment-model-base:1' });
    versions = [{ id: definition.version, subject: definition.feature, content: json(definition), contentHash: value(canonical(definition)).hash,
      since: anchor.id, supersedes: [], approvedIn, base: approvedIn.base, landedIn: null }];
    const effectSpine = createEffectSpine(effectHost, { context: ctx, privateKey }, store);
    const durability = { owner: 'part-ten' as const, ensure: (facts: readonly import('../../src/facts/index.js').FactEnvelope[]) => f.result(() => facts.map(fact => {
      const found = value(store.read()).find(x => x.id === fact.id && x.contentHash === fact.contentHash);
      if (!found) throw new Error('fact is not durable on the shared store');
      return { fact: found, durability: { kind: 'local-durable' as const }, taint: [] };
    })) };
    const custody = { owner: 'part-ten' as const, verify: (refs: readonly { reference: string; hash: string }[]) => f.result(() => {
      for (const r of refs) { const c = metadata[r.reference]; if (c?.status !== 'available' || c.hash !== r.hash) throw new Error('custody missing'); }
    }) };
    const adapter: OperationAdapterPort = { owner: 'part-ten', id: definition.adapter,
      describe: () => ({ contract: 'judgment-model-contract:1', account: definition.account, conversation: definition.conversation,
        maxCharge: definition.maxCharge, timeout: definition.timeout, hiddenRetries: 0 }),
      // The registered adapter enforces the digest-bound question deadline at the
      // provider boundary itself (R1's second layer, mirroring the legacy model
      // exchange gate): a late invocation is refused BEFORE any provider call.
      invoke: input => f.result(() => {
        const payload = JSON.parse(input.message.text) as { deadline?: number };
        if (typeof payload.deadline === 'number' && f.host.monotonic() >= payload.deadline) throw new Error('judgment deadline exhausted at provider invocation');
        effectCalls++; return JSON.stringify(observation);
      }),
      observe: () => f.success(JSON.stringify({ status: 'unknown', reason: 'model fixture has no decisive negative lookup' })) };
    let assessmentState: 'happened' | 'uncertain' = 'uncertain';
    let finalCharge: number | null = null, delayedExecutionExcluded = false, assessmentGuards = 0, acceptanceId = '', assessmentEvidence = '';
    const assessmentView = (ref: Parameters<EffectAssessmentPort['read']>[0], input: Parameters<EffectAssessmentPort['read']>[1]) => {
      if (ref.id !== acceptanceId || !input.observations.length) throw new Error('assessment binding');
      return Object.freeze({ outcome: value(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: assessmentState, evidence: [assessmentEvidence] }, effectHost.current().decode)),
        finalCharge, delayedExecutionExcluded, required: Object.freeze([acceptanceId]) });
    };
    // EXPLICIT nine stand-in (a note fact, not a counterfeit P9 record). No
    // production claim relies on this fixture composition.
    const assessor: EffectAssessmentPort = { owner: 'part-nine',
      assess: input => { if (assessmentGuards) throw new Error('assessment held'); acceptanceId ||= note('independent nine assessment STAND-IN').id;
        const evidenceId = `assessment:${input.reservation.operation}:${assessmentState}`;
        if (!f.evidence.some(e => e.id === evidenceId)) f.evidence.push(value(decode('Evidence', f.evidenceInput({ id: evidenceId,
          claim: { subject: input.reservation.operation, predicate: input.request.digest, value: assessmentState },
          strength: 'observation', observedAt: f.host.current().clock, freshFor: 1000 }), effectHost.current().decode)));
        assessmentEvidence = evidenceId;
        return f.success({ owner: 'part-nine', name: 'VerificationAssessment', id: acceptanceId }); },
      read: (ref, input) => f.success(assessmentView(ref, input)),
      consumeCurrent: (ref, input, consume) => {
        const current = assessmentView(ref, input); assessmentGuards++;
        try { return f.success(consume(current)); } finally { assessmentGuards--; }
      } };
    assess = (state, charge, excluded = true) => { if (assessmentGuards) throw new Error('assessment held'); assessmentState = state; finalCharge = charge; delayedExecutionExcluded = excluded; };
    (f.host as { accountingDurability?: typeof durability }).accountingDurability = durability;
    const doorway = createEffectDoorway({ host: effectHost, spine: effectSpine, transport: six, durability, adapter, custody, assessment: assessor });
    effectDoorway = doorway;
    value(installOperationDefinition(definition, effectHost, effectSpine));
    effects = { owner: 'part-eight',
      describe: () => ({ definition: definition.id, account: definition.account, conversation: definition.conversation,
        maxCharge: definition.maxCharge, durability: definition.durability, replicas: definition.replicas }),
      adopted: id => f.result(() => { const row = value(doorway.inspect()).find(v => v.record.type === 'EffectRequest' && v.record.id === id);
        if (!row) throw new Error('no adopted effect request'); const q = row.record as EffectRequest; return { request: q.id, digest: q.digest }; }),
      adopt: input => f.result(() => { const message = value(decodeOutboundMessage(input.message, effectHost));
        const q = value(doorway.adopt({ ...input, message })); return { request: q.id, digest: q.digest }; }),
      dispatch: (adopted, fence) => f.result(() => { const row = value(doorway.inspect()).find(v => v.record.type === 'EffectRequest' && v.record.id === adopted.request);
        if (!row) throw new Error('adopted effect request missing');
        return { operation: value(doorway.dispatch(row.record as EffectRequest, fence as Parameters<typeof doorway.dispatch>[1])).operation }; }) };
  }

  const ports: JudgmentPorts = { host, authority: six, spine, captures, model, boundary: f.c, ...(effects ? { effects } : {}) };
  const door = createJudgmentDoorway(ports);
  const semanticMessage = 'five-owned:semantic-question:1';
  const derivedRequest = `request:${value(canonical([definition.account, definition.conversation, semanticMessage])).hash}`;
  const input: QuestionInput = { id: 'question:1', run: f.run, step: 'step:1', ordinal: 0,
    semanticMessage,
    effectRequest: { owner: 'part-eight', name: 'EffectRequest', id: options.effects ? derivedRequest : 'eight-owned:model-effect:1' },
    question: 'Should the permitted work proceed?', context: 'The captured evidence supports work. Context does not grant standing.', evidence: ['e1', 'e2'], deadline: 400 };
  const start = () => { const token = value(six.acquire('acquire', '', 500)); value(six.schedule('schedule', token, f.run, f.policy)); return token; };
  return { ...f, host, metadata, ctx, storage, store, six, observation, captures, model, spine, ports, door, input, start, calls,
    effects, effectDoorway, definition, derivedRequest, assess, effectCalls: () => effectCalls };
}
