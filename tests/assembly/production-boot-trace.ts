// @ts-nocheck -- U4-G metadata/witness fixtures; all operational ports come from the public boot.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { prepareSnapshot } from '../../src/facts/index.js';
import { canonical, decode } from '../../src/index.js';
import { installTelegramReplyOperation, telegramConversation, assessTelegramReplyResponse } from '../../src/conversation/index.js';
import { decodeOutboundMessage, createEffectSpine, installOperationDefinition } from '../../src/effects/index.js';
import { createEffectSettlementAssessmentPort, createEffectAssessmentPort } from '../../src/verification/index.js';
import { value, privateKey, json } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';

const expect = actual => ({
  toBe: expected => assert.equal(actual, expected), toEqual: expected => assert.deepEqual(actual, expected),
  toBeNull: () => assert.equal(actual, null),
  toHaveLength: expected => assert.equal(actual.length, expected), toBeTruthy: () => assert.ok(actual),
  toContain: expected => assert.ok(actual.includes(expected)),
});
export async function runRecordedConversation(installed, http, checkpoint = async () => {}) {
  const f = installed.f;
  installed.receive(installed.application);
  await checkpoint('intake', installed);
  f.deps.context.evidenceSources.settlement = f.bob.provenance.adapter;
  const graph = installed.application.owners.run;
  const context = f.ctx, dc = context.decode;
  dc.register.entries.push('provider-call');
  const boundary = { ...f.c, register: dc.register };
  const host = installed.judgmentHost;
  const captures = installed.captures;
    f.owners.host.capture = bytes => captures.put(bytes, 262144);
    for (const [reference, bytes] of Object.entries(dc.captures)) {
      if (!context.captures[reference]) context.captures[reference] = { bytes, hash: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), byteLength: Buffer.byteLength(bytes), status: 'available' };
    }
    const settings = { automaticRetries: 0, maxTokens: 128 }, outputSchema = { type: 'Decision' };
    const question = { id: 'boot-question', run: { owner: 'part-five', name: 'Run', id: f.id },
      step: 'step:operation:1', ordinal: 0, semanticMessage: 'operation:1', question: 'May the worker produce its bounded reply?',
      context: 'Current delivered context was consumed by the native owner path.', evidence: ['e1', 'e2'], deadline: 400 };
    const submitted = value(canonical({ provider: host.description.provider, model: 'model', route: 'route',
      messages: [{ role: 'user', content: question.question }, { role: 'context', content: question.context }],
      attachments: [], tools: [], settings, outputSchema, floor: f.floor, evidence: question.evidence,
      point: 'judgment', generation: f.run.generation.id })).bytes;
    for (const evidence of f.evidence) f.append('evidence-record', json({ evidence }));
    const ready = value(graph.open(f.run));
    await checkpoint('run-opened', installed);
    const ground = value(graph.ground(f.id, 'w', 'native', 'start', f.lease));
    await checkpoint('provider-grounded', installed);
    const transition = f.start(ready, ground);
    value(graph.transition({ ...transition, step: { ...transition.step,
      operation: { ...transition.step.operation, digest: value(canonical(submitted)).hash } } }));
    await checkpoint('provider-pending', installed);
    await new Promise(resolve => setTimeout(resolve, 1));
    const seven = installed.application.owners.provider.seven;
    const prepared = value(seven.prepare(question, f.effects.fence));
    await checkpoint('provider-prepared', installed);
    expect(value(captures.read(prepared.value.submitted))).toBe(submitted);
    expect(prepared.value.pending).toBe(value(f.store.read()).find(row => row.kind === 'run-transition').id);
    expect(prepared.value.run).toBe(f.id);
    const all = () => value(f.store.read());
    const vh = installed.vh, runtime = installed.application.owners.provider.nine;
    const plan = { ...verificationInput('VerificationPlan'), id: 'boot-provider-plan',
      subject: { ...verificationInput('VerificationPlan').subject, generation: f.run.generation.id },
      bar: { ...verificationInput('VerificationPlan').bar, version: 'provider-bar', sources: ['probe'] } };
    value(runtime.record('VerificationPlan', plan));
    const nine = createEffectSettlementAssessmentPort(vh, runtime, f.store);
    expect(nine.owner).toBe('part-nine');
    // The native context delivery has used Eight's ordinary EffectDoorway.
    // Replace the fixture assessor with the actual landed Nine implementation.
    const contextPlan = { ...plan, id: 'boot-context-plan', bar: { ...plan.bar, version: 'live-input-bar' } };
    value(runtime.record('VerificationPlan', contextPlan));
    const realAssessment = createEffectAssessmentPort(vh, runtime);
    Object.assign(f.effects.composition.assessment, realAssessment);
    const settleContextDelivery = async () => {
    const rows = value(f.effects.api.inspect());
    const request = rows.filter(row => row.record.type === 'EffectRequest').at(-1).record;
    const observations = rows.filter(row => row.record.type === 'OperationObservation' && row.record.request === request.id).map(row => row.record);
    const response = observations.find(row => row.stage === 'response');
    expect(response).toBeTruthy();
    const reservation = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
      && row.record.operation === response.operation).at(-1).record;
    for (const [predicate, amount] of [['operation-occurred', null], ['charge-settled', 0], ['old-executor-quiescent', null]]) {
      const capture = response.capture;
      const sourceBytes = context.captures[capture.reference].bytes;
      dc.captures[capture.reference] = sourceBytes;
      const evidence = value(decode('Evidence', f.evidenceInput({ id: `boot-context-proof:${response.operation}:${predicate}`, capture,
        claim: { subject: response.operation, predicate, value: { digest: request.digest, ...(amount === null ? {} : { amount }) } },
        source: 'probe', observedAt: f.deps.clock(), freshFor: 100, strength: 'proof' }), dc));
      f.evidence.push(evidence); f.append('evidence-record', json({ evidence }));
    }
    await new Promise(resolve => setTimeout(resolve, 1));
    const input = { request, reservation, claim: response.claim, observations, bar: request.verificationBar };
    const acceptance = value(realAssessment.assess(input));
    const proof = value(realAssessment.read(acceptance, input));
    expect(proof.outcome.kind).toBe('happened');
    expect(proof.finalCharge).toBe(0);
    expect(proof.delayedExecutionExcluded).toBe(true);
    // Required lifecycle positive: the actual Eight doorway must consume Nine's
    // assessment without rewriting the source Evidence or substituting an assessor.
    value(f.effects.transport.settle(f.effects.fence, value(f.effects.api.settle(response.operation))));
    await new Promise(resolve => setTimeout(resolve, 1));
    };
    await settleContextDelivery();
    await checkpoint('context-settled', installed);
    const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'boot-provider-definition',
      feature: 'provider-call', version: 'boot-provider-version', generation: f.run.generation.id,
      adapter: 'route', account: 'test-provider', conversation: 'recorded provider', speaker: f.bob.id,
      scopeDigest: value(canonical(f.scope)).hash, durability: 'local-durable', replicas: 0,
      lossModel: 'Recorded local bytes, no remote durability claim.', maxBytes: 4096,
      maxCharge: 20, timeout: 100, verificationBar: 'provider-bar' };
    const approval = f.authorize({ id: 'boot-provider-approval', artifact: f.capture(value(canonical(definition)).bytes), base: 'boot-provider-base' });
    const current = f.owners.host.current;
    f.owners.host.current = () => ({ ...current(), versions: [...current().versions,
      { id: definition.version, subject: definition.feature, content: json(definition), contentHash: value(canonical(definition)).hash,
        since: f.opening.id, supersedes: [], approvedIn: approval, base: approval.base, landedIn: null }] });
    value(installOperationDefinition(definition, f.owners.host, createEffectSpine(f.owners.host, { context, privateKey }, f.store)));
    const providerOwners = installed.application.owners.provider;
    const api = providerOwners.eight;
    const obligation = all().find(row => row.kind === 'transport-LoopRecord').id;
    await new Promise(resolve => setTimeout(resolve, 1));
    const providerRequest = value(api.prepare({ prepared, definition: definition.id, verificationOwner: 'independent-probe',
      resultDestination: f.opening.id, obligation }, f.effects.fence));
    await checkpoint('provider-requested', installed);
    http.respond({ state: 'complete', bytes: JSON.stringify(f.decisionInput()), providerOperation: 'recorded-provider-operation:1',
      usage: { inputTokens: 11, outputTokens: 9, charge: 3, source: 'authenticated local provider receipt' }, retryBlocked: false });
    const observed = value(await api.dispatch(providerRequest, f.effects.fence));
    expect(http.requests).toHaveLength(1);
    await checkpoint('provider-observed', installed);
    for (const [predicate, amount] of [['operation-occurred', null], ['charge-settled', 3], ['old-executor-quiescent', null]]) {
      const capture = value(captures.put(value(canonical({ operation: observed.operation, digest: providerRequest.digest, predicate, amount })).bytes, 4096));
      const evidence = value(decode('Evidence', f.evidenceInput({ id: `boot-provider-proof:${predicate}`, capture,
        claim: { subject: observed.operation, predicate, value: { digest: providerRequest.digest, ...(amount === null ? {} : { amount }) } },
        source: 'probe', observedAt: f.deps.clock(), freshFor: 100, strength: 'proof' }), dc));
      f.evidence.push(evidence); f.append('evidence-record', json({ evidence }));
    }
    await new Promise(resolve => setImmediate(resolve));
    const assessment = value(api.assess(observed.operation));
    await checkpoint('provider-assessed', installed);
    await new Promise(resolve => setImmediate(resolve));
    const settlement = value(api.settle(observed.operation, assessment));
    await checkpoint('provider-settled', installed);
    await new Promise(resolve => setImmediate(resolve));
    const accounting = value(f.effects.transport.settle(f.effects.fence, settlement));
    expect(accounting.actualCharge).toBe(3);
    await checkpoint('provider-accounted', installed);
    await new Promise(resolve => setImmediate(resolve));
    const answer = value(seven.resolve(prepared.request, settlement, f.effects.fence));
    expect(answer.resolution.id).toBeTruthy();
    await checkpoint('answer-recorded', installed);
    await new Promise(resolve => setImmediate(resolve));
    f.deps.settlement.read = (reference, step) => api.readRunSettlement(reference, step);
    const sf = all().find(row => row.kind === 'effect-provider-ProviderEffectSettlement' && row.body.record.id === settlement.id);
    const conflicts = value(prepareSnapshot(all(), context)).entries.flatMap(row => row.conflicts);
    expect(conflicts).toEqual([]);
    await new Promise(resolve => setTimeout(resolve, 1));
    const view = value(graph.read(f.id));
    const ref = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
    await new Promise(resolve => setTimeout(resolve, 1));
    const accepted = value(graph.transition({ type: 'RunTransition', schemaVersion: 1, id: 'boot-provider-accepted',
      run: f.id, expected: view.head, trigger: { owner: 'part-two', name: 'FactEnvelope', id: answer.resolution.id },
      kind: 'observe', from: view.state, to: 'ready', responsible: f.owner, standing: ref(f.opening), ownership: f.lease,
      generation: f.run.generation, at: f.deps.clock(), blockedOn: { kind: 'nothing' }, nextWake: f.run.nextWake,
      affectedStep: question.step, outcome: { type: 'Outcome', id: 'boot-provider-outcome', fact: ref(sf), field: 'outcome' }, settlement: ref(sf) }));
    expect(accepted.pending).toHaveLength(0);
    await checkpoint('answer-accepted', installed);
    await new Promise(resolve => setTimeout(resolve, 1));
    const responder = installed.application.owners.responder;
    const text = value(responder.respond({ intake: f.opening.id, run: f.id, answer: answer.resolution.id }));
    expect(text).toContain('request was preserved');
    const telegram = installed;
    const conversation = telegramConversation(telegram.declaration.bot.id, telegram.extracted.target);
    dc.register.entries.push('telegram-ordinary-reply', telegram.admitted.id);
    const replyDefinition = { type: 'OperationDefinition', schemaVersion: 1,
      id: 'boot-telegram-reply-definition', feature: 'telegram-ordinary-reply', version: 'telegram:9.2:ordinary-reply:v1',
      generation: f.run.generation.id, adapter: telegram.admitted.id, account: telegram.admitted.account,
      conversation, speaker: f.bob.id, scopeDigest: value(canonical(f.scope)).hash,
      durability: 'local-durable', replicas: 0, lossModel: 'Recorded local bytes; replication admitted only through the U4-C fixture handle.',
      maxBytes: telegram.declaration.limits.maxReplyBytes, maxCharge: telegram.declaration.limits.maxCharge,
      timeout: telegram.declaration.limits.timeout, verificationBar: 'boot-telegram-reply-bar' };
    const replyApproval = f.authorize({ id: 'boot-telegram-reply-approval',
      artifact: f.capture(value(canonical(replyDefinition)).bytes), base: 'boot-telegram-reply-base' });
    const beforeReply = f.owners.host.current;
    f.owners.host.current = () => ({ ...beforeReply(), versions: [...beforeReply().versions,
      { id: replyDefinition.version, subject: replyDefinition.feature, content: json(replyDefinition),
        contentHash: value(canonical(replyDefinition)).hash, since: f.opening.id, supersedes: [],
        approvedIn: replyApproval, base: replyApproval.base, landedIn: null }] });
    const replySpine = createEffectSpine(f.owners.host, { context, privateKey }, f.store);
    const declared = value(installTelegramReplyOperation({ id: replyDefinition.id, generation: replyDefinition.generation,
      admitted: telegram.admitted, target: telegram.extracted.target, speaker: replyDefinition.speaker,
      scopeDigest: replyDefinition.scopeDigest, durability: replyDefinition.durability, replicas: 0,
      lossModel: replyDefinition.lossModel, verificationBar: replyDefinition.verificationBar }, f.owners.host, replySpine));
    const message = value(decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1,
      id: 'boot-telegram-reply', semanticMessage: 'operation:2', run: f.id, speaker: f.bob.id,
      account: telegram.admitted.account, conversation, text, purpose: 'ordinary-reply', sourceResult: answer.resolution.id }, f.owners.host));
    await new Promise(resolve => setTimeout(resolve, 1));
    const replyGround = value(graph.ground(f.id, 'w', 'native', 'resume', f.lease));
    await checkpoint('reply-grounded', installed);
    const next = f.start(accepted, replyGround, message.semanticMessage);
    const sending = value(graph.transition({ ...next, step: { ...next.step,
      operation: { ...next.step.operation, digest: value(canonical(message)).hash } } }));
    const pendingReply = all().find(row => row.kind === 'run-transition' && row.body.record.id === sending.head);
    await checkpoint('reply-pending', installed);
    await settleContextDelivery();
    await checkpoint('reply-context-settled', installed);
    const { adapter: replyAdapter, doorway: reply } = installed.application.owners.reply(telegram.admitted, telegram.extracted.target);
    const replyRequest = value(replyAdapter.prepare(reply, { definition: declared.id, message,
      run: question.run, pending: pendingReply.id, attempt: 'boot-telegram-reply-attempt',
      verificationOwner: 'independent-probe', obligation, closure: [answer.resolution.id], fence: f.effects.fence }));
    await new Promise(resolve => setTimeout(resolve, 1));
    await checkpoint('reply-requested', installed);
    const replyObservation = value(reply.dispatch(replyRequest, f.effects.fence));
    await checkpoint('reply-observed', installed);
    const replyBytes = context.captures[replyObservation.capture.reference].bytes;
    expect(replyBytes).toBe(readFileSync('tests/assembly/telegram-recorded/sendMessage.json', 'utf8'));
    const replyReceipt = JSON.parse(replyBytes);
    expect(String(replyReceipt.result.chat.id)).toBe(telegram.extracted.target.chatId);
    expect(Number.isSafeInteger(replyReceipt.result.message_id)).toBe(true);
    value(runtime.record('VerificationPlan', { ...plan, id: 'boot-telegram-reply-plan',
      bar: { ...plan.bar, version: replyDefinition.verificationBar } }));
    dc.captures[replyObservation.capture.reference] = replyBytes;
    const replyEvidence = value(decode('Evidence', f.evidenceInput({ id: 'boot-telegram-provider-acceptance',
      capture: replyObservation.capture, claim: { subject: replyObservation.operation, predicate: 'operation-occurred',
        value: { digest: replyRequest.digest } }, source: 'probe', observedAt: f.deps.clock(), freshFor: 100,
      strength: 'proof' }), dc));
    f.evidence.push(replyEvidence); f.append('evidence-record', json({ evidence: replyEvidence }));
    const replyReservation = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
      && row.record.operation === replyObservation.operation).at(-1).record;
    const replyObservations = value(reply.inspect()).filter(row => row.record.type === 'OperationObservation'
      && row.record.operation === replyObservation.operation).map(row => row.record);
    const replyInput = { request: replyRequest, reservation: replyReservation, claim: replyObservation.claim,
      observations: replyObservations, bar: replyDefinition.verificationBar };
    await new Promise(resolve => setTimeout(resolve, 1));
    const providerAccepted = value(assessTelegramReplyResponse({ effect: replyInput, claim: 'provider-accepted', existing: null },
      { admitted: telegram.admitted, api: telegram.api, target: telegram.extracted.target,
        effects: reply, transport: f.effects.transport, definition: declared,
        custody: f.effects.composition.custody, assessment: realAssessment, verification: runtime, boundary }));
    expect(providerAccepted.stage).toBe('provider-accepted');
    await checkpoint('reply-assessed', installed);
    const replySettlement = value(reply.settle(replyObservation.operation));
    expect(replySettlement.finalCharge).toBeNull();
    expect(replySettlement.delayedExecutionExcluded).toBe(false);
    await checkpoint('reply-settled', installed);
    expect(value(f.effects.transport.settle(f.effects.fence, replySettlement)).unresolved).toBe(1);
    await checkpoint('reply-accounted', installed);
    expect(http.requests).toHaveLength(1);
    expect(telegram.calls.filter(call => call === 'sendMessage')).toHaveLength(1);


    return { run: f.id, update: JSON.parse(installed.raw).update_id,
      providerOperation: observed.operation, assessment: assessment.id, answer: answer.resolution.id,
      replyOperation: replyObservation.operation, replyMessage: replyReceipt.result.message_id };
}
