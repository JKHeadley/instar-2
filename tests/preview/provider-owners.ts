// @ts-nocheck -- preview composition; authority, admission and dispatch use public owner constructors.
// Rules 26, 41, 55, 115 and the purpose's durable-cause rule (D14 §3): the provider-owner composition
// for one model operation. Five's Run, Seven's provider judgment request (the exact submitted bytes
// captured), Eight's provider effect request and Six's charge exist before any call; Eight's dispatch
// claims and consumes in Six before it invokes the route. It is shared by the self-hosting harness (a
// live entry point) and by the retired stage-two runner, which re-exports it for its old roots.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { canonical, consumeResult, decode } from '../../src/index.js';
import type { Result, Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import type { FactContext, CapturedContent, GovernedVersion, FactEnvelope } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, registerTransportBodies, transportSchemas, decodeLoopPolicy } from '../../src/transport/index.js';
import type { TransportHost } from '../../src/transport/index.js';
import { providerJudgmentSchemas, registerProviderJudgmentBodies } from '../../src/judgment/index.js';
import type { JudgmentHost, JudgmentCapturePort } from '../../src/judgment/index.js';
import { providerEffectSchemas, providerEffectMigrations, registerProviderEffectBodies, effectSchemas, registerEffectBodies,
  createEffectSpine, installOperationDefinition, consumeEffectSettlement } from '../../src/effects/index.js';
import type { EffectHost, EffectSettlement, ProviderEffectDoorway } from '../../src/effects/index.js';
import { subscriptionPolicyFor } from '../../src/assembly/production-provider.js';
import { createProductionProviderOwners } from '../../src/assembly/production-provider-owners.js';
import { admitAcceptedProviderReply, createProductionRunAdmission } from '../../src/transport/index.js';
import { runIdFor } from '../../src/rungraph/index.js';
import { STAGE2_SETTINGS, STAGE2_OUTPUT_SCHEMA, STAGE2_DISCLOSURE, OWNER_WINDOW_MS, stage2Description, decisionContext, submittedEnvelope, requireInputBound } from './stage2-provider.js';
import { factsFixture } from '../facts/fixtures.js';
import { verificationSchemas, registerVerificationBodies } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { createRunGraph, recordWire, runFactSchemas } from '../../src/rungraph/index.js';
import type { RunGraphDependencies } from '../../src/rungraph/index.js';
import { governanceFixture } from '../rungraph/governance-fixture.js';
import { setup, ref } from '../rungraph/fixtures.js';
import { value, privateKey, json } from '../facts/fixtures.js';
// @ts-expect-error Physical file adapter is outside pure core.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
import { createEffectReplicaStorage } from '../../scripts/effect-replica-storage.mjs';
// @ts-expect-error Physical capture adapter is outside pure core.
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
export const enc = (v: unknown) => value(canonical(v));
export function createProviderOwners(options: any) {
  const base = setup(); base.grant({ id: 'provider-agent-grant', grantee: base.bob });
  const directory = options.directory;
  const now = () => options.ownerNow();
  const stopped = () => !options.active() || now() >= options.deadline;
  const generation = base.run.generation.id;
  // `framing` is optional: absent, the historical one-shot v2 framing and its 4096-byte bound are unchanged.
  const description = stage2Description(options.model, options.framing);
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
    maxBytes: description.maxInputBytes, maxCharge: 0, timeout: 120000, verificationBar: 'provider-bar' };
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
    requireInputBound(question.question, question.context, submitted, options.framing);
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

export const record = fact => fact.body.record;
export const ownerReference = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id,
  kind: fact.kind, schemaVersion: fact.schemaVersion, contentHash: fact.contentHash });

const bindingPredicate = 'preview-invocation-binding';
export const invocationBindings = (facts, q) => facts.filter(f => f.kind === 'evidence-record'
  && (f.body.evidence.id === `proof:${bindingPredicate}:${q.id}`
    || f.body.evidence.claim.predicate === bindingPredicate));
function invocationClaim(binding, requestFact, preparedFact) {
  if (!binding) throw Error('preview: invocation binding descriptor absent');
  const q = record(requestFact);
  return { schemaVersion: 1, ...binding, request: ownerReference(requestFact), prepared: ownerReference(preparedFact),
    effectRequest: q.effectRequest, run: q.run, attempt: q.attempt, submitted: q.submitted, submittedDigest: q.inputDigest };
}
export function strictInvocationCapture(directory, cap) {
  if (!/^sha256:[a-f0-9]{64}$/u.test(cap?.hash) || cap.reference !== `judgment-capture:${cap.hash}`)
    throw Error('preview: invocation capture reference differs');
  const bytes = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
    .decode(readFileSync(join(directory, 'captures', cap.hash.slice(7))));
  if (hashBytes(bytes) !== cap.hash) throw Error('preview: invocation capture hash differs');
  return bytes;
}
/** Called only with chain-verified facts and strict capture readers. */
export function verifyInvocationBinding(facts, readCapture, requestFact, preparedFact, expected) {
  const q = record(requestFact), found = invocationBindings(facts, q);
  const check = ok => { if (!ok) throw Error('preview: invocation binding differs'); };
  check(found.length === 1);
  const fact = found[0], wire = fact.body.evidence, captured = readCapture(wire.capture);
  const context = factsFixture().ctx.decode;
  const e = value(decode('Evidence', wire, { ...context, captures: { ...context.captures, [wire.capture.reference]: captured } }));
  const v = e.claim.value;
  // The recorded framing selects the exact policy and system prompt; the historical v2 framing when absent.
  const { policy, system } = subscriptionPolicyFor(q.model, v.framing ?? undefined);
  const binding = { activationReference: v.activationReference, activationDigest: v.activationDigest,
    profileDigest: v.profileDigest, invocationPolicyDigest: enc(policy).hash,
    systemPromptDigest: hashBytes(system), framing: policy.framing, invocationPolicy: policy };
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
  requireInputBound('', '', stdin, policy.framing);
  return binding;
}
