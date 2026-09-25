// @ts-nocheck -- R5 offline grounding fixture over the real Five/Ten/Eight/Six live-input owners.
// Test-only authority: the v2 briefing schema, the approval and the audience below are
// SYNTHETIC offline stand-ins for R4's real package/operator acceptance. Nothing here
// is installed evidence.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { canonical } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createProductionGroundingReader } from '../../src/assembly/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { buildGroundingBriefingBody, createProductionContextSampler, groundingPendingState, groundingRunDirectives,
  renderGroundedContext } from '../../src/assembly/production-context-sampler.js';
import { createLiveInputAssemblyFixture, ref, value, json } from './live-input-owner-fixture.js';

export const SYNTHETIC_APPROVAL = 'approval:r5-offline-synthetic';
export const INSTALLATION = 'installation:r5-offline';
export const ROUTE = 'route';
const root = new URL('../../', import.meta.url);
const text = (maxLength: number) => ({ kind: 'text', maxLength });

/** Exact excerpt of preserved source bytes: path + revision, whole-source bytes in
 * Two capture custody, and a byte-range selector. Defaults to the approved document
 * at its git blob revision; `bytes`/`revision` label a synthetic offline source. */
export function documentExcerpt(f, path: string, from: string, through: string,
  bytes = readFileSync(new URL(path, root), 'utf8'),
  revision = execFileSync('git', ['rev-parse', `HEAD:${path}`], { cwd: root, encoding: 'utf8' }).trim()) {
  const start = bytes.indexOf(from), end = bytes.indexOf(through, start) + through.length;
  if (start < 0 || end < start + through.length) throw Error(`excerpt anchors absent in ${path}`);
  const content = bytes.slice(start, end);
  const capture = value(f.owners.host.capture(bytes));
  const byteStart = Buffer.byteLength(bytes.slice(0, start));
  return { content, source: { path, revision, capture: capture.reference, hash: capture.hash,
    selector: `utf8-bytes:${byteStart}-${byteStart + Buffer.byteLength(content)}`, facts: [] } };
}

export const PURPOSE = ['docs/00-the-purpose.md', '> **Make the world', '> **Make coherence something an AI cannot lose.**'] as const;
export const CONTRACT = ['docs/14-the-assembly/16-the-fixed-single-machine-installation-contract.md',
  '**Status: draft, awaiting operator approval.**', 'observation host.'] as const;

export function groundingFixture(options: { storage?: any; purpose?: (f: any) => any; audience?: string[] } = {}) {
  const f = createLiveInputAssemblyFixture(options.storage, { minimal: true });
  const p = f.groundingFor({ scope: 'scope:minimal' });
  // Test-only registration of the granted { class, content } briefing body. No src
  // owner registers this kind; R4's package must bind the real schema. `content` is
  // optional only so the fixture's pre-existing class-only rows stay decodable.
  Object.assign(f.ctx, { schemas: f.ctx.schemas.map(schema => schema.kind === 'rungraph-briefing-material'
    ? { ...schema, fields: { class: text(2048), content: text(65536) }, optional: ['content'] } : schema) });
  const at = () => f.deps.clock().value;
  const item = (id, kind, extra) => ({ id, kind, scope: INSTALLATION, audience: options.audience ?? ['bob', ROUTE],
    standing: { approval: SYNTHETIC_APPROVAL, version: 'r5-offline-v1', synthetic: true },
    observedAt: at(), effectiveAt: at(), ...extra,
    selectedHash: hashBytes(extra.content) });
  const derived = (facts: string[]) => ({ path: '', revision: '', capture: '', hash: '', selector: '', facts });
  const purpose = options.purpose ? options.purpose(f) : documentExcerpt(f, ...PURPOSE);
  const contract = documentExcerpt(f, ...CONTRACT);
  // Status carries Five's CURRENT pending work (each pending step, UNKNOWN disposition);
  // the sampler recomputes it from the Run view and refuses a stale body.
  const statusContent = (pending = []) => value(canonical({ installation: INSTALLATION, generation: f.run.generation.id,
    pending: groundingPendingState(pending), scope: 'reply-only', durability: 'local-durable',
    held: ['production-context-sampling', 'conversation-driver', 'activation-probe-evidence'],
    notObserved: ['live-telegram-delivery'], evidenceTier: 'synthetic-offline' })).bytes;
  const status = (pending = []) => item(`status:${pending.length}:${at()}`, 'installation-status', { content: statusContent(pending),
    source: derived([f.launchFact.id, f.effects.leaseFact.id]) });
  // Five's own Run directives (none for this Run), recomputed by the sampler.
  const runDirectives = item('directive:run', 'directive', { content: groundingRunDirectives(f.run.directives), source: derived([f.opening.id]) });
  const corpus = {
    identity: [item('purpose:1', 'purpose', purpose)],
    rules: [item('contract:1', 'contract', contract)],
    directives: [runDirectives],
    'pending-work': [status()],
  };
  const kinds = { identity: ['purpose'], rules: ['contract'], directives: ['directive'], 'pending-work': ['installation-status'] };
  const appendBody = (className: string, items = corpus[className]) => {
    const body = value(buildGroundingBriefingBody(className, items, p.context));
    return f.append('rungraph-briefing-material', json(body)).fact;
  };
  const bodies = Object.fromEntries(f.deps.groundingPolicy.briefingClasses.map(c => [c, appendBody(c)]));
  const captures = { read: (reference: string) => {
    const capture = f.ctx.captures[reference];
    return capture?.status === 'available' ? capture.bytes : null;
  } };
  let turn = 1;
  const plan: any = { run: f.id, opening: f.opening.id, step: 'step:operation:1', installation: INSTALLATION,
    generation: f.run.generation.id, audience: { principal: 'bob', route: ROUTE }, launch: f.launchFact.id,
    executionContext: f.effects.leaseFact.id, stimulusKinds: ['stimulus', 'next-inbound'], frontier: [f.opening.id],
    briefing: f.deps.groundingPolicy.briefingClasses.map(c => ({ class: c, fact: bodies[c].id, digest: bodies[c].contentHash, kinds: kinds[c] })),
    approvals: [SYNTHETIC_APPROVAL], threshold: f.deps.groundingPolicy.threshold, statusMaxAge: 1000,
    previousActivity: f.deps.clock() };
  const events: string[] = [];
  const sample = createProductionContextSampler({ store: f.store, runtime: p.runtime, context: p.context, captures,
    plan: () => { events.push('plan'); return plan; },
    admitDelivery: ({ capture }) => {
      const admitted = f.effects.prepare(JSON.parse(captures.read(capture.reference)));
      return { operation: admitted.operation, claim: admitted.claim };
    } });
  const reader = createProductionGroundingReader({ scope: 'scope:minimal', runtime: p.runtime, harness: p.harness,
    context: p.context, clock: p.clock, sample });
  const graph = value(createRunGraph({ ...p.graphDependencies, store: p.spine.store, assemblyHistory: p.history, grounding: reader }));
  /** The exact delivery + consumption facts of the most recent grounded read. */
  const delivered = () => {
    const rows = value(p.runtime.inspectCurrent());
    const delivery = rows.filter(r => r.record.type === 'ContextDeliverySpecification').at(-1);
    const consumption = rows.filter(r => r.record.type === 'HarnessObservation' && r.record.contextDelivery === delivery?.fact.id
      && r.record.phase === 'context-consumed').at(-1);
    return { delivery: delivery.fact, specification: delivery.record, consumption: consumption.fact };
  };
  const bindings = (step = plan.step) => {
    const d = delivered();
    return { run: f.id, step, delivery: d.delivery.id, consumption: d.consumption.id,
      installation: INSTALLATION, generation: f.run.generation.id };
  };
  const groundedInput = (overrides = {}) => ({ store: f.store, context: p.context, captures, bindings: bindings(),
    plan: () => plan, clock: () => f.deps.clock(), ...overrides });
  const render = (overrides = {}) => renderGroundedContext(groundedInput(overrides));
  /** Replace one class's approved body (a new appended fact) in the plan. */
  const rebind = (className: string, items) => {
    corpus[className] = items; const body = appendBody(className, items); bodies[className] = body;
    plan.briefing = plan.briefing.map(slot => slot.class === className ? { ...slot, fact: body.id, digest: body.contentHash } : slot);
    return body;
  };
  /** Re-derive the status body from Five's current Run view (pending steps). */
  const refreshStatus = () => rebind('pending-work', [status(value(graph.read(f.id)).pending)]);
  /** Admit a distinct next operator input and advance the explicit frontier. A
   * `constraint` substring of the input becomes a directive item: the exact bytes of
   * that admitted input's capture, selected by byte range. */
  const nextInput = (label: string, constraint?: string) => {
    const message = f.effects.message(f.id, label), bytes = value(canonical(message)).bytes;
    const capture = value(f.owners.host.capture(bytes));
    const fact = f.append('next-inbound', json({ capture })).fact;
    plan.frontier = [...plan.frontier, fact.id];
    plan.step = `step:operation:${++turn}`;
    if (constraint) {
      const start = Buffer.byteLength(bytes.slice(0, bytes.indexOf(constraint)));
      if (bytes.indexOf(constraint) < 0) throw Error('constraint is not in the admitted input bytes');
      rebind('directives', [...corpus.directives, item(`directive:${fact.id}`, 'directive', { content: constraint,
        source: { path: '', revision: '', capture: capture.reference, hash: capture.hash,
          selector: `utf8-bytes:${start}-${start + Buffer.byteLength(constraint)}`, facts: [fact.id] } })]);
    }
    refreshStatus();
    return fact;
  };
  return { ...f, p, plan, bodies, corpus, appendBody, captures, sample, reader, graph, delivered, bindings, render,
    groundedInput, rebind, refreshStatus, status, nextInput, events, ref };
}

import { createHash } from 'node:crypto';
import { decode } from '../../src/index.js';
import { installOperationDefinition, createEffectSpine, providerEffectMigrations, providerEffectSchemas,
  registerProviderEffectBodies } from '../../src/effects/index.js';
import { registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import { createProductionProviderOwners } from '../../src/assembly/production-provider-owners.js';
import { registerProviderResponseEvidenceBounds } from '../../src/assembly/provider-invocation.js';
import { verificationInput } from '../verification/fixture.js';
import { createProviderJudgmentPort, providerJudgmentSchemas, registerProviderJudgmentBodies } from '../../src/judgment/index.js';
import { groundedSubmission } from '../../src/assembly/production-context-sampler.js';
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
import { privateKey } from '../facts/fixtures.js';

export const SETTINGS = { automaticRetries: 0, maxTokens: 128 }, OUTPUT_SCHEMA = { type: 'Decision' };

/** Real Seven over the same store with file-backed judgment captures. The route
 * description is a recorded offline provider; `maxInputBytes` is the bound under test. */
export function withSeven(f: ReturnType<typeof groundingFixture>, directory: string, maxInputBytes: number) {
  const context = f.ctx, dc = context.decode;
  if (!dc.register.entries.includes('provider-call')) dc.register.entries.push('provider-call');
  const boundary = { ...f.c, register: dc.register };
  // `budget` mirrors the real Six transport host (live-input-owner-fixture.ts, 1000); Seven's
  // answer acceptance compares retained exposure against it.
  const th = { ...f.owners.host, domain: 'conversation:1', authorityIncarnation: 'authority:1', budget: 1000,
    monotonic: () => f.deps.clock().value, current: () => ({ ...f.owners.host.current(), generation: f.run.generation }) };
  const host = { transport: th, point: 'judgment', floor: f.floor,
    description: { owner: 'part-ten', provider: 'test-provider', model: 'model', route: ROUTE, automaticRetries: 0,
      maxInputBytes, maxOutputBytes: 4096, maxCharge: 20, measured: false, basis: 'recorded offline HTTP provider (synthetic)' },
    refreshFacts: () => f.success(undefined) };
  Object.assign(context, { schemas: [...context.schemas, ...providerJudgmentSchemas(host)],
    ownedBodies: [...context.ownedBodies, ...value(registerProviderJudgmentBodies(host, boundary))] });
  const captures = createJudgmentCaptures(directory, context.captures, fn => f.success(fn()), 1048576, dc.captures);
  f.owners.host.capture = bytes => captures.put(bytes, 262144);
  for (const [reference, bytes] of Object.entries(dc.captures)) if (!context.captures[reference]) context.captures[reference] =
    { bytes, hash: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), byteLength: Buffer.byteLength(bytes), status: 'available' };
  const judgment = { host, boundary, authority: f.effects.transport, captures, store: f.store, context, privateKey,
    runs: f.graph, settings: SETTINGS, outputSchema: OUTPUT_SCHEMA, maxTokens: 128, maxCaptureBytes: 1048576, timeout: 100,
    disclosure: 'recorded provider' };
  const seven = createProviderJudgmentPort(judgment);
  const submission = (question: string, rendered: string, evidence: string[] = []) => groundedSubmission({ provider: host.description.provider,
    model: host.description.model, route: ROUTE, question, context: rendered, settings: SETTINGS, outputSchema: OUTPUT_SCHEMA,
    floor: f.floor, evidence, point: 'judgment', generation: f.run.generation.id });
  /** Put the grounded turn's pending step into Five with the exact submission digest, then prepare it in Seven. */
  const prepareTurn = (ready, ground, key: string, question: string, rendered: string, evidence: string[] = []) => {
    const transition = f.start(ready, ground, key), digest = submission(question, rendered, evidence).digest;
    value(f.graph.transition({ ...transition, step: { ...transition.step, operation: { ...transition.step.operation, digest } } }));
    const prepared = seven.prepare({ id: `r5-question:${key}`, run: { owner: 'part-five', name: 'Run', id: f.id },
      step: `step:${key}`, ordinal: 0, semanticMessage: key, question, context: rendered, evidence, deadline: 400 }, f.effects.fence);
    return prepared;
  };
  return { seven, host, captures, judgment, submission, prepareTurn };
}


export const TURN_ONE_REDUCED_CONTEXT = 'R5 turn-one reduced context: the grounded packet is held at the current 4,096-byte provider bound.';
const tick = () => new Promise(resolve => setTimeout(resolve, 1));
const factRef = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id, kind: fact.kind,
  schemaVersion: fact.schemaVersion, contentHash: fact.contentHash });
const rec = fact => fact.body.record;
const RESPONSE_CONTRACT = { parserReference: 'claude-code-json-result', parserVersion: '1',
  evidenceContractReference: 'r5-response-contract', evidenceContractVersion: '1', mode: 'single-final-reply' };
const RESPONSE_BOUNDS = { ...RESPONSE_CONTRACT, maxMetadataBytes: 5000, maxRawTerminalBytes: 2048, maxCaptureBytes: 65000 };

/**
 * Drive ONE genuine offline Seven ProviderAnswerAcceptance for turn one through the real owner chain:
 * Seven prepare -> Eight provider prepare/dispatch (createProductionProviderOwners) -> Nine output-use
 * response assessment -> Eight settle -> Six settle -> Seven recordProviderAnswerAcceptance.
 * The model is an in-process stand-in: `invoke` returns a canned complete Decision answer with a
 * responseEvidenceDraft. No network. Requires `withSeven(f, dir, 4096)` (Eight caps provider calls at
 * 4,096 bytes, so turn one is prepared with a small context, not the grounded packet).
 */
export async function acceptTurnOne(f, s, options: { ready: any; ground: any; question: string; context?: string;
  evidence?: string[]; answer?: string } ) {
  const context = options.context ?? TURN_ONE_REDUCED_CONTEXT;
  const questionEvidence = options.evidence ?? f.evidence.map(e => e.id).slice(0, 2);
  const answer = options.answer ?? JSON.stringify(f.decisionInput());
  const dc = f.ctx.decode, ctx = f.ctx, all = () => value(f.store.read());
  const th = s.host.transport;

  // 1. Five step + Seven prepare with the reduced context.
  const prepared = value(s.prepareTurn(options.ready, options.ground, 'operation:1', options.question, context, questionEvidence));

  // 2. Register Eight provider-effect and Nine verification schemas over the same store.
  const vh = { machine: f.host.machine, principal: f.host.principal, scope: f.host.scope, boundary: s.judgment.boundary,
    current: () => ({ decode: dc, clock: f.deps.clock(), stopped: false, generation: f.run.generation.id,
      facts: { ...ctx, facts: all() }, evidence: f.evidence }) };
  Object.assign(ctx, { migrations: providerEffectMigrations,
    schemas: [...ctx.schemas.filter(schema => schema.kind !== 'verification-ProbeRecord'),
      ...providerEffectSchemas(f.owners.host), ...verificationSchemas(vh)],
    ownedBodies: [...ctx.ownedBodies, ...value(registerProviderEffectBodies(f.owners.host)), ...value(registerVerificationBodies(vh))] });
  await tick();

  const evidenceOf = (id, subject, predicate, claimValue, strength = 'proof', captureBytes?) => {
    const capture = value(f.owners.host.capture(captureBytes ?? value(canonical({ id, subject, predicate })).bytes));
    const e = value(decode('Evidence', f.evidenceInput({ id, capture,
      claim: { subject, predicate, value: claimValue }, source: 'probe', observedAt: f.deps.clock(), freshFor: 1000, strength }), dc));
    f.evidence.push(e); f.append('evidence-record', json({ evidence: e }));
    return e;
  };

  // 3. Settle the earlier native context delivery through the fixture's existing Eight/Six
  // path (the same settle its next-input admission performs), keeping the live-input
  // executor the native harness driver already holds.
  const legacy = verificationInput('VerificationPlan');
  for (const row of value(f.effects.transport.inspect()).filter(r => r.record.type === 'AdmissionReservation' && r.record.state === 'consumed'))
    if (!value(f.effects.transport.inspect()).some(r => r.record.type === 'SettlementApplication' && r.record.operation === row.record.operation))
      value(f.effects.transport.settle(f.effects.fence, value(f.effects.api.settle(row.record.operation))));
  await tick();

  // 4. Install the provider-call OperationDefinition at Eight's current owner cap (4,096 bytes).
  const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'r5-provider-definition', feature: 'provider-call',
    version: 'r5-provider-version', generation: f.run.generation.id, adapter: ROUTE, account: 'test-provider',
    conversation: 'recorded provider', speaker: f.bob.id, scopeDigest: value(canonical(f.scope)).hash, durability: 'local-durable',
    replicas: 0, lossModel: 'Recorded local bytes, no remote durability claim.', maxBytes: 4096, maxCharge: 20, timeout: 100,
    verificationBar: 'provider-bar' };
  const approval = f.authorize({ id: 'r5-provider-approval', artifact: f.capture(value(canonical(definition)).bytes), base: 'r5-base' });
  const current = f.owners.host.current;
  f.owners.host.current = () => ({ ...current(), versions: [...current().versions, { id: definition.version, subject: definition.feature,
    content: json(definition), contentHash: value(canonical(definition)).hash, since: f.opening.id, supersedes: [],
    approvedIn: approval, base: approval.base, landedIn: null }] });
  value(installOperationDefinition(definition, f.owners.host, createEffectSpine(f.owners.host, { context: ctx, privateKey }, f.store)));

  // 5. Response-contract evidence the stand-in's responseEvidenceDraft cites.
  const sourceBasis = { version: '1', parserReference: RESPONSE_CONTRACT.parserReference, parserVersion: '1',
    endpoint: 'in-process-stand-in', account: 'local-account', credentialReference: 'no-credential',
    controller: 'confined-custodian', executableArtifact: `sha256:${'1'.repeat(64)}`,
    provider: 'test-provider', model: 'model', route: ROUTE };
  const terminalBasis = { version: '1', parserReference: RESPONSE_CONTRACT.parserReference, parserVersion: '1',
    terminalReasonField: 'stop_reason', successfulFinalReplyReasons: ['end_turn'] };
  const sourceEvidence = evidenceOf('r5-response-source-contract', RESPONSE_CONTRACT.evidenceContractReference,
    'provider-response-source-contract', sourceBasis).id;
  const terminalEvidence = evidenceOf('r5-response-terminal-contract', RESPONSE_CONTRACT.evidenceContractReference,
    'provider-response-terminal-contract', terminalBasis).id;

  // 6. In-process model stand-in (no network).
  const received: string[] = [];
  const route = Object.freeze({ provider: 'test-provider', model: 'model', route: ROUTE, disclosure: 'recorded provider',
    automaticRetries: 0, environment: 'local-test', invoke: async (bytes, bounds) => {
      received.push(bytes);
      const frame = JSON.stringify({ type: 'result', is_error: false, result: answer, session_id: 'r5-call:one',
        stop_reason: 'end_turn', usage: { input_tokens: 2, output_tokens: 3 } });
      const rawBytes = Buffer.from(frame);
      const responseEvidenceDraft = { eligibility: 'admitted', contract: RESPONSE_BOUNDS,
        basis: { sourceEvidence: [sourceEvidence], terminalEvidence, terminalReasonField: 'stop_reason',
          successfulFinalReplyReasons: ['end_turn'] },
        source: { controller: 'confined-custodian', evidence: [sourceEvidence], endpoint: 'in-process-stand-in',
          account: 'local-account', credentialReference: 'no-credential', executableArtifact: `sha256:${'1'.repeat(64)}`,
          provider: 'test-provider', model: 'model', route: ROUTE, call: 'r5-call:one',
          submittedDigest: value(canonical(bytes)).hash, strength: 'observation' },
        terminal: { rawBase64: rawBytes.toString('base64'),
          rawDigest: `sha256:${createHash('sha256').update(rawBytes).digest('hex')}`, evidence: terminalEvidence,
          reason: 'successful-final-reply', providerReason: 'end_turn', limited: false, errored: false,
          cancelled: false, timedOut: false, truncated: false, toolCall: false },
        answer: { extractionContract: `${RESPONSE_CONTRACT.parserReference}:1`, answerDigest: hashBytes(answer) } };
      return { state: 'complete', bytes: answer, providerOperation: bounds.operation,
        usage: { inputTokens: 2, outputTokens: 3, charge: 3, source: 'in-process stand-in' },
        retryBlocked: false, responseEvidenceDraft };
    } });
  registerProviderResponseEvidenceBounds(route, RESPONSE_BOUNDS);
  const plan = 'r5-response-plan';
  const owners = value(createProductionProviderOwners({ judgment: s.judgment, verification: vh, route,
    effect: { host: f.owners.host, durability: f.effects.composition.durability, custody: f.effects.composition.custody, plan } }));
  const obligation = all().find(row => row.kind === 'transport-LoopRecord').id;
  await tick();

  // 7. Eight prepare + dispatch through the confined invocation.
  const request = value(owners.eight.prepare({ prepared, definition: definition.id, verificationOwner: 'independent-probe',
    resultDestination: f.opening.id, obligation }, f.effects.fence));
  const observed = value(await owners.eight.dispatch(request, f.effects.fence));
  await tick();
  for (const predicate of ['operation-occurred', 'charge-settled', 'old-executor-quiescent'])
    evidenceOf(`r5-provider-proof:${predicate}`, observed.operation, predicate,
      { digest: request.digest, ...(predicate === 'charge-settled' ? { amount: 3 } : {}) });

  // 8. Build the ProviderResponseSubject from the owners' own facts.
  const facts = all();
  const one = (kind, predicate) => {
    const found = facts.filter(fact => fact.kind === kind && predicate(rec(fact)));
    if (found.length !== 1) throw Error(`acceptTurnOne: ${kind} join differs (${found.length})`);
    return found[0];
  };
  const requestFact = facts.find(fact => fact.id === request.payload.request.id);
  const preparedFact = facts.find(fact => fact.id === request.payload.prepared.id);
  const q = rec(requestFact);
  const responseFact = one('judgment-provider-ProviderJudgmentAttemptRecord', r => r.request === q.id && r.phase === 'response-observed');
  const receipt = JSON.parse(value(s.captures.read(rec(responseFact).receipt)));
  if (receipt.state !== 'complete' || !receipt.responseEvidence) throw Error(`acceptTurnOne: response unavailable ${JSON.stringify(receipt)}`);
  const envelope = receipt.responseEvidence;
  const subject = {
    seven: { request: factRef(requestFact), prepared: factRef(preparedFact), attempt: request.attempt, response: factRef(responseFact) },
    eight: { request: factRef(one('effect-provider-ProviderEffectRequest', r => r.id === request.id)),
      executorObservation: factRef(one('effect-provider-ProviderOperationObservation', r => r.operation === observed.operation && r.stage === 'executor-accepted')),
      responseObservation: factRef(one('effect-provider-ProviderOperationObservation', r => r.operation === observed.operation && r.stage === 'response')) },
    six: { operation: observed.operation,
      consumedReservation: factRef(one('transport-AdmissionReservation', r => r.operation === observed.operation && r.state === 'consumed')),
      dispatchClaim: factRef(one('transport-AdmissionReservation', r => r.operation === observed.operation && r.state === 'dispatch-claimed')) },
    submitted: { capture: request.payload.submitted, operationDigest: request.digest },
    route: { provider: request.payload.provider, model: request.payload.model, route: request.payload.route,
      routeBasis: String(q.routeBasis), floorDigest: String(q.floorDigest), evidence: q.evidence,
      evidenceDigest: value(canonical(q.evidence)).hash, settingsDigest: request.payload.settingsDigest,
      outputSchemaDigest: request.payload.outputSchemaDigest },
    response: { capture: envelope.answer.source, answerDigest: envelope.answer.answerDigest,
      parserReference: envelope.contract.parserReference, parserVersion: envelope.contract.parserVersion,
      evidenceContractReference: envelope.contract.evidenceContractReference,
      evidenceContractVersion: envelope.contract.evidenceContractVersion },
    terminal: { evidence: envelope.terminal.evidence, capture: envelope.terminal.raw,
      rawDigest: envelope.terminal.rawDigest, sourceEvidence: envelope.source.evidence },
  };

  // 9. Nine output-use VerificationPlan v2 bound to this exact subject, then assess/settle/accept.
  value(owners.nine.record('VerificationPlan', { ...legacy, type: 'VerificationPlan', schemaVersion: 2,
    purpose: 'output-use', id: plan, subject: { ...legacy.subject,
      scope: f.scope.kind === 'organization' ? 'project-a' : f.scope.members[0], generation: f.run.generation.id },
    bar: { ...legacy.bar, version: request.verificationBar,
      predicates: ['occurrence', 'non-occurrence', 'quiescence', 'charge', 'response-authenticity', 'response-completeness'],
      sources: ['probe'], minimumStrength: 'proof', subjectDigest: value(canonical(subject)).hash, captureRequired: true, freshness: 1000 },
    responseContract: RESPONSE_CONTRACT,
    responseRequirements: ['response-authenticity', 'response-completeness'].map(predicate => ({ predicate,
      sources: [th.principal.id], minimumStrength: 'observation', requiredContract: RESPONSE_CONTRACT.evidenceContractReference })) }));
  const assessment = value(owners.eight.assessResponse(observed.operation));
  const settlement = value(owners.eight.settle(observed.operation, assessment));
  const accounting = value(s.judgment.authority.settle(f.effects.fence, settlement));
  const settlementFact = all().find(fact => fact.kind === 'effect-provider-ProviderEffectSettlement' && rec(fact).id === settlement.id);
  const accountingFact = all().find(fact => fact.kind === 'transport-SettlementApplication'
    && rec(fact).settlement === settlement.id && rec(fact).operation === accounting.operation);
  const acceptance = value(owners.seven.recordProviderAnswerAcceptance({ subject, assessment,
    settlement: factRef(settlementFact), accounting: factRef(accountingFact) }, owners.responseAssessment, f.effects.fence));
  const acceptanceFact = all().find(fact => fact.id === acceptance.id);
  return { prepared, request, observed, subject, assessment, settlement, accounting, acceptance, acceptanceFact,
    settlementFact, answer, owners, definition, received, plan };
}

/** Turn one answered through the real owner chain (reduced context, see TURN_ONE_REDUCED_CONTEXT),
 * then turn two admitted and grounded through the real Ten reader and Five. Turn one's Five step
 * stays pending: Five admits no new step while a predecessor is pending, and settling this
 * output-use-assessed provider step through Five's observe is refused in this composition
 * (see the progress record), so turn two is delivered and rendered, not prepared in Seven. */
export async function acceptedSecondTurn(directory: string, question: string, questionOne: string) {
  const f = groundingFixture();
  f.deps.context.evidenceSources.settlement = f.bob.provenance.adapter;
  const s = withSeven(f, directory, 4096);
  for (const evidence of f.evidence) f.append('evidence-record', json({ evidence }));
  const ready = value(f.graph.open(f.run)), ground = value(f.graph.ground(f.id, 'w', 'native', 'start', f.lease));
  const accepted = await acceptTurnOne(f, s, { ready, ground, question: questionOne });
  f.nextInput(question);
  const ground2 = value(f.graph.ground(f.id, 'w', 'native', 'resume', f.lease));
  return { f, s, accepted, ground2, rendered: value(f.render()), bindings: f.bindings() };
}
