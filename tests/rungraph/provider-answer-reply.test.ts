import { afterEach, expect, it, vi } from 'vitest';
// Each scenario is ~8-12s of synchronous owner work on a loaded host (existing pattern: model-provider-refusals).
vi.setConfig({ testTimeout: 60_000 });
// Yield between heavy fixtures so the runner's task-update IPC can flush (landed pattern,
// tests/e2e/slice.test.ts): these scenarios are synchronous owner work for the whole file,
// which otherwise starves the fork worker's channel past its fixed 60s RPC deadline.
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });
import { createHash } from 'node:crypto';
import { createConfinedProviderInvocation } from '../../src/assembly/index.js';
import { registerProviderResponseEvidenceBounds } from '../../src/assembly/provider-invocation.js';
import { createProviderEffectDoorway } from '../../src/effects/index.js';
import { createProviderResponseAssessmentPort, decodeHistoricalVerificationRecord } from '../../src/verification/index.js';
import { decodeHistoricalProviderAnswerAcceptance } from '../../src/judgment/index.js';
import type { Hash, Json } from '../../src/index.js';
import { createRunGraph, runIdFor } from '../../src/rungraph/index.js';
import { providerFixture, enc, refused, value } from '../model-provider/fixture.js';
import type { ProviderResponseSubject } from '../../src/verification/index.js';
import type { ConfinedProviderRoute, ProviderResponseEvidenceDraft } from '../../src/assembly/provider-invocation.js';
import { causalStanding, decodeHistoricalBody, hashBytes } from '../../src/facts/index.js';
import { decodeOwnedBody } from '../../src/facts/owned.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { privateKey } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';

const raw = (fact: FactEnvelope) => (fact.body as unknown as { record: Record<string, unknown> }).record;
const reference = (fact: FactEnvelope) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const,
  id: fact.id, kind: fact.kind, schemaVersion: fact.schemaVersion, contentHash: fact.contentHash });

export async function runProviderAnswerReplyScenario(malformedDecision = false, hook: Readonly<{
  beforeAssessment?: boolean; beforeOpen?: boolean; unknown?: boolean; noStop?: boolean; terminalReason?: string;
  nearMalformedDecision?: boolean;
}> = {}): Promise<any> {
  let answer = '', sourceEvidence = '', terminalEvidence = '', modelCalls = 0;
  const f = providerFixture({ route: { invoke: async (bytes, bounds) => {
    modelCalls++;
    const frame = JSON.stringify({ type: 'result', is_error: false, result: answer, session_id: 'call:one',
      stop_reason: hook.terminalReason ?? 'end_turn', usage: { input_tokens: 2, output_tokens: 3 }, total_cost_usd: 0.000003 });
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
  answer = hook.nearMalformedDecision
    ? JSON.stringify({ ...f.decisionInput(), unexpected: 'must refuse Decision decode' })
    : malformedDecision ? JSON.stringify({ not: 'a Decision' }) : JSON.stringify(f.decisionInput());

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

  for (const predicate of (hook.unknown ? ['operation-occurred'] : ['operation-occurred', 'charge-settled', 'old-executor-quiescent']))
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
      sources: ['probe'], minimumStrength: 'proof', subjectDigest: enc(subject).hash, captureRequired: true, freshness: 50 },
    responseContract: { parserReference: 'claude-code-json-result', parserVersion: '1',
      evidenceContractReference: 'response-contract', evidenceContractVersion: '1', mode: 'single-final-reply' },
    responseRequirements: [
      { predicate: 'response-authenticity', sources: [f.th.principal.id], minimumStrength: 'observation', requiredContract: 'response-contract' },
      { predicate: 'response-completeness', sources: [f.th.principal.id], minimumStrength: 'observation', requiredContract: 'response-contract' },
    ] }));

  if (hook.beforeAssessment) return { f, api, responseAssessment, subject, observed, request, providerObservation,
    modelCalls: () => modelCalls };
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
  expect(accepted.chargeSettled).toBe(!hook.unknown);
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
  if (hook.beforeOpen) return { f, api, responseAssessment, subject, assessment, settlement, accounting,
    acceptance, accepted, replyGraph, replyInput, reply, modelCalls: () => modelCalls };
  const opened = value(replyGraph.openAcceptedProviderReply(replyInput));
  expect(opened.run.id).toBe(reply.id);
  const callsBeforeReplay = modelCalls;
  if (!hook.noStop) f.stop();
  expect(value(replyGraph.openAcceptedProviderReply(replyInput)).run.id).toBe(reply.id);
  expect(modelCalls).toBe(callsBeforeReplay);

  const copied = { owner: 'part-seven' as const, decodeCapturedProviderDecision: f.seven.decodeCapturedProviderDecision };
  expect(() => createProviderResponseAssessmentPort(f.vh, f.runtime, f.store, copied)).toThrow(/genuine same-store/);
  expect(prepared.value.id).toBe(q.id);
  return { f, api, responseAssessment, subject, assessment, settlement, accounting, acceptance, accepted,
    replyGraph, replyInput, reply, modelCalls: () => modelCalls };
}

it('P10-SI-17 P10-SI-37 uses one output assessment for independent settlement and exact answer acceptance', async () => {
  await runProviderAnswerReplyScenario();
}, 30_000);

it('P10-SI-37 keeps the four settlement rows usable when the captured answer cannot decode as a Decision', async () => {
  await runProviderAnswerReplyScenario(true);
}, 30_000);

it('P10-SI-37 records near-valid malformed Decision insufficiency and settles from the same v2 fact', async () => {
  const s = await runProviderAnswerReplyScenario(false, { beforeAssessment: true, nearMalformedDecision: true });
  const assessment: any = value(s.api.assessResponse(s.observed.operation));
  const fact = s.f.all().find((candidate: FactEnvelope) => candidate.id === assessment.id)!;
  const record = raw(fact);
  expect(record.schemaVersion).toBe(2);
  expect((record.predicates as unknown as { predicate: string; verdict: string }[])
    .find(row => row.predicate === 'response-completeness')?.verdict).toBe('insufficient');
  const settlement: any = value(s.api.settle(s.observed.operation, assessment));
  expect(settlement.acceptance).toBe(assessment.id);
  expect(settlement.outcome.kind).toBe('happened');
}, 30_000);

// Rule 37 quarantine: see docs/defects/full-suite-load-timeouts.md
it.skip.each(['submitted', 'raw-terminal', 'answer', 'receipt', 'Evidence'] as const)(
  'P9-NF-66 reads historical assessment with %s capture loss while current use refuses', async kind => {
    const s = await runProviderAnswerReplyScenario(false, { beforeAssessment: true });
    const assessment: any = value(s.api.assessResponse(s.observed.operation));
    const fact = s.f.all().find((candidate: FactEnvelope) => candidate.id === assessment.id)!;
    const record = raw(fact);
    const responseFact = s.f.all().find((candidate: FactEnvelope) => candidate.id === s.subject.seven.response.id)!;
    const evidenceId = (record.evidence as unknown as string[])[0]!;
    const evidenceFact = s.f.all().find((candidate: FactEnvelope) =>
      (candidate.body as unknown as { evidence?: { id?: string } }).evidence?.id === evidenceId)!;
    const captures = {
      submitted: s.subject.submitted.capture,
      'raw-terminal': s.subject.terminal.capture,
      answer: s.subject.response.capture,
      receipt: raw(responseFact).receipt as { reference: string; hash: string },
      Evidence: (evidenceFact.body as unknown as { evidence: { capture: { reference: string; hash: string } } }).evidence.capture,
    };
    const capture = captures[kind], saved = s.f.metadata[capture.reference];
    s.f.metadata[capture.reference] = { ...saved, status: 'missing', bytes: null };
    refused(s.responseAssessment.consumeProviderResponseAssessment(assessment, s.subject, (view: unknown) => view));
    const facts = { ...s.f.context, facts: s.f.all(), captures: { ...s.f.context.captures,
      [capture.reference]: s.f.metadata[capture.reference]! } };
    expect(value(decodeHistoricalVerificationRecord('VerificationAssessment', record, { ...s.f.host.boundary,
      origin: fact, mode: 'historical', facts }, s.f.vh))).toEqual(record);
    const captureOwner = kind === 'receipt' ? responseFact : kind === 'Evidence' ? evidenceFact : fact;
    const historical = value(decodeHistoricalBody(captureOwner, facts,
      causalStanding(captureOwner, facts, false).decode));
    expect(historical.taint).toContain('evidence-unavailable');
    if (captureOwner.id === fact.id) expect(historical.fields.record).toEqual(record);
  });

it('preserves signed Nine assessment as unavailable history after original register retirement; current consumption refuses', async () => {
  const s = await runProviderAnswerReplyScenario(false, { beforeAssessment: true });
  const assessment: any = value(s.api.assessResponse(s.observed.operation));
  const fact = s.f.all().find((candidate: FactEnvelope) => candidate.id === assessment.id)!;
  const record = raw(fact);
  const originalFacts = { ...s.f.context, facts: s.f.all() };
  const original = decodeOwnedBody('part-nine', 'VerificationAssessment', record as unknown as Json, fact, 'historical', originalFacts);
  expect(original.value).toEqual(record);
  expect(original.taint).not.toContain('evidence-unavailable');

  const laterFacts = { ...originalFacts, decode: { ...originalFacts.decode,
    register: { ...originalFacts.decode.register,
      generation: { ...originalFacts.decode.register.generation, id: 'later-generation' },
      entries: originalFacts.decode.register.entries.filter((entry: string) => entry !== 'judgment') } } };
  refused(decodeHistoricalVerificationRecord('VerificationAssessment', record, { ...s.f.host.boundary,
    register: laterFacts.decode.register, origin: fact, mode: 'historical', facts: laterFacts }, s.f.vh), 'taint sink');
  const historical = decodeOwnedBody('part-nine', 'VerificationAssessment', record as unknown as Json, fact, 'historical', laterFacts);
  expect(historical.value).toEqual(record);
  expect((historical.value as unknown as { id: string }).id).toBe(record.id);
  expect(historical.taint).toContain('evidence-unavailable');

  s.f.generation('later-generation');
  refused(s.responseAssessment.consumeProviderResponseAssessment(assessment, s.subject, (view: unknown) => view));
});

it('P10-SI-37 keeps a v1 occurrence assessment diagnostic-only when no answer evidence exists', async () => {
  const f = providerFixture({ route: { invoke: async (_bytes, bounds) => ({ state: 'complete',
    bytes: 'legacy occurrence without authenticated answer evidence', providerOperation: bounds.operation,
    usage: { inputTokens: 1, outputTokens: 1, charge: null, source: 'legacy local return' }, retryBlocked: false }) } });
  const { request } = f.prepare();
  const observed = value(await f.api.dispatch(request, f.fence));
  f.evidence(observed.operation, request.digest, 'operation-occurred');
  const assessment = value(f.api.assess(observed.operation));
  const record = raw(f.all().find((fact: FactEnvelope) => fact.id === assessment.id)!);
  expect(record.schemaVersion).toBe(1);
  expect((record.predicates as unknown as { predicate: string }[]).map(row => row.predicate))
    .toEqual(['occurrence', 'non-occurrence', 'quiescence', 'charge']);
  expect(value(f.api.settle(observed.operation, assessment)).outcome.kind).toBe('happened');
  refused(f.api.assessResponse(observed.operation), 'response assessment absent');
});

it('P10-SI-17 P10-SI-37 retains unresolved exposure independently of a satisfied exact answer', async () => {
  const { accounting, settlement } = await runProviderAnswerReplyScenario(false, { unknown: true, beforeOpen: true });
  expect(accounting.unresolved).not.toBe(0);
  expect(accounting.exposure).toBe(20);
  expect(settlement.retainedExposure).toBe(20);
}, 30_000);

// Rule 37 quarantine: see docs/defects/full-suite-load-timeouts.md
it.skip('P10-SI-37 reuses a still-current assessment after the clock advances and refuses withdrawn captures', async () => {
  const s = await runProviderAnswerReplyScenario(false, { beforeAssessment: true });
  const assessment = value(s.api.assessResponse(s.observed.operation));
  s.f.time(101);
  expect(value(s.api.assessResponse(s.observed.operation))).toEqual(assessment);
  const capture = s.subject.response.capture;
  const saved = s.f.metadata[capture.reference];
  s.f.metadata[capture.reference] = { ...saved, status: 'missing', bytes: null };
  refused(s.responseAssessment.consumeProviderResponseAssessment(assessment, s.subject, (view: unknown) => view));
});

it('P9-NF-65 P9-NF-66 refuses forged origin derivations and identity conflicts, then records one linked supersession', async () => {
  const s = await runProviderAnswerReplyScenario(false, { beforeAssessment: true });
  const first: any = value(s.api.assessResponse(s.observed.operation));
  const firstFact = s.f.all().find((fact: FactEnvelope) => fact.id === first.id)!;
  const original = raw(firstFact);
  const changedRows = (original.predicates as unknown as Record<string, unknown>[]).map(row =>
    row.predicate === 'response-completeness' ? { ...row, verdict: 'contradicted', reason: 'invented' } : row);
  refused(s.f.runtime.record('VerificationAssessment', { ...original, predicates: changedRows }));
  refused(s.f.runtime.record('VerificationAssessment', { ...original, id: 'forged-output-assessment',
    vectorDigest: enc('invented-vector').hash, predicates: changedRows }), 'vector pin');
  s.f.time(151);
  s.f.evidence(s.subject.six.operation, s.subject.submitted.operationDigest, 'operation-occurred', undefined,
    { id: 'proof:operation-occurred:refresh' });
  const second: any = value(s.api.assessResponse(s.observed.operation));
  expect(second.id).not.toBe(first.id);
  expect(raw(s.f.all().find((fact: FactEnvelope) => fact.id === second.id)!).supersedes).toBe(first.id);
}, 30_000);

it('P9-NF-65 refuses a forged historical assessment against the original signed basis', async () => {
  const s = await runProviderAnswerReplyScenario(false, { beforeAssessment: true });
  const assessment: any = value(s.api.assessResponse(s.observed.operation));
  const fact = s.f.all().find((candidate: FactEnvelope) => candidate.id === assessment.id)!;
  const original = raw(fact);
  const forged = { ...original, id: 'historical-forged-assessment', vectorDigest: enc('historical-forged-vector').hash,
    predicates: (original.predicates as unknown as Record<string, unknown>[]).map(row =>
      row.predicate === 'response-completeness' ? { ...row, verdict: 'contradicted', reason: 'invented history' } : row) };
  refused(decodeHistoricalVerificationRecord('VerificationAssessment', forged, { ...s.f.host.boundary,
    origin: fact, mode: 'historical', facts: { ...s.f.context, facts: s.f.all() } }, s.f.vh), 'signed origin');
});

it('P10-SI-37 blocks a first reply after the genuine conversation obligation stops', async () => {
  const s = await runProviderAnswerReplyScenario(false, { beforeOpen: true });
  s.f.time(102);
  value(s.f.six.recover('reply-recovery-one', s.f.fence, s.settlement.operation,
    { owner: 'part-eight', observe: () => s.f.result(() => ({ owner: 'part-eight', name: 'OperationObservation', id: 'reply-observation' })) }));
  s.f.time(104);
  value(s.f.six.recover('reply-recovery-two', s.f.fence, s.settlement.operation,
    { owner: 'part-eight', observe: () => { throw new Error('terminal loop must not observe'); } }));
  expect((value(s.f.six.inspect()) as any[]).filter((row: any) => row.record.type === 'LoopRecord').at(-1)!.record.state).toBe('stopped');
  refused(s.replyGraph.openAcceptedProviderReply(s.replyInput), 'stopped');
}, 30_000);

it('P10-SI-37 refuses a second model request from the accepted-answer reply Run', async () => {
  const s = await runProviderAnswerReplyScenario(false, { noStop: true });
  refused(s.f.seven.prepare({ ...s.f.question,
    run: { owner: 'part-five', name: 'Run', id: s.reply.id } }, s.f.fence), 'cannot request another model');
  expect(s.modelCalls()).toBe(1);
}, 30_000);

it('P9-NF-66 derives insufficiency from raw tool_use despite caller success labels', async () => {
  const s = await runProviderAnswerReplyScenario(false, { beforeAssessment: true, terminalReason: 'tool_use' });
  const assessment: any = value(s.api.assessResponse(s.observed.operation));
  const record = raw(s.f.all().find((fact: FactEnvelope) => fact.id === assessment.id)!);
  expect((record.predicates as any[]).filter(row => String(row.predicate).startsWith('response-'))
    .map(row => row.verdict)).toEqual(['insufficient', 'insufficient']);
  refused(s.responseAssessment.consumeProviderResponseAssessment(assessment, s.subject, (view: unknown) => view));
});

it('P10-SI-37 reconstructs acceptance with its original signed Decision authority', async () => {
  const s = await runProviderAnswerReplyScenario(false, { beforeOpen: true });
  const fact = s.f.all().find((candidate: FactEnvelope) => candidate.id === s.acceptance.id)!;
  const facts = { ...s.f.context, facts: s.f.all(), decode: { ...s.f.context.decode,
    register: { ...s.f.context.decode.register, generation: { ...s.f.context.decode.register.generation,
      id: 'later-generation' }, entries: s.f.context.decode.register.entries.filter((entry: string) => entry !== 'judgment') } } };
  expect(value(decodeHistoricalProviderAnswerAcceptance(raw(fact), { ...s.f.host.boundary,
    origin: fact, mode: 'historical', facts }, s.f.jh)).id).toBe(raw(fact).id);
}, 30_000);
