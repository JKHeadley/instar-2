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
import { checkGroundingEnvelope, groundingEnvelopeMeasurements, verifyGroundedSubmission }
  from '../../src/assembly/production-context-sampler.js';
import { localProvider } from '../model-provider/http-provider.js';
import { verificationInput } from '../verification/fixture.js';
import { OUTPUT_SCHEMA, ROUTE, SETTINGS, acceptedSecondTurn, groundingFixture, withSeven } from '../assembly/production-context-sampler-fixture.js';
import { createProviderJudgmentPort } from '../../src/judgment/index.js';
import { reportInstallationHolds } from '../../src/assembly/production-installation-report.js';
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

/** Rebuild the measured envelope input for a held turn from durable records only: the delivery
 * and consumption facts of the Run's pending step, the question as the admitted input's own text,
 * the context re-rendered from the (reopened) store, and Seven's canonical submission shape. Its
 * digest must equal the operation digest Five durably recorded for the pending step. */
function heldFromRecords(f, store, captures, route) {
  const facts = value(store.read()), view = value(f.graph.read(f.id));
  const step = view.pending[0];
  const deliveryFact = facts.filter(row => row.kind === 'assembly-ContextDeliverySpecification'
    && row.body.record.run === f.id && row.body.record.step === step.id).at(-1);
  const consumption = facts.find(row => row.kind === 'assembly-HarnessObservation' && row.body.record.contextDelivery === deliveryFact.id
    && row.body.record.phase === 'context-consumed');
  const input = facts.find(row => row.id === deliveryFact.body.record.input);
  const question = JSON.parse(captures.read(input.body.capture.reference)).text;
  const bindings = { run: f.id, step: step.id, delivery: deliveryFact.id, consumption: consumption.id,
    installation: f.plan.installation, generation: f.run.generation.id };
  const context = value(f.render({ store, captures, bindings }));
  const submitted = route(question, context);
  expect(value(canonical(submitted.bytes)).hash).toBe(step.operation.digest);
  return { step, deliveryFact, question, context, submitted: submitted.bytes, retained: [input.id, deliveryFact.id] };
}

it('holds the preview-envelope overflow visibly before Seven or any provider IO, and reconstructs the same hold after restart', async () => {
  const { f, s, ready, ground, rendered } = grounded();
  const http = await localProvider();
  try {
    // The question Seven would receive is the admitted input's own text.
    const question = JSON.parse(f.captures.read(f.initialCapture.reference)).text;
    const submission = s.submission(question, rendered);
    const transition = f.start(ready, ground, 'operation:1');
    value(f.graph.transition({ ...transition, step: { ...transition.step, operation: { ...transition.step.operation, digest: submission.digest } } }));
    const held = { turn: 'step:operation:1', route: ROUTE, policy: 'subscription-preview-v2', question, context: rendered,
      submitted: submission.bytes, retained: [f.opening.id, f.bindings().delivery], bounds: previewBounds };
    const detail = refused(checkGroundingEnvelope(held, f.p.context), 'grounding-envelope-held turn=step:operation:1');
    expect(detail).toContain(`canonical-request=${Buffer.byteLength(submission.bytes)}/4096`);
    expect(detail).toContain(`combined-prompt=${previewBounds.systemBytes + Buffer.byteLength(submission.bytes)}/4096`);
    expect(detail).toContain(`retained=${f.opening.id}`);
    // Restart: a fresh FactStore over the same durable wire; no in-memory request object is reused.
    const store = createFactStore(f.ctx, f.storage);
    expect(value(store.read()).map(row => row.id)).toEqual(value(f.store.read()).map(row => row.id));
    const rebuilt = heldFromRecords(f, store, f.captures, (q, c) => s.submission(q, c));
    expect(rebuilt.context).toBe(rendered);
    const reopenedDetail = refused(checkGroundingEnvelope({ turn: rebuilt.step.id, route: ROUTE, policy: 'subscription-preview-v2',
      question: rebuilt.question, context: rebuilt.context, submitted: rebuilt.submitted,
      retained: [f.opening.id, rebuilt.deliveryFact.id], bounds: previewBounds }, f.p.context));
    expect(reopenedDetail).toBe(detail);
    // The existing installation hold report keeps production-context-sampling held, carrying the
    // retained delivery as its evidence reference; nothing is upgraded to admitted or live.
    const report = value(reportInstallationHolds({ installation: f.plan.installation, scope: 'scope:minimal',
      generation: f.run.generation.id, vector: 'vector:r5-offline', facts: { owner: 'part-ten', lookup: () => null },
      verdicts: [{ hold: 'production-context-sampling', owner: 'part-ten', evidence: rebuilt.deliveryFact.id }] }, f.p.context));
    const row = report.rows.find(entry => entry.hold === 'production-context-sampling');
    expect([row.state, row.evidence, report.live]).toEqual(['held', rebuilt.deliveryFact.id, false]);
    // Still held: the Five step stays pending, and no Seven request or provider call exists.
    expect(value(f.graph.read(f.id)).pending.map(step => step.id)).toEqual(['step:operation:1']);
    expect(value(store.read()).some(row => row.kind === 'judgment-provider-ProviderJudgmentRequest')).toBe(false);
    expect(http.requests).toHaveLength(0);
  } finally { await http.close(); }
}, 120000);

it('measures the whole envelope for each turn shape against the actual fixture route and labelled preview projections', async () => {
  const { f, s, ready, ground, rendered, directory } = grounded();
  // The recorded offline route carries no system framing (0 B); its bounds come from Seven's own
  // prepared request where one exists, else from the LABELLED 12,288-byte test route.
  const route = s.host.description;
  const boundsOf = (q) => ({ systemBytes: 0, maxPromptBytes: q.maxInputBytes, maxInputBytes: q.maxInputBytes,
    maxOutputBytes: q.maxOutputBytes, maxCaptureBytes: q.maxCaptureBytes, maxDeliveryBytes: 4096, maxOutboundBytes: 4096 });
  const testRoute = { ...boundsOf({ maxInputBytes: PROPOSED.maxInputBytes, maxOutputBytes: route.maxOutputBytes,
    maxCaptureBytes: s.judgment.maxCaptureBytes }) };
  const identity = { route: value(canonical(route)).hash, policy: value(canonical({ settings: SETTINGS, outputSchema: OUTPUT_SCHEMA,
    maxTokens: s.judgment.maxTokens, timeout: s.judgment.timeout })).hash };
  const table = [];
  const measure = (name, tier, question, context, submitted, bounds, boundsBasis, extra = {}) => {
    const selection = value(canonical(JSON.parse(context).bindings.manifest)).hash;
    const cells = (b, policy) => Object.fromEntries(groundingEnvelopeMeasurements({ turn: name, route: ROUTE, policy, question, context,
      submitted, retained: [], bounds: b }).map(m => [m.subject.split(':')[0], m.bound === null ? m.measured : `${m.measured}/${m.bound}`]));
    table.push({ turn: name, tier, ...identity, selection, boundsBasis, ...extra,
      actual: cells(bounds, boundsBasis), previewProjection: cells(previewBounds, 'subscription-preview-v2 (projection)') });
  };
  const first = s.submission(QUESTION, rendered).bytes, size = Buffer.byteLength(first);
  // Seven's real input bound at limit+1 (refused, nothing recorded) and at the exact limit (prepared).
  route.maxInputBytes = size - 1;
  refused(s.prepareTurn(ready, ground, 'operation:1', QUESTION, rendered), 'provider input/token/time bound exceeded');
  expect(value(f.store.read()).some(r => r.kind === 'judgment-provider-ProviderJudgmentRequest')).toBe(false);
  route.maxInputBytes = size;
  const question = { id: 'r5-question:operation:1', run: { owner: 'part-five', name: 'Run', id: f.id }, step: 'step:operation:1',
    ordinal: 0, semanticMessage: 'operation:1', question: QUESTION, context: rendered, evidence: [], deadline: 400 };
  // Seven's real capture allowance at its exact boundary and one byte under.
  const allowance = Buffer.byteLength(QUESTION + rendered + first) + 6 * route.maxOutputBytes + 8192;
  refused(createProviderJudgmentPort({ ...s.judgment, maxCaptureBytes: allowance - 1 }).prepare(question, f.effects.fence), 'capture bound exceeded');
  expect(value(f.store.read()).some(r => r.kind === 'judgment-provider-ProviderJudgmentRequest')).toBe(false);
  const prepared = value(createProviderJudgmentPort({ ...s.judgment, maxCaptureBytes: allowance }).prepare(question, f.effects.fence));
  expect(value(s.captures.read(prepared.value.submitted))).toBe(first);
  expect([prepared.value.maxInputBytes, prepared.value.maxCaptureBytes]).toEqual([size, allowance]);
  const captured = (p) => ({ request: p.request.id, submittedCapture: p.value.submitted.reference });
  measure('first-turn', 'Seven capture', QUESTION, rendered, first, boundsOf(prepared.value), 'Seven prepared request',
    { ...captured(prepared), captureAllowanceBoundary: allowance });
  // Restart: the reconstruction row is read from REOPENED file-backed captures, not from memory.
  const reopened = createJudgmentCaptures(directory, {}, fn => f.success(fn()), 1048576, {});
  const reread = value(reopened.read(prepared.value.submitted));
  expect(reread).toBe(first);
  measure('restart-reconstruction', 'reopened Seven capture', QUESTION, JSON.parse(reread).messages[1].content, reread,
    boundsOf(prepared.value), 'Seven prepared request', captured(prepared));
  const QUESTION_TWO = 'Can this installation talk in any conversation other than this one?';
  f.nextInput(QUESTION_TWO);
  value(f.graph.ground(f.id, 'w', 'native', 'resume', f.lease));
  const second = value(f.render());
  // Five admits no new step while the predecessor is pending, so this shape cannot be captured by Seven yet.
  measure('second-turn-pending-predecessor', 'real delivered packet; Seven-shape mirror (Five holds dispatch)', QUESTION_TWO, second,
    s.submission(QUESTION_TWO, second).bytes, testRoute, 'labelled 12,288-byte test route');
  // The genuine accepted-reply second turn (real Seven/Eight/Nine/Six acceptance of turn one).
  const replyDirectory = mkdtempSync(join(tmpdir(), 'r5-e2e-reply-'));
  directories.push(replyDirectory);
  const r = await acceptedSecondTurn(replyDirectory, QUESTION_TWO, QUESTION);
  measure('second-turn-with-accepted-reply', 'real delivered packet; Seven-shape mirror (Seven capture blocked, see progress)',
    QUESTION_TWO, r.rendered, r.s.submission(QUESTION_TWO, r.rendered).bytes, testRoute, 'labelled 12,288-byte test route',
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
    completeOutboundBytes: outboundRow.measured, table }, null, 1));
  expect(table.find(row => row.turn === 'first-turn').actual['canonical-request']).toBe(`${size}/${size}`);
  expect(table.find(row => row.turn === 'first-turn').actual['capture-allowance']).toBe(`${allowance}/${allowance}`);
}, 300000);
