import { consumeOutcome, consumeResult, decode, readEvidence } from '../index.js';
import type { Result } from '../index.js';
import type { FactEnvelope } from '../facts/index.js';
import { causalCone } from '../facts/index.js';
import type { AdmissionReservation, DispatchClaim } from '../transport/index.js';
import type { EffectComposition, EffectDoorway, EffectRecord, EffectRequest, EffectSettlement, EffectValidation,
  OperationDefinition, OperationObservation, OutboundMessage } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { definitionCheck, live, rows, wire } from './records.js';
import { issuedSettlement, withSettlement } from './settlement-authority.js';

export function createEffectDoorway(composition: EffectComposition): EffectDoorway {
  const { host, spine, transport, durability, adapter, assessment } = composition;
  const checked = <T>(name: string, input: unknown, fn: () => T): Result<T> => boundary(name, input, host.boundary, fn);
  const snapshot = () => {
    const s = take(spine.store.readForProjection());
    ensure(s.entries.length <= 4096, 'single-reply history bound exhausted');
    ensure(s.entries.every(e => !e.taint.length && !e.conflicts.length), 'effect closure is tainted or contested');
    return s.entries.map(e => e.fact);
  };
  const find = <N extends EffectRecord['type']>(id: string, type: N): { fact: FactEnvelope; record: Extract<EffectRecord, { type: N }> } => {
    const found = rows(snapshot()).find(v => v.record.id === id && v.record.type === type);
    ensure(found, `missing recorded ${type}`); return found as { fact: FactEnvelope; record: Extract<EffectRecord, { type: N }> };
  };
  const persist = <T extends EffectRecord>(record: T, required: readonly string[] = []): T => {
    const prior = rows(snapshot()).find(v => v.record.type === record.type && v.record.id === record.id);
    if (prior) { ensure(encoded(wire(prior.record)).bytes === encoded(wire(record)).bytes, 'immutable effect collision'); return prior.record as T; }
    const receipt = take(spine.append(record, [...new Set(required)]));
    ensure(!receipt.taint.length && encoded(receipt.fact.body).bytes === encoded({ record: wire(record) }).bytes, 'append was tainted or changed bytes');
    return freeze(record);
  };
  const factsFor = (ids: readonly string[]) => {
    const all = snapshot(), closure = new Map<string, FactEnvelope>();
    for (const id of new Set(ids)) {
      const f = all.find(f => f.id === id); ensure(f, `missing closure fact ${id}`);
      for (const predecessor of [...causalCone(f, all), f]) closure.set(predecessor.id, predecessor);
    }
    return [...closure.values()];
  };
  const demand = (definition: OperationDefinition, facts: readonly FactEnvelope[]) => {
    ensure(durability.owner === 'part-ten', 'durability owner mismatch');
    const receipts = take(durability.ensure(facts));
    for (const fact of facts) {
      const receipt = receipts.find(r => r.fact.id === fact.id);
      ensure(receipt && receipt.fact.contentHash === fact.contentHash && encoded(receipt.fact).bytes === encoded(fact).bytes
        && !receipt.taint.length, 'missing exact durable fact receipt');
      const d = receipt.durability;
      ensure(d.kind === 'local-durable' || d.kind === 'replicated', 'local durability absent');
      if (d.kind === 'replicated') ensure(d.n > 0 && d.n === d.peers.length && new Set(d.peers).size === d.n
        && !d.peers.includes(fact.machine), 'duplicate or local peer cannot satisfy demand');
      if (definition.durability === 'replicated') ensure(d.kind === 'replicated' && d.n >= definition.replicas, 'replicated demand unmet');
    }
  };
  const actual = (q: EffectRequest) => {
    const stored = find(q.id, 'EffectRequest');
    ensure(encoded(stored.record).bytes === encoded(q).bytes, 'request handoff changed');
    const d = find(q.definition, 'OperationDefinition'), m = find(q.message, 'OutboundMessage');
    definitionCheck(d.record, host);
    const capabilities = adapter.describe();
    ensure(adapter.owner === 'part-ten' && adapter.id === d.record.adapter && capabilities.contract.length > 0
      && capabilities.account === m.record.account && capabilities.conversation === m.record.conversation
      && capabilities.maxCharge <= d.record.maxCharge && capabilities.timeout === d.record.timeout
      && capabilities.hiddenRetries === 0, 'adapter mode or actual target mismatch');
    ensure(encoded(m.record).hash === q.digest, 'prepared message digest changed');
    return { d, m, q: stored };
  };
  const validation = (q: EffectRequest, phase: 'reservation' | 'dispatch') => {
    const { d } = actual(q), c = host.current();
    const fields = { request: q.id, digest: q.digest, phase, generation: c.decode.register.generation.id,
      definition: d.record.id, expires: c.clock.value + d.record.timeout, authority: [...c.authority] };
    const record = { type: 'EffectValidation', schemaVersion: 1, id: `validation:${encoded(fields).hash}`, ...fields } as unknown as EffectValidation;
    return persist(record, [find(q.id, 'EffectRequest').fact.id, ...c.authority]);
  };
  const operation = (id: string) => {
    const all = take(transport.inspect());
    const op = all.filter(v => v.record.type === 'AdmissionReservation' && v.record.operation === id).at(-1);
    ensure(op?.record.type === 'AdmissionReservation', 'reservation missing');
    const claim = all.find(v => v.record.type === 'AdmissionReservation' && v.record.operation === id && v.record.state === 'dispatch-claimed');
    return { reservation: op.record, fact: op.fact, claim: claim?.fact };
  };
  const observeRecord = (q: EffectRequest, op: ReturnType<typeof operation>, stage: OperationObservation['stage'], bytes: string, wake = '') => {
    ensure(op.claim, 'observation requires recorded claim');
    const m = find(q.message, 'OutboundMessage').record;
    const capture = take(host.capture(bytes));
    const fields = { request: q.id, operation: op.reservation.operation, claim: op.claim.id, digest: q.digest,
      account: m.account, conversation: m.conversation, stage, wake, capture, attestation: 'local-recorder' as const };
    return persist({ type: 'OperationObservation', schemaVersion: 1, id: `observation:${encoded(fields).hash}`, ...fields } as OperationObservation,
      [find(q.id, 'EffectRequest').fact.id, op.fact.id, op.claim.id, ...(wake ? [wake] : [])]);
  };
  const priorObservation = (op: string) => rows(snapshot()).filter(v => v.record.type === 'OperationObservation'
    && v.record.operation === op).at(-1)?.record as OperationObservation | undefined;
  // Synchronous consume-before-call excludes on-stack reentry. P6's live capability
  // additionally excludes another instance and any reconstructed/restarted handle.
  const active = new Set<string>();
  const accepted = new WeakMap<object, OperationObservation>();
  const api: EffectDoorway = {
    owner: 'part-eight',
    inspect: () => checked('EffectInspect', null, () => rows(snapshot())),
    prepare: input => checked('EffectPrepare', input, () => {
      live(host); ensure(input.run.owner === 'part-five' && input.run.name === 'Run' && input.run.id === input.message.run, 'run owner mismatch');
      const d = find(input.definition, 'OperationDefinition'); definitionCheck(d.record, host);
      const m = persist(input.message, [input.message.sourceResult]);
      const closure = [...new Set([...input.closure, input.pending, input.obligation, d.fact.id,
        find(m.id, 'OutboundMessage').fact.id, ...host.current().authority])];
      const q = persist({ type: 'EffectRequest', schemaVersion: 1,
        id: `request:${encoded([m.account, m.conversation, m.semanticMessage]).hash}`, definition: d.record.id,
        message: m.id, semanticMessage: m.semanticMessage, run: m.run, pending: input.pending, attempt: input.attempt,
        digest: encoded(m).hash, verificationOwner: input.verificationOwner, verificationBar: d.record.verificationBar,
        obligation: input.obligation, closure } as unknown as EffectRequest, closure);
      const v = validation(q, 'reservation');
      demand(d.record, factsFor([...q.closure, find(q.id, 'EffectRequest').fact.id, find(v.id, 'EffectValidation').fact.id]));
      // Waiting for copies may have changed stop/standing. Six checks again too.
      actual(q);
      take(transport.reserve({ command: `reserve:${q.id}`, fence: input.fence,
        request: { owner: 'part-eight', name: 'EffectRequest', id: q.id }, attempt: q.attempt,
        payloadDigest: q.digest, charge: d.record.maxCharge, run: input.run, semanticMessage: q.semanticMessage,
        durability: d.record.durability, replicas: d.record.replicas }));
      return q;
    }),
    dispatch: (q, fence) => checked('EffectDispatch', q.id, () => {
      const prior = take(transport.inspect()).filter(v => v.record.type === 'AdmissionReservation' && v.record.request === q.id).at(-1);
      ensure(prior?.record.type === 'AdmissionReservation', 'request is not reserved');
      if (prior.record.state !== 'prepared') {
        const observation = priorObservation(prior.record.operation);
        ensure(observation, 'claimed operation is uncertain; observe only'); return observation;
      }
      validation(q, 'dispatch');
      const claim = take(transport.claim(`claim:${q.id}`, fence, prior.record.operation));
      return take(api.handoff(q, prior.record, claim, fence));
    }),
    handoff: (q, supplied, claim, fence) => checked('EffectHandoff', { request: q.id, operation: claim.operation }, () => {
      const already = accepted.get(claim); if (already) return already;
      ensure(!active.has(claim.operation), 'executor handoff already active');
      const { d } = actual(q), op = operation(claim.operation);
      ensure(op.reservation.request === q.id && supplied.operation === op.reservation.operation
        && supplied.digest === q.digest && claim.digest === q.digest && claim.attempt === q.attempt
        && claim.executor === host.incarnation, 'claim request or incarnation mismatch');
      const v = rows(snapshot()).filter(v => v.record.type === 'EffectValidation' && v.record.request === q.id && v.record.phase === 'dispatch').at(-1);
      ensure(v?.record.type === 'EffectValidation' && v.record.expires > host.current().clock.value
        && encoded(v.record.authority).bytes === encoded(host.current().authority).bytes, 'current dispatch validation required');
      ensure(op.claim, 'claim not durable');
      ensure(causalCone(op.claim, snapshot()).some(f => f.id === v.fact.id), 'claim must follow its dispatch validation');
      demand(d.record, factsFor([...q.closure, find(q.id, 'EffectRequest').fact.id, v.fact.id, op.fact.id, op.claim.id]));
      actual(q); ensure(v.record.expires > host.current().clock.value, 'validation expired during durability wait');
      active.add(claim.operation);
      try {
        take(transport.consume(claim, fence));
        const consumed = operation(claim.operation);
        const local = observeRecord(q, consumed, 'executor-accepted', encoded({ operation: claim.operation, executor: host.incarnation, stage: 'executor-accepted' }).bytes);
        accepted.set(claim, local);
        demand(d.record, factsFor([consumed.fact.id, find(local.id, 'OperationObservation').fact.id]));
        actual(q); ensure(v.record.expires > host.current().clock.value, 'validation expired before invocation');
        let bytes: string, stage: 'response' | 'unknown';
        try {
          const response = adapter.invoke({ operation: claim.operation, claim: op.claim.id, digest: q.digest, message: find(q.message, 'OutboundMessage').record });
          const received = consumeResult(response, { Success: bytes => ({ bytes, ok: true }), Refused: () => ({ bytes: 'adapter returned no conclusive response', ok: false }) });
          bytes = received.bytes; stage = received.ok ? 'response' : 'unknown';
        } catch { bytes = 'invocation ended without a recorded service response'; stage = 'unknown'; }
        // Append failure after invoke is not a clean business-effect refusal.
        // The already-durable acceptance remains the observer-only disposition.
        try { const observed = observeRecord(q, consumed, stage, bytes); accepted.set(claim, observed); return observed; }
        catch { return local; }
      } finally { active.delete(claim.operation); }
    }),
    observe: id => checked('EffectObserve', id, () => {
      const op = operation(id); ensure(op.claim, 'prepared operation cannot be queried as dispatched');
      const q = find(op.reservation.request, 'EffectRequest').record, m = find(q.message, 'OutboundMessage').record;
      const transportFacts = take(transport.inspect());
      const wake = transportFacts.filter(v => v.record.type === 'LoopRecord' && v.record.run === q.run).at(-1);
      ensure(wake?.record.type === 'LoopRecord' && wake.record.pending === id
        && ['running', 'restoring', 'waiting'].includes(wake.record.state), 'six-owned active observation wake required');
      ensure(!transportFacts.some(v => v.record.type === 'RecoveryRecord' && `${v.record.command}:wake` === wake.record.command), 'observation wake already completed');
      const prior = rows(snapshot()).filter(v => v.record.type === 'OperationObservation' && v.record.wake === wake.fact.id).at(-1);
      if (prior) return { owner: 'part-eight' as const, name: 'OperationObservation' as const, id: prior.fact.id };
      const local = observeRecord(q, op, 'observer-accepted', encoded({ operation: id, wake: wake.fact.id }).bytes, wake.fact.id);
      // Recovery has ONLY this read-only adapter method. It never calls dispatch,
      // reserves a replacement, consumes a claim or upgrades a lookup miss.
      try {
        const response = consumeResult(adapter.observe({ operation: id, digest: q.digest, account: m.account, conversation: m.conversation }),
          { Success: bytes => bytes, Refused: () => 'lookup unavailable; original operation remains uncertain' });
        const observation = observeRecord(q, op, 'lookup', response, wake.fact.id);
        return { owner: 'part-eight' as const, name: 'OperationObservation' as const, id: find(observation.id, 'OperationObservation').fact.id };
      } catch { return { owner: 'part-eight' as const, name: 'OperationObservation' as const, id: find(local.id, 'OperationObservation').fact.id }; }
    }),
    settle: id => checked('EffectSettle', id, () => {
      ensure(assessment?.owner === 'part-nine', 'independent evidence assessor unavailable');
      const op = operation(id); ensure(op.claim, 'settlement has no claim');
      const q = find(op.reservation.request, 'EffectRequest').record, d = find(q.definition, 'OperationDefinition').record;
      const observations = rows(snapshot()).filter(v => v.record.type === 'OperationObservation' && v.record.operation === id)
        .map(v => v.record as OperationObservation);
      const input = { request: q, reservation: op.reservation, claim: op.claim.id, observations, bar: q.verificationBar };
      const acceptance = take(assessment.assess(input));
      ensure(acceptance.owner === 'part-nine' && acceptance.name === 'VerificationAssessment' && acceptance.id.length > 0, 'wrong acceptance owner');
      const proof = take(assessment.read(acceptance, input));
      const outcome = take(decode('Outcome', proof.outcome, host.current().decode));
      const state = consumeOutcome(outcome, { happened: () => 'happened', 'did-not-happen': () => 'did-not-happen', uncertain: () => 'uncertain' });
      const evidenceIds = consumeOutcome(outcome, { happened: e => e, 'did-not-happen': e => e, uncertain: e => e });
      for (const id of evidenceIds) {
        const source = host.current().decode.evidence?.find(e => e.id === id);
        ensure(source, 'accepted evidence is absent');
        const e = take(decode('Evidence', source, host.current().decode));
        const claim = take(readEvidence(e, host.current().clock, host.boundary.preserved));
        ensure(claim.subject === op.reservation.operation && claim.predicate === q.digest
          && claim.value === state, 'accepted evidence has different operation/digest/predicate');
        ensure(state === 'uncertain' || e.strength === 'proof' || e.strength === 'observation', 'inference cannot settle an external effect');
      }
      ensure(evidenceIds.length > 0, 'settlement has no evidence');
      ensure(proof.finalCharge === null || Number.isSafeInteger(proof.finalCharge) && proof.finalCharge >= 0, 'invalid final charge');
      const required = [...new Set([...q.closure, op.fact.id, op.claim.id, acceptance.id, ...proof.required,
        ...observations.map(o => find(o.id, 'OperationObservation').fact.id)])];
      demand(d, factsFor(required));
      const fields = { request: q.id, operation: id, claim: op.claim.id, reservation: op.fact.id, digest: q.digest,
        acceptance: acceptance.id, observations: observations.map(o => o.id), outcome,
        finalCharge: proof.finalCharge, delayedExecutionExcluded: proof.delayedExecutionExcluded,
        retainedExposure: state === 'uncertain' || proof.finalCharge === null ? op.reservation.charge : proof.finalCharge, retryEligible: false as const };
      const prior = rows(snapshot()).filter(v => v.record.type === 'EffectSettlement' && v.record.operation === id).at(-1);
      if (prior) {
        ensure(prior.record.type === 'EffectSettlement', 'settlement type mismatch');
        if (encoded({ ...prior.record, id: '' }).bytes === encoded({ type: 'EffectSettlement', schemaVersion: 1, id: '', ...fields }).bytes) {
          demand(d, [prior.fact]); return issuedSettlement(prior.record, () => api.settle(id));
        }
        const previous = consumeOutcome(prior.record.outcome, { happened: () => 'happened', 'did-not-happen': () => 'did-not-happen', uncertain: () => 'uncertain' });
        ensure(previous === 'uncertain' || previous === state, 'settlement disagreement requires reassessment, not overwrite');
        ensure(prior.record.finalCharge === null || prior.record.finalCharge === proof.finalCharge, 'final charge disagreement');
        required.push(prior.fact.id);
      }
      const candidate = { type: 'EffectSettlement', schemaVersion: 1, id: `settlement:${encoded(fields).hash}`, ...fields } as unknown as EffectSettlement;
      const settlement = withSettlement(host, candidate, () => persist(candidate, required));
      demand(d, [find(settlement.id, 'EffectSettlement').fact]); return issuedSettlement(settlement, () => api.settle(id));
    }),
  };
  return Object.freeze(api);
}
