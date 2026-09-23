import { consumeOutcome, consumeResult, decode, readEvidence } from '../index.js';
import type { Result } from '../index.js';
import type { FactEnvelope, FactStorePort } from '../facts/index.js';
import { causalCone } from '../facts/index.js';
import { createTransportAuthority, createTransportSpine, invokeConsumedDispatch } from '../transport/index.js';
import type { TransportHost, AdmissionReservation, DispatchClaim, FenceToken, RunPairAdmission } from '../transport/index.js';
import type { EffectComposition, EffectDoorway, EffectRecord, EffectRequest, EffectSettlement, EffectValidation,
  OperationDefinition, OperationObservation, OutboundMessage } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { definitionCheck, live, rows, wire, readHarnessLiveInputCapture, harnessLiveInputAuthor } from './records.js';
import { issuedSettlement, withSettlement, consumeEffectSettlement } from './settlement-authority.js';

export interface HarnessLiveInputExecutionPort {
  readonly owner: 'part-eight';
  admit(request: EffectRequest, fence: FenceToken): Result<Readonly<{ operation: string; claim: string }>>;
  deliver(input: Readonly<{ specification: Readonly<{ operation: string; claim: string; inputDigest: string; run: string }>;
    operation: string; claim: string; processIdentity: string }>): Result<string>;
  observe(input: Readonly<{ specification: Readonly<{ operation: string; claim: string; inputDigest: string; run: string }>;
    operation: string; processIdentity: string }>): Result<Readonly<{ phase: 'context-consumed'; evidence: string; detail: string }>>;
}
const liveInputFactories = new WeakMap<object, () => HarnessLiveInputExecutionPort>();
const doorwayOrigins = new WeakMap<object, EffectComposition>();
const liveInputStores = new WeakMap<object, FactStorePort>();
/** Only a real Eight doorway can expose the additive live-input arm. */
export function createHarnessLiveInputExecution(doorway: EffectDoorway, transportHost: TransportHost): HarnessLiveInputExecutionPort {
  const composition = doorwayOrigins.get(doorway);
  ensure(composition, 'live-input execution requires a genuine Eight doorway');
  ensure(transportHost.incarnation === composition.host.incarnation && transportHost.machine === composition.host.machine
    && transportHost.principal.id === composition.host.principal.id, 'live-input Six/Eight executor identity differs');
  // Own the actual Six constructor/delegation here. A caller-supplied method-
  // shaped transport, or a wrapper that skips consume(), cannot be certified.
  const author = harnessLiveInputAuthor(composition.spine);
  const transport = createTransportAuthority(transportHost,
    createTransportSpine(transportHost, author, composition.spine.store), composition.host.boundary, consumeEffectSettlement);
  const confined = createEffectDoorway({ ...composition, transport });
  return liveInputFactories.get(confined)!();
}
export function isHarnessLiveInputExecution(port: object, store: FactStorePort): boolean {
  return liveInputStores.get(port) === store;
}

export function createEffectDoorway(composition: EffectComposition): EffectDoorway {
  const { host, spine, transport, durability, custody, adapter, assessment } = composition;
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
    ensure((m.record.purpose === 'context-delivery') === (d.record.feature === 'harness-live-input'), 'live-input payload requires its governed harness-live-input definition');
    const capabilities = adapter.describe();
    ensure(adapter.owner === 'part-ten' && adapter.id === d.record.adapter && capabilities.contract.length > 0
      && capabilities.account === m.record.account && capabilities.conversation === m.record.conversation
      && capabilities.maxCharge <= d.record.maxCharge && capabilities.timeout === d.record.timeout
      && capabilities.hiddenRetries === 0, 'adapter mode or actual target mismatch');
    ensure(encoded(m.record).hash === q.digest, 'prepared message digest changed');
    return { d, m, q: stored };
  };
  const validation = (q: EffectRequest, phase: 'reservation' | 'dispatch') => {
    const { d } = actual(q), c = d.record.feature === 'harness-live-input' ? host.current(d.record.feature) : host.current();
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
  // The complete admission-to-definition-and-request equality adoption requires: the
  // exact seven fields prepare would have reserved with. Enforced at BOTH adoption
  // (before any persist) and dispatch/handoff (the unavoidable invocation boundary),
  // so a mismatched or unadopted admission can never authorize a call even if a
  // request was left persisted by an earlier refused or partial adoption.
  const admissionMatches = (r: AdmissionReservation, q: { digest: string; attempt: string; run: string; semanticMessage: string }, d: OperationDefinition): boolean =>
    r.digest === q.digest && r.attempt === q.attempt && r.charge === d.maxCharge
    && r.run === q.run && r.semanticMessage === q.semanticMessage
    && r.durability === d.durability && r.replicas === d.replicas;
  // Synchronous consume-before-call excludes on-stack reentry. P6's live capability
  // additionally excludes another instance and any reconstructed/restarted handle.
  const active = new Set<string>();
  const accepted = new WeakMap<object, OperationObservation>();
  const api: EffectDoorway = {
    owner: 'part-eight',
    inspect: () => checked('EffectInspect', null, () => rows(snapshot())),
    prepare: input => checked('EffectPrepare', input, () => {
      live(host, input.message.purpose === 'context-delivery' ? 'harness-live-input' : undefined); ensure(input.run.owner === 'part-five' && input.run.name === 'Run' && input.run.id === input.message.run, 'run owner mismatch');
      const d = find(input.definition, 'OperationDefinition'); definitionCheck(d.record, host);
      const m = persist(input.message, [input.message.sourceResult]);
      const closure = [...new Set([...input.closure, input.pending, input.obligation, d.fact.id,
        find(m.id, 'OutboundMessage').fact.id, ...(d.record.feature === 'harness-live-input' ? host.current(d.record.feature) : host.current()).authority])];
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
    // Dispatch-against-provided-admission: an operation six ADMITTED AND RESERVED at a
    // caller's request (docs/11 step 5). Eight records its own EffectRequest for that
    // admission — so `settle`'s find(reservation.request, 'EffectRequest') resolves —
    // but NEVER mints a second six reservation: the reserve() call above is replaced by
    // verifying the caller's admission exists and is exactly the one it shows. Every
    // other rule (validation, durability demand, actual re-check) is prepare's, so the
    // reused `dispatch`/`handoff`/`settle` path is byte-identical.
    adopt: input => checked('EffectAdopt', input, () => {
      live(host, input.message.purpose === 'context-delivery' ? 'harness-live-input' : undefined); ensure(input.run.owner === 'part-five' && input.run.name === 'Run' && input.run.id === input.message.run, 'run owner mismatch');
      const d = find(input.definition, 'OperationDefinition'); definitionCheck(d.record, host);
      // Validate the CALLER's admission BEFORE persisting anything, so a refused
      // adoption leaves no dispatchable EffectRequest behind (R1). The request identity
      // and digest derive from the caller's message alone; no persist is needed to match.
      const requestId = `request:${encoded([input.message.account, input.message.conversation, input.message.semanticMessage]).hash}`;
      // A repeated adoption of an admission eight already recorded its request for
      // refuses by name (R2); a replacement process recovers by dispatching the
      // persisted request directly, never by re-adopting.
      ensure(!rows(snapshot()).some(v => v.record.type === 'EffectRequest' && v.record.id === requestId), 'admission already adopted');
      const admission = take(transport.inspect()).filter(a => a.record.type === 'AdmissionReservation' && a.record.request === requestId).at(-1);
      ensure(admission?.record.type === 'AdmissionReservation', 'no external admission exists for this request');
      const shown = { digest: encoded(input.message).hash, attempt: input.attempt, run: input.message.run, semanticMessage: input.message.semanticMessage };
      ensure(admissionMatches(admission.record, shown, d.record), 'external admission does not match the caller-shown dispatch');
      // Match confirmed. NOW record eight's own EffectRequest against the caller's
      // admission — never a second six reservation. dispatch/handoff/settle apply unchanged.
      const m = persist(input.message, [input.message.sourceResult]);
      const closure = [...new Set([...input.closure, input.pending, input.obligation, d.fact.id,
        find(m.id, 'OutboundMessage').fact.id, ...(d.record.feature === 'harness-live-input' ? host.current(d.record.feature) : host.current()).authority])];
      const q = persist({ type: 'EffectRequest', schemaVersion: 1,
        id: requestId, definition: d.record.id,
        message: m.id, semanticMessage: m.semanticMessage, run: m.run, pending: input.pending, attempt: input.attempt,
        digest: encoded(m).hash, verificationOwner: input.verificationOwner, verificationBar: d.record.verificationBar,
        obligation: input.obligation, closure } as unknown as EffectRequest, closure);
      const v = validation(q, 'reservation');
      demand(d.record, factsFor([...q.closure, find(q.id, 'EffectRequest').fact.id, find(v.id, 'EffectValidation').fact.id]));
      actual(q);
      return q;
    }),
    dispatch: (q, fence) => checked('EffectDispatch', q.id, () => {
      const prior = take(transport.inspect()).filter(v => v.record.type === 'AdmissionReservation' && v.record.request === q.id).at(-1);
      ensure(prior?.record.type === 'AdmissionReservation', 'request is not reserved');
      // The reservation must COMPLETELY match the dispatched request's definition and
      // identity — the same equality adoption required. A mismatched or unadopted
      // admission (e.g. one left dispatchable by a refused adoption) can never dispatch.
      ensure(admissionMatches(prior.record, q, find(q.definition, 'OperationDefinition').record), 'reservation does not match the dispatched request');
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
      // The unavoidable invocation boundary: the reservation must completely match the
      // request's definition and identity before any adapter call, so a mismatched or
      // unadopted admission can never authorize an invocation even by a direct handoff.
      ensure(admissionMatches(op.reservation, q, d.record), 'reservation does not match the dispatched request');
      const v = rows(snapshot()).filter(v => v.record.type === 'EffectValidation' && v.record.request === q.id && v.record.phase === 'dispatch').at(-1);
      ensure(v?.record.type === 'EffectValidation' && v.record.expires > host.current().clock.value
        && encoded(v.record.authority).bytes === encoded((d.record.feature === 'harness-live-input' ? host.current(d.record.feature) : host.current()).authority).bytes, 'current dispatch validation required');
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
        const { m } = actual(q); ensure(v.record.expires > host.current().clock.value, 'validation expired before invocation');
        const invocation = { operation: claim.operation, claim: op.claim.id, digest: q.digest, message: m.record };
        // Select the pair boundary for this exact operation from the signed
        // store, never a caller's role or a transport wrapper's inspection.
        // Ordinary dispatch retains its existing transport-port contract.
        const invocationFacts = snapshot();
        const operationDomains = invocationFacts.filter(fact => fact.kind === 'transport-AdmissionReservation')
          .map(fact => (fact.body as unknown as { record: AdmissionReservation }).record)
          .filter(record => record.operation === claim.operation).map(record => record.domain);
        const paired = invocationFacts.some(fact => fact.kind === 'transport-RunPairAdmission'
          && operationDomains.includes((fact.body as unknown as { record: RunPairAdmission }).record.domain));
        const invoke = () => {
          try {
            const response = adapter.invoke(invocation);
            return consumeResult<string, { bytes: string; stage: 'response' | 'unknown' }>(response, {
              Success: bytes => ({ bytes, stage: 'response' as const }),
              Refused: () => ({ bytes: 'adapter returned no conclusive response', stage: 'unknown' as const }),
            });
          } catch { return { bytes: 'invocation ended without a recorded service response', stage: 'unknown' as const }; }
        };
        const { bytes, stage } = paired
          ? take(invokeConsumedDispatch(transport, claim, fence, host.boundary, invoke)) : invoke();
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
    settle: id => settle(id, value => value),
  };
  function settle<T>(id: string, consume: (value: EffectSettlement) => T): Result<T> {
    return checked('EffectSettle', id, () => {
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
      const checkEvidence = () => {
        const current = host.current();
        return encoded(evidenceIds.map(id => {
          const source = current.decode.evidence?.find(e => e.id === id);
          ensure(source, 'accepted evidence is absent');
          const e = take(decode('Evidence', source, current.decode));
          const claim = take(readEvidence(e, current.clock, host.boundary.preserved));
          const value = claim.value;
          const predicates = state === 'happened' ? ['operation-occurred'] : state === 'did-not-happen'
            ? ['operation-did-not-occur', 'old-executor-quiescent']
            : ['operation-occurred', 'operation-did-not-occur', 'old-executor-quiescent', 'charge-settled'];
          ensure(claim.subject === op.reservation.operation
            && ((claim.predicate === q.digest && value === state)
              || (value !== null && typeof value === 'object' && !Array.isArray(value)
                && 'digest' in value && value.digest === q.digest && predicates.includes(claim.predicate))),
          'accepted evidence has different operation/digest/predicate');
          ensure(state === 'uncertain' || e.strength === 'proof' || e.strength === 'observation', 'inference cannot settle an external effect');
          return source;
        })).bytes;
      };
      const evidencePin = checkEvidence(), proofPin = encoded(proof).bytes;
      ensure(evidenceIds.length > 0, 'settlement has no evidence');
      ensure(proof.finalCharge === null || Number.isSafeInteger(proof.finalCharge) && proof.finalCharge >= 0, 'invalid final charge');
      const required = [...new Set([...q.closure, op.fact.id, op.claim.id, acceptance.id, ...proof.required,
        ...observations.map(o => find(o.id, 'OperationObservation').fact.id)])];
      const revalidate = <U>(ready: () => U): U => {
        // Assessment and custody may wait too. Read them BEFORE the final P1
        // clock check; changed inputs refuse instead of blessing an old comparison.
        ensure(encoded(take(assessment.read(acceptance, input))).bytes === proofPin, 'assessment changed during settlement wait');
        ensure(custody?.owner === 'part-ten', 'current physical custody port unavailable');
        take(custody.verify(observations.map(o => o.capture), d));
        ensure(encoded(operation(id).reservation).bytes === encoded(op.reservation).bytes, 'reservation changed during settlement wait');
        const currentObservations = rows(snapshot()).filter(v => v.record.type === 'OperationObservation' && v.record.operation === id).map(v => v.record);
        ensure(encoded(currentObservations).bytes === encoded(observations).bytes, 'observations changed during settlement wait');
        ensure(typeof assessment.consumeCurrent === 'function', 'non-waiting current assessment guard unavailable');
        // All host work that may wait is now complete. The owner must compare
        // and hold CURRENT conclusions without refreshing/waiting; refusal is
        // the only fallback. No custody/read/reservation port runs in this guard.
        return take(assessment.consumeCurrent(acceptance, input, current => {
          ensure(encoded(current).bytes === proofPin, 'assessment changed during settlement wait');
          ensure(checkEvidence() === evidencePin, 'evidence changed during settlement wait');
          return ready();
        }));
      };
      demand(d, factsFor(required));
      revalidate(() => undefined);
      const issue = (value: EffectSettlement) => consume(issuedSettlement(value, next => settle(id, next)));
      const fields = { request: q.id, operation: id, claim: op.claim.id, reservation: op.fact.id, digest: q.digest,
        acceptance: acceptance.id, observations: observations.map(o => o.id), outcome,
        finalCharge: proof.finalCharge, delayedExecutionExcluded: proof.delayedExecutionExcluded,
        retainedExposure: state === 'uncertain' || proof.finalCharge === null ? op.reservation.charge : proof.finalCharge, retryEligible: false as const };
      const prior = rows(snapshot()).filter(v => v.record.type === 'EffectSettlement' && v.record.operation === id).at(-1);
      if (prior) {
        ensure(prior.record.type === 'EffectSettlement', 'settlement type mismatch');
        if (encoded({ ...prior.record, id: '' }).bytes === encoded({ type: 'EffectSettlement', schemaVersion: 1, id: '', ...fields }).bytes) {
          demand(d, [prior.fact]); return revalidate(() => issue(prior.record as EffectSettlement));
        }
        const previous = consumeOutcome(prior.record.outcome, { happened: () => 'happened', 'did-not-happen': () => 'did-not-happen', uncertain: () => 'uncertain' });
        ensure(previous === 'uncertain' || previous === state, 'settlement disagreement requires reassessment, not overwrite');
        ensure(prior.record.finalCharge === null || prior.record.finalCharge === proof.finalCharge, 'final charge disagreement');
        required.push(prior.fact.id);
      }
      const candidate = { type: 'EffectSettlement', schemaVersion: 1, id: `settlement:${encoded(fields).hash}`, ...fields } as unknown as EffectSettlement;
      const settlement = withSettlement(host, candidate, () => persist(candidate, required));
      demand(d, [find(settlement.id, 'EffectSettlement').fact]); return revalidate(() => issue(settlement));
    });
  }
  doorwayOrigins.set(api, composition);
  liveInputFactories.set(api, () => {
    const claims = new Map<string, { request: EffectRequest; fence: FenceToken; claim: DispatchClaim; reservation: AdmissionReservation }>();
    const execution: HarnessLiveInputExecutionPort = Object.freeze({ owner: 'part-eight' as const,
      admit: (request: EffectRequest, fence: FenceToken) => checked('HarnessLiveInputAdmission', request, () => {
        const { m, d } = actual(request);
        ensure(m.record.purpose === 'context-delivery' && d.record.feature === 'harness-live-input', 'harness live-input role required');
        const reserved = take(transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
          && row.record.request === request.id).at(-1);
        ensure(reserved?.record.type === 'AdmissionReservation' && reserved.record.state === 'prepared', 'live-input operation is not prepared; recovery is observation only');
        validation(request, 'dispatch');
        const claim = take(transport.claim(`claim:${request.id}`, fence, reserved.record.operation));
        claims.set(claim.operation, { request, fence, claim, reservation: reserved.record });
        return freeze({ operation: claim.operation, claim: operation(claim.operation).claim!.id });
      }),
      deliver: (input: Parameters<HarnessLiveInputExecutionPort['deliver']>[0]) => checked('HarnessLiveInputHandoff', input, () => {
        const held = claims.get(input.operation), spec = input.specification;
        ensure(held && spec.operation === input.operation && spec.claim === input.claim
          && held.request.run === spec.run
          && operation(input.operation).claim?.id === input.claim, 'exact live-input claim/request required');
        const { m } = actual(held.request);
        ensure(m.record.purpose === 'context-delivery', 'ordinary reply cannot deliver harness context');
        ensure((m.record.context?.input.hash ?? held.request.digest) === spec.inputDigest, 'live-input captured input digest differs');
        // Burn before entering the real handoff. Six performs the durable consume
        // before adapter.invoke; no reconstructed executor can reissue this handle.
        claims.delete(input.operation);
        const result = take(api.handoff(held.request, held.reservation, held.claim, held.fence));
        ensure(result.stage === 'response', 'live-input adapter did not return acceptance evidence');
        const acceptance = rows(snapshot()).find(row => row.record.type === 'OperationObservation'
          && row.record.operation === input.operation && row.record.stage === 'executor-accepted');
        ensure(acceptance, 'durable executor acceptance missing');
        return acceptance.fact.id;
      }),
      observe: (input: Parameters<HarnessLiveInputExecutionPort['observe']>[0]) => checked('HarnessLiveInputConsumption', input, () => {
        const op = operation(input.operation), spec = input.specification;
        const request = find(op.reservation.request, 'EffectRequest').record;
        const { m } = actual(request);
        ensure(op.reservation.state === 'consumed' && op.reservation.digest === request.digest
          && (m.record.context?.input.hash ?? request.digest) === spec.inputDigest
          && op.reservation.run === spec.run && op.claim?.id === spec.claim, 'consumed live-input owner claim required');
        const observation = priorObservation(input.operation);
        ensure(observation?.stage === 'response', 'live-input response is missing or uncertain');
        const response = JSON.parse(readHarnessLiveInputCapture(spine, observation.capture)) as Record<string, unknown>;
        ensure(response.type === 'harness-context-consumed' && response.operation === input.operation
          && response.digest === request.digest && response.processIdentity === input.processIdentity,
          'response does not witness this process consuming this live input');
        return freeze({ phase: 'context-consumed' as const, evidence: find(observation.id, 'OperationObservation').fact.id,
          detail: 'the admitted harness boundary witnessed exact live-input consumption' });
      }),
    });
    liveInputStores.set(execution, spine.store);
    return execution;
  });
  return Object.freeze(api);
}
