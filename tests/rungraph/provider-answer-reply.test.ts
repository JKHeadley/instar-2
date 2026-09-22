import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createConfinedProviderInvocation } from '../../src/assembly/index.js';
import { registerProviderResponseEvidenceBounds } from '../../src/assembly/provider-invocation.js';
import { createProviderEffectDoorway } from '../../src/effects/index.js';
import { createProviderResponseAssessmentPort } from '../../src/verification/index.js';
import type { Hash } from '../../src/index.js';
import { createRunGraph, runIdFor } from '../../src/rungraph/index.js';
import { providerFixture, enc, refused, value } from '../model-provider/fixture.js';
import type { ProviderResponseSubject } from '../../src/verification/index.js';
import type { ConfinedProviderRoute, ProviderResponseEvidenceDraft } from '../../src/assembly/provider-invocation.js';
import { hashBytes } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { privateKey } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';

const raw = (fact: FactEnvelope) => (fact.body as unknown as { record: Record<string, unknown> }).record;
const reference = (fact: FactEnvelope) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const,
  id: fact.id, kind: fact.kind, schemaVersion: fact.schemaVersion, contentHash: fact.contentHash });

export async function runProviderAnswerReplyScenario(malformedDecision = false): Promise<any> {
  let answer = '', sourceEvidence = '', terminalEvidence = '';
  const f = providerFixture({ route: { invoke: async (bytes, bounds) => {
    const frame = JSON.stringify({ type: 'result', is_error: false, result: answer, session_id: 'call:one',
      stop_reason: 'end_turn', usage: { input_tokens: 2, output_tokens: 3 }, total_cost_usd: 0.000003 });
    const rawBytes = Buffer.from(frame);
    const draft: ProviderResponseEvidenceDraft = {
      eligibility: 'admitted', contract: { parserReference: 'claude-code-json-result', parserVersion: '1',
        evidenceContractReference: 'response-contract', evidenceContractVersion: '1', mode: 'single-final-reply',
        maxMetadataBytes: 5000, maxRawTerminalBytes: 2048, maxCaptureBytes: 65000 },
      basis: { sourceEvidence: [sourceEvidence], terminalEvidence, terminalReasonField: 'stop_reason',
        successfulFinalReplyReasons: ['end_turn'] },
      source: { controller: 'confined-custodian', evidence: [sourceEvidence], endpoint: 'local-provider',
        account: 'local-account', credentialReference: 'credential', executableArtifact: `sha256:${'1'.repeat(64)}`,
        provider: 'test-provider', model: 'model', route: 'route', call: 'call:one', submittedDigest: enc(bytes).hash,
        strength: 'observation' },
      terminal: { rawBase64: rawBytes.toString('base64'),
        rawDigest: `sha256:${createHash('sha256').update(rawBytes).digest('hex')}`, evidence: terminalEvidence,
        reason: 'successful-final-reply', providerReason: 'end_turn', limited: false, errored: false,
        cancelled: false, timedOut: false, truncated: false, toolCall: false },
      answer: { extractionContract: 'claude-code-json-result:1', answerDigest: hashBytes(answer) },
    };
    return { state: 'complete', bytes: answer, providerOperation: bounds.operation,
      usage: { inputTokens: 2, outputTokens: 3, charge: 3, source: 'confined local return' },
      retryBlocked: false, responseEvidenceDraft: draft };
  } } });

  const sourceBasis = { version: '1', parserReference: 'claude-code-json-result', parserVersion: '1',
    endpoint: 'local-provider', account: 'local-account', credentialReference: 'credential',
    controller: 'confined-custodian', executableArtifact: `sha256:${'1'.repeat(64)}`,
    provider: 'test-provider', model: 'model', route: 'route' };
  const terminalBasis = { version: '1', parserReference: 'claude-code-json-result', parserVersion: '1',
    terminalReasonField: 'stop_reason', successfulFinalReplyReasons: ['end_turn'] };
  sourceEvidence = f.evidence('response-contract', enc(sourceBasis).hash, 'provider-response-source-contract', undefined,
    { claim: { subject: 'response-contract', predicate: 'provider-response-source-contract', value: sourceBasis } }).id;
  terminalEvidence = f.evidence('response-contract', enc(terminalBasis).hash, 'provider-response-terminal-contract', undefined,
    { claim: { subject: 'response-contract', predicate: 'provider-response-terminal-contract', value: terminalBasis } }).id;
  answer = malformedDecision ? JSON.stringify({ not: 'a Decision' }) : JSON.stringify(f.decisionInput());

  const route = Object.freeze({ ...f.route, invoke: (f.route as ConfinedProviderRoute).invoke }) as ConfinedProviderRoute;
  registerProviderResponseEvidenceBounds(route, { parserReference: 'claude-code-json-result', parserVersion: '1',
    evidenceContractReference: 'response-contract', evidenceContractVersion: '1', mode: 'single-final-reply',
    maxMetadataBytes: 5000, maxRawTerminalBytes: 2048, maxCaptureBytes: 65000 });
  const invocation = value(createConfinedProviderInvocation(route, f.six, f.th, f.captures, f.host.boundary, f.store,
    { context: f.context, privateKey }));
  const responseAssessment = createProviderResponseAssessmentPort(f.vh, f.runtime, f.store, f.seven);
  const api = createProviderEffectDoorway({ ...f.dependencies, invocation, responseAssessment, plan: 'provider-response-plan' });
  const { prepared, request } = f.prepare();
  const observed = value(await api.dispatch(request, f.fence));

  for (const predicate of ['operation-occurred', 'charge-settled', 'old-executor-quiescent'])
    f.evidence(observed.operation, request.digest, predicate, predicate === 'charge-settled' ? 3 : undefined);
  const facts = f.all();
  const requestFact = facts.find(fact => fact.id === request.payload.request.id)!;
  const preparedFact = facts.find(fact => fact.id === request.payload.prepared.id)!;
  const responseFact = facts.find(fact => fact.kind === 'judgment-provider-ProviderJudgmentAttemptRecord'
    && raw(fact).phase === 'response-observed')!;
  const effectFact = facts.find(fact => fact.kind === 'effect-provider-ProviderEffectRequest' && raw(fact).id === request.id)!;
  const executorFact = facts.find(fact => fact.kind === 'effect-provider-ProviderOperationObservation'
    && raw(fact).operation === observed.operation && raw(fact).stage === 'executor-accepted')!;
  const responseObservationFact = facts.find(fact => fact.kind === 'effect-provider-ProviderOperationObservation'
    && raw(fact).operation === observed.operation && raw(fact).stage === 'response')!;
  const consumedFact = facts.find(fact => fact.kind === 'transport-AdmissionReservation'
    && raw(fact).operation === observed.operation && raw(fact).state === 'consumed')!;
  const claimFact = facts.find(fact => fact.kind === 'transport-AdmissionReservation'
    && raw(fact).operation === observed.operation && raw(fact).state === 'dispatch-claimed')!;
  const receipt = raw(responseFact).receipt as { reference: string; hash: string };
  const providerObservation = JSON.parse(f.metadata[receipt.reference]!.bytes!) as { responseEvidence: {
    contract: Record<string, string>; source: { evidence: string[] }; terminal: { evidence: string; raw: { reference: string; hash: string }; rawDigest: string };
    answer: { source: { reference: string; hash: string }; answerDigest: string } } };
  if (!providerObservation.responseEvidence) throw new Error(JSON.stringify(providerObservation));
  const envelope = providerObservation.responseEvidence;
  const q = raw(requestFact);
  const subject: ProviderResponseSubject = {
    seven: { request: reference(requestFact), prepared: reference(preparedFact), attempt: request.attempt,
      response: reference(responseFact) },
    eight: { request: reference(effectFact), executorObservation: reference(executorFact),
      responseObservation: reference(responseObservationFact) },
    six: { operation: observed.operation, consumedReservation: reference(consumedFact), dispatchClaim: reference(claimFact) },
    submitted: { capture: request.payload.submitted, operationDigest: request.digest as Hash },
    route: { provider: request.payload.provider, model: request.payload.model, route: request.payload.route,
      routeBasis: String(q.routeBasis), floorDigest: String(q.floorDigest) as Hash, evidence: q.evidence as unknown as string[],
      evidenceDigest: enc(q.evidence).hash, settingsDigest: request.payload.settingsDigest as Hash,
      outputSchemaDigest: request.payload.outputSchemaDigest as Hash },
    response: { capture: envelope.answer.source as ProviderResponseSubject['response']['capture'],
      answerDigest: envelope.answer.answerDigest as Hash,
      parserReference: envelope.contract.parserReference!, parserVersion: envelope.contract.parserVersion!,
      evidenceContractReference: envelope.contract.evidenceContractReference!,
      evidenceContractVersion: envelope.contract.evidenceContractVersion! },
    terminal: { evidence: envelope.terminal.evidence,
      capture: envelope.terminal.raw as ProviderResponseSubject['terminal']['capture'],
      rawDigest: envelope.terminal.rawDigest as Hash, sourceEvidence: envelope.source.evidence },
  };
  const legacy = verificationInput('VerificationPlan');
  value(f.runtime.record('VerificationPlan', { ...legacy, type: 'VerificationPlan', schemaVersion: 2,
    purpose: 'output-use', id: 'provider-response-plan', subject: { ...legacy.subject,
      scope: f.scope.kind === 'organization' ? 'project-a' : f.scope.members[0]!, generation: f.th.current().generation.id },
    bar: { ...legacy.bar, version: request.verificationBar,
      predicates: ['occurrence', 'non-occurrence', 'quiescence', 'charge', 'response-authenticity', 'response-completeness'],
      sources: ['probe'], minimumStrength: 'proof', subjectDigest: enc(subject).hash, captureRequired: true },
    responseContract: { parserReference: 'claude-code-json-result', parserVersion: '1',
      evidenceContractReference: 'response-contract', evidenceContractVersion: '1', mode: 'single-final-reply' },
    responseRequirements: [
      { predicate: 'response-authenticity', sources: [f.th.principal.id], minimumStrength: 'observation', requiredContract: 'response-contract' },
      { predicate: 'response-completeness', sources: [f.th.principal.id], minimumStrength: 'observation', requiredContract: 'response-contract' },
    ] }));

  const assessment = value(api.assessResponse(observed.operation));
  expect(value(api.assessResponse(observed.operation))).toEqual(assessment);
  const settlement = value(api.settle(observed.operation, assessment));
  const accounting = value(f.six.settle(f.fence, settlement));
  const settlementFact = f.all().find(fact => fact.kind === 'effect-provider-ProviderEffectSettlement'
    && raw(fact).id === settlement.id)!;
  const accountingFact = f.all().find(fact => fact.kind === 'transport-SettlementApplication'
    && raw(fact).settlement === settlement.id && raw(fact).operation === accounting.operation)!;
  if (malformedDecision) {
    const assessed = raw(f.all().find(fact => fact.id === assessment.id)!);
    expect((assessed.predicates as unknown as { predicate: string; verdict: string }[])
      .find(row => row.predicate === 'response-completeness')?.verdict).toBe('insufficient');
    expect(settlement.outcome.kind).toBe('happened');
    expect(accounting.unresolved).toBe(0);
    return { f, api, responseAssessment, assessment, settlement, accounting };
  }
  const acceptance = value(f.seven.recordProviderAnswerAcceptance({ subject, assessment,
    settlement: reference(settlementFact), accounting: reference(accountingFact) }, responseAssessment, f.fence));
  const accepted = value(api.consumeAcceptedProviderAnswer(acceptance, view => view));
  expect(accepted.answer).toBe(answer);
  expect(accepted.chargeSettled).toBe(true);
  expect(accepted.required).toContain(assessment.id);

  const replyGraph = value(createRunGraph({ ...f.deps, acceptedAnswer: api }));
  const acceptanceFact = f.all().find(fact => fact.id === acceptance.id)!;
  const opening = { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: acceptanceFact.id };
  const original = value(replyGraph.read(f.id));
  const reply = JSON.parse(JSON.stringify({ ...original.run, id: runIdFor(opening), opening })) as typeof original.run;
  refused(replyGraph.open(JSON.parse(JSON.stringify(reply))), 'conditional accepted-reply boundary');
  const obligationFact = f.all().find(fact => fact.id === accepted.obligation)!;
  const replyInput = { acceptance, originalRun: f.id, expected: accepted.predecessor,
    obligation: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: obligationFact.id },
    standing: original.run.owner.fact, ownership: f.lease, fence: f.fence, reply };
  refused(replyGraph.openAcceptedProviderReply({ ...replyInput, expected: 'changed-predecessor' }),
    'cause, predecessor, or conversation obligation differs');
  refused(replyGraph.openAcceptedProviderReply({ ...replyInput,
    fence: { ...f.fence, epoch: f.fence.epoch + 1 } }), 'lease-derived fence or ownership differs');
  const opened = value(replyGraph.openAcceptedProviderReply(replyInput));
  expect(opened.run.id).toBe(reply.id);
  const modelCalls = f.calls();
  f.stop();
  expect(value(replyGraph.openAcceptedProviderReply(replyInput)).run.id).toBe(reply.id);
  expect(f.calls()).toBe(modelCalls);

  const copied = { owner: 'part-seven' as const, decodeCapturedProviderDecision: f.seven.decodeCapturedProviderDecision };
  expect(() => createProviderResponseAssessmentPort(f.vh, f.runtime, f.store, copied)).toThrow(/genuine same-store/);
  expect(prepared.value.id).toBe(q.id);
  return { f, api, responseAssessment, assessment, settlement, accounting, acceptance, accepted, replyGraph, replyInput, reply };
}

it('P10-SI-17 P10-SI-37 uses one output assessment for independent settlement and exact answer acceptance', async () => {
  await runProviderAnswerReplyScenario();
});

it('P10-SI-37 keeps the four settlement rows usable when the captured answer cannot decode as a Decision', async () => {
  await runProviderAnswerReplyScenario(true);
});
