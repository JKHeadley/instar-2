// @ts-nocheck -- U4-G metadata/witness fixtures; all operational ports come from the public boot.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { prepareSnapshot } from '../../src/facts/index.js';
import { canonical, decode } from '../../src/index.js';
import { installTelegramReplyOperation, telegramConversation, assessTelegramReplyResponse } from '../../src/conversation/index.js';
import { decodeOutboundMessage, createEffectSpine, installOperationDefinition } from '../../src/effects/index.js';
import { decodeLoopPolicy } from '../../src/transport/index.js';
import { runIdFor } from '../../src/rungraph/index.js';
import { runAdmission } from '../../src/rungraph/rungraph.js';
import { createEffectSettlementAssessmentPort, createEffectAssessmentPort } from '../../src/verification/index.js';
import { createProductionProviderOwners } from '../../src/assembly/production-provider-owners.js';
import { value, privateKey, json } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';

const expect = actual => ({
  toBe: expected => assert.equal(actual, expected), toEqual: expected => assert.deepEqual(actual, expected),
  toBeNull: () => assert.equal(actual, null),
  toHaveLength: expected => assert.equal(actual.length, expected), toBeTruthy: () => assert.ok(actual),
  toContain: expected => assert.ok(actual.includes(expected)),
});
export const recordedResponseEvidenceContract = Object.freeze({ parserReference: 'claude-code-json-result', parserVersion: '1',
  evidenceContractReference: 'response-contract', evidenceContractVersion: '1', mode: 'single-final-reply',
  maxMetadataBytes: 5000, maxRawTerminalBytes: 2048, maxCaptureBytes: 65000 });

/** The installed offline serving profile's turn policy. Identities derive from
 * Four's durable opening; the provider and reply still use the same owners. */
export function createRecordedServingPlan(installed, target) {
  const f = installed.f, application = installed.application, context = f.ctx, dc = context.decode;
  const rows = () => value(f.store.read());
  const raw = fact => fact.body.record;
  const reference = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id,
    kind: fact.kind, schemaVersion: fact.schemaVersion, contentHash: fact.contentHash });
  const shortRef = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
  const byRecord = (kind, id) => rows().find(fact => fact.kind === kind && raw(fact)?.id === id);
  const plan = { ...verificationInput('VerificationPlan'), id: 'boot-context-plan',
    subject: { ...verificationInput('VerificationPlan').subject, generation: f.run.generation.id },
    bar: { ...verificationInput('VerificationPlan').bar, version: 'live-input-bar', sources: ['probe'] } };
  if (!value(installed.runtime.inspectCurrent()).some(row => row.record.id === plan.id))
    value(installed.runtime.record('VerificationPlan', plan));
  for (const evidence of f.evidence) if (!rows().some(row => row.kind === 'evidence-record'
    && row.body.evidence?.id === evidence.id)) f.append('evidence-record', json({ evidence }));
  dc.register.entries.push('provider-call', 'telegram-ordinary-reply', installed.admitted.id);
  const providerDefinition = { type: 'OperationDefinition', schemaVersion: 1, id: 'boot-provider-definition',
    feature: 'provider-call', version: 'boot-provider-version', generation: f.run.generation.id,
    adapter: 'route', account: 'test-provider', conversation: 'recorded provider', speaker: f.bob.id,
    scopeDigest: value(canonical(f.scope)).hash, durability: 'local-durable', replicas: 0,
    lossModel: 'Recorded local bytes, no remote durability claim.', maxBytes: 4096,
    maxCharge: 20, timeout: 100, verificationBar: 'provider-bar' };
  const approval = f.authorize({ id: 'boot-provider-approval',
    artifact: f.capture(value(canonical(providerDefinition)).bytes), base: 'boot-provider-base' });
  const current = f.owners.host.current;
  f.owners.host.current = () => ({ ...current(), versions: [...current().versions,
    { id: providerDefinition.version, subject: providerDefinition.feature, content: json(providerDefinition),
      contentHash: value(canonical(providerDefinition)).hash, since: rows().find(row => row.kind === 'intake-admitted')?.id ?? f.opening.id,
      supersedes: [], approvedIn: approval, base: approval.base, landedIn: null }] });
  if (!byRecord('effect-OperationDefinition', providerDefinition.id)) value(installOperationDefinition(
    providerDefinition, f.owners.host, createEffectSpine(f.owners.host, { context, privateKey }, f.store)));
  const questions = new Map(), subjects = new Map(), replyRuns = new Map(), providerOwners = new Map(), sourceBasis = { version: '1', parserReference: 'claude-code-json-result', parserVersion: '1',
    endpoint: 'local-provider', account: 'local-account', credentialReference: 'credential',
    controller: 'confined-custodian', executableArtifact: `sha256:${'1'.repeat(64)}`,
    provider: 'test-provider', model: 'model', route: 'route' };
  const terminalBasis = { version: '1', parserReference: 'claude-code-json-result', parserVersion: '1',
    terminalReasonField: 'stop_reason', successfulFinalReplyReasons: ['end_turn'] };
  const authority = (id, predicate, basis) => {
    const existing = rows().find(row => row.kind === 'evidence-record' && row.body.evidence?.id === id);
    if (existing) return existing.body.evidence.id;
    const capture = value(installed.captures.put(value(canonical(basis)).bytes, 4096));
    const evidence = value(decode('Evidence', f.evidenceInput({ id, capture,
      claim: { subject: 'response-contract', predicate, value: basis }, source: 'probe',
      observedAt: f.deps.clock(), freshFor: 1000, strength: 'proof' }), dc));
    f.evidence.push(evidence); f.append('evidence-record', json({ evidence }));
    return evidence.id;
  };
  const sourceEvidence = authority('serving-response-source-contract', 'provider-response-source-contract', sourceBasis);
  const terminalEvidence = authority('serving-response-terminal-contract', 'provider-response-terminal-contract', terminalBasis);
  const evidenceContract = recordedResponseEvidenceContract;
  const responseDraft = (bytes, answer) => {
    const frame = JSON.stringify({ type: 'result', is_error: false, result: answer, session_id: 'serving-call',
      stop_reason: 'end_turn', usage: { input_tokens: 2, output_tokens: 3 }, total_cost_usd: 0.000003 });
    const rawBytes = Buffer.from(frame);
    return { eligibility: 'admitted', contract: evidenceContract,
      basis: { sourceEvidence: [sourceEvidence], terminalEvidence,
        terminalReasonField: 'stop_reason', successfulFinalReplyReasons: ['end_turn'] },
      source: { controller: 'confined-custodian', evidence: [sourceEvidence], endpoint: 'local-provider',
        account: 'local-account', credentialReference: 'credential', executableArtifact: `sha256:${'1'.repeat(64)}`,
        provider: 'test-provider', model: 'model', route: 'route', call: 'serving-call',
        submittedDigest: value(canonical(bytes)).hash, strength: 'observation' },
      terminal: { rawBase64: rawBytes.toString('base64'), rawDigest: `sha256:${createHash('sha256').update(rawBytes).digest('hex')}`,
        evidence: terminalEvidence, reason: 'successful-final-reply', providerReason: 'end_turn',
        limited: false, errored: false, cancelled: false, timedOut: false, truncated: false, toolCall: false },
      answer: { extractionContract: 'claude-code-json-result:1', answerDigest: 'sha256:' + createHash('sha256').update(answer).digest('hex') } };
  };
  const providerQuestion = turn => {
    const existing = questions.get(turn.opening);
    if (existing) return existing;
    const step = installed.f.last()?.grounding.step;
    const question = { id: `boot-question:${turn.opening}`, run: { owner: 'part-five', name: 'Run', id: f.id },
      step, ordinal: 0, semanticMessage: `operation:${turn.opening}`,
      question: 'May the worker produce its bounded reply?',
      context: `Current delivered context for ${turn.opening} was consumed by the native owner path.`,
      evidence: ['e1', 'e2'], deadline: 400 };
    questions.set(turn.opening, question); return question;
  };
  const settleContext = () => {
    const request = rows().filter(row => row.kind === 'effect-EffectRequest'
      && raw(row)?.message && rows().some(message => message.kind === 'effect-OutboundMessage'
        && raw(message)?.id === raw(row).message && raw(message).purpose === 'context-delivery')).at(-1)?.body.record;
    if (!request) throw Error('context request absent');
    const response = rows().find(row => row.kind === 'effect-OperationObservation'
      && raw(row)?.request === request.id && raw(row).stage === 'response')?.body.record;
    if (!response) throw Error('context response absent');
    if (value(f.effects.transport.inspect()).some(row => row.record.type === 'SettlementApplication'
      && row.record.operation === response.operation)) return;
    const capture = response.capture, sourceBytes = context.captures[capture.reference].bytes;
    dc.captures[capture.reference] = sourceBytes;
    for (const [predicate, amount] of [['operation-occurred', null], ['charge-settled', 0], ['old-executor-quiescent', null]]) {
      const id = `serving-context-proof:${response.operation}:${predicate}`;
      if (rows().some(row => row.kind === 'evidence-record' && row.body.evidence?.id === id)) continue;
      const evidence = value(decode('Evidence', f.evidenceInput({ id, capture,
        claim: { subject: response.operation, predicate, value: { digest: request.digest,
          ...(amount === null ? {} : { amount }) } }, source: 'probe', observedAt: f.deps.clock(),
        freshFor: 100, strength: 'proof' }), dc));
      f.evidence.push(evidence); f.append('evidence-record', json({ evidence }));
    }
    value(f.effects.transport.settle(f.effects.fence, value(f.effects.api.settle(response.operation))));
  };
  const evidenceFor = (operation, digest, predicate, amount) => {
    const id = `serving-provider-proof:${operation}:${predicate}`;
    if (rows().some(row => row.kind === 'evidence-record' && row.body.evidence?.id === id)) return;
    const capture = value(installed.captures.put(value(canonical({ operation, digest, predicate, amount })).bytes, 4096));
    const evidence = value(decode('Evidence', f.evidenceInput({ id, capture,
      claim: { subject: operation, predicate, value: { digest, ...(amount === null ? {} : { amount }) } },
      source: 'probe', observedAt: f.deps.clock(), freshFor: 100, strength: 'proof' }), dc));
    f.evidence.push(evidence); f.append('evidence-record', json({ evidence }));
  };
  const replyDefinition = () => {
    const conversation = telegramConversation(installed.declaration.bot.id, target);
    const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'boot-telegram-reply-definition',
      feature: 'telegram-ordinary-reply', version: 'telegram:9.2:ordinary-reply:v1',
      generation: f.run.generation.id, adapter: installed.admitted.id, account: installed.admitted.account,
      conversation, speaker: f.bob.id, scopeDigest: value(canonical(f.scope)).hash,
      durability: 'local-durable', replicas: 0,
      lossModel: 'Recorded local bytes; replication admitted only through the U4-C fixture handle.',
      maxBytes: installed.declaration.limits.maxReplyBytes, maxCharge: installed.declaration.limits.maxCharge,
      timeout: installed.declaration.limits.timeout, verificationBar: 'boot-telegram-reply-bar' };
    if (byRecord('effect-OperationDefinition', definition.id)) return definition;
    const approved = f.authorize({ id: 'boot-telegram-reply-approval',
      artifact: f.capture(value(canonical(definition)).bytes), base: 'boot-telegram-reply-base' });
    const prior = f.owners.host.current;
    f.owners.host.current = () => ({ ...prior(), versions: [...prior().versions,
      { id: definition.version, subject: definition.feature, content: json(definition),
        contentHash: value(canonical(definition)).hash, since: f.opening.id,
        supersedes: [], approvedIn: approved, base: approved.base, landedIn: null }] });
    value(installTelegramReplyOperation({ id: definition.id, generation: definition.generation,
      admitted: installed.admitted, target, speaker: definition.speaker,
      scopeDigest: definition.scopeDigest, durability: definition.durability, replicas: 0,
      lossModel: definition.lossModel, verificationBar: definition.verificationBar }, f.owners.host,
    createEffectSpine(f.owners.host, { context, privateKey }, f.store)));
    return definition;
  };
  const serving = {
    providerOwners(turn) {
      const previous = providerOwners.get(turn.opening);
      if (previous) return previous;
      const owners = value(createProductionProviderOwners({ ...installed.owners.provider,
        judgment: { ...installed.owners.provider.judgment, runs: application.owners.run },
        effect: { ...installed.owners.provider.effect, plan: `boot-provider-plan:${turn.opening}` } }));
      providerOwners.set(turn.opening, owners);
      return owners;
    },
    open(turn, history) {
      const opening = rows().find(row => row.id === turn.opening);
      if (!opening) throw Error('turn opening absent');
      f.bindIntake(opening);
      installed.contextHistory = history;
      if (history.some(item => item.acceptedReply)) {
        const preserved = value(f.deps.governance.capture.preserve(f.run));
        value(runAdmission(f.run, { ...f.runContext, preserved,
          facts: { ...f.runContext.facts, facts: rows() } }, f.deps.governance));
      }
      return f.run;
    },
    grounding(turn) {
      installed.placeTurn(f.opening);
      return { worker: 'w', harness: 'native', reason: 'start', ownership: f.lease };
    },
    pending(turn, ready, grounding) {
      const question = providerQuestion(turn);
      const submitted = value(canonical({ provider: 'test-provider', model: 'model', route: 'route',
        messages: [{ role: 'user', content: question.question }, { role: 'context', content: question.context }],
        attachments: [], tools: [], settings: { automaticRetries: 0, maxTokens: 128 },
        outputSchema: { type: 'Decision' }, floor: f.floor, evidence: question.evidence,
        point: 'judgment', generation: f.run.generation.id })).bytes;
      const transition = f.start(ready, grounding, question.semanticMessage);
      return { ...transition, step: { ...transition.step,
        operation: { ...transition.step.operation, key: question.semanticMessage,
          digest: value(canonical(submitted)).hash } } };
    },
    question: providerQuestion,
    providerEffect(turn, prepared) {
      settleContext();
      const obligation = rows().filter(row => row.kind === 'transport-LoopRecord'
        && raw(row)?.run === f.id).at(-1);
      if (!obligation) throw Error('provider loop absent');
      return { prepared, definition: providerDefinition.id, verificationOwner: 'independent-probe',
        resultDestination: turn.opening, obligation: obligation.id };
    },
    prepareAssessment(turn, operation) {
      const reservationRows = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
        && row.record.operation === operation);
      const consumed = reservationRows.find(row => row.record.state === 'consumed');
      const claim = reservationRows.find(row => row.record.state === 'dispatch-claimed');
      if (!consumed || !claim) throw Error('provider claim absent');
      const effect = byRecord('effect-provider-ProviderEffectRequest', consumed.record.request);
      const q = raw(effect), requestFact = rows().find(row => row.id === q.payload.request.id);
      const preparedFact = rows().find(row => row.id === q.payload.prepared.id);
      const responseFact = rows().find(row => row.kind === 'judgment-provider-ProviderJudgmentAttemptRecord'
        && raw(row)?.request === raw(requestFact).id && raw(row).phase === 'response-observed');
      const executor = rows().find(row => row.kind === 'effect-provider-ProviderOperationObservation'
        && raw(row)?.operation === operation && raw(row).stage === 'executor-accepted');
      const response = rows().find(row => row.kind === 'effect-provider-ProviderOperationObservation'
        && raw(row)?.operation === operation && raw(row).stage === 'response');
      if (!requestFact || !preparedFact || !responseFact || !executor || !response) throw Error('provider response facts absent');
      const receipt = raw(responseFact).receipt;
      const envelope = JSON.parse(context.captures[receipt.reference].bytes).responseEvidence;
      if (!envelope) throw Error('provider response evidence absent');
      const request = raw(requestFact);
      const subject = {
        seven: { request: reference(requestFact), prepared: reference(preparedFact), attempt: q.attempt,
          response: reference(responseFact) },
        eight: { request: reference(effect), executorObservation: reference(executor),
          responseObservation: reference(response) },
        six: { operation, consumedReservation: reference(consumed.fact), dispatchClaim: reference(claim.fact) },
        submitted: { capture: q.payload.submitted, operationDigest: q.digest },
        route: { provider: q.payload.provider, model: q.payload.model, route: q.payload.route,
          routeBasis: String(request.routeBasis), floorDigest: String(request.floorDigest),
          evidence: request.evidence, evidenceDigest: value(canonical(request.evidence)).hash,
          settingsDigest: q.payload.settingsDigest, outputSchemaDigest: q.payload.outputSchemaDigest },
        response: { capture: envelope.answer.source, answerDigest: envelope.answer.answerDigest,
          parserReference: envelope.contract.parserReference, parserVersion: envelope.contract.parserVersion,
          evidenceContractReference: envelope.contract.evidenceContractReference,
          evidenceContractVersion: envelope.contract.evidenceContractVersion },
        terminal: { evidence: envelope.terminal.evidence, capture: envelope.terminal.raw,
          rawDigest: envelope.terminal.rawDigest, sourceEvidence: envelope.source.evidence },
      };
      subjects.set(turn.opening, subject);
      for (const [predicate, amount] of [['operation-occurred', null], ['charge-settled', 3],
        ['old-executor-quiescent', null]]) evidenceFor(operation, q.digest, predicate, amount);
      const legacy = verificationInput('VerificationPlan');
      const planId = `boot-provider-plan:${turn.opening}`;
      if (!value(installed.runtime.inspectCurrent()).some(row => row.record.id === planId))
        value(installed.runtime.record('VerificationPlan', { ...legacy, type: 'VerificationPlan', schemaVersion: 2,
          purpose: 'output-use', id: planId, subject: { ...legacy.subject,
            generation: f.run.generation.id, scope: f.scope.kind === 'organization' ? 'project-a' : f.scope.members[0] },
          bar: { ...legacy.bar, version: q.verificationBar,
            predicates: ['occurrence', 'non-occurrence', 'quiescence', 'charge', 'response-authenticity', 'response-completeness'],
            sources: ['probe'], minimumStrength: 'proof', subjectDigest: value(canonical(subject)).hash,
            captureRequired: true, freshness: 50 },
          responseContract: { parserReference: evidenceContract.parserReference,
            parserVersion: evidenceContract.parserVersion,
            evidenceContractReference: evidenceContract.evidenceContractReference,
            evidenceContractVersion: evidenceContract.evidenceContractVersion, mode: 'single-final-reply' },
          responseRequirements: [
            { predicate: 'response-authenticity', sources: [f.owners.host.principal.id],
              minimumStrength: 'observation', requiredContract: 'response-contract' },
            { predicate: 'response-completeness', sources: [f.owners.host.principal.id],
              minimumStrength: 'observation', requiredContract: 'response-contract' },
          ] }));
    },
    acceptance(turn, facts, assessment, settlement, accounting) {
      const settlementFact = facts.find(row => row.kind === 'effect-provider-ProviderEffectSettlement'
        && raw(row)?.id === settlement.id);
      const accountingFact = rows().find(row => row.kind === 'transport-SettlementApplication'
        && raw(row)?.operation === accounting.operation && raw(row).settlement === settlement.id);
      if (!settlementFact || !accountingFact) throw Error('provider settlement facts absent');
      return { subject: subjects.get(turn.opening), assessment, settlement: reference(settlementFact),
        accounting: reference(accountingFact) };
    },
    replyOpening(turn, acceptance) {
      const conflicts = value(prepareSnapshot(rows(), context)).entries
        .filter(entry => entry.conflicts.length).map(entry => [entry.fact.id, entry.fact.kind, entry.conflicts]);
      if (conflicts.length) throw Error(`accepted projection conflicts: ${JSON.stringify(conflicts)}`);
      const accepted = value(application.owners.provider.eight.consumeAcceptedProviderAnswer(acceptance, view => view));
      const fact = rows().find(row => row.id === acceptance.id);
      const opening = shortRef(fact), original = value(application.owners.run.read(accepted.originalRun)).run;
      const reply = { ...original, id: runIdFor(opening), opening };
      value(f.deps.governance.capture.preserve(reply));
      replyRuns.set(turn.opening, { reply: reply.id, acceptance });
      return { acceptance, originalRun: accepted.originalRun, expected: accepted.predecessor,
        obligation: shortRef(rows().find(row => row.id === accepted.obligation)),
        standing: original.owner.fact, ownership: f.lease, fence: f.effects.fence, reply };
    },
    replyPolicy(turn) { return value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1,
      id: `serving-reply-loop:${turn.opening}`, maxAttempts: 1, minDelay: 1, maxDuration: 1000, timeout: 100,
      concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, f.c)); },
    replyRoute() { return { admitted: installed.admitted, target }; },
    replyEffect(turn) {
      const definition = replyDefinition();
      const prepared = replyRuns.get(turn.opening);
      if (!prepared) throw Error('reply Run absent');
      const acceptance = rows().find(row => row.id === prepared.acceptance.id);
      const accepted = value(application.owners.provider.eight.consumeAcceptedProviderAnswer(
        { owner: 'part-seven', name: 'ProviderAnswerAcceptance', id: acceptance.id }, view => view));
      const message = value(decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1,
        id: `serving-telegram-reply:${turn.opening}`, semanticMessage: `reply:${turn.opening}`,
        run: prepared.reply, speaker: f.bob.id, account: installed.admitted.account,
        conversation: definition.conversation, text: accepted.answer, purpose: 'ordinary-reply',
        sourceResult: acceptance.id }, f.owners.host));
      const loop = rows().find(row => row.kind === 'transport-LoopRecord' && raw(row)?.run === prepared.reply);
      return { definition: definition.id, message, run: { owner: 'part-five', name: 'Run', id: prepared.reply },
        pending: acceptance.id, attempt: `serving-reply-attempt:${turn.opening}`,
        verificationOwner: 'independent-probe', obligation: loop.id,
        closure: [acceptance.id, accepted.settlement.id], fence: f.effects.fence };
    },
  };
  return { plan: serving, responseDraft, evidenceContract };
}
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
