// @ts-nocheck -- R5 offline provider-dispatch boundary. NOT installed-bin or live usefulness
// certification: the provider is a local recorded HTTP stand-in, approvals are synthetic,
// and the answer is scripted. It proves wiring: the bytes the model adapter receives are
// Seven's capture, and that capture holds the delivered manifest's actual evidence.
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createEffectSpine, installOperationDefinition, providerEffectMigrations, providerEffectSchemas,
  registerProviderEffectBodies } from '../../src/effects/index.js';
import { createEffectAssessmentPort, createVerificationRuntime, createVerificationSpine, registerVerificationBodies,
  verificationSchemas } from '../../src/verification/index.js';
import { createProductionProviderOwners } from '../../src/assembly/production-provider-owners.js';
import { SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT, subscriptionInvocationPolicy } from '../../src/assembly/production-provider.js';
import { checkGroundingEnvelope, groundedSubmission, groundingEnvelopeHold, groundingEnvelopeMeasurements,
  reportGroundingEnvelopeHold, verifyGroundedSubmission } from '../../src/assembly/production-context-sampler.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { createAssemblySpine } from '../../src/assembly/records.js';
import { createProductionGroundingReader } from '../../src/assembly/index.js';
import { localProvider } from '../model-provider/http-provider.js';
import { verificationInput } from '../verification/fixture.js';
import { OUTPUT_SCHEMA, ROUTE, SETTINGS, acceptedSecondTurn, groundingFixture, withSeven } from '../assembly/production-context-sampler-fixture.js';
import { createProviderJudgmentPort } from '../../src/judgment/index.js';
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
import { json, privateKey, refused, value } from '../facts/fixtures.js';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const tick = () => new Promise(resolve => setTimeout(resolve, 1));
const QUESTION = 'What is Instar for, and what may this installation do?';
const preview = subscriptionInvocationPolicy('claude-offline-measure');
const previewBounds = { systemBytes: Buffer.byteLength(SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT, 'utf8'),
  maxPromptBytes: preview.maxPromptBytes, maxInputBytes: preview.maxInputBytes, maxOutputBytes: preview.maxOutputBytes,
  maxCaptureBytes: preview.maxCaptureBytes, maxDeliveryBytes: 4096, maxOutboundBytes: 4096 };
const PROPOSED = { ...previewBounds, maxInputBytes: 12288, maxPromptBytes: 12288 + previewBounds.systemBytes };

function grounded() {
  const f = groundingFixture(), directory = mkdtempSync(join(tmpdir(), 'r5-e2e-'));
  directories.push(directory);
  f.deps.context.evidenceSources.settlement = f.bob.provenance.adapter;
  const s = withSeven(f, directory, PROPOSED.maxInputBytes);
  for (const evidence of f.evidence) f.append('evidence-record', json({ evidence }));
  const ready = value(f.graph.open(f.run)), ground = value(f.graph.ground(f.id, 'w', 'native', 'start', f.lease));
  return { f, s, ready, ground, directory, rendered: value(f.render()), evidence: f.evidence.map(e => e.id).slice(0, 2) };
}

it('the real Eight provider doorway holds the grounded request at its current 4,096-byte operation bound before any provider IO', async () => {
  const { f, s, ready, ground, rendered, evidence } = grounded();
  const http = await localProvider();
  try {
    const submission = s.submission(QUESTION, rendered, evidence);
    value(checkGroundingEnvelope({ turn: 'step:operation:1', route: ROUTE, policy: 'r5-proposed', question: QUESTION,
      context: rendered, submitted: submission.bytes, retained: [f.opening.id], bounds: PROPOSED }, f.p.context));
    const prepared = value(s.prepareTurn(ready, ground, 'operation:1', QUESTION, rendered, evidence));
    const bindings = f.bindings(), submitted = value(s.captures.read(prepared.value.submitted));
    const dc = f.ctx.decode, context = f.ctx, all = () => value(f.store.read());
    const vh = { machine: f.host.machine, principal: f.host.principal, scope: f.host.scope, boundary: s.judgment.boundary,
      current: () => ({ decode: dc, clock: f.deps.clock(), stopped: false, generation: f.run.generation.id,
        facts: { ...context, facts: all() }, evidence: f.evidence }) };
    Object.assign(context, { migrations: providerEffectMigrations,
      schemas: [...context.schemas.filter(schema => schema.kind !== 'verification-ProbeRecord'),
        ...providerEffectSchemas(f.owners.host), ...verificationSchemas(vh)],
      ownedBodies: [...context.ownedBodies, ...value(registerProviderEffectBodies(f.owners.host)), ...value(registerVerificationBodies(vh))] });
    await tick();
    // Settle the native context delivery through the real Nine/Eight/Six path (as the landed boot test does).
    const runtime = createVerificationRuntime(vh, createVerificationSpine(vh, { context, privateKey }, f.store));
    const plan = { ...verificationInput('VerificationPlan'), id: 'r5-provider-plan',
      subject: { ...verificationInput('VerificationPlan').subject, generation: f.run.generation.id },
      bar: { ...verificationInput('VerificationPlan').bar, version: 'provider-bar', sources: ['probe'] } };
    value(runtime.record('VerificationPlan', plan));
    value(runtime.record('VerificationPlan', { ...plan, id: 'r5-context-plan', bar: { ...plan.bar, version: 'live-input-bar' } }));
    const assessment = createEffectAssessmentPort(vh, runtime);
    f.effects.composition.assessment = assessment; f.effects.recreate(f.store);
    const rows = value(f.effects.api.inspect());
    const request = rows.find(row => row.record.type === 'EffectRequest').record;
    const observations = rows.filter(row => row.record.type === 'OperationObservation').map(row => row.record);
    const response = observations.find(row => row.stage === 'response');
    const reservation = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
      && row.record.operation === response.operation).at(-1).record;
    for (const [predicate, amount] of [['operation-occurred', null], ['charge-settled', 0], ['old-executor-quiescent', null]]) {
      dc.captures[response.capture.reference] = context.captures[response.capture.reference].bytes;
      const proof = value(decode('Evidence', f.evidenceInput({ id: `r5-context-proof:${predicate}`, capture: response.capture,
        claim: { subject: response.operation, predicate, value: { digest: request.digest, ...(amount === null ? {} : { amount }) } },
        source: 'probe', observedAt: f.deps.clock(), freshFor: 100, strength: 'proof' }), dc));
      f.evidence.push(proof); f.append('evidence-record', json({ evidence: proof }));
    }
    await tick();
    const input = { request, reservation, claim: response.claim, observations, bar: request.verificationBar };
    value(assessment.read(value(assessment.assess(input)), input));
    value(f.effects.transport.settle(f.effects.fence, value(f.effects.api.settle(response.operation))));
    await tick();
    const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'r5-provider-definition', feature: 'provider-call',
      version: 'r5-provider-version', generation: f.run.generation.id, adapter: ROUTE, account: 'test-provider',
      conversation: 'recorded provider', speaker: f.bob.id, scopeDigest: value(canonical(f.scope)).hash, durability: 'local-durable',
      // Eight's CURRENT owner cap (records.ts: 0 < maxBytes <= 4096). The proposed larger bound is refused below.
      replicas: 0, lossModel: 'Recorded local bytes, no remote durability claim.', maxBytes: 4096, maxCharge: 20, timeout: 100,
      verificationBar: 'provider-bar' };
    const approval = f.authorize({ id: 'r5-provider-approval', artifact: f.capture(value(canonical(definition)).bytes), base: 'r5-base' });
    const current = f.owners.host.current;
    f.owners.host.current = () => ({ ...current(), versions: [...current().versions, { id: definition.version, subject: definition.feature,
      content: json(definition), contentHash: value(canonical(definition)).hash, since: f.opening.id, supersedes: [],
      approvedIn: approval, base: approval.base, landedIn: null }] });
    value(installOperationDefinition(definition, f.owners.host, createEffectSpine(f.owners.host, { context, privateKey }, f.store)));
    const received: string[] = [];
    const route = { provider: 'test-provider', model: 'model', route: ROUTE, disclosure: 'recorded provider', automaticRetries: 0,
      environment: 'local-test', invoke: async bytes => {
        // The join check runs at the adapter seam, before the external call.
        value(verifyGroundedSubmission({ ...f.groundedInput({ bindings }), request: prepared.value,
          requestFact: prepared.request.id, received: bytes }));
        received.push(bytes);
        const answer = await fetch(http.endpoint, { method: 'POST', body: bytes,
          headers: { Authorization: `Bearer ${http.credential}`, 'Content-Type': 'application/json' } });
        return answer.json();
      } };
    const owners = value(createProductionProviderOwners({ judgment: s.judgment, verification: vh, route,
      effect: { host: f.owners.host, durability: f.effects.composition.durability, custody: f.effects.composition.custody, plan: plan.id } }));
    const obligation = all().find(row => row.kind === 'transport-LoopRecord').id;
    await tick();
    // Seven's grounded capture exceeds Eight's current provider-call envelope: held before any provider IO.
    refused(owners.eight.prepare({ prepared, definition: definition.id, verificationOwner: 'independent-probe',
      resultDestination: f.opening.id, obligation }, f.effects.fence), 'provider bound exceeded');
    expect(Buffer.byteLength(submitted)).toBeGreaterThan(4096);
    expect(http.requests).toHaveLength(0);
    expect(received).toHaveLength(0);
    // Raising it needs an owner grant: Eight's OperationDefinition validator caps maxBytes at 4096
    // (src/effects/records.ts). This unit does not edit it; see the progress handoff's bound proposal.
    // Seven's captured submission itself still holds exactly the delivered evidence (the join the
    // dispatch seam will run once the owner bound is granted).
    value(verifyGroundedSubmission({ ...f.groundedInput({ bindings }), request: prepared.value,
      requestFact: prepared.request.id, received: submitted }));
    const onWire = JSON.parse(JSON.parse(submitted).messages[1].content);
    expect(onWire.bindings.delivery).toBe(bindings.delivery);
    expect(onWire.sources.map(source => source.class)).toEqual(['identity', 'rules', 'directives', 'pending-work']);
    expect(onWire.sources[0].items[0].content).toContain('Make coherence something an AI cannot lose.');
    expect(onWire.sources[1].items[0].content).toContain('**Status: draft, awaiting operator approval.**');
    // Bounded reply preparation: an ordinary answer's complete canonical outbound message fits Eight's
    // 4,096-byte envelope; an oversized answer is held before reply dispatch, never cut.
    const outbound = text => value(canonical(f.effects.message(f.id, text))).bytes;
    const reply = { turn: 'reply:operation:1', route: ROUTE, policy: 'eight-outbound-4096', question: QUESTION, context: rendered,
      submitted, retained: [prepared.request.id], bounds: PROPOSED };
    value(checkGroundingEnvelope({ ...reply, outbound: outbound(f.decisionInput().conclusion?.text ?? 'Instar keeps an agent coherent.') }, f.p.context));
    refused(checkGroundingEnvelope({ ...reply, outbound: outbound('ü'.repeat(2100)) }, f.p.context), 'outbound-message=');
  } finally { await http.close(); }
}, 240000);

/** Rebuild a held turn from durable records only, independently of any permission to dispatch
 * it: Five's Run is re-read through a run graph over the REOPENED store; the pending step's
 * delivery and consumption facts, the admitted input's own text (the question), the installation
 * (the delivered status body's scope) and the generation (the delivery record) come from that
 * store; the context is re-rendered in `reconstruct` mode; and Seven's canonical submission is
 * rebuilt from the RETAINED policy inputs. Its digest must equal Five's durable pending digest. */
function heldFromRecords(f, store, captures, policy) {
  // Ten's assembly runtime/history and Five's run graph, both reopened over the new store.
  const reopened = f.groundingFor({ spine: createAssemblySpine(f.host, { context: f.ctx, privateKey }, store), scope: 'scope:minimal' });
  // Its production grounding reader never samples here: reconstruction reads, it never grounds.
  const grounding = createProductionGroundingReader({ scope: 'scope:minimal', runtime: reopened.runtime, harness: reopened.harness,
    context: reopened.context, clock: reopened.clock, sample: () => { throw Error('reconstruction never samples a new turn'); } });
  const graph = value(createRunGraph({ ...reopened.graphDependencies, assemblyHistory: reopened.history, grounding }));
  const facts = value(store.read()), step = value(graph.read(f.id)).pending[0];
  const deliveryFact = facts.filter(row => row.kind === 'assembly-ContextDeliverySpecification'
    && row.body.record.run === f.id && row.body.record.step === step.id).at(-1);
  const delivery = deliveryFact.body.record;
  const consumption = facts.find(row => row.kind === 'assembly-HarnessObservation' && row.body.record.contextDelivery === deliveryFact.id
    && row.body.record.phase === 'context-consumed');
  const input = facts.find(row => row.id === delivery.input);
  const question = JSON.parse(captures.read(input.body.capture.reference)).text;
  const status = facts.find(row => row.id === delivery.contextManifest.find(entry => entry.class === 'pending-work').reference);
  const installation = JSON.parse(status.body.content).items[0].scope;
  const bindings = { run: f.id, step: step.id, delivery: deliveryFact.id, consumption: consumption.id, installation, generation: delivery.generation };
  const context = value(f.render({ store, captures, bindings, purpose: 'reconstruct' }));
  const submitted = groundedSubmission({ provider: policy.provider, model: policy.model, route: policy.route, question, context,
    settings: policy.settings, outputSchema: policy.outputSchema, floor: policy.floor, evidence: [], point: policy.point,
    generation: delivery.generation });
  expect(submitted.digest).toBe(step.operation.digest);
  return { graph, step, bindings, deliveryFact, question, context, submitted: submitted.bytes,
    envelope: { turn: step.id, route: policy.route, policy: policy.name, question, context, submitted: submitted.bytes,
      retained: [input.id, deliveryFact.id], bounds: policy.bounds } };
}

it('holds the preview-envelope overflow visibly before Seven or any provider IO, and reconstructs and reports the same hold after restart', async () => {
  const { f, s, ready, ground, rendered } = grounded();
  const http = await localProvider();
  try {
    // The question Seven would receive is the admitted input's own text.
    const question = JSON.parse(f.captures.read(f.initialCapture.reference)).text;
    const submission = s.submission(question, rendered);
    const transition = f.start(ready, ground, 'operation:1');
    value(f.graph.transition({ ...transition, step: { ...transition.step, operation: { ...transition.step.operation, digest: submission.digest } } }));
    // The policy inputs of the held turn, retained as canonical bytes (not live objects).
    const retainedPolicy = value(canonical({ name: 'subscription-preview-v2', provider: s.host.description.provider,
      model: s.host.description.model, route: ROUTE, settings: SETTINGS, outputSchema: OUTPUT_SCHEMA, floor: f.floor,
      point: 'judgment', bounds: previewBounds })).bytes;
    const held = { turn: 'step:operation:1', route: ROUTE, policy: 'subscription-preview-v2', question, context: rendered,
      submitted: submission.bytes, retained: [f.opening.id, f.bindings().delivery], bounds: previewBounds };
    const detail = refused(checkGroundingEnvelope(held, f.p.context), 'grounding-envelope-held turn=step:operation:1');
    expect(detail).toContain(`canonical-request=${Buffer.byteLength(submission.bytes)}/4096`);
    expect(detail).toContain(`combined-prompt=${previewBounds.systemBytes + Buffer.byteLength(submission.bytes)}/4096`);
    expect(detail).toContain(`retained=${f.opening.id}`);
    const originalHold = groundingEnvelopeHold(held);
    // Time and the owner plan move on: the old turn has no current permission to dispatch.
    f.nextInput('A later question arrives while turn one is held.');
    f.time(f.deps.clock().value + f.plan.statusMaxAge + 1);
    // Restart: a fresh FactStore over the same durable wire and a run graph over it; no in-memory
    // request, submission, graph read or old plan binding is reused.
    const store = createFactStore(f.ctx, f.storage);
    expect(value(store.read()).map(row => row.id)).toEqual(value(f.store.read()).map(row => row.id));
    const rebuilt = heldFromRecords(f, store, f.captures, JSON.parse(retainedPolicy));
    refused(f.render({ store, bindings: rebuilt.bindings }), 'bindings differ from the current owner plan');
    expect(rebuilt.context).toBe(rendered);
    // The reconstructed diagnostic travels with the existing installation hold report.
    const { report, hold } = value(reportGroundingEnvelopeHold({ envelope: rebuilt.envelope, report: {
      installation: rebuilt.bindings.installation, scope: 'scope:minimal', generation: rebuilt.bindings.generation,
      vector: 'vector:r5-offline', verdicts: [{ hold: 'production-context-sampling', owner: 'part-ten', evidence: rebuilt.deliveryFact.id }],
      facts: { owner: 'part-ten', lookup: reference => {
        const fact = value(store.read()).find(row => row.id === reference);
        return fact ? { kind: fact.kind, owner: 'part-ten', fixture: true, current: false } : null;
      } } } }, f.p.context));
    const bytes = Buffer.byteLength(submission.bytes);
    expect([hold.cause, hold.turn, hold.retained]).toEqual(['grounding-envelope-held', 'step:operation:1',
      [f.opening.id, rebuilt.deliveryFact.id]]);
    expect(hold.over.map(m => [m.subject.split(':')[0], m.measured, m.bound])).toEqual(expect.arrayContaining([
      ['canonical-request', bytes, 4096], ['combined-prompt', previewBounds.systemBytes + bytes, 4096]]));
    expect(hold).toEqual(originalHold);
    const row = report.rows.find(entry => entry.hold === 'production-context-sampling');
    expect([row.state, row.evidence, report.live]).toEqual(['held', rebuilt.deliveryFact.id, false]);
    // Still held, zero dispatch: Five's reopened Run keeps the step pending; no Seven request; no provider call.
    expect(value(rebuilt.graph.read(f.id)).pending.map(step => step.id)).toEqual(['step:operation:1']);
    expect(value(store.read()).some(row => row.kind === 'judgment-provider-ProviderJudgmentRequest')).toBe(false);
    expect(http.requests).toHaveLength(0);
  } finally { await http.close(); }
}, 120000);

it('measures captured turns under one prepared route/policy, boundaries separately, and uncaptured shapes as held projections', async () => {
  const { f, s, ready, ground, rendered, directory } = grounded();
  // The recorded offline route carries no system framing (0 B). Captured rows take their bounds
  // AND their identities from Seven's durable request record, never from a mutable description.
  const route = s.host.description;
  const boundsOf = (q) => ({ systemBytes: 0, maxPromptBytes: q.maxInputBytes, maxInputBytes: q.maxInputBytes,
    maxOutputBytes: q.maxOutputBytes, maxCaptureBytes: q.maxCaptureBytes, maxDeliveryBytes: 4096, maxOutboundBytes: 4096 });
  /** Route + full bound policy identity of one exact preparation input set (or its request record). */
  const identityOf = (q) => ({
    route: value(canonical({ provider: q.provider, model: q.model, route: q.route, maxInputBytes: q.maxInputBytes,
      maxOutputBytes: q.maxOutputBytes, maxCharge: q.maxCharge })).hash,
    policy: value(canonical({ settings: value(canonical(SETTINGS)).hash, outputSchema: value(canonical(OUTPUT_SCHEMA)).hash,
      maxTokens: q.maxTokens, timeout: q.timeout, maxInputBytes: q.maxInputBytes, maxOutputBytes: q.maxOutputBytes,
      maxCaptureBytes: q.maxCaptureBytes, maxCharge: q.maxCharge })).hash });
  const cells = (turn, question, context, submitted, b, policy) => Object.fromEntries(groundingEnvelopeMeasurements({ turn, route: ROUTE,
    policy, question, context, submitted, retained: [], bounds: b }).map(m => [m.subject.split(':')[0], m.bound === null ? m.measured : `${m.measured}/${m.bound}`]));
  const selectionOf = context => value(canonical(JSON.parse(context).bindings.manifest)).hash;
  const first = s.submission(QUESTION, rendered).bytes, size = Buffer.byteLength(first);
  const allowance = Buffer.byteLength(QUESTION + rendered + first) + 6 * route.maxOutputBytes + 8192;
  const judged = (maxInputBytes, maxCaptureBytes) => ({ ...route, maxInputBytes, maxCaptureBytes,
    maxTokens: s.judgment.maxTokens, timeout: s.judgment.timeout });
  // Boundary variations, each reported with ITS OWN route/policy identity, outcome and no record.
  const boundaries = [];
  route.maxInputBytes = size - 1;
  refused(s.prepareTurn(ready, ground, 'operation:1', QUESTION, rendered), 'provider input/token/time bound exceeded');
  expect(value(f.store.read()).some(r => r.kind === 'judgment-provider-ProviderJudgmentRequest')).toBe(false);
  boundaries.push({ case: 'input limit+1', ...identityOf(judged(size - 1, s.judgment.maxCaptureBytes)), measured: size,
    bound: size - 1, outcome: 'refused by Seven: provider input/token/time bound exceeded; nothing recorded' });
  route.maxInputBytes = size;
  const question = { id: 'r5-question:operation:1', run: { owner: 'part-five', name: 'Run', id: f.id }, step: 'step:operation:1',
    ordinal: 0, semanticMessage: 'operation:1', question: QUESTION, context: rendered, evidence: [], deadline: 400 };
  refused(createProviderJudgmentPort({ ...s.judgment, maxCaptureBytes: allowance - 1 }).prepare(question, f.effects.fence), 'capture bound exceeded');
  expect(value(f.store.read()).some(r => r.kind === 'judgment-provider-ProviderJudgmentRequest')).toBe(false);
  boundaries.push({ case: 'capture allowance-1', ...identityOf(judged(size, allowance - 1)), measured: allowance,
    bound: allowance - 1, outcome: 'refused by Seven: capture bound exceeded; nothing recorded' });
  // The one captured policy: exact input limit and exact capture allowance.
  const prepared = value(createProviderJudgmentPort({ ...s.judgment, maxCaptureBytes: allowance }).prepare(question, f.effects.fence));
  expect(value(s.captures.read(prepared.value.submitted))).toBe(first);
  expect([prepared.value.maxInputBytes, prepared.value.maxCaptureBytes]).toEqual([size, allowance]);
  // The identity is derived from the exact preparation inputs AND equals the one derived from Seven's record.
  expect(identityOf(prepared.value)).toEqual(identityOf(judged(size, allowance)));
  boundaries.push({ case: 'exact limit and exact capture allowance', ...identityOf(prepared.value), measured: size, bound: size,
    outcome: `prepared by Seven as request ${prepared.request.id}` });
  const captured = [];
  captured.push({ turn: 'first-turn', tier: 'Seven capture', request: prepared.request.id, submittedCapture: prepared.value.submitted.reference,
    ...identityOf(prepared.value), selection: selectionOf(rendered), actual: cells('first-turn', QUESTION, rendered, first, boundsOf(prepared.value), 'captured'),
    previewProjection: cells('first-turn', QUESTION, rendered, first, previewBounds, 'subscription-preview-v2 (projection)') });
  // Restart: the request RECORD and its submitted bytes are read from a reopened store and reopened file captures.
  const reopenedStore = createFactStore(f.ctx, f.storage);
  const record = value(reopenedStore.read()).find(row => row.kind === 'judgment-provider-ProviderJudgmentRequest'
    && row.body.record.id === prepared.value.id).body.record;
  const reopened = createJudgmentCaptures(directory, {}, fn => f.success(fn()), 1048576, {});
  const reread = value(reopened.read(record.submitted)), rereadContext = JSON.parse(reread).messages[1].content;
  expect(reread).toBe(first);
  captured.push({ turn: 'restart-reconstruction', tier: 'reopened Seven record + file capture', request: prepared.request.id,
    submittedCapture: record.submitted.reference, ...identityOf(record), selection: selectionOf(rereadContext),
    actual: cells('restart-reconstruction', QUESTION, rereadContext, reread, boundsOf(record), 'captured'),
    previewProjection: cells('restart-reconstruction', QUESTION, rereadContext, reread, previewBounds, 'subscription-preview-v2 (projection)') });
  expect(new Set(captured.map(row => `${row.route}|${row.policy}|${row.selection}`)).size).toBe(1);
  // Uncaptured shapes: held projections, NOT capture proof. Their identity is the labelled test route.
  const projectionRoute = judged(PROPOSED.maxInputBytes, s.judgment.maxCaptureBytes);
  const projected = [];
  const project = (turn, context, submitted, missing, extra = {}) => projected.push({ turn, status: 'held projection — incomplete owner-dependent evidence',
    missing, ...identityOf(projectionRoute), selection: selectionOf(context), ...extra,
    testRoute: cells(turn, QUESTION_TWO, context, submitted, boundsOf(projectionRoute), 'labelled 12,288 B test route (projection)'),
    previewProjection: cells(turn, QUESTION_TWO, context, submitted, previewBounds, 'subscription-preview-v2 (projection)') });
  const QUESTION_TWO = 'Can this installation talk in any conversation other than this one?';
  f.nextInput(QUESTION_TWO);
  value(f.graph.ground(f.id, 'w', 'native', 'resume', f.lease));
  const second = value(f.render());
  project('second-turn-pending-predecessor', second, s.submission(QUESTION_TWO, second).bytes,
    'no Seven capture: Five admits no new step while the predecessor is pending (owner-correct hold)');
  const replyDirectory = mkdtempSync(join(tmpdir(), 'r5-e2e-reply-'));
  directories.push(replyDirectory);
  const r = await acceptedSecondTurn(replyDirectory, QUESTION_TWO, QUESTION);
  project('second-turn-with-accepted-reply', r.rendered, r.s.submission(QUESTION_TWO, r.rendered).bytes,
    'no Seven capture: settling the accepted step through Five observe is refused (Five/Nine owner handoff)',
    { acceptance: r.accepted.acceptanceFact.id });
  // Eight's serialized context-delivery payloads (the admitted OutboundMessage records, bound 4096).
  const deliveries = value(f.store.read()).filter(row => row.kind === 'effect-OutboundMessage')
    .map(row => Buffer.byteLength(value(canonical(row.body.record)).bytes));
  expect(deliveries.every(bytes => bytes <= 4096)).toBe(true);
  // A complete canonical outbound reply for an ordinary answer, measured against Eight's 4,096-byte envelope.
  const outbound = value(canonical(f.effects.message(f.id, 'Instar keeps an agent coherent across sessions and machines.'))).bytes;
  const outboundRow = value(checkGroundingEnvelope({ turn: 'reply:operation:1', route: ROUTE, policy: 'eight-outbound-4096', question: QUESTION,
    context: rendered, submitted: first, outbound, retained: [prepared.request.id], bounds: PROPOSED }, f.p.context))
    .find(m => m.subject.startsWith('outbound-message'));
  console.log('R5-MEASUREMENT-TABLE ' + JSON.stringify({ firstRequestBytes: size, contextDeliveryPayloadBytes: deliveries,
    completeOutboundBytes: outboundRow.measured, captured, boundaries, heldProjections: projected }, null, 1));
  expect(captured[0].actual['canonical-request']).toBe(`${size}/${size}`);
  expect(captured[0].actual['capture-allowance']).toBe(`${allowance}/${allowance}`);
  expect(new Set(boundaries.map(row => row.policy)).size).toBe(3);
  expect(projected.every(row => row.route !== captured[0].route)).toBe(true);
}, 300000);
