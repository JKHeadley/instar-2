import { consumeResult, decode, readEvidence } from '../index.js';
import type { Decision, Result } from '../index.js';
import type { FenceToken } from '../transport/index.js';
import type { JudgmentAttemptRecord, JudgmentDoorway, JudgmentFact, JudgmentPorts, JudgmentRecord, JudgmentRequest, JudgmentResolution, ProviderObservation, QuestionInput, RecordedAnswer } from './contracts.js';
import type { AdmissionReservation } from '../transport/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { decisionFrom, dispatchMessage, phaseIn, providerEvidence, requestIn, rows, unsettledOutcome } from './records.js';
import { receiptByteBound, snapshotObservation, uncertainObservation } from './model-adapter.js';

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
          if (p.effects) {
            // Through-eight admission (docs/11 step 6): the effect-request identity
            // is DERIVED from the registered operation's addressing, never caller-chosen.
            const d = p.effects.describe();
            ensure(d.maxCharge === p.host.description.maxCharge, 'registered operation liability differs from judgment bounds');
            ensure(q.effectRequest.id === `request:${encoded([d.account, d.conversation, q.semanticMessage]).hash}`,
              'question effect-request identity is not the admitted-dispatch derivation');
          }
          const cap = (s: string) => take(p.captures.put(s, p.host.description.maxInputBytes));
          request = { ...meta(q.id, q.id), type: 'JudgmentRequest', logicalKey: encoded([q.run.id, q.step, q.ordinal]).hash,
            inputDigest: digest, run: q.run.id, step: q.step, ordinal: q.ordinal, semanticMessage: q.semanticMessage, effectRequest: q.effectRequest.id, point: p.host.point, consumer: 'advisory',
            generation: now.generation.id, incarnation: p.host.transport.incarnation, deadline: q.deadline,
            question: cap(q.question), context: cap(q.context), submitted: cap(submitted), route: p.host.description.route,
            evidence: q.evidence, maxInputBytes: p.host.description.maxInputBytes, maxOutputBytes: p.host.description.maxOutputBytes,
            maxCharge: p.host.description.maxCharge,
            ...(p.effects ? { account: p.effects.describe().account, conversation: p.effects.describe().conversation } : {}) } as unknown as JudgmentRequest;
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
      if (p.effects) {
        // docs/11 step 6: dispatch through part eight's effect boundary to the
        // registered model adapter against six's reservation. Level-triggered so a
        // crash between any two durable steps resumes through the public seams
        // without a second provider invocation (docs/11 retries rule).
        const eight = p.effects;
        const recording = checked('JudgmentAdoptedDispatch', () => {
          const d = eight.describe();
          ensure(request.account === d.account && request.conversation === d.conversation && request.maxCharge === d.maxCharge,
            'registered operation differs from the admitted question addressing');
          const requestFact = read().find(v => v.record.type === 'JudgmentRequest');
          ensure(requestFact, 'missing durable question');
          const message = dispatchMessage(request, requestFact.fact.id, p.host);
          const reservationRows = () => take(p.authority.inspect()).filter(v => v.record.type === 'AdmissionReservation'
            && v.record.request === request.effectRequest && v.record.attempt === `attempt:${request.id}:1`);
          // Custody commits the complete worst-case encoded receipt budget before
          // six admits spend (and before any recovery re-record). Other writers
          // and process restart cannot free it.
          const receiptCapacity = take(p.captures.reserve(receiptByteBound(p.host.description)));
          let observed: import('./contracts.js').DispatchObservation;
          const claimed = reservationRows().find(v => (v.record as AdmissionReservation).state !== 'prepared');
          if (claimed) {
            // An invocation may already have started; only eight's DURABLE terminal
            // observation can carry this forward — never another invocation.
            const terminal = take(eight.observations((claimed.record as AdmissionReservation).operation))
              .filter(o => o.stage === 'response' || o.stage === 'unknown').at(-1);
            ensure(terminal, 'unresolved dispatch claim: missing receipt cannot trigger another invocation');
            observed = terminal;
          } else {
            phase(request, 'prepared');
            current(request, fence, 'dispatch');
            // Six admits and durably reserves the exact operation eight will
            // dispatch (docs/11 step 5), shaped for eight's adopt contract: the
            // derived request id, the dispatch MESSAGE digest, and the registered
            // definition's charge/durability/replicas. reserve() is idempotent
            // over an identical mapping, so a resumed process re-enters safely.
            take(p.authority.reserve({ command: `judgment:${request.id}:reserve`, fence,
              request: { owner: 'part-eight', name: 'EffectRequest', id: request.effectRequest }, attempt: `attempt:${request.id}:1`,
              payloadDigest: encoded(message).hash, charge: d.maxCharge, run: { owner: 'part-five', name: 'Run', id: request.run },
              semanticMessage: request.semanticMessage, durability: d.durability, replicas: d.replicas }));
            // Recovery reads the persisted adopted request first: eight refuses a
            // repeated adoption by name, and re-adopting is never the resume path.
            // The obligation is six's own verification wake for this run — eight
            // requires the durable LoopRecord, the same wake its recovery rides.
            const wake = take(p.authority.inspect()).filter(v => v.record.type === 'LoopRecord' && v.record.run === request.run).at(-1);
            ensure(wake, 'six-owned verification wake missing for the judgment run');
            const prior = consumeResult(eight.adopted(request.effectRequest), { Success: v => v, Refused: () => undefined });
            const adopted = prior ?? take(eight.adopt({ definition: d.definition, message,
              run: { owner: 'part-five', name: 'Run', id: request.run }, pending: requestFact.fact.id,
              attempt: `attempt:${request.id}:1`, verificationOwner: 'part-seven',
              obligation: wake.fact.id, closure: [] }));
            ensure(adopted.request === request.effectRequest && adopted.digest === encoded(message).hash,
              'eight adopted a different request than the one shown');
            observed = take(eight.dispatch(adopted, fence));
          }
          const consumed = take(p.authority.inspect()).find(v => v.record.type === 'AdmissionReservation'
            && v.record.request === request.effectRequest && v.record.state === 'consumed');
          ensure(consumed, 'six durable claim consumption missing');
          const operation = (consumed.record as AdmissionReservation).operation;
          ensure(observed.operation === operation, 'eight observation names another operation');
          phase(request, 'dispatch-observed', operation, consumed.fact.id);
          // The receipt records eight's observed service response as seven's
          // provider observation: actual response bytes AND observational usage.
          // It is not a settlement — six's exposure stays reserved until eight's
          // own evidence-checked settlement is applied through six's settle().
          const observation = (() => {
            if (observed.stage !== 'response') return uncertainObservation('eight recorded no conclusive service response');
            let raw: unknown; try { raw = JSON.parse(observed.bytes); } catch { raw = undefined; }
            return snapshotObservation(raw, p.host.description);
          })();
          const receipt = take(p.captures.putReserved(receiptCapacity, encoded(observation).bytes));
          const evidence = providerEvidence(receipt, encoded(observation).bytes, operation, p.host.transport.current().clock, p.host);
          phase(request, 'response-observed', operation, consumed.fact.id, receipt, { evidence });
          return take(recordAnswer(request));
        });
        return consumeResult(recording, { Success: () => readAnswer(request.id, fence), Refused: r => r });
      }
      const admission = checked('JudgmentDispatch', () => {
        ensure(!phaseIn(read(), 'dispatch-observed'), 'unresolved dispatch: missing receipt cannot trigger another invocation');
        ensure(!take(p.authority.inspect()).some(v => v.record.type === 'AdmissionReservation'
          && v.record.request === request.effectRequest && v.record.attempt === `attempt:${request.id}:1` && v.record.state !== 'prepared'),
        'unresolved dispatch claim: missing receipt cannot trigger another invocation');
        phase(request, 'prepared');
        current(request, fence, 'dispatch');
        // Custody commits the complete worst-case encoded receipt budget before
        // six admits spend. Other writers and process restart cannot free it.
        const receiptCapacity = take(p.captures.reserve(receiptByteBound(p.host.description)));
        const reservation = take(p.authority.reserve({ command: `judgment:${request.id}:reserve`, fence,
          request: { owner: 'part-eight', name: 'EffectRequest', id: request.effectRequest }, attempt: `attempt:${request.id}:1`,
          payloadDigest: request.inputDigest, charge: request.maxCharge, run: { owner: 'part-five', name: 'Run', id: request.run },
          semanticMessage: request.semanticMessage, durability: 'local-durable', replicas: 0 }));
        const claim = take(p.authority.claim(`judgment:${request.id}:claim`, fence, reservation.operation));
        return { claim, reservation, receiptCapacity };
      });
      const admitted = consumeResult(admission, { Success: v => v, Refused: () => undefined });
      if (!admitted) return consumeResult(admission, { Success: () => checked('ImpossibleAdmission', () => { throw new Error('unreachable'); }), Refused: r => r });
      let returned: Result<ProviderObservation>;
      try { returned = await p.model.exchange({ claim: admitted.claim, fence, bytes: captured(request), deadline: request.deadline, incarnation: request.incarnation,
        recordDispatch: () => checked('JudgmentExecutorHandoff', () => {
          const consumed = take(p.authority.inspect()).find(v => v.record.type === 'AdmissionReservation'
            && v.record.operation === admitted.reservation.operation && v.record.state === 'consumed');
          ensure(consumed, 'six durable claim consumption missing');
          phase(request, 'dispatch-observed', admitted.reservation.operation, consumed.fact.id);
        }) }); }
      catch { return checked('MissingProviderObservation', () => { throw new Error('adapter threw: original liability retained; answer unavailable'); }); }
      const recording = checked('JudgmentRecordReceipt', () => {
        const observation = take(returned);
        // Receipt includes actual response bytes AND observational usage. It is not
        // a settlement; even known rejection leaves six's exposure reserved.
        const receipt = take(p.captures.putReserved(admitted.receiptCapacity, encoded(observation).bytes));
        const evidence = providerEvidence(receipt, encoded(observation).bytes, admitted.reservation.operation, p.host.transport.current().clock, p.host);
        const dispatch = phaseIn(read(), 'dispatch-observed'); ensure(dispatch?.record.reservation, 'provider observation lacks recorded executor handoff');
        phase(request, 'response-observed', admitted.reservation.operation, dispatch.record.reservation, receipt, { evidence });
        return take(recordAnswer(request));
      });
      return consumeResult(recording, { Success: () => readAnswer(request.id, fence), Refused: r => r });
    },
  } satisfies JudgmentDoorway);
}
