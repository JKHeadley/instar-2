// @ts-nocheck -- waived preview shell; authority, admission and dispatch use public owner constructors.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, consumeResult, decode, readEvidence } from '../../src/index.js';
import type { Result, Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, hashBytes, extendsChain } from '../../src/facts/index.js';
import type { FactContext, CapturedContent, GovernedVersion, FactEnvelope } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, registerTransportBodies, transportSchemas, decodeLoopPolicy } from '../../src/transport/index.js';
import type { TransportHost, FenceToken } from '../../src/transport/index.js';
import { createProviderJudgmentPort, decodeHistoricalProviderAnswerAcceptance, providerJudgmentSchemas, registerProviderJudgmentBodies } from '../../src/judgment/index.js';
import type { JudgmentHost, JudgmentCapturePort, ProviderObservation } from '../../src/judgment/index.js';
import { createProviderEffectDoorway, providerEffectSchemas, providerEffectMigrations, registerProviderEffectBodies, effectSchemas, registerEffectBodies,
  createEffectSpine, installOperationDefinition, consumeEffectSettlement, createEffectDoorway, decodeOutboundMessage } from '../../src/effects/index.js';
import type { EffectHost, EffectSettlement, ProviderEffectDoorway } from '../../src/effects/index.js';
import { SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { createProductionProviderOwners } from '../../src/assembly/production-provider-owners.js';
import { admitAcceptedProviderReply, createProductionRunAdmission } from '../../src/transport/index.js';
import { acceptedReplyPreviewText, runIdFor } from '../../src/rungraph/index.js';
import { STAGE2_SETTINGS, STAGE2_OUTPUT_SCHEMA, STAGE2_DISCLOSURE, OWNER_WINDOW_MS, stage2Description, decisionContext, submittedEnvelope, inputMeasurements, requireInputBound, requireOutboundBound, encoded, subscriptionInvocationPolicy } from './stage2-provider.js';
import { createTelegramReplyOperationAdapter, installTelegramReplyOperation, telegramConversation, renderTelegramHtml } from '../../src/conversation/index.js';
import { readRecordFact, validateGrounding } from '../../src/rungraph/graph.js';
import { decodeSessionGrounding } from '../../src/rungraph/records.js';
import { decodeFrame } from '../../src/facts/envelope.js';
import { factsFixture } from '../facts/fixtures.js';
import { validateStage2State, validateStage2Successor, durablePreviewWrite } from './state.js';
import type { ConfinedProviderRoute } from '../../src/assembly/index.js';
import { createEffectSettlementAssessmentPort, createVerificationRuntime, createVerificationSpine, verificationSchemas, registerVerificationBodies } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { createRunGraph, recordWire, runFactSchemas } from '../../src/rungraph/index.js';
import type { RunGraphDependencies } from '../../src/rungraph/index.js';
import { governanceFixture } from '../rungraph/governance-fixture.js';
import { setup, ref } from '../rungraph/fixtures.js';
import { value, refused, privateKey, json } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
// @ts-expect-error Physical file adapter is outside pure core.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
import { createEffectReplicaStorage } from '../../scripts/effect-replica-storage.mjs';
// @ts-expect-error Physical capture adapter is outside pure core.
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
export { value, refused };
export const enc = (v: unknown) => value(canonical(v));
export function createStage2Owners(options: any) {
  const base = setup(); base.grant({ id: 'provider-agent-grant', grantee: base.bob });
  const directory = options.directory;
  const now = () => options.ownerNow();
  const stopped = () => !options.active() || now() >= options.deadline;
  const generation = base.run.generation.id;
  const description = stage2Description(options.model);
  const register = { ...base.ctx.decode.register, entries: [...base.ctx.decode.register.entries, 'provider-call', options.model, description.route, 'ordinary-reply', 'reply-route', ...options.registerEntries ?? []] };
  const dc = { ...base.ctx.decode, register }, boundary = { site: base.c.site, preserved: base.c.preserved, register };
  if (options.seed) {
    Object.assign(dc.captures, options.seed.decode.captures);
    dc.principals = [...dc.principals ?? [], ...options.seed.decode.principals ?? []];
    register.entries = [...new Set([...register.entries, ...options.seed.decode.register.entries])];
    register.methods = [...new Set([...register.methods, ...options.seed.decode.register.methods])];
    register.sites = { ...register.sites, ...options.seed.decode.register.sites };
  }
  const metadata: Record<string, CapturedContent> = { ...base.ctx.captures, ...options.seed?.captures };
  for (const [reference, bytes] of Object.entries(base.captures)) metadata[reference] = { bytes, hash: hashBytes(bytes), status: 'available', byteLength: Buffer.byteLength(bytes) };
  const result = <T>(fn: () => T): Result<T> => { try { return base.success(fn()); } catch (e) {
    return consumeResult(value(decode('Result', base.refusedInput({ detail: String(e) }), dc)), { Refused: r => r, Success: () => { throw e; } }); } };
  const captures: JudgmentCapturePort = createJudgmentCaptures(directory, metadata, result, 1048576, dc.captures);
  let storage = createTransportFileStorage(directory, result);
  // The initial authenticated fixture stimulus is the same signed P2 fact on restart.
  if (!existsSync(join(directory, 'facts.json'))) {
    for (const fact of options.seed?.facts ?? [base.opening])
      value(storage.append(JSON.stringify(fact), storage.read().at(-1)?.contentHash ?? null));
  }
  const recoverCaptures = (v: unknown): void => {
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (typeof o.reference === 'string' && typeof o.hash === 'string') { try { value(captures.read(o as unknown as Parameters<JudgmentCapturePort['read']>[0])); } catch { /* source remains unavailable */ } }
    Object.values(o).forEach(recoverCaptures);
  };
  storage.read().forEach(recoverCaptures);
  let versions: GovernedVersion[] = [];
  const th: TransportHost = { domain: 'provider-path', machine: 'machine-a', incarnation: 'executor:provider', authorityIncarnation: 'authority:provider',
    principal: base.bob, scope: base.scope, maxLeaseTerm: OWNER_WINDOW_MS, budget: options.replyCharge, monotonic: now,
    current: () => ({ decode: { ...dc, register: { ...dc.register, generation: { ...base.run.generation, id: generation } } }, clock: base.clock(now()), generation: { ...base.run.generation, id: generation }, stopped: stopped() }) };
  // One clock sample per synchronous owner transaction; physical stop/deadline
  // gates always read now() independently, including after any awaited model call.
  let effectInstant: number | undefined;
  const effectAtCurrent = run => {
    if (effectInstant !== undefined) return run();
    effectInstant = now();
    try { return run(); } finally { effectInstant = undefined; }
  };
  const host: EffectHost = { machine: th.machine, incarnation: th.incarnation, principal: th.principal, scope: th.scope, boundary,
    current: () => ({ decode: th.current().decode, clock: base.clock(effectInstant ?? now()), stopped: stopped(), versions, authority: [base.opening.id] }),
    capture: bytes => captures.put(bytes, 262144) };
  const jh: JudgmentHost = { transport: th, point: 'judgment', floor: base.floor,
    description,
    refreshFacts: () => base.success(undefined) };
  let context: FactContext; let store: ReturnType<typeof createFactStore>;
  let verificationInstant: number | undefined;
  const verifyAtCurrent = run => {
    if (verificationInstant !== undefined) return run();
    verificationInstant = now();
    try { return run(); } finally { verificationInstant = undefined; }
  };
  const vh: VerificationHost = { machine: th.machine, principal: th.principal, scope: th.scope, boundary,
    current: () => ({ decode: th.current().decode, clock: base.clock(verificationInstant ?? now()), stopped: stopped(), generation,
      facts: { ...context, facts: value(store.read()) }, evidence: base.evidence }) };
  const runContext = { ...base.c, intakeOwners: {}, stimulusKinds: options.seed ? ['intake-admitted'] : base.c.stimulusKinds, register, types: dc, facts: { ...base.ctx, schemas: [...base.ctx.schemas, ...options.seed?.schemas ?? []] }, evidenceSources: { ...base.c.evidenceSources, settlement: th.principal.provenance.adapter } };
  const runRegistration = value(runFactSchemas(runContext));
  context = { ...base.ctx, grants: [...base.ctx.grants, ...options.seed?.grants ?? []], migrations: providerEffectMigrations, decode: dc, captures: metadata, schemas: [...base.ctx.schemas.filter(s => !runRegistration.schemas.some(t => t.kind === s.kind) && !options.seed?.schemas.some(t => t.kind === s.kind)), ...runRegistration.schemas, ...options.seed?.schemas ?? [], ...transportSchemas(th), ...effectSchemas(host),
    ...providerEffectSchemas(host), ...providerJudgmentSchemas(jh), ...verificationSchemas(vh)], ownedBodies: [...(base.ctx.ownedBodies ?? []).filter(r => r.owner !== 'part-five'), ...runRegistration.registrations, ...options.seed?.ownedBodies ?? [],
      ...value(registerTransportBodies(th, boundary, consumeEffectSettlement)), ...value(registerEffectBodies(host)),
      ...value(registerProviderEffectBodies(host)), ...value(registerProviderJudgmentBodies(jh, boundary)), ...value(registerVerificationBodies(vh))] };
  runContext.facts = context;
  const priorWitness = storage.read().find(row => row.kind === 'stimulus');
  if (options.seed && priorWitness) runContext.intakeOwners[options.seed.opening.body.work.owner] = {
    type: 'VerifiedPrincipal', id: base.bob.id, fact: ref(priorWitness), field: 'owner' };
  const peer = createFactStore(context, createTransportFileStorage(join(directory, 'peer'), result));
  const replicas = createEffectReplicaStorage(directory, { id: 'preview-peer-directory', store: peer }, result);
  storage = replicas.storage;
  store = createFactStore(context, storage);
  const author = { context, privateKey }, six = createTransportAuthority<EffectSettlement>(th, createTransportSpine(th, author, store), boundary, consumeEffectSettlement);
  const all = () => value(store.read());
  for (const f of all()) {
    const evidence = (f.body as unknown as { evidence?: import('../../src/index.js').Evidence }).evidence;
    if (evidence && !base.evidence.some(e => e.id === evidence.id)) base.evidence.push(value(decode('Evidence', evidence, dc)));
  }
  const raw = (f: FactEnvelope) => (f.body as unknown as { record: Record<string, unknown> }).record;
  const append = (kind: string, body: Json, required: readonly string[] = []) => value(authorAndAppend({ kind, schemaVersion: 1,
    machine: th.machine, principal: json(th.principal), provenance: json(th.principal.provenance), at: json(base.clock(now())), body, required }, context, store, privateKey)).fact;
  for (const evidence of base.evidence) if (!all().some(f => (f.body as unknown as { evidence?: { id: string } }).evidence?.id === evidence.id)) append('evidence-record', json({ evidence }));
  const witness = options.seed ? all().find(f => f.kind === 'stimulus') ?? append('stimulus', json({
    intent: value(decode('Intent', base.intentInput({ principal: base.bob }), dc)), owner: base.bob,
    capture: { reference: 'message:1', hash: metadata['message:1'].hash } })) : base.opening;
  if (options.seed) {
    base.opening = options.seed.opening; base.id = runIdFor(ref(base.opening));
    base.owner = { type: 'VerifiedPrincipal', id: base.bob.id, fact: ref(witness), field: 'owner' };
    base.run = { ...base.run, id: base.id, opening: ref(base.opening), owner: base.owner,
      intent: { type: 'Intent', id: base.opening.body.intent.id, fact: ref(base.opening), field: 'intent' },
      authority: { resolution: ref(base.opening), grants: [] },
      resultDestination: { ...base.run.resultDestination, route: ref(base.opening) } };
  }
  base.run = { ...base.run, createdAt: base.clock(options.start), budget: { ...base.run.budget,
    safetyCeiling: base.clock(options.deadline), exhaustedOwner: base.owner },
    nextWake: { owner: base.owner, at: base.clock(options.deadline), reason: 'continue' } };
  if (options.seed) runContext.intakeOwners[base.opening.body.work.owner] = base.owner;
  const fence = value(six.acquire('provider-acquire', '', options.deadline - options.start));
  base.lease = { owner: 'part-six', name: 'Lease', id: fence.assignment };
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'provider-loop', maxAttempts: 1, minDelay: 1,
    maxDuration: OWNER_WINDOW_MS, timeout: 120000, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, boundary));
  if (!all().some(f => f.kind === 'transport-LoopRecord')) value(six.schedule('provider-schedule', fence, { owner: 'part-five', name: 'Run', id: base.id }, policy));
  const obligation = all().find(f => f.kind === 'transport-LoopRecord')!.id;
  const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'provider-definition', feature: 'provider-call', version: 'provider-definition-v1',
    generation, adapter: description.route, account: description.provider, conversation: STAGE2_DISCLOSURE, speaker: th.principal.id, scopeDigest: enc(th.scope).hash,
    durability: 'local-durable', replicas: 0, lossModel: 'approved test-only local origin; permanent origin loss retains uncertainty',
    maxBytes: 4096, maxCharge: 0, timeout: 120000, verificationBar: 'provider-bar' };
  const approval = base.authorize({ id: 'provider-definition-approval', artifact: base.capture(enc(definition).bytes), base: 'provider-base' });
  versions = [{ id: definition.version, subject: definition.feature, content: json(definition), contentHash: enc(definition).hash,
    since: base.opening.id, supersedes: [], approvedIn: approval, base: approval.base, landedIn: null }];
  if (!all().some(f => f.kind === 'effect-OperationDefinition')) value(installOperationDefinition(definition, host, createEffectSpine(host, author, store)));
  let api: ProviderEffectDoorway;
  if (options.seed) runContext.intakeOwners[base.opening.body.work.owner] = base.owner;
  const admission = createProductionRunAdmission({ authority: six, store, context: boundary });
  let projectionObservedAt = now();
  const deps: RunGraphDependencies = { ...base.deps, groundingPolicy: { ...base.deps.groundingPolicy, maxAge: OWNER_WINDOW_MS }, governance: governanceFixture(runContext), context: runContext, store,
    clock: () => base.clock(projectionObservedAt = now()), generation: () => ({ reference: { ...base.run.generation, id: generation }, kinds: [...new Set(context.schemas.map(s => s.kind))],
      lineages: { 'machine-a': { head: { epoch: 0, position: all().at(-1)!.segment.position }, observedAt: projectionObservedAt, closed: false } } }),
    writer: { owner: 'part-ten', append: (kind, run, r, required) => base.success({ fact: append(kind, json({ run, record: recordWire(r) }), required), durability: { kind: 'local-durable' }, taint: [] }) },
    admission: { ...admission,
      // Preview placement and original capacity are still explicitly waived stand-ins.
      execution: (_run, ownership) => result(() => { if (ownership.id !== fence.assignment) throw Error('preview: stale placement');
        return { worker: 'w', harness: 'h', ownership, context: ref(all().find(f => f.id === fence.assignment)) }; }),
      reservation: (_reference, _step) => base.success(ref(base.opening)) },
    grounding: { owner: 'part-ten', read: ({ run, worker, harness, reason, execution }) => result(() => {
      const consumption = append('consumption', { worker, harness, hashes: JSON.stringify((options.messages ?? [{ hash: metadata['message:1'].hash }]).map(m => m.hash)), classes: JSON.stringify(base.deps.groundingPolicy.briefingClasses) });
      const observed = base.clock(now());
      return { type: 'SessionGrounding', schemaVersion: 2, id: `provider-ground:${run.run.id}:${run.head}`, run: run.run.id, expected: run.head, worker, harness, reason,
        ownership: execution.ownership, executionContext: execution.context, at: observed, previousActivity: base.now,
        elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: worker }, value: observed.value - base.now.value, unit: 'ms', at: observed, by: 'probe' },
        principal: base.owner, intake: ref(base.opening), binding: base.run.resultDestination.binding, directives: [], generation: base.run.generation,
        frontier: { 'machine-a': { epoch: 0, position: base.opening.segment.position } }, knownLineages: ['machine-a'], threshold: 20,
        messages: options.messages ?? [{ fact: ref(base.opening), sequence: base.opening.segment.position, capture: 'message:1', hash: metadata['message:1']!.hash }],
        lastInbound: ref(base.opening), pendingOperations: run.pending.map(s => s.operation.key), children: [], receipts: [], briefingClasses: base.deps.groundingPolicy.briefingClasses, consumption: ref(consumption) };
    }) },
    settlement: { owner: 'part-eight', read: (reference, step) => api.readRunSettlement(reference, step) },
  };
  const evidence = (operation: string, digest: string, predicate: string, amount?: number, overrides: Record<string, unknown> = {}) => {
    const id = overrides.id ?? `proof:${predicate}:${operation}`;
    const existing = all().find(f => f.kind === 'evidence-record' && f.body.evidence.id === id);
    if (existing) return existing.body.evidence;
    const sourceCapture = value(captures.put(enc({ operation, digest, predicate, amount: amount ?? null, at: options.start }).bytes, 8192));
    const e = value(decode('Evidence', base.evidenceInput({ id, capture: sourceCapture,
      claim: { subject: operation, predicate, value: { digest, ...(amount === undefined ? {} : { amount }) } },
      source: 'probe', observedAt: base.clock(options.start), freshFor: OWNER_WINDOW_MS,
      strength: 'attestation', ...overrides }), dc));
    base.evidence.push(e); append('evidence-record', json({ evidence: e })); return e;
  };
  const inputCapture = value(captures.put(enc({ question: options.question, conversation: options.conversation }).bytes, 131072));
  const inputEvidence = evidence('preview-input', inputCapture.hash, 'input-preserved', undefined,
    { id: 'preview-input', capture: inputCapture, strength: 'observation' });
  const selectedEvidence = [inputEvidence.id];
  const graph = value(createRunGraph({ ...deps, acceptedAnswer: { owner: 'part-eight',
    consumeAcceptedProviderAnswer: (...args) => api.consumeAcceptedProviderAnswer(...args) } }));
  // Required Decision bindings are selected before the envelope, never filled into a returned answer.
  const contextText = decisionContext({ type: 'Decision', schemaVersion: 1, at: base.clock(options.start),
    by: { judgment: 'judgment', model: options.model, route: description.route }, floor: base.floor,
    evidence: selectedEvidence }, options.conversation);
  const question = { id: 'preview-question', run: { owner: 'part-five', name: 'Run', id: base.id },
    step: 'step:preview-provider', ordinal: 0, semanticMessage: 'preview-provider', question: options.question,
    context: contextText, evidence: selectedEvidence, deadline: options.deadline };
  const submitted = submittedEnvelope({ provider: description.provider, model: description.model, route: description.route,
    question: question.question, context: question.context, floor: base.floor, evidence: question.evidence,
    point: 'judgment', generation }).bytes;
  const groundAndStart = () => {
    requireInputBound(question.question, question.context, submitted);
    if (!all().some(f => f.kind === 'run-opening')) value(graph.open(base.run));
    const ready = value(graph.read(base.id));
    if (ready.pending.length) return ready;
    const ground = value(graph.ground(base.id, 'w', 'h', 'start', base.lease));
    return value(graph.transition({ type: 'RunTransition', schemaVersion: 1, id: 'start:preview-provider',
      run: base.id, expected: ready.head, trigger: ref(base.opening), kind: 'start', from: ready.state, to: 'running',
      responsible: base.owner, standing: base.run.owner.fact, ownership: base.lease, generation: base.run.generation,
      at: base.clock(now()), blockedOn: { kind: 'step', reference: question.step, owner: base.owner,
        nextObservation: base.clock(options.deadline) }, nextWake: base.run.nextWake, grounding: ref(ground),
      step: { type: 'RunStep', schemaVersion: 1, id: question.step, run: base.id, expected: ready.head, kind: 'effect',
        operation: { key: question.semanticMessage, digest: enc(submitted).hash, classification: ref(base.opening) },
        evidence: [], directives: [], authorizations: [], allocation: { budget: base.run.budget.id,
          reservation: { owner: 'part-six', name: 'AdmissionReservation', id: 'reservation:preview-provider' } },
        ownership: base.lease, resultDestination: base.run.resultDestination, generation: base.run.generation } }));
  };
  const peerCaptures = createJudgmentCaptures(join(directory, 'peer'), {}, result, 1048576, {});
  const durability = { owner: 'part-ten', ensure: facts => result(() => {
    // This peer is still the disclosed same-machine stand-in. Copy its actual
    // capture bytes before returning the existing adapter's replicated receipt.
    for (const [reference, content] of Object.entries(metadata)) {
      if (!reference.startsWith('judgment-capture:')) continue;
      const cap = { reference, hash: content.hash }, bytes = value(captures.read(cap));
      const copy = value(peerCaptures.put(bytes, Buffer.byteLength(bytes)));
      if (copy.reference !== reference || copy.hash !== cap.hash || value(peerCaptures.read(copy)) !== bytes)
        throw Error('preview: peer capture differs');
    }
    return value(replicas.durability.ensure(facts));
  }) };
  const custody = { owner: 'part-ten' as const, verify: (caps, demand) => result(() => {
    for (const cap of caps) {
      const bytes = value(captures.read(cap));
      if (demand?.durability === 'replicated') {
        if (demand.replicas !== 1) throw Error('preview: unsupported peer custody');
        const copy = value(peerCaptures.put(bytes, Buffer.byteLength(bytes)));
        if (copy.reference !== cap.reference || copy.hash !== cap.hash || value(peerCaptures.read(copy)) !== bytes)
          throw Error('preview: peer capture differs');
      }
    }
  }) };
  const route = options.routeFactory({ evidence, context: boundary, description, deadline: options.deadline,
    // A fresh Six write witness rechecks the current lease/fence/standing without
    // renewing expiry. The subscription route calls this before every child.
    current: () => {
      const facts = all(), requestFact = facts.find(f => f.kind === 'judgment-provider-ProviderJudgmentRequest');
      if (requestFact) verifyInvocationBinding(facts, cap => strictInvocationCapture(directory, cap), requestFact,
        facts.find(f => f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && record(f).phase === 'prepared'), options.invocationBinding);
      return six.admitWrite(`preview-provider-current:${all().at(-1).id}`, fence).kind === 'Success';
    } });
  const owners = value(createProductionProviderOwners({ judgment: { host: jh, boundary, authority: six,
    captures, store, context, privateKey, runs: graph, settings: STAGE2_SETTINGS, outputSchema: STAGE2_OUTPUT_SCHEMA,
    maxTokens: 2048, maxCaptureBytes: 1048576, timeout: 120000, disclosure: STAGE2_DISCLOSURE },
    effect: { host, durability, custody, plan: 'preview-response-plan' }, verification: vh, route }));
  api = owners.eight;
  const seven = owners.seven, runtime = owners.nine;
  const prepare = () => { groundAndStart(); const prepared = value(seven.prepare(question, fence));
    const request = value(api.prepare({ prepared, definition: definition.id, verificationOwner: 'preview-recorder',
      resultDestination: base.opening.id, obligation }, fence));
    const requestFact = all().find(f => f.id === prepared.request.id);
    const preparedFact = all().find(f => f.id === prepared.prepared.id);
    const q = record(requestFact), claim = invocationClaim(options.invocationBinding, requestFact, preparedFact);
    const existing = invocationBindings(all(), q);
    if (!existing.length) {
      if (all().some(f => f.kind === 'transport-AdmissionReservation'
        && record(f).run === q.run && ['dispatch-claimed', 'consumed'].includes(record(f).state)))
        throw Error('preview: invocation binding missing after dispatch');
      const capture = value(captures.put(enc(claim).bytes, 16384));
      evidence(q.id, enc(claim).hash, 'preview-invocation-binding', undefined,
        { capture, claim: { subject: q.id, predicate: 'preview-invocation-binding', value: claim } });
    }
    verifyInvocationBinding(all(), cap => strictInvocationCapture(directory, cap), requestFact, preparedFact, options.invocationBinding);
    return { prepared, request }; };
  return { ...base, directory, dc, metadata, result, storage, context, store, th, host, jh, vh, six, fence,
    graph, deps, seven, api, runtime, route, captures, question, submitted, prepare, evidence, all, owners,
    durability, custody, definition, versions, author, verifyAtCurrent, effectAtCurrent,
    admitReply: (command, run, replyPolicy) => admitAcceptedProviderReply(six, graph, command, fence, run, replyPolicy, boundary) };
}

const record = fact => fact.body.record;
const ownerReference = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id,
  kind: fact.kind, schemaVersion: fact.schemaVersion, contentHash: fact.contentHash });

const bindingPredicate = 'preview-invocation-binding';
const invocationBindings = (facts, q) => facts.filter(f => f.kind === 'evidence-record'
  && (f.body.evidence.id === `proof:${bindingPredicate}:${q.id}`
    || f.body.evidence.claim.predicate === bindingPredicate));
function invocationClaim(binding, requestFact, preparedFact) {
  if (!binding) throw Error('preview: invocation binding descriptor absent');
  const q = record(requestFact);
  return { schemaVersion: 1, ...binding, request: ownerReference(requestFact), prepared: ownerReference(preparedFact),
    effectRequest: q.effectRequest, run: q.run, attempt: q.attempt, submitted: q.submitted, submittedDigest: q.inputDigest };
}
function strictInvocationCapture(directory, cap) {
  if (!/^sha256:[a-f0-9]{64}$/u.test(cap?.hash) || cap.reference !== `judgment-capture:${cap.hash}`)
    throw Error('preview: invocation capture reference differs');
  const bytes = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
    .decode(readFileSync(join(directory, 'captures', cap.hash.slice(7))));
  if (hashBytes(bytes) !== cap.hash) throw Error('preview: invocation capture hash differs');
  return bytes;
}
/** Called only with chain-verified facts and strict capture readers. */
function verifyInvocationBinding(facts, readCapture, requestFact, preparedFact, expected) {
  const q = record(requestFact), found = invocationBindings(facts, q);
  const check = ok => { if (!ok) throw Error('preview: invocation binding differs'); };
  check(found.length === 1);
  const fact = found[0], wire = fact.body.evidence, captured = readCapture(wire.capture);
  const context = factsFixture().ctx.decode;
  const e = value(decode('Evidence', wire, { ...context, captures: { ...context.captures, [wire.capture.reference]: captured } }));
  const v = e.claim.value;
  const policy = subscriptionInvocationPolicy(q.model);
  const binding = { activationReference: v.activationReference, activationDigest: v.activationDigest,
    profileDigest: v.profileDigest, invocationPolicyDigest: enc(policy).hash,
    systemPromptDigest: hashBytes(SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT), framing: policy.framing, invocationPolicy: policy };
  check(e.id === `proof:${bindingPredicate}:${q.id}` && e.claim.subject === q.id
    && e.claim.predicate === bindingPredicate && e.source === 'probe' && e.strength === 'attestation');
  check(enc(v).bytes === enc(invocationClaim(expected ?? binding, requestFact, preparedFact)).bytes
    && enc(v).bytes === enc(invocationClaim(binding, requestFact, preparedFact)).bytes);
  check(captured === enc(v).bytes && e.capture.hash === hashBytes(enc(v).bytes));
  check(fact.segment.position > preparedFact.segment.position && fact.segment.position > requestFact.segment.position);
  const p = record(preparedFact);
  check(p.request === q.id && p.attempt === q.attempt && p.submittedDigest === q.inputDigest && p.phase === 'prepared');
  const effects = facts.filter(f => f.kind === 'effect-provider-ProviderEffectRequest' && record(f).id === q.effectRequest);
  check(effects.length === 1);
  const effect = record(effects[0]);
  check(effect.run === q.run && effect.attempt === q.attempt && effect.digest === q.inputDigest
    && effect.payload.effectRequest === q.effectRequest && effect.payload.run === q.run
    && effect.payload.attempt === q.attempt && effect.payload.submittedDigest === q.inputDigest
    && enc(effect.payload.submitted).bytes === enc(q.submitted).bytes
    && enc(effect.payload.request).bytes === enc({ owner: 'part-seven', name: 'JudgmentRequest', id: requestFact.id }).bytes
    && enc(effect.payload.prepared).bytes === enc({ owner: 'part-seven', name: 'JudgmentAttemptRecord', id: preparedFact.id }).bytes);
  check(facts.filter(f => f.kind === 'run-opening' && record(f).id === q.run).length === 1);
  for (const f of facts.filter(f => f.kind === 'transport-AdmissionReservation'
    && record(f).run === q.run && ['dispatch-claimed', 'consumed'].includes(record(f).state)))
    check(f.segment.position > fact.segment.position);
  const stdin = readCapture(q.submitted);
  check(enc(stdin).hash === q.inputDigest);
  requireInputBound('', '', stdin);
  return binding;
}

/** Rebuild Nine's exact subject from the verified same-store response chain. */
export function stage2ResponseSubject(f) {
  const facts = f.all();
  const requestFact = facts.find(f => f.kind === 'judgment-provider-ProviderJudgmentRequest');
  const q = record(requestFact);
  const one = (kind, predicate) => {
    const found = facts.filter(f => f.kind === kind && predicate(record(f)));
    if (found.length !== 1) throw Error('preview: response owner join differs');
    return found[0];
  };
  const prepared = one('judgment-provider-ProviderJudgmentAttemptRecord', r => r.request === q.id && r.phase === 'prepared');
  const response = one('judgment-provider-ProviderJudgmentAttemptRecord', r => r.request === q.id && r.phase === 'response-observed');
  const r = record(response), receipt = JSON.parse(value(f.captures.read(r.receipt)));
  if (receipt.state !== 'complete' || receipt.usage.charge !== null || !receipt.responseEvidence) throw Error('preview: response unavailable');
  const evidence = receipt.responseEvidence;
  const effect = one('effect-provider-ProviderEffectRequest', e => e.id === q.effectRequest);
  const executor = one('effect-provider-ProviderOperationObservation', e => e.operation === r.operation && e.stage === 'executor-accepted');
  const observation = one('effect-provider-ProviderOperationObservation', e => e.operation === r.operation && e.stage === 'response');
  const consumed = one('transport-AdmissionReservation', e => e.operation === r.operation && e.state === 'consumed');
  const claim = one('transport-AdmissionReservation', e => e.operation === r.operation && e.state === 'dispatch-claimed');
  return { seven: { request: ownerReference(requestFact), prepared: ownerReference(prepared), attempt: q.attempt,
    response: ownerReference(response) }, eight: { request: ownerReference(effect), executorObservation: ownerReference(executor),
    responseObservation: ownerReference(observation) }, six: { operation: r.operation,
    consumedReservation: ownerReference(consumed), dispatchClaim: ownerReference(claim) },
    submitted: { capture: q.submitted, operationDigest: q.inputDigest },
    route: { provider: q.provider, model: q.model, route: q.route, routeBasis: q.routeBasis,
      floorDigest: q.floorDigest, evidence: q.evidence, evidenceDigest: enc(q.evidence).hash,
      settingsDigest: q.settingsDigest, outputSchemaDigest: q.outputSchemaDigest },
    response: { capture: evidence.answer.source, answerDigest: evidence.answer.answerDigest,
      parserReference: evidence.contract.parserReference, parserVersion: evidence.contract.parserVersion,
      evidenceContractReference: evidence.contract.evidenceContractReference, evidenceContractVersion: evidence.contract.evidenceContractVersion },
    terminal: { evidence: evidence.terminal.evidence, capture: evidence.terminal.raw,
      rawDigest: evidence.terminal.rawDigest, sourceEvidence: evidence.source.evidence } };
}

export function acceptStage2Answer(f) {
  const subject = stage2ResponseSubject(f);
  for (const fact of f.all()) {
    const evidence = fact.body.evidence;
    if (evidence && !f.dc.evidence.some(row => row.id === evidence.id)) f.dc.evidence.push(value(decode('Evidence', evidence, f.dc)));
  }
  f.evidence(subject.six.operation, subject.submitted.operationDigest, 'operation-occurred', undefined, { strength: 'observation' });
  const legacy = verificationInput('VerificationPlan');
  if (!f.all().some(row => row.kind === 'verification-VerificationPlan' && record(row).id === 'preview-response-plan'))
    value(f.runtime.record('VerificationPlan', { ...legacy, type: 'VerificationPlan', schemaVersion: 2,
      purpose: 'output-use', id: 'preview-response-plan', subject: { ...legacy.subject,
        scope: f.scope.members[0], generation: f.th.current().generation.id },
      bar: { ...legacy.bar, version: 'provider-bar',
        predicates: ['occurrence', 'non-occurrence', 'quiescence', 'charge', 'response-authenticity', 'response-completeness'],
        sources: ['probe'], minimumStrength: 'observation', subjectDigest: enc(subject).hash, captureRequired: true,
        freshness: OWNER_WINDOW_MS }, responseContract: { parserReference: subject.response.parserReference,
        parserVersion: subject.response.parserVersion, evidenceContractReference: subject.response.evidenceContractReference,
        evidenceContractVersion: subject.response.evidenceContractVersion, mode: 'single-final-reply' },
      responseRequirements: ['response-authenticity', 'response-completeness'].map(predicate => ({
        predicate, sources: [f.th.principal.id], minimumStrength: 'observation',
        requiredContract: subject.response.evidenceContractReference })) }));
  const assessment = value(f.verifyAtCurrent(() => f.api.assessResponse(subject.six.operation)));
  const settlement = value(f.api.settle(subject.six.operation, assessment));
  const accounting = value(f.six.settle(f.fence, settlement));
  if (settlement.finalCharge !== null || settlement.delayedExecutionExcluded !== false
    || accounting.actualCharge !== -1 || accounting.unresolved !== 1 || accounting.released !== 0
    || accounting.retryEligible !== 0 || accounting.exposure !== 0) throw Error('preview: UNKNOWN accounting differs');
  const settlementFact = f.all().find(row => row.kind === 'effect-provider-ProviderEffectSettlement' && record(row).id === settlement.id);
  const accountingFact = f.all().find(row => row.kind === 'transport-SettlementApplication' && record(row).settlement === settlement.id);
  const acceptance = value(f.seven.recordProviderAnswerAcceptance({ subject, assessment,
    settlement: ownerReference(settlementFact), accounting: ownerReference(accountingFact) }, f.owners.responseAssessment, f.fence));
  return { subject, assessment, settlement, accounting, acceptance };
}

export function openStage2Reply(f, acceptance) {
  const accepted = value(f.api.consumeAcceptedProviderAnswer(acceptance, view => view));
  const original = value(f.graph.read(f.id));
  const opening = { owner: 'part-two', name: 'FactEnvelope', id: acceptance.id };
  const reply = JSON.parse(JSON.stringify({ ...original.run, id: runIdFor(opening), opening }));
  const opened = value(f.graph.openAcceptedProviderReply({ acceptance, originalRun: f.id,
    expected: accepted.predecessor, obligation: { owner: 'part-two', name: 'FactEnvelope', id: accepted.obligation },
    standing: original.run.owner.fact, ownership: f.lease, fence: f.fence, reply }));
  return { reply, opened, accepted };
}

export function admitStage2Reply(f, reply, timeout: number) {
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'preview-reply-loop',
    maxAttempts: 1, minDelay: 1, maxDuration: OWNER_WINDOW_MS, timeout, concurrency: 1,
    failDirection: 'closed', breaker: 'stub-closed' }, f.host.boundary));
  const run = { owner: 'part-five', name: 'Run', id: reply.id };
  const admitted = value(f.admitReply('preview-pair', run, policy));
  const grounded = f.all().find(row => row.kind === 'session-grounding' && row.body.run === reply.id)
    ?? value(f.graph.ground(reply.id, 'w', 'h', 'start', f.lease));
  const context = { ...f.deps.context, facts: { ...f.context, facts: f.all() } };
  const grounding = value(decodeSessionGrounding(readRecordFact(grounded), context));
  const view = value(f.graph.read(reply.id));
  validateGrounding(grounding, view.run, view.head, view.pending, context);
  return { admitted, grounded, run };
}

export function prepareStage2Reply(f, accepted, reply, config) {
  const text = acceptedReplyPreviewText(f.all(), reply.id);
  const { admitted, api, target, declaration } = config;
  // The projection already escapes HTML. Validate with the adapter's existing
  // preparation path; do not run it through another escaping transform.
  const conversation = telegramConversation(declaration.bot.id, target);
  const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'preview-reply-definition',
    feature: 'telegram-ordinary-reply', version: 'telegram:9.2:ordinary-reply:v1', adapter: admitted.id,
    account: admitted.account, conversation, generation: f.th.current().generation.id,
    speaker: f.host.principal.id, scopeDigest: enc(f.host.scope).hash, durability: 'replicated', replicas: 1,
    lossModel: 'Same-machine fixture peer STAND-IN; shared disk loss is NOT covered.',
    maxBytes: declaration.limits.maxReplyBytes, maxCharge: declaration.limits.maxCharge,
    timeout: declaration.limits.timeout, verificationBar: 'preview-recorded-reply-bar' };
  const message = value(decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1,
    id: 'preview-answer', semanticMessage: 'preview-answer', run: reply.id, speaker: f.host.principal.id,
    account: admitted.account, conversation, text, purpose: 'ordinary-reply', sourceResult: accepted.acceptance.id }, f.host));
  try { requireOutboundBound(message, definition.maxBytes); }
  catch { const error = new Error('preview: complete outbound bound');
    Object.assign(error, { previewBound: { text: Buffer.byteLength(text), outbound: Buffer.byteLength(enc(message).bytes), maximum: definition.maxBytes } });
    throw error; }
  const approvedIn = f.authorize({ id: 'preview-reply-approval', artifact: f.capture(enc(definition).bytes), base: 'preview-reply-base' });
  if (!f.versions.some(row => row.id === definition.version)) f.versions.push({ id: definition.version,
    subject: definition.feature, content: json(definition), contentHash: enc(definition).hash,
    since: accepted.acceptance.id, supersedes: [], approvedIn, base: approvedIn.base, landedIn: null });
  const spine = createEffectSpine(f.host, f.author, f.store);
  const installed = value(installTelegramReplyOperation({ id: definition.id, generation: definition.generation,
    admitted, target, speaker: definition.speaker, scopeDigest: definition.scopeDigest,
    durability: definition.durability, replicas: definition.replicas, lossModel: definition.lossModel,
    verificationBar: definition.verificationBar }, f.host, spine));
  const adapter = createTelegramReplyOperationAdapter(admitted, api, target, f.host.boundary);
  const doorway = createEffectDoorway({ host: f.host, spine, transport: f.six, durability: f.durability,
    custody: f.custody, adapter, assessment: null });
  const loop = f.all().find(row => row.kind === 'transport-LoopRecord' && record(row).run === reply.id);
  const request = value(f.effectAtCurrent(() => adapter.prepare(doorway, { definition: installed.id, message,
    run: { owner: 'part-five', name: 'Run', id: reply.id }, pending: accepted.acceptance.id,
    attempt: 'preview-answer-attempt', verificationOwner: 'preview-recorded-verifier', obligation: loop.id,
    closure: [accepted.acceptance.id, accepted.assessment.id], fence: f.fence })));
  return { doorway, request, message };
}

/** One awaited advancement per launcher yield. Sidecar is bookkeeping; retained
 * owner records decide whether a crash can advance or must remain UNKNOWN. */
export function stage2Lifecycle(input) {
  const { sidecar, state, now, configuration } = input;
  const terminal = () => {
    const d = sidecar.read();
    if (d.phase === 'api-accepted') reconcileStage2History(input.directory, d, state.read(), configuration);
    return d.terminalLatch;
  };
  const gate = () => {
    state.gate('dispatch');
    if (!input.activationActive()) throw Error('preview: activation revoked');
    const d = sidecar.read();
    if (d.ownerDeadline !== null && now() >= d.ownerDeadline) throw Error('preview: owner deadline');
  };
  const save = (phase, references = {}, fields = {}) => {
    const d = sidecar.read();
    const saved = sidecar.update({ ...fields, phase, references: { ...d.references, ...references } });
    input.checkpoint?.(phase, saved); return saved;
  };
  const hold = (code, lengths = {}, references = []) => {
    const turn = state.read().turns[sidecar.read().selectedTurn];
    if (turn && ['intake-preserved', 'grounded'].includes(turn.phase) && !turn.failureClass)
      state.markFailure(turn.id, 'unknown', null);
    return sidecar.hold(code, lengths, references);
  };
  let f;
  const owners = () => {
    if (f) return f;
    const d = sidecar.read(), turn = state.read().turns[d.selectedTurn];
    const selected = input.selectedContext(turn);
    if (selected.digest !== d.contextDigest || JSON.stringify(selected.references) !== JSON.stringify(d.contextReferences))
      throw Error('preview: selected context changed');
    f = createStage2Owners({ directory: input.directory, seed: selected.seed, messages: selected.messages,
      start: d.ownerStart, deadline: d.ownerDeadline, ownerNow: now,
      active: () => { try { gate(); return true; } catch { return false; } }, model: input.model,
      invocationBinding: input.invocationBinding,
      question: selected.question, conversation: selected.conversation,
      replyCharge: input.telegram.declaration.limits.maxCharge,
      registerEntries: ['preview', 'telegram-ordinary-reply', input.telegram.admitted.id], routeFactory: input.routeFactory });
    return f;
  };
  const finishOuter = (observation) => {
    const turn = state.read().turns[sidecar.read().selectedTurn];
    if (turn.phase === 'dispatch-outcome-unknown') {
      state.advance(turn.id, 'dispatch-outcome-unknown', 'api-accepted', {
        replyOperation: observation.operation, replyObservation: observation.id });
      state.noteSuccess();
    } else if (turn.phase !== 'api-accepted') throw Error('preview: accepted outer turn disagrees');
  };
  const recordProviderFailure = (owner, response) => {
    const observed = JSON.parse(value(owner.captures.read(record(response).receipt)));
    if (observed.state === 'uncertain' || observed.state === 'rejected') {
      const selected = sidecar.read().selectedTurn;
      const turn = state.read().turns[selected];
      if (turn && !turn.failureClass) state.markFailure(selected, observed.failure?.failureClass ?? 'unknown', observed.failure?.resetHint ?? null);
      if (observed.failure?.failureClass === 'limit') state.noteLimit(observed.failure.resetAt);
    }
  };
  const reconcile = () => {
    const d = sidecar.read(), owner = owners(), facts = owner.all();
    const response = facts.find(row => row.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && record(row).phase === 'response-observed');
    const claimed = facts.some(row => row.kind === 'transport-AdmissionReservation'
      && ['dispatch-claimed', 'consumed'].includes(record(row).state) && record(row).run === owner.id);
    if (claimed && d.modelAttemptUsed !== 1) throw Error('preview: sidecar attempt disagrees with owner');
    if (d.phase === 'provider-dispatch-unknown') {
      if (!response) { hold('UNKNOWN'); return false; }
      recordProviderFailure(owner, response);
      save('response-preserved', { responseFact: response.id, receipt: record(response).receipt.reference });
    }
    return true;
  };
  const resumeOne = async () => {
    if (terminal()) {
      if (sidecar.read().phase === 'api-accepted') reconcileStage2History(input.directory, sidecar.read(), state.read(), configuration);
      return false;
    }
    if (sidecar.read().phase === 'reply-dispatch-unknown') {
      try {
        const historical = reconcileStage2History(input.directory, sidecar.read(), state.read(), configuration, true);
        finishOuter(historical.observation);
        save('api-accepted', { replyObservationFact: historical.observationFact }, { terminalLatch: true });
      } catch { hold('UNKNOWN'); }
      return false;
    }
    gate(); input.reconcileIntake();
    let d = sidecar.read();
    if (d.selectedTurn === null) {
      const candidates = state.pending().filter(turn => !d.excludedTurns.includes(turn.id))
        .sort((a, b) => a.updateId - b.updateId);
      const turn = candidates.find(turn => input.messageTime(turn) > d.cutoff && turn.recordedAt >= d.cutoff);
      if (!turn) return false;
      const instant = now();
      if (state.read().trial.expiresAt - instant < OWNER_WINDOW_MS) { hold('EXPIRED'); return false; }
      const context = input.selectedContext(turn);
      save('armed', {}, { selectedTurn: turn.id, contextReferences: context.references, contextDigest: context.digest,
        ownerStart: instant, ownerDeadline: instant + OWNER_WINDOW_MS, absoluteStart: instant });
      d = sidecar.read();
    }
    if (Object.keys(d.references).length) reconcileStage2History(input.directory, d, state.read(), configuration);
    const owner = owners();
    if (!reconcile() || terminal()) return false;
    d = sidecar.read();
    if (d.phase === 'armed') {
      const lengths = inputMeasurements(owner.question.question, owner.question.context, owner.submitted);
      if (lengths.submitted > 4096 || lengths.prompt > 4096) { hold('BOUND', lengths, d.contextReferences); return false; }
      const { prepared, request } = owner.prepare();
      save('provider-prepared', { requestFact: prepared.request.id, preparedFact: prepared.prepared.id,
        providerRequest: request.id, submittedCapture: request.payload.submitted.reference, providerRun: owner.id });
      return true;
    }
    if (d.phase === 'provider-prepared') {
      const { request } = owner.prepare();
      await new Promise(resolve => setImmediate(resolve)); gate();
      state.gateSpend();
      if (d.modelAttemptUsed) { hold('UNKNOWN'); return false; }
      save('provider-dispatch-unknown', {}, { modelAttemptUsed: 1 });
      // Six claims/consumes and Ten captures via their unchanged final edge.
      value(await owner.api.dispatch(request, owner.fence));
      const response = owner.all().find(row => row.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && record(row).phase === 'response-observed');
      if (!response) { hold('UNKNOWN'); return false; }
      recordProviderFailure(owner, response);
      save('response-preserved', { responseFact: response.id, receipt: record(response).receipt.reference });
      gate(); return true;
    }
    if (d.phase === 'response-preserved') {
      const answer = acceptStage2Answer(owner);
      const facts = owner.all();
      save('answer-accepted', { assessmentFact: answer.assessment.id, acceptanceFact: answer.acceptance.id,
        settlementFact: facts.find(row => row.kind === 'effect-provider-ProviderEffectSettlement').id,
        accountingFact: facts.find(row => row.kind === 'transport-SettlementApplication').id });
      return true;
    }
    const accepted = { acceptance: { owner: 'part-seven', name: 'ProviderAnswerAcceptance', id: d.references.acceptanceFact },
      assessment: { owner: 'part-nine', name: 'VerificationAssessment', id: d.references.assessmentFact } };
    const opened = openStage2Reply(owner, accepted.acceptance);
    if (d.phase === 'answer-accepted') {
      const opening = owner.all().find(row => row.kind === 'run-opening' && row.body.run === opened.reply.id);
      save('reply-opened', { replyRun: opened.reply.id, replyOpeningFact: opening.id }); return true;
    }
    const admitted = admitStage2Reply(owner, opened.reply, input.telegram.declaration.limits.timeout);
    if (d.phase === 'reply-opened') {
      const pair = owner.all().find(row => row.kind === 'transport-RunPairAdmission');
      save('reply-admitted', { pairFact: pair.id, replyGroundingFact: admitted.grounded.id }); return true;
    }
    gate();
    const reply = prepareStage2Reply(owner, accepted, opened.reply, input.telegram);
    if (d.phase === 'reply-admitted') {
      const facts = owner.all();
      save('reply-prepared', { replyRequestFact: facts.find(row => row.kind === 'effect-EffectRequest').id,
        replyMessageFact: facts.find(row => row.kind === 'effect-OutboundMessage').id }); return true;
    }
    if (d.phase !== 'reply-prepared') throw Error('preview: unsupported phase');
    await new Promise(resolve => setImmediate(resolve)); gate();
    state.reserveReply();
    save('reply-dispatch-unknown');
    const turn = state.read().turns[d.selectedTurn];
    if (turn.phase === 'intake-preserved') state.advance(turn.id, 'intake-preserved', 'grounded', {
      contextReferences: d.contextReferences, contextDigest: d.contextDigest, runEvidence: input.directory });
    state.advance(turn.id, 'grounded', 'dispatch-outcome-unknown', { replyOperation: reply.request.id });
    const observation = value(owner.effectAtCurrent(() => reply.doorway.dispatch(reply.request, owner.fence)));
    input.checkpoint?.('reply-returned', sidecar.read());
    if (!acceptedTelegram(owner, observation, reply.message, input.telegram.target)) { hold('UNKNOWN'); return false; }
    const observationFact = owner.all().find(row => row.kind === 'effect-OperationObservation' && record(row).id === observation.id);
    finishOuter(observation);
    save('api-accepted', { replyObservationFact: observationFact.id }, { terminalLatch: true }); return false;
  };
  return { resumeOne, terminal, owners };
}

/** Historical inspection has no writer, route, authority or live-clock dependency.
 * The preview's disclosed fixed signing key remains its trust anchor. */
export function reconcileStage2History(directory, d, outer, configuration, requireResponse = d.phase === 'api-accepted', bindingOnly = false) {
  validateStage2State(d, outer, configuration.root);
  const base = factsFixture(), facts = [];
  for (const raw of JSON.parse(readFileSync(join(directory, 'facts.json'), 'utf8'))) {
    const fact = value(decodeFrame(raw, base.ctx)).frame;
    extendsChain(fact, { ...base.ctx, facts }); facts.push(fact);
  }
  const fail = () => { throw Error('preview: sidecar owner disagreement'); };
  const check = condition => { if (!condition) fail(); };
  const one = (kind, predicate = () => true) => {
    const found = facts.filter(f => f.kind === kind && predicate(record(f), f));
    check(found.length === 1); return found[0];
  };
  const readCapture = cap => {
    check(/^sha256:[a-f0-9]{64}$/u.test(cap?.hash) && cap.reference === `judgment-capture:${cap.hash}`);
    const bytes = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
      .decode(readFileSync(join(directory, 'captures', cap.hash.slice(7))));
    check(hashBytes(bytes) === cap.hash); return bytes;
  };
  const requests = facts.filter(f => f.kind === 'judgment-provider-ProviderJudgmentRequest');
  if (requests.length) {
    check(requests.length === 1);
    const requestFact = requests[0], q = record(requestFact);
    const continuation = existsSync(join(configuration.root, 'preview-predecessor.json'))
      && JSON.parse(readFileSync(join(configuration.root, 'preview-predecessor.json'), 'utf8')).continuation;
    const bindings = invocationBindings(facts, q);
    const isV2 = !!continuation || d.policyDigest === enc(subscriptionInvocationPolicy(q.model)).hash || bindings.length > 0;
    if (!isV2) {
      const { framing: _framing, maxPromptBytes: _maximum, ...legacy } = subscriptionInvocationPolicy(q.model);
      check(d.policyDigest === enc({ ...legacy, args: legacy.args.filter((_, i, args) => args[i] !== '--system-prompt' && args[i - 1] !== '--system-prompt') }).hash);
    }
    const dispatched = facts.some(f => f.kind === 'transport-AdmissionReservation'
      && record(f).run === q.run && ['dispatch-claimed', 'consumed'].includes(record(f).state));
    if (isV2 && (bindings.length || d.references.requestFact || dispatched || d.modelAttemptUsed)) {
      const preparedFact = one('judgment-provider-ProviderJudgmentAttemptRecord', r => r.request === q.id && r.phase === 'prepared');
      const binding = verifyInvocationBinding(facts, readCapture, requestFact, preparedFact);
      check(binding.activationDigest === d.activationDigest && binding.invocationPolicyDigest === d.policyDigest);
      const source = facts.filter(f => f.kind === 'evidence-record'
        && f.body.evidence.claim.predicate === 'provider-response-source-contract');
      check(source.length === 1 && source[0].body.evidence.claim.subject === binding.activationReference
        && source[0].body.evidence.claim.value.version === binding.profileDigest);
      validateStage2Successor({ root: configuration.root, outer, binding, model: q.model, cutoff: d.cutoff });
    }
  }
  if (bindingOnly) return { facts, readCapture, one, check };
  const expected = {};
  const remember = (role, fact) => { expected[role] = fact.id; return record(fact); };
  if (d.references.requestFact) {
    const q = remember('requestFact', one('judgment-provider-ProviderJudgmentRequest'));
    const run = one('run-opening', r => r.id === q.run), r = record(run);
    const intake = one('intake-admitted', (_r, f) => f.id === r.opening.id);
    const turn = outer.turns[d.selectedTurn];
    check(intake.body.eventId === String(turn.updateId) && intake.body.receipt === turn.receipt);
    check(d.selectedTurn === `telegram:${configuration.botId}:update:${intake.body.eventId}`);
    check(r.createdAt.value === d.ownerStart && r.budget.safetyCeiling.value === d.ownerDeadline && q.deadline === d.ownerDeadline);
    const grounding = record(one('session-grounding', r => r.run === q.run));
    check(enc(grounding.messages.map(m => m.capture)).bytes === enc(d.contextReferences).bytes);
    check(hashBytes(JSON.stringify(grounding.messages.map(m => ({ reference: m.capture, hash: m.hash })))) === d.contextDigest);
    expected.providerRun = q.run; expected.providerRequest = q.effectRequest; expected.submittedCapture = q.submitted.reference;
    const submitted = readCapture(q.submitted);
    check(enc(submitted).hash === q.inputDigest);
    const envelope = JSON.parse(submitted);
    check(envelope.messages[0].content === readCapture(q.question) && envelope.messages[1].content === readCapture(q.context));
    const prepared = remember('preparedFact', one('judgment-provider-ProviderJudgmentAttemptRecord', r => r.request === q.id && r.phase === 'prepared'));
    check(prepared.attempt === q.attempt && prepared.submittedDigest === q.inputDigest);
    const effect = record(one('effect-provider-ProviderEffectRequest', r => r.id === q.effectRequest));
    check(effect.run === q.run && effect.digest === q.inputDigest && effect.attempt === q.attempt);
    if (d.references.responseFact) {
      const responseFact = one('judgment-provider-ProviderJudgmentAttemptRecord', r => r.request === q.id && r.phase === 'response-observed');
      const response = remember('responseFact', responseFact); expected.receipt = response.receipt.reference;
      check(response.attempt === q.attempt && response.submittedDigest === q.inputDigest);
      const receipt = JSON.parse(readCapture(response.receipt));
      check(['complete', 'rejected', 'uncertain'].includes(receipt.state) && receipt.usage.charge === null);
      if (receipt.state !== 'complete') {
        check(!d.references.acceptanceFact && receipt.bytes === null && !receipt.responseEvidence);
        if (d.phase === 'held') check(turn.failureClass === (receipt.failure?.failureClass ?? 'unknown')
          && (turn.resetHint ?? null) === (receipt.failure?.resetHint ?? null));
      }
      const providerClaim = one('transport-AdmissionReservation', r => r.operation === response.operation && r.state === 'dispatch-claimed');
      const providerConsumed = one('transport-AdmissionReservation', r => r.operation === response.operation && r.state === 'consumed');
      check(response.claim === providerClaim.id && response.reservation === providerConsumed.id);
      for (const f of [providerClaim, providerConsumed]) {
        const r = record(f); check(r.run === q.run && r.request === effect.id && r.digest === q.inputDigest);
      }
      if (d.references.acceptanceFact) {
        const acceptanceFact = one('judgment-provider-ProviderAnswerAcceptance', r => r.request === q.id);
        const acceptance = remember('acceptanceFact', acceptanceFact);
        const referenced = (role, reference, kind) => {
          const fact = one(kind, (_r, f) => f.id === reference.id);
          check(enc(ownerReference(fact)).bytes === enc(reference).bytes); remember(role, fact); return record(fact);
        };
        check(enc(acceptance.response).bytes === enc(ownerReference(responseFact)).bytes);
        check(acceptance.operation === response.operation && acceptance.claim === response.claim && acceptance.digest === q.inputDigest);
        const assessment = referenced('assessmentFact', acceptance.assessment, 'verification-VerificationAssessment');
        const settlement = referenced('settlementFact', acceptance.settlement, 'effect-provider-ProviderEffectSettlement');
        const accounting = referenced('accountingFact', acceptance.accounting, 'transport-SettlementApplication');
        check(assessment.operation === response.operation && assessment.operationDigest === q.inputDigest);
        check(enc(assessment.subject).bytes === enc(stage2ResponseSubject({ all: () => facts,
          captures: { read: cap => base.success(readCapture(cap)) } })).bytes);
        for (const predicate of ['response-authenticity', 'response-completeness'])
          check(assessment.predicates.some(p => p.predicate === predicate && p.verdict === 'satisfied'));
        check(settlement.operation === response.operation && settlement.finalCharge === 'unknown' && settlement.delayedExecutionExcluded === false);
        check(accounting.operation === response.operation && accounting.settlement === settlement.id && accounting.actualCharge === -1
          && accounting.unresolved === 1 && accounting.released === 0 && accounting.retryEligible === 0);
        // Every signed response-subject reference and capture must still exist unchanged.
        const inspect = v => {
          if (!v || typeof v !== 'object') return;
          if (v.name === 'FactEnvelope' && v.contentHash) {
            const fact = facts.find(f => f.id === v.id); check(fact && enc(ownerReference(fact)).bytes === enc(v).bytes);
          }
          if (v.reference?.startsWith('judgment-capture:') && v.hash) readCapture(v);
          Object.values(v).forEach(inspect);
        };
        inspect(assessment.subject); inspect(receipt);
        const answer = readCapture(acceptance.capture);
        // Seven's historical decoder revalidates its signed Decision and causal
        // acceptance/accounting basis without evaluating current authority.
        value(decodeHistoricalProviderAnswerAcceptance(acceptance, { ...base.c, origin: acceptanceFact, mode: 'historical',
          facts: { ...base.ctx, facts, captures: { [acceptance.capture.reference]: {
            bytes: answer, hash: acceptance.capture.hash, status: 'available', byteLength: Buffer.byteLength(answer) } } } },
          { transport: { machine: 'machine-a', principal: base.bob } }));
        check(hashBytes(answer) === acceptance.answerDigest && receipt.responseEvidence.answer.answerDigest === acceptance.answerDigest);
        const decision = JSON.parse(answer), signed = acceptanceFact.body.decision;
        check(enc(decision.standsOn === undefined ? { ...decision, standsOn: signed.standsOn } : decision).bytes === enc(signed).bytes);
        if (d.references.replyRun) {
          const reply = one('run-opening', r => r.opening.id === acceptanceFact.id);
          remember('replyOpeningFact', reply); expected.replyRun = record(reply).id;
          if (d.references.pairFact) {
            const pair = remember('pairFact', one('transport-RunPairAdmission', r => r.reply === expected.replyRun));
            check(pair.provider === q.run && pair.acceptance === acceptanceFact.id && pair.opening === reply.id
              && pair.operation === response.operation && pair.answerDigest === acceptance.answerDigest);
            remember('replyGroundingFact', one('session-grounding', r => r.run === expected.replyRun));
          }
          if (d.references.replyMessageFact) {
            const message = remember('replyMessageFact', one('effect-OutboundMessage', r => r.run === expected.replyRun));
            const request = remember('replyRequestFact', one('effect-EffectRequest', r => r.run === expected.replyRun));
            check(request.message === message.id && request.digest === enc(message).hash && request.semanticMessage === message.semanticMessage
              && request.pending === acceptanceFact.id && message.sourceResult === acceptanceFact.id);
            check(message.text === acceptedReplyPreviewText(facts, expected.replyRun));
            check(message.account === `telegram:v1:bot:${configuration.botId}`
              && message.conversation === telegramConversation(configuration.botId, { chatId: configuration.chatId, forum: configuration.forum, messageThreadId: configuration.messageThreadId }));
            if (requireResponse) {
              const observationFact = one('effect-OperationObservation', r => r.request === request.id && r.stage === 'response');
              const observation = remember('replyObservationFact', observationFact);
              const claim = one('transport-AdmissionReservation', r => r.operation === observation.operation && r.state === 'dispatch-claimed');
              const consumed = one('transport-AdmissionReservation', r => r.operation === observation.operation && r.state === 'consumed');
              check(observation.claim === claim.id && observation.digest === request.digest
                && observation.account === message.account && observation.conversation === message.conversation);
              for (const fact of [claim, consumed]) { const r = record(fact);
                check(r.request === request.id && r.run === message.run && r.digest === request.digest && r.semanticMessage === message.semanticMessage); }
              check(acceptedTelegram({ captures: { read: cap => base.success(readCapture(cap)) } }, observation, message,
                { chatId: configuration.chatId, messageThreadId: configuration.messageThreadId }));
              if (d.phase === 'api-accepted') check(turn.phase === 'api-accepted'
                && turn.replyOperation === observation.operation && turn.replyObservation === observation.id);
            }
          }
        }
      }
    }
  }
  for (const [role, id] of Object.entries(d.references)) check(expected[role] === id);
  if (requireResponse) check(expected.replyObservationFact);
  return { facts, readCapture, one, check, observation: expected.replyObservationFact && record(facts.find(f => f.id === expected.replyObservationFact)),
    observationFact: expected.replyObservationFact };
}

export function stage2HistoricalStatus(root, outer, configuration) {
  const d = validateStage2State(JSON.parse(readFileSync(join(root, 'preview-stage2-state.json'), 'utf8')), outer, root);
  if (existsSync(join(root, '.preview-stage2/facts.json'))) reconcileStage2History(join(root, '.preview-stage2'), d, outer, configuration, d.phase === 'api-accepted', !d.terminalLatch);
  else if (Object.keys(d.references).length) throw Error('preview: historical owner facts absent');
  return d;
}

function acceptedTelegram(f, observation, message, target) {
  if (observation.stage !== 'response') return false;
  try {
    const bytes = value(f.captures.read(observation.capture));
    const response = JSON.parse(bytes), result = response.result;
    return response.ok === true && Number.isSafeInteger(result?.message_id) && result.message_id > 0
      && String(result.chat?.id) === target.chatId && typeof result.text === 'string'
      && result.text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;') === message.text
      && (target.messageThreadId === null || result.message_thread_id === target.messageThreadId);
  } catch { return false; }
}

/** Sole continuation class: complete terminal prose, assessed but never accepted.
 * Uses only signed historical frames and exact capture bytes, never live owners. */
export function validateRefusedStage2Predecessor(root, outer, configuration) {
  const d = validateStage2State(JSON.parse(readFileSync(join(root, 'preview-stage2-state.json'), 'utf8')), outer, configuration.root);
  const { facts, readCapture, one, check } = reconcileStage2History(join(root, '.preview-stage2'), d, outer, configuration);
  check(d.phase === 'held' && d.hold?.code === 'REFUSED' && d.terminalLatch && d.modelAttemptUsed === 1);
  for (const role of ['requestFact', 'preparedFact', 'providerRequest', 'submittedCapture', 'providerRun', 'responseFact', 'receipt']) check(d.references[role]);
  const q = record(one('judgment-provider-ProviderJudgmentRequest'));
  const response = record(one('judgment-provider-ProviderJudgmentAttemptRecord', r => r.phase === 'response-observed'));
  check(response.request === q.id && response.operation);
  const receipt = JSON.parse(readCapture(response.receipt)), evidence = receipt.responseEvidence;
  check(receipt.state === 'complete' && receipt.usage.charge === null && evidence?.eligibility === 'admitted');
  const subject = stage2ResponseSubject({ all: () => facts, captures: { read: cap => ({ kind: 'Success', value: readCapture(cap) }) } });
  const inspect = v => {
    if (!v || typeof v !== 'object') return;
    if (v.name === 'FactEnvelope' && v.contentHash) check(enc(ownerReference(facts.find(f => f.id === v.id))).bytes === enc(v).bytes);
    if (v.reference?.startsWith('judgment-capture:') && v.hash) readCapture(v);
    Object.values(v).forEach(inspect);
  };
  inspect(subject); inspect(receipt); facts.forEach(f => inspect(f.body));
  const answer = readCapture(evidence.answer.source), base64 = readCapture(evidence.terminal.raw);
  const raw = Buffer.from(base64, 'base64');
  check(raw.toString('base64') === base64 && raw.length <= 65536);
  const terminal = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw));
  check(`sha256:${createHash('sha256').update(raw).digest('hex')}` === evidence.terminal.rawDigest);
  check(terminal.type === 'result' && terminal.subtype === 'success' && terminal.is_error === false
    && terminal.structured_output === undefined && terminal.result === answer && answer.trim().length > 0
    && Buffer.byteLength(answer) <= 16384 && receipt.bytes === answer && hashBytes(answer) === evidence.answer.answerDigest
    && terminal.session_id === receipt.providerOperation && evidence.source.call === terminal.session_id
    && Number.isSafeInteger(terminal.usage?.input_tokens) && terminal.usage.input_tokens >= 0
    && Number.isSafeInteger(terminal.usage?.output_tokens) && terminal.usage.output_tokens >= 0 && terminal.usage.output_tokens <= 2048);
  let isJson = true; try { JSON.parse(answer); } catch { isJson = false; } check(!isJson);
  check(evidence.answer.extractionContract === 'claude-code-json-result:1'
    && evidence.contract.parserReference === 'claude-code-json-result' && evidence.contract.parserVersion === '1'
    && evidence.terminal.reason === 'successful-final-reply' && evidence.terminal.providerReason === 'success');
  for (const field of ['limited', 'errored', 'cancelled', 'timedOut', 'truncated', 'toolCall']) check(evidence.terminal[field] === false);
  for (const [key, expected] of Object.entries({ request: d.references.requestFact, attempt: q.attempt,
    operation: response.operation, claim: response.claim, submittedDigest: q.inputDigest, provider: q.provider, model: q.model, route: q.route }))
    check(evidence.source[key] === expected);
  const vf = one('verification-VerificationRequest', r => r.operation === response.operation), vr = record(vf);
  const af = one('verification-VerificationAssessment', r => r.request === vr.id), a = record(af);
  for (const r of [vr, a]) check(r.operation === response.operation && r.operationDigest === q.inputDigest
    && r.attempt === q.attempt && enc(r.subject).bytes === enc(subject).bytes);
  check(af.predecessors.required.includes(vf.id));
  for (const [predicate, verdict] of [['response-authenticity', 'satisfied'], ['response-completeness', 'insufficient']])
    check(a.predicates.filter(p => p.predicate === predicate && p.verdict === verdict).length === 1);
  const sf = one('effect-provider-ProviderEffectSettlement', r => r.operation === response.operation), settlement = record(sf);
  const cf = one('transport-SettlementApplication', r => r.operation === response.operation), accounting = record(cf);
  check(settlement.acceptance === af.id && sf.predecessors.required.includes(af.id)
    && settlement.finalCharge === 'unknown' && settlement.delayedExecutionExcluded === false
    && settlement.retainedExposure === 0 && settlement.retryEligible === false
    && accounting.settlement === settlement.id && accounting.settlementFact === sf.id && accounting.settlementHash === sf.contentHash
    && cf.predecessors.required.includes(sf.id) && accounting.actualCharge === -1 && accounting.unresolved === 1
    && accounting.released === 0 && accounting.retryEligible === 0 && accounting.exposure === 0);
  for (const r of [settlement, accounting]) check(r.request === q.effectRequest && r.digest === q.inputDigest
    && r.claim === response.claim && r.reservation === response.reservation);
  check(facts.filter(f => f.kind === 'run-opening').length === 1);
  for (const f of facts) {
    check(!['judgment-provider-ProviderAnswerAcceptance', 'transport-RunPairAdmission', 'effect-OutboundMessage',
      'effect-EffectRequest', 'effect-OperationObservation'].includes(f.kind));
    if (f.kind === 'transport-AdmissionReservation') check(record(f).run === q.run);
  }
  return { failedTurn: d.selectedTurn, operation: response.operation, receiptDigest: response.receipt.hash,
    answerDigest: evidence.answer.answerDigest, rawDigest: evidence.terminal.rawDigest,
    rawCaptureDigest: evidence.terminal.raw.hash, submittedDigest: q.submitted.hash,
    oldActivationDigest: d.activationDigest, oldPolicyDigest: d.policyDigest,
    oldActivationReference: evidence.contract.evidenceContractReference,
    unresolvedObligation: { store: join(configuration.root, '.preview-stage2/facts.json'),
      assessment: ownerReference(af), settlement: ownerReference(sf), accounting: ownerReference(cf),
      charge: 'UNKNOWN', quiescence: 'UNKNOWN', actualCharge: -1, unresolved: 1, released: 0, retryEligible: 0, exposure: 0 } };
}
