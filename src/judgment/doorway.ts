import { consumeResult, decode, readEvidence } from '../index.js';
import type { Decision, Result } from '../index.js';
import type { FenceToken } from '../transport/index.js';
import type { JudgmentAttemptRecord, JudgmentDoorway, JudgmentFact, JudgmentPorts, JudgmentRecord, JudgmentRequest, JudgmentResolution, ProviderObservation, QuestionInput, RecordedAnswer } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { decisionFrom, phaseIn, providerEvidence, requestIn, rows, unsettledOutcome } from './records.js';

export function createJudgmentDoorway(p: JudgmentPorts): JudgmentDoorway {
  const c = p.boundary;
  const checked = <T>(name: string, run: () => T) => boundary(name, null, c, run);
  const read = (): readonly JudgmentFact[] => {
    const snapshot = take(p.spine.store.readForProjection());
    ensure(snapshot.entries.every(e => e.taint.length === 0 && e.conflicts.length === 0), 'judgment source prefix tainted or conflicted');
    return rows(snapshot.entries.map(e => e.fact));
  };
  const save = (record: JudgmentRecord, attachments: Readonly<Record<string, unknown>> = {}) => {
    const receipt = take(p.spine.append(record, attachments));
    ensure(receipt.taint.length === 0 && ['local-durable', 'replicated'].includes(receipt.durability.kind), 'judgment receipt not durable/untainted');
    ensure(encoded(receipt.fact.body).bytes === encoded({ record, ...attachments }).bytes, 'append receipt names different judgment bytes');
    const all = read(); ensure(all.some(v => v.fact.id === receipt.fact.id && v.fact.contentHash === receipt.fact.contentHash), 'append not visible on authoritative spine');
    return receipt.fact;
  };
  const current = (request: JudgmentRequest, fence: FenceToken, suffix: string) => {
    ensure(p.host.transport.incarnation === request.incarnation && p.host.transport.current().generation.id === request.generation,
      'request belongs to stale generation or clock incarnation');
    ensure(p.host.transport.monotonic() < request.deadline, 'judgment deadline exhausted');
    const authorityHead = take(p.authority.inspect()).at(-1)?.fact.id ?? 'none';
    take(p.authority.admitWrite(`judgment:${request.id}:${suffix}:${authorityHead}`, fence));
    const now = p.host.transport.current();
    take(decode('ActionFloor', p.host.floor, now.decode));
    for (const id of request.evidence) {
      const evidence = now.decode.evidence?.find(e => e.id === id); ensure(evidence, 'current evidence unavailable');
      take(readEvidence(evidence, now.clock, c.preserved));
    }
  };
  const captured = (request: JudgmentRequest) => {
    take(p.captures.read(request.question)); take(p.captures.read(request.context));
    const bytes = take(p.captures.read(request.submitted));
    ensure(encoded(bytes).hash === request.inputDigest, 'submitted capture no longer matches reserved bytes'); return bytes;
  };
  const meta = (request: string, id: string) => ({ schemaVersion: 1 as const, id, request, predecessor: read().at(-1)?.fact.id ?? '' });
  const phase = (request: JudgmentRequest, name: JudgmentAttemptRecord['phase'], operation?: string, reservation?: string,
    receipt?: JudgmentAttemptRecord['receipt'], attachments?: Readonly<Record<string, unknown>>) => {
    const existing = phaseIn(read(), name); if (existing) return existing.fact;
    return save({ ...meta(request.id, `${request.id}:${name}`), type: 'JudgmentAttemptRecord', attempt: `attempt:${request.id}:1`, phase: name,
      ...(operation ? { operation } : {}), ...(reservation ? { reservation } : {}), ...(receipt ? { receipt } : {}) } as JudgmentAttemptRecord, attachments);
  };
  const recordAnswer = (request: JudgmentRequest): Result<Decision> => {
    const all = read(), response = phaseIn(all, 'response-observed');
    ensure(response?.record.receipt, 'provider receipt missing: answer unusable; observe original operation');
    const observation = JSON.parse(take(p.captures.read(response.record.receipt))) as ProviderObservation;
    take(p.host.refreshFacts());
    const operation = response.record.operation!, reservation = response.record.reservation!;
    const accounting = phase(request, 'accounting-observed', operation, reservation, undefined,
      { outcome: unsettledOutcome(response, take(p.captures.read(response.record.receipt)), p.host) });
    const result = decisionFrom(observation, request, p.host, c);
    const decision = consumeResult(result, { Success: d => d, Refused: () => undefined });
    const attachments = { result, ...(decision ? { decision } : {}) };
    const decoded = phase(request, 'decode-observed', operation, reservation, undefined, attachments);
    if (!read().some(v => v.record.type === 'JudgmentResolution')) save({ ...meta(request.id, `${request.id}:resolution`), type: 'JudgmentResolution',
      attempt: response.record.attempt, disposition: decision ? 'decided' : 'refused', response: response.fact.id, accounting: accounting.id, decoded: decoded.id } as JudgmentResolution, attachments);
    return result;
  };
  const readAnswer = (id: string, fence: FenceToken): Result<RecordedAnswer> => checked('RecordedJudgmentUse', () => {
    const all = read(), request = requestIn(all); ensure(request?.id === id, 'unknown question');
    current(request, fence, 'accept'); captured(request);
    const resolution = all.find(v => v.record.type === 'JudgmentResolution');
    ensure(resolution, 'resolution receipt missing: answer unusable');
    const response = phaseIn(all, 'response-observed'); ensure(response?.record.receipt, 'provider receipt missing');
    const decision = take(decisionFrom(JSON.parse(take(p.captures.read(response.record.receipt))) as ProviderObservation, request, p.host, c));
    ensure(encoded((resolution.fact.body as { decision?: unknown }).decision).bytes === encoded(decision).bytes, 'resolution differs from current captured decision');
    return freeze({ resolution: { owner: 'part-seven', name: 'JudgmentResolution', id: resolution.fact.id }, decision });
  });
  return Object.freeze({ inspect: () => checked('JudgmentInspect', read), readAnswer,
    resumeRecording: id => checked('JudgmentLocalRecordingRecovery', () => {
      const request = requestIn(read()); ensure(request?.id === id, 'unknown question'); captured(request);
      recordAnswer(request); // A recorded refusal is also a terminal resolution.
      const resolution = read().find(v => v.record.type === 'JudgmentResolution'); ensure(resolution, 'resolution missing');
      return freeze({ owner: 'part-seven' as const, name: 'JudgmentResolution' as const, id: resolution.fact.id });
    }),
    judge: async (input: QuestionInput, fence: FenceToken) => {
      const preparation = boundary('JudgmentPrepare', input, c, safe => {
        const q = safe as unknown as QuestionInput;
        ensure(Object.keys(q).sort().join(',') === 'context,deadline,effectRequest,evidence,id,ordinal,question,run,semanticMessage,step', 'closed question input');
        ensure(q.run.owner === 'part-five' && q.run.name === 'Run' && typeof q.question === 'string' && typeof q.context === 'string', 'question/run ownership');
        ensure(q.effectRequest.owner === 'part-eight' && q.effectRequest.name === 'EffectRequest' && q.effectRequest.id.length > 0
          && typeof q.semanticMessage === 'string' && q.semanticMessage.length > 0, 'foreign effect/message identity required');
        ensure(Number.isSafeInteger(q.deadline) && Number.isSafeInteger(q.ordinal) && q.ordinal >= 0, 'finite question bounds');
        ensure(Array.isArray(q.evidence) && q.evidence.length <= 64 && q.evidence.every(e => typeof e === 'string'), 'bounded evidence references');
        ensure(encoded(p.model.describe()).bytes === encoded(p.host.description).bytes, 'adapter differs from host route');
        const now = p.host.transport.current();
        const submitted = take(p.model.prepare({ question: q.question, context: q.context, floor: p.host.floor, evidence: q.evidence,
          deadline: q.deadline, generation: now.generation.id, point: p.host.point,
          roles: { question: 'untrusted-user-content', context: 'evidence-not-authority' } }));
        const digest = encoded(submitted).hash;
        let request = requestIn(read());
        if (request) ensure(request.id === q.id && request.logicalKey === encoded([q.run.id, q.step, q.ordinal]).hash
          && request.inputDigest === digest && request.semanticMessage === q.semanticMessage && request.effectRequest === q.effectRequest.id, 'logical question collision: request identity/input changed');
        else {
          ensure(q.deadline > p.host.transport.monotonic(), 'judgment deadline exhausted');
          const cap = (s: string) => take(p.captures.put(s, p.host.description.maxInputBytes));
          request = { ...meta(q.id, q.id), type: 'JudgmentRequest', logicalKey: encoded([q.run.id, q.step, q.ordinal]).hash,
            inputDigest: digest, run: q.run.id, step: q.step, ordinal: q.ordinal, semanticMessage: q.semanticMessage, effectRequest: q.effectRequest.id, point: p.host.point, consumer: 'advisory',
            generation: now.generation.id, incarnation: p.host.transport.incarnation, deadline: q.deadline,
            question: cap(q.question), context: cap(q.context), submitted: cap(submitted), route: p.host.description.route,
            evidence: q.evidence, maxInputBytes: p.host.description.maxInputBytes, maxOutputBytes: p.host.description.maxOutputBytes,
            maxCharge: p.host.description.maxCharge } as unknown as JudgmentRequest;
          save(request);
        }
        current(request, fence, 'prepare'); captured(request);
        return { request, done: !!read().find(v => v.record.type === 'JudgmentResolution'), hasResponse: !!phaseIn(read(), 'response-observed') };
      });
      const prepared = consumeResult(preparation, { Success: v => v, Refused: () => undefined });
      if (!prepared) return consumeResult(preparation, { Success: () => checked('ImpossiblePreparation', () => { throw new Error('unreachable'); }), Refused: r => r });
      const { request } = prepared;
      if (prepared.done) return readAnswer(request.id, fence);
      if (prepared.hasResponse) {
        const recorded = checked('JudgmentResumeRecording', () => take(recordAnswer(request)));
        return consumeResult(recorded, { Success: () => readAnswer(request.id, fence), Refused: r => r });
      }
      const admission = checked('JudgmentDispatch', () => {
        ensure(!phaseIn(read(), 'dispatch-observed'), 'unresolved dispatch: missing receipt cannot trigger another invocation');
        phase(request, 'prepared');
        current(request, fence, 'dispatch');
        const reservation = take(p.authority.reserve({ command: `judgment:${request.id}:reserve`, fence,
          request: { owner: 'part-eight', name: 'EffectRequest', id: request.effectRequest }, attempt: `attempt:${request.id}:1`,
          payloadDigest: request.inputDigest, charge: request.maxCharge, run: { owner: 'part-five', name: 'Run', id: request.run },
          semanticMessage: request.semanticMessage, durability: 'local-durable', replicas: 0 }));
        const sixFact = take(p.authority.inspect()).find(v => v.record.type === 'AdmissionReservation' && v.record.operation === reservation.operation)?.fact;
        ensure(sixFact, 'six reservation fact missing');
        phase(request, 'dispatch-observed', reservation.operation, sixFact.id);
        const claim = take(p.authority.claim(`judgment:${request.id}:claim`, fence, reservation.operation));
        return { claim, reservation, sixFact };
      });
      const admitted = consumeResult(admission, { Success: v => v, Refused: () => undefined });
      if (!admitted) return consumeResult(admission, { Success: () => checked('ImpossibleAdmission', () => { throw new Error('unreachable'); }), Refused: r => r });
      let returned: Result<ProviderObservation>;
      try { returned = await p.model.exchange({ claim: admitted.claim, fence, bytes: captured(request), deadline: request.deadline, incarnation: request.incarnation }); }
      catch { return checked('MissingProviderObservation', () => { throw new Error('adapter threw: original liability retained; answer unavailable'); }); }
      const recording = checked('JudgmentRecordReceipt', () => {
        const observation = take(returned);
        // Receipt includes actual response bytes AND observational usage. It is not
        // a settlement; even known rejection leaves six's exposure reserved.
        const receipt = take(p.captures.put(encoded(observation).bytes, request.maxOutputBytes + 2048));
        const evidence = providerEvidence(receipt, encoded(observation).bytes, admitted.reservation.operation, p.host.transport.current().clock, p.host);
        phase(request, 'response-observed', admitted.reservation.operation, admitted.sixFact.id, receipt, { evidence });
        return take(recordAnswer(request));
      });
      return consumeResult(recording, { Success: () => readAnswer(request.id, fence), Refused: r => r });
    },
  } satisfies JudgmentDoorway);
}
