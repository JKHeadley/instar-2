import { consumeOutcome, consumeResult, decode, readEvidence } from '../index.js';
import type { Result } from '../index.js';
import type { FactEnvelope } from '../facts/index.js';
import { causalCone } from '../facts/index.js';
import type { AdmissionReservation, DispatchClaim } from '../transport/index.js';
import type { EffectComposition, EffectDoorway, EffectRecord, EffectRequest, EffectSettlement, EffectValidation,
  OperationDefinition, OperationObservation, OutboundMessage, TypedEffectPayload } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { definitionCheck, live, rows, wire } from './records.js';
import { issuedSettlement, withSettlement } from './settlement-authority.js';
import { effectOperationContracts, validateEffectPayload } from './payloads.js';
import { referencedPayloadFacts } from './references.js';

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
    const d = find(q.definition, 'OperationDefinition');
    definitionCheck(d.record, host);
    const capabilities = adapter.describe();
    ensure(adapter.owner === 'part-ten' && adapter.id === d.record.adapter && capabilities.contract.length > 0
      && capabilities.maxCharge <= d.record.maxCharge && capabilities.timeout === d.record.timeout
      && capabilities.hiddenRetries === 0, 'adapter mode or actual target mismatch');
    if (!q.payload) {
      ensure(d.record.payloadKind === undefined || d.record.payloadKind === 'ordinary-reply',
        'ordinary reply does not match operation definition');
      const m = find(q.message, 'OutboundMessage');
      ensure(capabilities.account === m.record.account && capabilities.conversation === m.record.conversation,
        'adapter mode or actual target mismatch');
      ensure(encoded(m.record).hash === q.digest, 'prepared message digest changed');
      return { d, payload: m.record as OutboundMessage | TypedEffectPayload, q: stored };
    }
    const p = find(q.payload, 'EffectPayload').record as TypedEffectPayload;
    validateEffectPayload(p, host, snapshot());
    ensure(q.payloadDigest === encoded(p).hash && q.binding && q.digest === encoded(q.binding).hash,
      'prepared effect payload digest changed');
    ensure(q.binding.claim.executor === host.incarnation, 'typed request belongs to an earlier executor incarnation');
    const contract = effectOperationContracts[p.kind], described = adapter.describePayload?.();
    ensure(adapter.invokePayload && described && described.kinds.includes(p.kind)
      && described.schemas.includes(contract.inputSchema) && described.canonicalization === contract.canonicalization
      && encoded(described.observations[p.kind]).bytes === encoded(contract.observations).bytes,
    `unsupported adapter capability for ${p.kind}`);
    if ('account' in p) {
      const conversation = p.kind === 'create-topic' ? p.parentConversation : p.conversation;
      ensure(capabilities.account === p.account && capabilities.conversation === conversation
        && d.record.account === p.account && d.record.conversation === conversation,
      'adapter mode or actual target mismatch');
    }
    return { d, payload: p as OutboundMessage | TypedEffectPayload, q: stored };
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
    const d = find(q.definition, 'OperationDefinition').record;
    const payload = q.payload ? find(q.payload, 'EffectPayload').record as TypedEffectPayload : find(q.message, 'OutboundMessage').record;
    const account = payload.type === 'OutboundMessage' ? payload.account : 'account' in payload ? payload.account : d.account;
    const conversation = payload.type === 'OutboundMessage' ? payload.conversation : 'conversation' in payload ? payload.conversation : d.conversation;
    const capture = take(host.capture(bytes));
    const fields = { request: q.id, operation: op.reservation.operation, claim: op.claim.id, digest: q.digest,
      account, conversation, stage, wake, capture, attestation: 'local-recorder' as const };
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
  const admissionSemantic = (q: { semanticMessage: string; binding?: EffectRequest['binding'] }): string => q.binding
    ? `effect-child:${encoded([q.semanticMessage, q.binding.logicalEffect]).hash}` : q.semanticMessage;
  const admissionMatches = (r: AdmissionReservation, q: { digest: string; attempt: string; run: string; semanticMessage: string;
    binding?: EffectRequest['binding'] }, d: OperationDefinition): boolean =>
    r.digest === q.digest && r.attempt === q.attempt && r.charge === d.maxCharge
    && r.run === q.run && r.semanticMessage === admissionSemantic(q)
    && r.durability === d.durability && r.replicas === d.replicas;
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
    preparePayload: input => checked('EffectPayloadPrepare', input, () => {
      live(host);
      ensure(input.run.owner === 'part-five' && input.run.name === 'Run' && input.run.id === input.payload.run,
        'run owner mismatch');
      const historical = snapshot();
      validateEffectPayload(input.payload, host, historical);
      const d = find(input.definition, 'OperationDefinition'); definitionCheck(d.record, host);
      ensure(d.record.payloadKind === input.payload.kind, 'payload kind differs from operation definition');
      ensure(input.payload.sourceResult === input.pending, 'typed source result is not the pending result being discharged');
      const references = referencedPayloadFacts(input.payload, host, historical);
      if (input.payload.kind === 'post-media') take(custody.verify(input.payload.attachments.map(item => item.capture), d.record));
      if (input.payload.kind === 'derive-transcript') take(custody.verify([input.payload.sourceCapture], d.record));
      const p = persist(input.payload, references);
      const closure = [...new Set([...input.closure, input.pending, input.obligation, d.fact.id,
        find(p.id, 'EffectPayload').fact.id, ...references, ...host.current().authority])];
      const requestId = `request:${encoded(['effect-payload', p.logicalEffect, p.semanticMessage, p.id]).hash}`;
      const binding = freeze({ subject: p.semanticMessage, target: p.targetDigest,
        sourceVector: encoded([...closure].sort()).hash, sourceGeneration: d.record.generation,
        principal: host.principal.id, definition: { id: d.record.id, version: d.record.version },
        payload: { id: p.id, digest: encoded(p).hash }, logicalEffect: p.logicalEffect,
        run: p.run, step: p.step, lease: input.fence.assignment, fence: encoded(input.fence).hash,
        reservation: { request: requestId, attempt: input.attempt, charge: d.record.maxCharge,
          run: p.run, semanticMessage: `effect-child:${encoded([p.semanticMessage, p.logicalEffect]).hash}`,
          durability: d.record.durability, replicas: d.record.replicas },
        claim: { attempt: input.attempt, executor: host.incarnation } });
      const q = persist({ type: 'EffectRequest', schemaVersion: 1, id: requestId, definition: d.record.id,
        message: p.id, payload: p.id, payloadDigest: encoded(p).hash, binding,
        semanticMessage: p.semanticMessage, run: p.run, pending: input.pending, attempt: input.attempt,
        digest: encoded(binding).hash, verificationOwner: input.verificationOwner, verificationBar: d.record.verificationBar,
        obligation: input.obligation, closure } as unknown as EffectRequest, closure);
      const v = validation(q, 'reservation');
      demand(d.record, factsFor([...q.closure, find(q.id, 'EffectRequest').fact.id, find(v.id, 'EffectValidation').fact.id]));
      // Capability absence is a typed Refused before six can reserve or claim.
      actual(q);
      take(transport.reserve({ command: `reserve:${q.id}`, fence: input.fence,
        request: { owner: 'part-eight', name: 'EffectRequest', id: q.id }, attempt: q.attempt,
        payloadDigest: q.digest, charge: d.record.maxCharge, run: input.run, semanticMessage: admissionSemantic(q),
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
      live(host); ensure(input.run.owner === 'part-five' && input.run.name === 'Run' && input.run.id === input.message.run, 'run owner mismatch');
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
        find(m.id, 'OutboundMessage').fact.id, ...host.current().authority])];
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
      const { d, payload } = actual(q), op = operation(claim.operation);
      ensure(op.reservation.request === q.id && supplied.operation === op.reservation.operation
        && supplied.digest === q.digest && claim.digest === q.digest && claim.attempt === q.attempt
        && claim.executor === host.incarnation, 'claim request or incarnation mismatch');
      // The unavoidable invocation boundary: the reservation must completely match the
      // request's definition and identity before any adapter call, so a mismatched or
      // unadopted admission can never authorize an invocation even by a direct handoff.
      ensure(admissionMatches(op.reservation, q, d.record), 'reservation does not match the dispatched request');
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
          const response = payload.type === 'OutboundMessage'
            ? adapter.invoke({ operation: claim.operation, claim: op.claim.id, digest: q.digest, message: payload })
            : adapter.invokePayload!({ operation: claim.operation, claim: op.claim.id, digest: q.digest, payload });
          const received = consumeResult(response, { Success: responseBytes => ({ bytes: responseBytes, ok: true }),
            Refused: refusal => ({ bytes: payload.type === 'OutboundMessage'
              ? 'adapter returned no conclusive response' : encoded(refusal).bytes, ok: false }) });
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
      const q = find(op.reservation.request, 'EffectRequest').record;
      const d = find(q.definition, 'OperationDefinition').record;
      const payload = q.payload ? find(q.payload, 'EffectPayload').record as TypedEffectPayload : find(q.message, 'OutboundMessage').record;
      const account = payload.type === 'OutboundMessage' ? payload.account : 'account' in payload ? payload.account : d.account;
      const conversation = payload.type === 'OutboundMessage' ? payload.conversation : 'conversation' in payload ? payload.conversation : d.conversation;
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
        const response = consumeResult(adapter.observe({ operation: id, digest: q.digest, account, conversation }),
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
          const claimFields = claim.value && typeof claim.value === 'object' && !Array.isArray(claim.value)
            ? claim.value as Readonly<Record<string, import('../index.js').Json>> : undefined;
          const standardized = Boolean(q.payload) && claimFields?.digest === q.digest
            && (claim.predicate === 'operation-occurred' && state === 'happened'
              || claim.predicate === 'operation-did-not-occur' && (state === 'did-not-happen' || state === 'uncertain')
              || claim.predicate === 'old-executor-quiescent'
              || claim.predicate === 'charge-settled');
          const historical = claim.predicate === q.digest && claim.value === state;
          ensure(claim.subject === op.reservation.operation && (standardized || historical),
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
      const evidenceCaptures = q.payload ? (() => {
        const acceptanceFact = snapshot().find(fact => fact.id === acceptance.id
          && fact.kind === 'verification-VerificationAssessment');
        const acceptanceRecord = acceptanceFact && typeof acceptanceFact.body === 'object' && !Array.isArray(acceptanceFact.body)
          ? (acceptanceFact.body as { record?: { evidence?: readonly string[] } }).record : undefined;
        ensure(acceptanceRecord && Array.isArray(acceptanceRecord.evidence) && acceptanceRecord.evidence.length > 0,
          'typed settlement assessment evidence is absent');
        const sources = acceptanceRecord.evidence.map(evidenceId => host.current().decode.evidence?.find(item => item.id === evidenceId));
        ensure(sources.every((item): item is NonNullable<typeof item> => item !== undefined),
          'typed settlement assessment evidence is unavailable');
        return freeze([...new Map(sources.map(item => [item!.capture.reference, item!.capture])).values()]
          .sort((left, right) => left.reference.localeCompare(right.reference)));
      })() : undefined;
      const fields = { request: q.id, operation: id, claim: op.claim.id, reservation: op.fact.id, digest: q.digest,
        acceptance: acceptance.id, observations: observations.map(o => o.id), outcome,
        finalCharge: proof.finalCharge, delayedExecutionExcluded: proof.delayedExecutionExcluded,
        retainedExposure: state === 'uncertain' || proof.finalCharge === null ? op.reservation.charge : proof.finalCharge, retryEligible: false as const,
        ...(evidenceCaptures ? { evidenceCaptures } : {}) };
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
  return Object.freeze(api);
}
