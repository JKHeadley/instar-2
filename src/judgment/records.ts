import { consumeResult, decode } from '../index.js';
import type { BoundaryContext, Clock, Decision, Json, Result } from '../index.js';
import { authorAndAppend, causalCone, registerOwnedBody } from '../facts/index.js';
import type { FactEnvelope, FactSchema, FactStorePort, OwnedBodyContext, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import type { AdmissionReservation } from '../transport/index.js';
import type { BenchmarkRecord, BenchmarkRunRecord, BenchmarkScenario, Capture, JudgmentAttemptRecord, JudgmentAuthor, JudgmentFact, JudgmentHost, JudgmentRecord, JudgmentRequest, JudgmentSpine, ProviderObservation } from './contracts.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { observationCheck } from './model-adapter.js';

const txt = { kind: 'text', maxLength: 256 } as const, int = { kind: 'integer' } as const, capture = { kind: 'capture' } as const;
const ref = { kind: 'object', fields: { owner: txt, name: txt, id: txt } } as const;
const captures = { kind: 'array', maxLength: 256, items: capture } as const;
const texts = { kind: 'array', maxLength: 256, items: txt } as const;
const factRow = { type: txt, schemaVersion: int, id: txt, predecessor: txt };
const row = { ...factRow, request: txt };
export const judgmentShapes: Readonly<Record<string, OwnedShape>> = freeze({
  JudgmentRequest: { kind: 'object', fields: { ...row, logicalKey: txt, inputDigest: txt, run: txt, step: txt, ordinal: int, semanticMessage: txt, effectRequest: txt,
    point: txt, consumer: txt, generation: txt, incarnation: txt, deadline: int, question: capture, context: capture, submitted: capture,
    route: txt, evidence: { kind: 'array', maxLength: 64, items: txt }, maxInputBytes: int, maxOutputBytes: int, maxCharge: int } },
  JudgmentAttemptRecord: { kind: 'object', fields: { ...row, attempt: txt, phase: txt, operation: txt, reservation: txt, receipt: capture }, optional: ['operation', 'reservation', 'receipt'] },
  JudgmentResolution: { kind: 'object', fields: { ...row, attempt: txt, disposition: txt, response: txt, accounting: txt, decoded: txt } },
  BenchmarkRecord: { kind: 'object', fields: { ...factRow,
    provenance: { kind: 'object', fields: { kind: txt, request: ref, generation: txt, vector: txt, fixture: txt, productionDerived: { kind: 'boolean' } },
      optional: ['request', 'generation', 'vector', 'fixture', 'productionDerived'] },
    request: ref, requestDigest: txt, resolution: ref, run: txt, step: txt, logicalKey: txt, recordingPrincipal: txt,
    sourceGeneration: txt, scenarioClass: txt, inputDigest: txt, compatibilityDigest: txt,
    attempts: { kind: 'array', maxLength: 256, items: ref }, captureReferences: captures,
    decision: { kind: 'object', fields: { state: txt, id: txt }, optional: ['id'] },
    conclusionEvidence: texts, reasonEvidence: texts, outcomeReferences: texts, usageReferences: texts } },
  BenchmarkScenario: { kind: 'object', fields: { ...factRow, version: txt, source: ref, sourceGrade: ref,
    pinnedGeneration: txt, pinnedVector: txt, scenarioClass: txt, promotionDecision: txt, replayInput: capture,
    originalInputHash: txt, transformedInputHash: txt, transformationVersion: txt, changedSemanticFields: texts,
    unavailableSemanticFields: texts, excludedAnswerFields: texts, excludedOutcomeFields: texts, floorDigest: txt,
    outputSchemaDigest: txt, evaluationContract: txt, dataScope: txt, captureAvailability: txt } },
  BenchmarkRunRecord: { kind: 'object', fields: { ...factRow, suite: txt, suiteVersion: txt,
    scenarios: { kind: 'array', maxLength: 256, items: { kind: 'object', fields: { scenario: ref, version: txt } } },
    candidates: { kind: 'array', maxLength: 256, items: { kind: 'object', fields: { route: txt, samples: int } } },
    criterionDigest: txt, inputDigest: txt, compatibilityDigest: txt, heldOutPartition: txt, run: ref,
    startedAt: int, stoppedAt: int,
    executions: { kind: 'array', maxLength: 4096, items: { kind: 'object', fields: { scenario: ref, candidate: txt,
      ordinal: int, disposition: txt, attempt: ref, resolution: ref, usage: texts, detail: txt }, optional: ['attempt', 'resolution', 'detail'] } } } },
});
export const kindFor = (name: string) => `judgment-${name}`;
export function judgmentSchemas(host: JudgmentHost): readonly FactSchema[] {
  return Object.keys(judgmentShapes).map(name => ({ kind: kindFor(name), version: 1,
    fields: { record: { kind: 'owned', owner: 'part-seven', name }, result: { kind: 'constitutional', type: 'Result' },
      decision: { kind: 'constitutional', type: 'Decision' }, outcome: { kind: 'constitutional', type: 'Outcome' },
      evidence: { kind: 'constitutional', type: 'Evidence' } }, optional: ['result', 'decision', 'outcome', 'evidence'],
    machineScope: 'shared', standing: 'requester', action: 'work', scope: host.transport.scope,
    causallyBound: false, requiredReferences: [], authority: 'none' }));
}
export function rows(facts: readonly FactEnvelope[]): JudgmentFact[] {
  return facts.filter(f => Object.keys(judgmentShapes).some(n => f.kind === kindFor(n)))
    .map(fact => ({ fact, record: (fact.body as { record: Json }).record as unknown as JudgmentRecord }));
}
export function requestIn(all: readonly JudgmentFact[]): JudgmentRequest | undefined {
  return all.find((v): v is JudgmentFact & { record: JudgmentRequest } => v.record.type === 'JudgmentRequest')?.record;
}
export function phaseIn(all: readonly JudgmentFact[], phase: JudgmentAttemptRecord['phase']): JudgmentFact & { record: JudgmentAttemptRecord } | undefined {
  return all.find((v): v is JudgmentFact & { record: JudgmentAttemptRecord } => v.record.type === 'JudgmentAttemptRecord' && v.record.phase === phase);
}
export function decisionFrom(observation: ProviderObservation, request: JudgmentRequest, host: JudgmentHost, c: BoundaryContext): Result<Decision> {
  return boundary('JudgmentAnswerDecode', observation, c, () => {
    ensure(observation.state === 'complete' && observation.bytes !== null && !observation.limitation, `provider ${observation.state}: no usable answer`);
    ensure(observation.usage.charge === null || observation.usage.charge <= request.maxCharge, 'observed liability exceeds reservation');
    const decision = take(decode('Decision', JSON.parse(observation.bytes) as unknown, host.transport.current().decode));
    ensure(decision.floor && 'judgment' in decision.by, 'model answer requires floor and model attribution');
    ensure(encoded(decision.floor.allowed).bytes === encoded(host.floor).bytes, 'answer widened or replaced floor');
    ensure(decision.by.judgment === request.point && decision.by.route === request.route && decision.by.model === host.description.model, 'answer route attribution differs');
    ensure([...decision.conclusion.evidence, ...decision.reason.evidence].every(e => request.evidence.includes(e)), 'answer invented context evidence');
    return decision;
  });
}
export function providerEvidence(receipt: Capture, content: string, operation: string, at: Clock, host: JudgmentHost) {
  const dc = host.transport.current().decode;
  return take(decode('Evidence', { type: 'Evidence', schemaVersion: 1, id: `provider:${receipt.hash}`,
    claim: { subject: operation, predicate: 'provider-observation-recorded', value: receipt.hash },
    source: host.transport.principal.provenance.adapter, observedAt: at, freshFor: 0, capture: receipt, strength: 'observation' },
  { ...dc, captures: { ...dc.captures, [receipt.reference]: content } }));
}
export function unsettledOutcome(response: JudgmentFact & { record: JudgmentAttemptRecord }, content: string, host: JudgmentHost) {
  const evidence = providerEvidence(response.record.receipt!, content, response.record.operation!, response.fact.at, host);
  const dc = host.transport.current().decode;
  return take(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: 'uncertain', evidence: [evidence.id] }, { ...dc, evidence: [...dc.evidence ?? [], evidence] }));
}
export function registerJudgmentBodies(host: JudgmentHost, c: BoundaryContext): Result<readonly OwnedBodyRegistration[]> {
  return boundary('JudgmentRegistrations', null, c, () => Object.entries(judgmentShapes).map(([name, shape]) => take(registerOwnedBody({
    name, owner: 'part-seven', currentVersion: 1, versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: (v, ctx) => {
      try { validate(v as unknown as JudgmentRecord, ctx, host, c); return { ok: true, value: freeze(v) }; }
      catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'judgment record refused' }; }
    },
  }, shape, c))));
}
function validate(r: JudgmentRecord, ctx: OwnedBodyContext, host: JudgmentHost, c: BoundaryContext): void {
  const all = rows(causalCone(ctx.origin, ctx.facts.facts));
  ensure(ctx.origin.machine === host.transport.machine && ctx.origin.principal.id === host.transport.principal.id
    && ctx.origin.principal.kind === host.transport.principal.kind, 'judgment recorder identity mismatch');
  ensure(all.every(v => v.fact.machine === host.transport.machine && v.fact.principal.id === host.transport.principal.id), 'untrusted judgment predecessor');
  ensure(r.schemaVersion === 1 && ctx.origin.kind === kindFor(r.type) && r.id.length > 0, 'judgment identity/version');
  ensure(r.predecessor === (all.at(-1)?.fact.id ?? ''), 'judgment predecessor changed');
  ensure(!all.some(v => v.record.id === r.id), 'duplicate judgment record identity');
  if (ctx.mode === 'origin') ensure(r.predecessor === (rows(ctx.facts.facts).at(-1)?.fact.id ?? ''), 'stale judgment origin predecessor');
  const body = ctx.origin.body as Record<string, Json>;
  if (r.type === 'BenchmarkRecord' || r.type === 'BenchmarkScenario' || r.type === 'BenchmarkRunRecord') {
    validateBenchmark(r, all, ctx, host); ensure(body.result === undefined && body.decision === undefined && body.outcome === undefined && body.evidence === undefined,
      'benchmark records do not contain grading or constitutional conclusions'); return;
  }
  ensure(r.request.length > 0, 'judgment request identity');
  if (!(r.type === 'JudgmentAttemptRecord' && r.phase === 'accounting-observed')) ensure(body.outcome === undefined, 'Outcome belongs to accounting observation');
  if (!(r.type === 'JudgmentAttemptRecord' && r.phase === 'response-observed')) ensure(body.evidence === undefined, 'provider evidence belongs to response');
  const bytes = (cap: Capture): string | undefined => {
    const content = ctx.facts.captures[cap.reference];
    return content?.status === 'available' && content.bytes !== null ? content.bytes : undefined;
  };
  if (r.type === 'JudgmentRequest') {
    ensure(all.length === 0 && r.request === r.id && r.ordinal >= 0 && r.run.length > 0 && r.step.length > 0
      && r.semanticMessage.length > 0 && r.effectRequest.length > 0, 'slice accepts one logical question');
    ensure(r.logicalKey === encoded([r.run, r.step, r.ordinal]).hash, 'logical question identity');
    ensure(r.point === host.point && r.consumer === 'advisory' && r.route === host.description.route, 'unknown judgment point or route');
    ensure(r.maxCharge === host.description.maxCharge && r.maxInputBytes === host.description.maxInputBytes
      && r.maxOutputBytes === host.description.maxOutputBytes, 'caller changed registered bounds');
    ensure(r.deadline >= 0 && r.evidence.length === new Set(r.evidence).size, 'invalid deadline/evidence');
    if (ctx.mode === 'origin') ensure(r.generation === host.transport.current().generation.id && r.incarnation === host.transport.incarnation, 'stale request generation/incarnation');
    const submitted = bytes(r.submitted), question = bytes(r.question), context = bytes(r.context);
    if (submitted !== undefined && question !== undefined && context !== undefined) {
      ensure(encoded(submitted).hash === r.inputDigest, 'submitted digest changed');
      const wire = JSON.parse(submitted) as { provider: string; model: string; route: string; input: Record<string, unknown> };
      ensure(wire.provider === host.description.provider && wire.model === host.description.model && wire.route === r.route, 'submitted route mismatch');
      ensure(wire.input.question === question && wire.input.context === context
        && encoded(wire.input.floor).bytes === encoded(host.floor).bytes && encoded(wire.input.evidence).bytes === encoded(r.evidence).bytes
        && wire.input.deadline === r.deadline && wire.input.generation === r.generation && wire.input.point === r.point,
      'submitted manifest differs from request');
    }
    ensure(body.result === undefined && body.decision === undefined, 'request cannot contain answer'); return;
  }
  const request = requestIn(all); ensure(request && r.request === request.id, 'missing owning question');
  ensure(!all.some(v => v.record.type === 'JudgmentResolution'), 'terminal question cannot reopen');
  ensure(r.attempt === `attempt:${request.id}:1`, 'slice has one immutable attempt');
  const phases = ['prepared', 'dispatch-observed', 'response-observed', 'accounting-observed', 'decode-observed'];
  const previous = all.filter(v => v.record.type === 'JudgmentAttemptRecord');
  if (r.type === 'JudgmentAttemptRecord') {
    ensure(r.phase === phases[previous.length], 'attempt phase skipped or repeated');
    if (r.phase === 'prepared') ensure(r.operation === undefined && r.reservation === undefined && r.receipt === undefined, 'prepared is explicitly not reserved');
    else {
      ensure(r.operation && r.reservation, 'phase requires six operation/reservation');
      const reservation = causalCone(ctx.origin, ctx.facts.facts).find(f => f.id === r.reservation);
      const op = (reservation?.body as { record?: AdmissionReservation } | undefined)?.record;
      ensure(reservation?.kind === 'transport-AdmissionReservation' && op?.state === 'consumed' && op.operation === r.operation && op.attempt === r.attempt
        && op.request === request.effectRequest && op.semanticMessage === request.semanticMessage && op.digest === request.inputDigest && op.charge === request.maxCharge && op.run === request.run,
      'phase lacks exact consumed six claim');
      const first = phaseIn(all, 'dispatch-observed');
      if (first) ensure(r.operation === first.record.operation && r.reservation === first.record.reservation, 'attempt remapped operation');
      if (r.phase === 'response-observed') {
        ensure(r.receipt, 'response requires captured receipt');
        const consumed = causalCone(ctx.origin, ctx.facts.facts).some(f => {
          const a = (f.body as { record?: AdmissionReservation }).record;
          return f.kind === 'transport-AdmissionReservation' && a !== undefined && a.operation === r.operation && a.state === 'consumed';
        }); ensure(consumed, 'response without consumed dispatch claim');
        const content = bytes(r.receipt); if (content !== undefined) {
          observationCheck(JSON.parse(content) as ProviderObservation, host.description);
          ensure(encoded(body.evidence).bytes === encoded(providerEvidence(r.receipt, content, r.operation, ctx.origin.at, host)).bytes, 'provider observation evidence inflated or changed');
        }
      } else ensure(r.receipt === undefined, 'receipt belongs only to response phase');
      if (r.phase === 'accounting-observed') {
        const response = phaseIn(all, 'response-observed'); ensure(response?.record.receipt, 'accounting requires receipt');
        const content = bytes(response.record.receipt);
        if (content !== undefined) ensure(encoded(body.outcome).bytes === encoded(unsettledOutcome(response, content, host)).bytes, 'provider receipt is not settled effect evidence');
      }
    }
    if (r.phase !== 'decode-observed') { ensure(body.result === undefined && body.decision === undefined, 'answer before decode phase'); return; }
  } else {
    ensure(previous.length === phases.length, 'resolution requires all durable attempt phases');
    ensure(r.response === phaseIn(all, 'response-observed')?.fact.id && r.accounting === phaseIn(all, 'accounting-observed')?.fact.id
      && r.decoded === phaseIn(all, 'decode-observed')?.fact.id, 'resolution must link actual receipt/accounting/decode facts');
  }
  const response = phaseIn(all, 'response-observed')?.record.receipt; ensure(response, 'missing response record');
  const content = bytes(response);
  if (content !== undefined) {
    const result = decisionFrom(JSON.parse(content) as ProviderObservation, request, host, c);
    ensure(encoded(body.result).bytes === encoded(result).bytes, 'recorded Result differs from captured answer');
    consumeResult(result, { Success: d => {
      ensure(encoded(body.decision).bytes === encoded(d).bytes, 'recorded Decision differs from captured answer');
      if (r.type === 'JudgmentResolution') ensure(r.disposition === 'decided', 'decided disposition required');
    }, Refused: () => {
      ensure(body.decision === undefined, 'refused provider cannot produce Decision');
      if (r.type === 'JudgmentResolution') ensure(r.disposition === 'refused', 'refused disposition required');
    } });
  }
}
function owned(reference: { readonly owner: string; readonly name: string; readonly id: string }, owner: string, name: string): void {
  ensure(reference.owner === owner && reference.name === name && reference.id.length > 0, `${name} owner/reference mismatch`);
}
function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return encoded(left).bytes === encoded(right).bytes;
}
function sameCaptures(left: readonly Capture[], right: readonly Capture[]): boolean {
  return encoded(left).bytes === encoded(right).bytes;
}
function captureBytes(ctx: OwnedBodyContext, value: Capture): string | undefined {
  const captured = ctx.facts.captures[value.reference];
  if (captured?.status !== 'available' || captured.bytes === null || captured.hash !== value.hash) {
    ensure(ctx.mode === 'historical', 'benchmark replay capture unavailable'); return undefined;
  }
  return captured.bytes;
}
function containsExcludedField(value: unknown, excluded: string): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => containsExcludedField(item, excluded));
  const object = value as Record<string, unknown>;
  if (Object.hasOwn(object, excluded)) return true;
  return Object.values(object).some(item => containsExcludedField(item, excluded));
}
function executionObservation(id: string, request: string, all: readonly JudgmentFact[], ctx: OwnedBodyContext,
  host: JudgmentHost): JudgmentFact & { record: JudgmentAttemptRecord } {
  const response = all.find((v): v is JudgmentFact & { record: JudgmentAttemptRecord } =>
    v.fact.id === id && v.record.type === 'JudgmentAttemptRecord' && v.record.request === request);
  ensure(response?.record.phase === 'response-observed' && response.record.receipt,
    'benchmark usage reference is not a response observation');
  const bytes = captureBytes(ctx, response.record.receipt);
  if (bytes !== undefined) {
    let observation: ProviderObservation;
    try { observation = JSON.parse(bytes) as ProviderObservation; } catch { ensure(false, 'benchmark usage observation is not JSON'); }
    observationCheck(observation, host.description);
  }
  return response;
}
function executionOutcome(response: JudgmentFact & { record: JudgmentAttemptRecord }, all: readonly JudgmentFact[]): void {
  const accounting = all.find(v => v.record.type === 'JudgmentAttemptRecord'
    && v.record.request === response.record.request && v.record.attempt === response.record.attempt
    && v.record.phase === 'accounting-observed');
  ensure(accounting && (accounting.fact.body as { readonly outcome?: unknown }).outcome !== undefined,
    'benchmark outcome reference lacks an accounting Outcome');
}
function validateBenchmark(r: BenchmarkRecord | BenchmarkScenario | BenchmarkRunRecord, all: readonly JudgmentFact[], ctx: OwnedBodyContext,
  host: JudgmentHost): void {
  const unique = (values: readonly string[], name: string) => ensure(values.length === new Set(values).size, `${name} contains duplicates`);
  if (r.type === 'BenchmarkRecord') {
    owned(r.request, 'part-seven', 'JudgmentRequest'); owned(r.resolution, 'part-seven', 'JudgmentResolution');
    ensure(r.requestDigest.length > 0 && r.inputDigest.length > 0 && r.compatibilityDigest.length > 0, 'benchmark digests required');
    const request = all.find((v): v is JudgmentFact & { record: JudgmentRequest } => v.fact.id === r.request.id && v.record.type === 'JudgmentRequest');
    const resolution = all.find((v): v is JudgmentFact & { record: import('./contracts.js').JudgmentResolution } => v.fact.id === r.resolution.id && v.record.type === 'JudgmentResolution');
    ensure(request && resolution && resolution.record.request === request.record.id, 'benchmark source request/resolution absent or unrelated');
    ensure(r.requestDigest === request.record.inputDigest && r.inputDigest === request.record.inputDigest, 'benchmark input digest differs from real request');
    ensure(r.provenance.kind === 'real' || r.provenance.kind === 'synthetic', 'unknown benchmark provenance kind');
    if (r.provenance.kind === 'real') {
      ensure(Object.keys(r.provenance).sort().join(',') === 'generation,kind,request,vector', 'real provenance is not closed');
      owned(r.provenance.request, 'part-seven', 'JudgmentRequest');
      ensure(r.provenance.request.id === r.request.id && r.provenance.generation === request.record.generation && r.provenance.vector.length > 0,
        'real provenance differs from source request');
    } else {
      ensure(Object.keys(r.provenance).sort().join(',') === 'fixture,kind,productionDerived' && r.provenance.productionDerived === false
        && r.provenance.fixture.length > 0, 'synthetic provenance cannot claim production derivation');
    }
    ensure(!all.some(v => v.record.type === 'BenchmarkRecord' && v.record.request.id === r.request.id
      && v.record.resolution.id === r.resolution.id), 'duplicate logical benchmark manifest');
    r.attempts.forEach(a => owned(a, 'part-seven', 'JudgmentAttemptRecord'));
    unique(r.attempts.map(a => a.id), 'benchmark attempts'); unique(r.conclusionEvidence, 'conclusion evidence'); unique(r.reasonEvidence, 'reason evidence');
    ensure(r.decision.state === 'present' || r.decision.state === 'absent', 'unknown benchmark Decision state');
    ensure(r.decision.state === 'present' ? Object.keys(r.decision).sort().join(',') === 'id,state' && r.decision.id.length > 0
      : Object.keys(r.decision).join(',') === 'state', 'benchmark Decision presence must be explicit');
    ensure(r.captureReferences.length > 0 && r.run === request.record.run && r.step === request.record.step
      && r.logicalKey === request.record.logicalKey && r.sourceGeneration === request.record.generation, 'benchmark manifest differs from source request');
    if (r.provenance.kind === 'real') {
      const attempts = all.filter((v): v is JudgmentFact & { record: JudgmentAttemptRecord } =>
        v.record.type === 'JudgmentAttemptRecord' && v.record.request === request.record.id);
      const response = attempts.find(v => v.record.phase === 'response-observed');
      const expectedCaptures = [request.record.question, request.record.context, request.record.submitted,
        ...attempts.flatMap(v => v.record.receipt ? [v.record.receipt] : [])];
      const actualDecision = (resolution.fact.body as { readonly decision?: Decision }).decision;
      ensure(r.recordingPrincipal === request.fact.principal.id && resolution.fact.principal.id === request.fact.principal.id,
        'benchmark recording principal differs from source recorder');
      ensure(sameStrings(r.attempts.map(v => v.id), attempts.map(v => v.fact.id)), 'benchmark attempts differ from source attempts');
      ensure(sameCaptures(r.captureReferences, expectedCaptures), 'benchmark captures differ from source captures');
      if (resolution.record.disposition === 'decided') {
        ensure(actualDecision && r.decision.state === 'present' && r.decision.id === actualDecision.id,
          'benchmark Decision differs from source resolution');
        ensure(sameStrings(r.conclusionEvidence, actualDecision.conclusion.evidence)
          && sameStrings(r.reasonEvidence, actualDecision.reason.evidence), 'benchmark evidence differs from source Decision');
      } else {
        ensure(actualDecision === undefined && r.decision.state === 'absent'
          && r.conclusionEvidence.length === 0 && r.reasonEvidence.length === 0,
        'refused source resolution requires explicit absent Decision');
      }
      ensure(response, 'benchmark real manifest requires recorded response attempt');
    }
    for (const id of r.usageReferences) executionObservation(id, request.record.id, all, ctx, host);
    for (const id of r.outcomeReferences) executionOutcome(executionObservation(id, request.record.id, all, ctx, host), all);
    return;
  }
  if (r.type === 'BenchmarkScenario') {
    owned(r.source, 'part-seven', 'BenchmarkRecord'); owned(r.sourceGrade, 'part-nine', 'Grade');
    const source = all.find((v): v is JudgmentFact & { record: BenchmarkRecord } => v.fact.id === r.source.id && v.record.type === 'BenchmarkRecord');
    ensure(source?.record.provenance.kind === 'real', 'benchmark scenario requires real source provenance');
    const sourceRequest = all.find((v): v is JudgmentFact & { record: JudgmentRequest } =>
      v.fact.id === source.record.request.id && v.record.type === 'JudgmentRequest');
    ensure(sourceRequest, 'benchmark scenario source request absent');
    ensure(r.version.length > 0 && r.pinnedGeneration.length > 0 && r.pinnedVector.length > 0 && r.promotionDecision.length > 0,
      'scenario grade/promotion pin required');
    ensure(/^sha256:[a-f0-9]{64}$/.test(r.originalInputHash) && r.originalInputHash === sourceRequest.record.submitted.hash
      && r.transformedInputHash === r.replayInput.hash && /^sha256:[a-f0-9]{64}$/.test(r.transformedInputHash)
      && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(r.transformationVersion) && r.floorDigest.length > 0
      && r.outputSchemaDigest.length > 0 && r.evaluationContract.length > 0 && r.dataScope.length > 0, 'scenario lineage/digests required');
    ensure(r.pinnedGeneration === source.record.sourceGeneration && r.pinnedGeneration === sourceRequest.record.generation
      && r.pinnedVector === source.record.provenance.vector, 'scenario lineage pins differ from source manifest');
    unique(r.excludedAnswerFields, 'excluded answer fields'); unique(r.excludedOutcomeFields, 'excluded outcome fields');
    ensure(r.excludedAnswerFields.length > 0 && r.excludedOutcomeFields.length > 0, 'answer and outcome exclusions must be explicit');
    const replayBytes = captureBytes(ctx, r.replayInput);
    if (replayBytes !== undefined) {
      let replay: unknown;
      try { replay = JSON.parse(replayBytes) as unknown; } catch { ensure(false, 'benchmark replay input must be JSON'); }
      ensure(replay !== null && typeof replay === 'object', 'benchmark replay input must be a JSON object or array');
      for (const field of [...r.excludedAnswerFields, ...r.excludedOutcomeFields]) {
        ensure(field.length > 0 && !containsExcludedField(replay, field), `benchmark replay input contains excluded field: ${field}`);
      }
    }
    ensure(['available', 'unavailable'].includes(r.captureAvailability), 'unknown scenario capture availability'); return;
  }
  owned(r.run, 'part-five', 'Run');
  ensure(r.suite.length > 0 && r.suiteVersion.length > 0 && r.criterionDigest.length > 0 && r.inputDigest.length > 0
    && r.compatibilityDigest.length > 0 && r.heldOutPartition.length > 0 && r.startedAt >= 0 && r.stoppedAt >= r.startedAt,
  'benchmark run identity/digests/measurements required');
  ensure(r.scenarios.length > 0 && r.candidates.length > 0, 'benchmark population must be predeclared');
  unique(r.scenarios.map(s => `${s.scenario.id}:${s.version}`), 'scenario population'); unique(r.candidates.map(v => v.route), 'candidate population');
  for (const s of r.scenarios) {
    owned(s.scenario, 'part-seven', 'BenchmarkScenario');
    ensure(s.version.length > 0 && all.some(v => v.fact.id === s.scenario.id && v.record.type === 'BenchmarkScenario' && v.record.version === s.version),
      'run scenario/version absent');
  }
  for (const candidate of r.candidates) ensure(candidate.route.length > 0 && Number.isSafeInteger(candidate.samples) && candidate.samples > 0, 'invalid candidate sampling count');
  const planned = r.scenarios.flatMap(s => r.candidates.flatMap(candidate => Array.from({ length: candidate.samples }, (_, ordinal) => `${s.scenario.id}:${candidate.route}:${ordinal}`)));
  const observed = r.executions.map(e => `${e.scenario.id}:${e.candidate}:${e.ordinal}`);
  unique(observed, 'execution disposition population');
  ensure(planned.length === observed.length && planned.every(key => observed.includes(key)), 'every planned benchmark execution needs a disposition');
  const completedWitnesses = new Set<string>();
  for (const e of r.executions) {
    owned(e.scenario, 'part-seven', 'BenchmarkScenario');
    ensure(['completed', 'refused', 'cancelled', 'missing'].includes(e.disposition) && Number.isSafeInteger(e.ordinal) && e.ordinal >= 0,
      'invalid execution disposition');
    ensure(r.candidates.some(candidate => candidate.route === e.candidate && e.ordinal < candidate.samples), 'execution was not predeclared');
    ensure(r.scenarios.some(s => s.scenario.id === e.scenario.id), 'execution scenario was not predeclared');
    if (e.disposition === 'completed') {
      ensure(e.attempt && e.resolution && e.detail === undefined, 'completed execution requires attempt/resolution only');
      ensure(e.usage.length > 0, 'completed execution requires an observed usage reference');
    } else ensure(e.detail && e.detail.length > 0, 'non-completed execution requires explicit detail');

    if (e.attempt) owned(e.attempt, 'part-seven', 'JudgmentAttemptRecord');
    if (e.resolution) owned(e.resolution, 'part-seven', 'JudgmentResolution');
    const attempt = e.attempt && all.find((v): v is JudgmentFact & { record: JudgmentAttemptRecord } =>
      v.fact.id === e.attempt!.id && v.record.type === 'JudgmentAttemptRecord');
    const resolution = e.resolution && all.find((v): v is JudgmentFact & { record: import('./contracts.js').JudgmentResolution } =>
      v.fact.id === e.resolution!.id && v.record.type === 'JudgmentResolution');
    if (e.attempt) ensure(attempt?.record.phase === 'response-observed',
      `${e.disposition === 'completed' ? 'completed' : 'non-completed'} execution attempt absent or not a response`);
    if (e.resolution) ensure(resolution,
      `${e.disposition === 'completed' ? 'completed' : 'non-completed'} execution resolution absent`);

    const hasObservation = e.attempt !== undefined || e.resolution !== undefined || e.usage.length > 0;
    if (hasObservation) {
      const scenario = all.find((v): v is JudgmentFact & { record: BenchmarkScenario } =>
        v.fact.id === e.scenario.id && v.record.type === 'BenchmarkScenario');
      const source = scenario && all.find((v): v is JudgmentFact & { record: BenchmarkRecord } =>
        v.fact.id === scenario.record.source.id && v.record.type === 'BenchmarkRecord');
      const request = source && all.find((v): v is JudgmentFact & { record: JudgmentRequest } =>
        v.fact.id === source.record.request.id && v.record.type === 'JudgmentRequest');
      ensure(scenario && source && request, 'execution scenario/request absent');
      if (e.disposition === 'completed') ensure(resolution, 'completed execution resolution/request absent');
      if (attempt) ensure(attempt.record.request === request.record.id, 'execution attempt/request unrelated');
      if (resolution) ensure(resolution.record.request === request.record.id, 'execution resolution/request unrelated');
      if (attempt && resolution) ensure(resolution.record.response === attempt.fact.id, 'execution attempt/resolution unrelated');
      ensure(request.record.route === e.candidate && request.record.run === r.run.id, 'execution candidate/run unrelated');
      ensure(scenario.record.replayInput.hash === request.record.submitted.hash, 'execution input differs from the observed request');
      ensure(r.inputDigest === scenario.record.transformedInputHash, 'execution input digest differs from the scenario replay');
      ensure(r.compatibilityDigest === source.record.compatibilityDigest, 'execution compatibility digest differs from the source manifest');
      e.usage.forEach(id => executionObservation(id, request.record.id, all, ctx, host));
    }
    if (e.disposition === 'completed') {
      ensure(attempt && resolution, 'completed execution resolution/request absent');
      ensure(!completedWitnesses.has(attempt.fact.id), 'completed benchmark samples reused one execution witness');
      completedWitnesses.add(attempt.fact.id);
    }
  }
}
export function createJudgmentSpine(host: JudgmentHost, author: JudgmentAuthor, store: FactStorePort): JudgmentSpine {
  return Object.freeze({ store, append: (record: JudgmentRecord, attachments: Readonly<Record<string, unknown>> = {}) => authorAndAppend({
    kind: kindFor(record.type), schemaVersion: 1, machine: host.transport.machine,
    principal: json(host.transport.principal), provenance: json(host.transport.principal.provenance), at: json(host.transport.current().clock),
    body: json({ record, ...attachments }), required: record.predecessor ? [record.predecessor] : [],
  }, author.context, store, author.privateKey) });
}
