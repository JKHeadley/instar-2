import { expect, it } from 'vitest';
import { createEffectDoorway, createEffectSpine, createProviderEffectDoorway, decodeOutboundMessage } from '../../src/effects/index.js';
import { createProviderResponseAssessmentPort } from '../../src/verification/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { providerFixture, refused, value } from '../model-provider/fixture.js';
import { privateKey } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { runProviderAnswerReplyScenario } from '../rungraph/provider-answer-reply.test.js';

it('P10-SI-17 P10-SI-18 P10-SI-24 P10-SI-37 recovers one real outbound operation after original accounting closes', async () => {
  const first = await runProviderAnswerReplyScenario(false, { unknown: true, noStop: true });
  expect(first.accounting.unresolved).not.toBe(0);
  expect(first.accounting.exposure).toBe(first.settlement.retainedExposure);
  // The legacy one-run Six fixture cannot admit the required separately-owned
  // reply operation while this accounting stays unresolved. Keep the useful
  // restart/replay coverage below, but do not treat it as the pending-exposure
  // T4 neighbor; the blocked handoff identifies that missing owner dependency.
  first.f.time(101);
  first.f.evidence(first.settlement.operation, first.subject.submitted.operationDigest, 'charge-settled', 3);
  first.f.evidence(first.settlement.operation, first.subject.submitted.operationDigest, 'old-executor-quiescent');
  const completedAssessment = value(first.api.assessResponse(first.settlement.operation));
  const completedSettlement = value(first.api.settle(first.settlement.operation, completedAssessment));
  expect((value(first.f.six.settle(first.f.fence, completedSettlement)) as any).unresolved).toBe(0);
  let outboundCalls = 0;
  const adapter = { owner: 'part-ten' as const, id: 'route',
    describe: () => ({ contract: 'reply-route-v1', account: 'test-provider', conversation: 'local-test',
      maxCharge: 20, timeout: 100, hiddenRetries: 0 as const }),
    invoke: () => first.f.result(() => { outboundCalls++; return JSON.stringify({ ok: true, message_id: 'reply:1' }); }),
    observe: () => first.f.result(() => JSON.stringify({ status: 'unknown' })) };
  const outbound = createEffectDoorway({ host: first.f.host,
    spine: createEffectSpine(first.f.host, { context: first.f.context, privateKey }, first.f.store),
    transport: first.f.six, durability: first.f.dependencies.durability, custody: first.f.dependencies.custody,
    adapter, assessment: null });
  const message = value(decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1, id: 'accepted-reply-message',
    semanticMessage: 'ordinary-reply:accepted-answer', run: first.f.id, speaker: first.f.th.principal.id,
    account: 'test-provider', conversation: 'local-test', text: first.accepted.answer,
    purpose: 'ordinary-reply', sourceResult: first.acceptance.id }, first.f.host));
  const outboundRequest = value(outbound.prepare({ definition: 'provider-definition', message,
    run: { owner: 'part-five', name: 'Run', id: first.f.id }, pending: first.acceptance.id,
    attempt: 'accepted-reply-attempt:1', verificationOwner: 'reply-verifier', obligation: first.accepted.obligation,
    closure: [first.acceptance.id, first.assessment.id], fence: first.f.fence }));
  const outboundObservation = value(outbound.dispatch(outboundRequest, first.f.fence));
  expect(outboundObservation.stage).toBe('response');
  expect(outboundCalls).toBe(1);
  expect(first.modelCalls()).toBe(1);
  value(first.f.runtime.record('VerificationPlan', { ...verificationInput('VerificationPlan'), id: 'legacy-rebuild-plan' }));
  value(first.f.runtime.record('VerificationRequest', { ...verificationInput('VerificationRequest'),
    id: 'legacy-rebuild-request', logicalKey: 'legacy-rebuild-request' }));
  value(first.f.runtime.record('VerificationAssessment', { ...verificationInput('VerificationAssessment'),
    id: 'legacy-rebuild-assessment', request: 'legacy-rebuild-request' }));
  const before = first.f.all();
  let modelCalls = 0;
  const rebuilt = providerFixture({ directory: first.f.directory, route: { invoke: async () => {
    modelCalls++; throw new Error('restart must not call the model');
  } } });
  const responseAssessment = createProviderResponseAssessmentPort(rebuilt.vh, rebuilt.runtime, rebuilt.store, rebuilt.seven);
  const rebuiltVerification = value(rebuilt.runtime.inspect()) as any[];
  for (const name of ['VerificationPlan', 'VerificationRequest', 'VerificationAssessment'])
    expect(new Set(rebuiltVerification.filter(row => row.record.type === name)
      .map(row => row.record.schemaVersion))).toEqual(new Set([1, 2]));
  const effects = createProviderEffectDoorway({ ...rebuilt.dependencies, responseAssessment, plan: 'provider-response-plan' });
  const acceptance = { owner: 'part-seven' as const, name: 'ProviderAnswerAcceptance' as const, id: first.acceptance.id };
  const accepted = value(effects.consumeAcceptedProviderAnswer(acceptance, view => view));
  expect(accepted.answerDigest).toBe(first.accepted.answerDigest);
  expect(accepted.retainedExposure).toBe(first.accepted.retainedExposure);

  const graph = value(createRunGraph({ ...rebuilt.deps, acceptedAnswer: effects }));
  rebuilt.time(1000);
  rebuilt.stop();
  const recovered = value(graph.openAcceptedProviderReply({ ...first.replyInput, acceptance, reply: first.reply }));
  expect(recovered.run.id).toBe(first.reply.id);
  expect(modelCalls).toBe(0);
  let repeatedOutbound = 0;
  const recoveredOutbound = createEffectDoorway({ host: rebuilt.host,
    spine: createEffectSpine(rebuilt.host, { context: rebuilt.context, privateKey }, rebuilt.store),
    transport: rebuilt.six, durability: rebuilt.dependencies.durability, custody: rebuilt.dependencies.custody,
    adapter: { ...adapter, invoke: () => rebuilt.result(() => { repeatedOutbound++; throw new Error('must recover prior outbound operation'); }) },
    assessment: null });
  expect(value(recoveredOutbound.dispatch(outboundRequest, rebuilt.fence)).id).toBe(outboundObservation.id);
  expect(repeatedOutbound).toBe(0);
  refused(rebuilt.seven.prepare({ ...rebuilt.question,
    run: { owner: 'part-five', name: 'Run', id: recovered.run.id } }, rebuilt.fence), 'cannot request another model');
  const after = rebuilt.all();
  for (const kind of ['verification-VerificationAssessment', 'judgment-provider-ProviderAnswerAcceptance', 'run-opening'])
    expect(after.filter((fact: FactEnvelope) => fact.kind === kind)).toHaveLength(
      before.filter((fact: FactEnvelope) => fact.kind === kind).length);
  expect(after.filter((fact: FactEnvelope) => fact.kind === 'effect-provider-ProviderEffectRequest')).toHaveLength(
    before.filter((fact: FactEnvelope) => fact.kind === 'effect-provider-ProviderEffectRequest').length);
  expect(after.filter((fact: FactEnvelope) => fact.kind === 'effect-OperationObservation'
    && (fact.body as any).record.operation === outboundObservation.operation)).toHaveLength(
    before.filter((fact: FactEnvelope) => fact.kind === 'effect-OperationObservation'
      && (fact.body as any).record.operation === outboundObservation.operation).length);
}, 30_000);
