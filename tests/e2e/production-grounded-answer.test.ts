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
import { groundingFixture, withSeven, ROUTE } from '../assembly/production-context-sampler-fixture.js';
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
  return { f, s, ready, ground, rendered: value(f.render()), evidence: f.evidence.map(e => e.id).slice(0, 2) };
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
        value(verifyGroundedSubmission({ store: f.store, context: f.p.context, captures: f.captures, bindings, replies: [],
          request: prepared.value, requestFact: prepared.request.id, received: bytes }));
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
    value(verifyGroundedSubmission({ store: f.store, context: f.p.context, captures: f.captures, bindings, replies: [],
      request: prepared.value, requestFact: prepared.request.id, received: submitted }));
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

it('holds the preview-envelope overflow visibly before Seven or any provider IO, and the hold survives restart', async () => {
  const { f, s, ready, ground, rendered } = grounded();
  const http = await localProvider();
  try {
    const submission = s.submission(QUESTION, rendered);
    const transition = f.start(ready, ground, 'operation:1');
    value(f.graph.transition({ ...transition, step: { ...transition.step, operation: { ...transition.step.operation, digest: submission.digest } } }));
    const held = { turn: 'step:operation:1', route: ROUTE, policy: 'subscription-preview-v2', question: QUESTION, context: rendered,
      submitted: submission.bytes, retained: [f.opening.id, f.bindings().delivery], bounds: previewBounds };
    const detail = refused(checkGroundingEnvelope(held, f.p.context), 'grounding-envelope-held turn=step:operation:1');
    expect(detail).toContain(`canonical-request=${Buffer.byteLength(submission.bytes)}/4096`);
    expect(detail).toContain(`retained=${f.opening.id}`);
    expect(http.requests).toHaveLength(0);
    expect(value(f.store.read()).some(row => row.kind === 'judgment-provider-ProviderJudgmentRequest')).toBe(false);
    // Visible through Five's run view: the pending step remains, un-dispatched, with its admitted input.
    expect(value(f.graph.read(f.id)).pending.map(step => step.id)).toEqual(['step:operation:1']);
    // Restart: the same durable work is still held; the same measured refusal recurs, no new identity.
    const store = createFactStore(f.ctx, f.storage);
    expect(value(store.read()).map(row => row.id)).toEqual(value(f.store.read()).map(row => row.id));
    expect(value(store.read()).some(row => row.id === f.opening.id)).toBe(true);
    expect(refused(checkGroundingEnvelope(held, f.p.context))).toBe(detail);
  } finally { await http.close(); }
}, 120000);

it('measures the whole envelope for each turn shape against the owner limits (report table)', () => {
  const { f, s, ready, ground, rendered } = grounded();
  const table = [];
  const row = (name, question, context) => {
    const submitted = s.submission(question, context).bytes;
    const measured = groundingEnvelopeMeasurements({ turn: name, route: ROUTE, policy: 'subscription-preview-v2', question, context,
      submitted, retained: [], bounds: previewBounds });
    table.push({ turn: name, ...Object.fromEntries(measured.map(m => [m.subject.split(':')[0], m.bound === null ? m.measured : `${m.measured}/${m.bound}`])) });
    return submitted;
  };
  const first = row('first-turn', QUESTION, rendered);
  // Seven's real owner input bound at limit+1 (refused, nothing recorded) and at the exact limit (prepared).
  const size = Buffer.byteLength(first);
  s.host.description.maxInputBytes = size - 1;
  refused(s.prepareTurn(ready, ground, 'operation:1', QUESTION, rendered), 'provider input/token/time bound exceeded');
  expect(value(f.store.read()).some(r => r.kind === 'judgment-provider-ProviderJudgmentRequest')).toBe(false);
  s.host.description.maxInputBytes = size;
  const prepared = value(s.seven.prepare({ id: 'r5-question:operation:1', run: { owner: 'part-five', name: 'Run', id: f.id },
    step: 'step:operation:1', ordinal: 0, semanticMessage: 'operation:1', question: QUESTION, context: rendered, evidence: [],
    deadline: 400 }, f.effects.fence));
  expect(value(s.captures.read(prepared.value.submitted))).toBe(first);
  expect(prepared.value.maxInputBytes).toBe(size);
  row('restart-reconstruction', QUESTION, JSON.parse(value(s.captures.read(prepared.value.submitted))).messages[1].content);
  f.nextInput('Can this installation talk in any conversation other than this one?');
  value(f.graph.ground(f.id, 'w', 'native', 'resume', f.lease));
  const second = value(f.render());
  row('second-turn-pending-predecessor', 'Can this installation talk in any conversation other than this one?', second);
  // The first accepted reply's canonical conversation entry, inserted into the actual second-turn packet.
  // Composed shape: a live ProviderAnswerAcceptance join in one store is R7's per-turn integration.
  const packet = JSON.parse(second), answer = JSON.stringify(f.decisionInput());
  packet.conversation.splice(1, 0, { reply: 'acceptance:composed', hash: 'sha256:' + '0'.repeat(64), text: answer });
  row('second-turn-with-first-reply(composed)', 'Can this installation talk in any conversation other than this one?',
    value(canonical(packet)).bytes);
  // Eight's serialized context-delivery payload (the admitted OutboundMessage record, bound 4096).
  const deliveries = value(f.store.read()).filter(r => r.kind === 'effect-OutboundMessage')
    .map(r => Buffer.byteLength(value(canonical(r.body.record)).bytes));
  expect(deliveries.every(bytes => bytes <= 4096)).toBe(true);
  console.log('R5-MEASUREMENT-TABLE ' + JSON.stringify({ firstRequestBytes: size, contextDeliveryPayloadBytes: deliveries, table }, null, 1));
  expect(table.every(entry => typeof entry['canonical-request'] === 'string')).toBe(true);
}, 120000);

