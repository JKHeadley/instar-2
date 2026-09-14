import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, consumeResult, decode, readEvidence } from '../../src/index.js';
import type { Result, Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import type { FactContext, CapturedContent, GovernedVersion, FactEnvelope } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, registerTransportBodies, transportSchemas, decodeLoopPolicy } from '../../src/transport/index.js';
import type { TransportHost, FenceToken } from '../../src/transport/index.js';
import { createProviderJudgmentPort, providerJudgmentSchemas, registerProviderJudgmentBodies } from '../../src/judgment/index.js';
import type { JudgmentHost, JudgmentCapturePort, ProviderObservation } from '../../src/judgment/index.js';
import { createProviderEffectDoorway, providerEffectSchemas, providerEffectMigrations, registerProviderEffectBodies, effectSchemas, registerEffectBodies,
  createEffectSpine, installOperationDefinition, consumeEffectSettlement } from '../../src/effects/index.js';
import type { EffectHost, EffectSettlement, ProviderEffectDoorway } from '../../src/effects/index.js';
import { createConfinedProviderInvocation } from '../../src/assembly/index.js';
import type { ConfinedProviderRoute } from '../../src/assembly/index.js';
import { createEffectSettlementAssessmentPort, createVerificationRuntime, createVerificationSpine, verificationSchemas, registerVerificationBodies } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { createRunGraph, recordWire } from '../../src/rungraph/index.js';
import type { RunGraphDependencies } from '../../src/rungraph/index.js';
import { governanceFixture } from '../rungraph/governance-fixture.js';
import { setup, ref } from '../rungraph/fixtures.js';
import { value, refused, privateKey, json } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
// @ts-expect-error Physical file adapter is outside pure core.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Physical capture adapter is outside pure core.
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
export { value, refused };
export const enc = (v: unknown) => value(canonical(v));
export function providerFixture(options: { directory?: string; endpoint?: string; credential?: string;
  route?: Partial<ConfinedProviderRoute>; afterInvoke?: () => void; timeout?: number } = {}) {
  const base = setup(); base.grant({ id: 'provider-agent-grant', grantee: base.bob });
  const directory = options.directory ?? mkdtempSync(join(tmpdir(), 'provider-path-'));
  let now = 100, stopped = false, generation = base.run.generation.id;
  const register = { ...base.ctx.decode.register, entries: [...base.ctx.decode.register.entries, 'provider-call', 'route'] };
  const dc = { ...base.ctx.decode, register }, boundary = { ...base.c, register };
  const metadata: Record<string, CapturedContent> = { ...base.ctx.captures };
  for (const [reference, bytes] of Object.entries(base.captures)) metadata[reference] = { bytes, hash: hashBytes(bytes), status: 'available', byteLength: Buffer.byteLength(bytes) };
  const result = <T>(fn: () => T): Result<T> => { try { return base.success(fn()); } catch (e) {
    return consumeResult(value(decode('Result', base.refusedInput({ detail: String(e) }), dc)), { Refused: r => r, Success: () => { throw e; } }); } };
  const captures: JudgmentCapturePort = createJudgmentCaptures(directory, metadata, result, 1048576, dc.captures);
  const storage = createTransportFileStorage(directory, result);
  // The initial authenticated fixture stimulus is the same signed P2 fact on restart.
  if (!existsSync(join(directory, 'facts.json'))) value(storage.append(JSON.stringify(base.opening), null));
  const recoverCaptures = (v: unknown): void => {
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (typeof o.reference === 'string' && typeof o.hash === 'string') { try { value(captures.read(o as unknown as Parameters<JudgmentCapturePort['read']>[0])); } catch { /* source remains unavailable */ } }
    Object.values(o).forEach(recoverCaptures);
  };
  storage.read().forEach(recoverCaptures);
  let versions: GovernedVersion[] = [];
  const th: TransportHost = { domain: 'provider-path', machine: 'machine-a', incarnation: 'executor:provider', authorityIncarnation: 'authority:provider',
    principal: base.bob, scope: base.scope, maxLeaseTerm: 1000, budget: 100, monotonic: () => now,
    current: () => ({ decode: { ...dc, register: { ...dc.register, generation: { ...base.run.generation, id: generation } } }, clock: base.clock(now), generation: { ...base.run.generation, id: generation }, stopped }) };
  const host: EffectHost = { machine: th.machine, incarnation: th.incarnation, principal: th.principal, scope: th.scope, boundary,
    current: () => ({ decode: th.current().decode, clock: base.clock(now), stopped, versions, authority: [base.opening.id] }),
    capture: bytes => captures.put(bytes, 262144) };
  const jh: JudgmentHost = { transport: th, point: 'judgment', floor: base.floor,
    description: { owner: 'part-ten', provider: 'test-provider', model: 'model', route: 'route', automaticRetries: 0,
      maxInputBytes: 4096, maxOutputBytes: 4096, maxCharge: 20, measured: false, basis: 'owned local HTTP test endpoint; commercial route held' },
    refreshFacts: () => base.success(undefined) };
  let context: FactContext; let store: ReturnType<typeof createFactStore>;
  const vh: VerificationHost = { machine: th.machine, principal: th.principal, scope: th.scope, boundary,
    current: () => ({ decode: th.current().decode, clock: base.clock(now), stopped, generation,
      facts: { ...context, facts: value(store.read()) }, evidence: base.evidence }) };
  context = { ...base.ctx, migrations: providerEffectMigrations, decode: dc, captures: metadata, schemas: [...base.ctx.schemas, ...transportSchemas(th), ...effectSchemas(host),
    ...providerEffectSchemas(host), ...providerJudgmentSchemas(jh), ...verificationSchemas(vh)], ownedBodies: [...base.ctx.ownedBodies ?? [],
      ...value(registerTransportBodies(th, boundary, consumeEffectSettlement)), ...value(registerEffectBodies(host)).filter(r => r.name !== 'EffectSettlement'),
      ...value(registerProviderEffectBodies(host)), ...value(registerProviderJudgmentBodies(jh, boundary)), ...value(registerVerificationBodies(vh))] };
  store = createFactStore(context, storage);
  const author = { context, privateKey }, six = createTransportAuthority<EffectSettlement>(th, createTransportSpine(th, author, store), boundary, consumeEffectSettlement);
  const all = () => value(store.read());
  for (const f of all()) {
    const evidence = (f.body as unknown as { evidence?: import('../../src/index.js').Evidence }).evidence;
    if (evidence && !base.evidence.some(e => e.id === evidence.id)) base.evidence.push(evidence);
  }
  const raw = (f: FactEnvelope) => (f.body as unknown as { record: Record<string, unknown> }).record;
  const append = (kind: string, body: Json, required: readonly string[] = []) => value(authorAndAppend({ kind, schemaVersion: 1,
    machine: th.machine, principal: json(th.principal), provenance: json(th.principal.provenance), at: json(base.clock(now)), body, required }, context, store, privateKey)).fact;
  for (const evidence of base.evidence) if (!all().some(f => (f.body as unknown as { evidence?: { id: string } }).evidence?.id === evidence.id)) append('evidence-record', json({ evidence }));
  const fence = value(six.acquire('provider-acquire', '', 500));
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'provider-loop', maxAttempts: 1, minDelay: 1,
    maxDuration: 1000, timeout: 100, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, boundary));
  if (!all().some(f => f.kind === 'transport-LoopRecord')) value(six.schedule('provider-schedule', fence, { owner: 'part-five', name: 'Run', id: base.id }, policy));
  const obligation = all().find(f => f.kind === 'transport-LoopRecord')!.id;
  const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'provider-definition', feature: 'provider-call', version: 'provider-definition-v1',
    generation, adapter: 'route', account: 'test-provider', conversation: 'local-test', speaker: th.principal.id, scopeDigest: enc(th.scope).hash,
    durability: 'local-durable', replicas: 0, lossModel: 'approved test-only local origin; permanent origin loss retains uncertainty',
    maxBytes: 4096, maxCharge: 20, timeout: 100, verificationBar: 'provider-bar' };
  const approval = base.authorize({ id: 'provider-definition-approval', artifact: base.capture(enc(definition).bytes), base: 'provider-base' });
  versions = [{ id: definition.version, subject: definition.feature, content: json(definition), contentHash: enc(definition).hash,
    since: base.opening.id, supersedes: [], approvedIn: approval, base: approval.base, landedIn: null }];
  if (!all().some(f => f.kind === 'effect-OperationDefinition')) value(installOperationDefinition(definition, host, createEffectSpine(host, author, store)));
  let api: ProviderEffectDoorway;
  const runContext = { ...base.c, register, types: dc, facts: context, evidenceSources: { ...base.c.evidenceSources, settlement: th.principal.provenance.adapter } };
  let writingWitness = '';
  const commit: RunGraphDependencies['admission']['commit'] = (request, write) => result(() => {
    if (request.ownership.id !== base.lease.id) throw new Error('Five stale ownership');
    value(six.admitWrite(`five-admit:${request.expected}:${request.operation}:${request.digest}`, fence));
    writingWitness = all().at(-1)!.id;
    try { return value(write()); } finally { writingWitness = ''; }
  });
  const deps: RunGraphDependencies = { ...base.deps, governance: governanceFixture(runContext), context: runContext, store,
    clock: () => base.clock(now), generation: () => ({ reference: { ...base.run.generation, id: generation }, kinds: [...new Set(context.schemas.map(s => s.kind))],
      lineages: { 'machine-a': { head: { epoch: 0, position: all().at(-1)!.segment.position }, observedAt: now, closed: false } } }),
    writer: { owner: 'part-ten', append: (kind, run, r, required) => base.success({ fact: append(kind, json({ run, record: recordWire(r) }), [...required, ...(writingWitness ? [writingWitness] : [])]), durability: { kind: 'local-durable' }, taint: [] }) },
    admission: { ...base.deps.admission, commit,
      create: (_opening, _run, write) => commit({ run: base.id, expected: 'opening', ownership: base.lease, generation: base.run.generation,
        operation: 'open', digest: enc(base.run).hash, durability: { kind: 'local-durable' } }, write),
      verify: reference => result(() => { const f = all().find(f => f.id === reference.id); if (!f || !f.predecessors.required.some(id => all().some(p => p.id === id
        && p.kind === 'transport-Lease' && String(raw(p)?.command).startsWith('five-admit:')))) throw new Error('durable Six admission witness missing'); return reference; }),
    },
    grounding: { owner: 'part-ten', read: ({ run, worker, harness, reason, execution }) => result(() => {
      const consumption = append('consumption', { worker, harness, hashes: JSON.stringify([metadata['message:1']!.hash]), classes: JSON.stringify(base.deps.groundingPolicy.briefingClasses) });
      return { type: 'SessionGrounding', schemaVersion: 2, id: `provider-ground:${run.head}`, run: base.id, expected: run.head, worker, harness, reason,
        ownership: execution.ownership, executionContext: execution.context, at: base.clock(now), previousActivity: base.now,
        elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: worker }, value: now - base.now.value, unit: 'ms', at: base.clock(now), by: 'probe' },
        principal: base.owner, intake: ref(base.opening), binding: base.run.resultDestination.binding, directives: [], generation: base.run.generation,
        frontier: { 'machine-a': { epoch: 0, position: consumption.segment.position } }, knownLineages: ['machine-a'], threshold: 20,
        messages: [{ fact: ref(base.opening), sequence: base.opening.segment.position, capture: 'message:1', hash: metadata['message:1']!.hash }],
        lastInbound: ref(base.opening), pendingOperations: [], children: [], receipts: [], briefingClasses: base.deps.groundingPolicy.briefingClasses, consumption: ref(consumption) };
    }) },
    settlement: { owner: 'part-eight', read: (reference, step) => api.readRunSettlement(reference, step) },
  };
  const graph = value(createRunGraph(deps));
  const settings = { automaticRetries: 0, maxTokens: 128 }, outputSchema = { type: 'Decision' };
  const question = { id: 'provider-question', run: { owner: 'part-five' as const, name: 'Run' as const, id: base.id }, step: 'step:provider:semantic:1', ordinal: 0,
    semanticMessage: 'provider:semantic:1', question: 'Should work proceed?', context: 'Recorded task evidence.', evidence: ['e1', 'e2'], deadline: 400 };
  const submitted = enc({ provider: 'test-provider', model: 'model', route: 'route', messages: [{ role: 'user', content: question.question },
    { role: 'context', content: question.context }], attachments: [], tools: [], settings, outputSchema, floor: base.floor,
    evidence: question.evidence, point: 'judgment', generation }).bytes;
  let running;
  if (!all().some(f => f.kind === 'run-opening')) {
    const ready = value(graph.open(base.run)), ground = value(graph.ground(base.id, 'w', 'h', 'start', base.lease));
    const start = base.start(ready, ground, question.semanticMessage);
    running = value(graph.transition({ ...start, step: { ...start.step, operation: { ...start.step.operation, digest: enc(submitted).hash } } }));
  } else running = value(graph.read(base.id));
  const seven = createProviderJudgmentPort({ host: jh, boundary, authority: six, captures, store, context, privateKey, runs: graph,
    settings, outputSchema, maxTokens: 128, maxCaptureBytes: 65536, timeout: 100, disclosure: 'local-test' });
  const runtime = createVerificationRuntime(vh, createVerificationSpine(vh, author, store));
  const plan = { ...verificationInput('VerificationPlan'), id: 'provider-plan', subject: { ...verificationInput('VerificationPlan').subject, generation },
    bar: { ...verificationInput('VerificationPlan').bar, version: 'provider-bar', sources: ['probe'] } };
  if (!all().some(f => f.kind === 'verification-VerificationPlan')) value(runtime.record('VerificationPlan', plan));
  const nine = createEffectSettlementAssessmentPort(vh, runtime, store);
  let calls = 0;
  const route: ConfinedProviderRoute = { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'local-test', automaticRetries: 0, environment: 'local-test',
    invoke: async (bytes, bounds) => {
      calls++;
      if (!options.endpoint) throw new Error('real local HTTP endpoint required');
      const response = await fetch(options.endpoint, { method: 'POST', body: bytes, redirect: 'error',
        headers: { Authorization: `Bearer ${options.credential}`, 'Content-Type': 'application/json', 'X-Operation': bounds.operation },
        signal: AbortSignal.timeout(options.timeout ?? 2000) });
      const observation = await response.json() as ProviderObservation;
      options.afterInvoke?.(); return observation;
    }, ...options.route };
  const invocation = value(createConfinedProviderInvocation(route, six, th, captures, boundary, store));
  const durability = { owner: 'part-ten' as const, ensure: (facts: readonly FactEnvelope[]) => base.success(facts.map(f => ({ fact: f, durability: { kind: 'local-durable' as const }, taint: [] }))) };
  const custody = { owner: 'part-ten' as const, verify: (caps: readonly { reference: string; hash: string }[]) => result(() => { for (const cap of caps) value(captures.read(cap as Parameters<JudgmentCapturePort['read']>[0])); }) };
  const dependencies = { host, context, store, privateKey, transport: six, judgment: seven, invocation, durability, custody, assessment: nine, plan: plan.id };
  api = createProviderEffectDoorway(dependencies);
  const prepare = () => {
    const prepared = value(seven.prepare(question, fence));
    const request = value(api.prepare({ prepared, definition: definition.id, verificationOwner: 'independent-probe', resultDestination: base.opening.id, obligation }, fence));
    return { prepared, request };
  };
  const evidence = (operation: string, digest: string, predicate: string, amount?: number, overrides: Record<string, unknown> = {}) => {
    const e = value(decode('Evidence', base.evidenceInput({ id: `proof:${predicate}:${operation}`, claim: { subject: operation, predicate, value: { digest, ...(amount === undefined ? {} : { amount }) } },
      source: 'probe', observedAt: base.clock(now), freshFor: 100, strength: 'proof', ...overrides }), dc));
    const bytes = dc.captures[e.capture.reference]!;
    metadata[e.capture.reference] = { bytes, hash: e.capture.hash, status: 'available', byteLength: Buffer.byteLength(bytes) };
    base.evidence.push(e); append('evidence-record', json({ evidence: e })); return e;
  };
  const accept = (settlement: EffectSettlement, resolution: string) => {
    const sf = all().find(f => f.kind === 'effect-EffectSettlement' && raw(f)?.id === settlement.id)!;
    const v = value(graph.read(base.id));
    return graph.transition({ type: 'RunTransition', schemaVersion: 1, id: 'provider-accepted', run: base.id, expected: v.head,
      trigger: { owner: 'part-two', name: 'FactEnvelope', id: resolution }, kind: 'observe', from: v.state, to: 'ready', responsible: base.owner,
      standing: ref(base.opening), ownership: base.lease, generation: base.run.generation, at: base.clock(now), blockedOn: { kind: 'nothing' },
      nextWake: base.run.nextWake, affectedStep: question.step, outcome: { type: 'Outcome', id: 'provider-outcome', fact: ref(sf), field: 'outcome' }, settlement: ref(sf) });
  };
  return { ...base, directory, dc, metadata, result, storage, context, store, th, host, jh, vh, six, fence, graph, deps, seven, api, nine, runtime,
    plan, route, captures, question, submitted, prepare, evidence, accept, all, dependencies, running, calls: () => calls,
    time: (v: number) => { now = v; }, stop: () => { stopped = true; }, generation: (v: string) => { generation = v; } };
}
