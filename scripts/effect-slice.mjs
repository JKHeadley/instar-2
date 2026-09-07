import { join } from 'node:path';
import { canonical, consumeResult, decode, decodeMeasurement, defineDecoder, deriveThrough } from '../dist/index.js';
import { createFactStore, authorAndAppend, hashBytes } from '../dist/facts/index.js';
import { createTransportAuthority, createTransportSpine, transportSchemas, registerTransportBodies, decodeLoopPolicy } from '../dist/transport/index.js';
import { createEffectDoorway, createEffectSpine, effectSchemas, registerEffectBodies, installOperationDefinition, decodeOutboundMessage } from '../dist/effects/index.js';
import { createTransportFileStorage } from './transport-file-storage.mjs';
import { createEffectReplicaStorage } from './effect-replica-storage.mjs';
import { createEffectFileCaptures } from './effect-file-captures.mjs';

const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
// Reference assembly. Seed is pinned host configuration, not candidate input.
// P5 pending/source and P9 assessor are explicitly absent/stand-ins, not live.
export function createEffectSlice(seed, directory, runtime) {
  const c = { register: seed.register, preserved: seed.preserved, captures: seed.captures,
    principals: [], grants: [], revocations: [], authorizations: [], evidence: [] };
  for (const p of seed.principals) {
    const provenance = take(decode('Provenance', p.provenance, c));
    c.principals.push(take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id: p.id, kind: p.kind }, { ...c, provenance })));
  }
  for (const g of seed.grants) {
    const source = take(decode('Provenance', g.source, c));
    c.grants.push(take(decode('StandingGrant', { ...g, source }, { ...c, provenance: source })));
  }
  for (const a of seed.authorizations) {
    const explicitYes = take(decode('Provenance', a.explicitYes, c));
    c.authorizations.push(take(decode('Authorization', { ...a, explicitYes }, { ...c, provenance: explicitYes })));
  }
  const clock = take(decodeMeasurement('clock', seed.clock, c));
  const principal = c.principals.find(p => p.id === seed.speaker);
  if (!principal) throw new Error('speaker absent from pinned identity context');
  const scope = take(decode('Scope', seed.scope, c)), boundary = { site: seed.site, register: seed.register, preserved: seed.preserved };
  const result = run => {
    const d = take(defineDecoder({ name: 'EffectFixtureHostResult', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: () => { try { return { ok: true, value: run() }; } catch (e) { return { ok: false, detail: String(e) }; } },
    }, seed.preserved));
    return deriveThrough(d, { type: 'EffectFixtureHostResult', schemaVersion: 1 }, boundary);
  };
  const custody = createEffectFileCaptures([join(directory, 'origin-captures'), join(directory, 'peer-captures')], result);
  const versions = seed.versions.map(v => ({ ...v, approvedIn: c.authorizations.find(a => a.id === v.approvedIn) }));
  const host = { machine: seed.machine, incarnation: runtime.incarnation, principal, scope, boundary, capture: custody.capture,
    current: () => ({ decode: c, clock, stopped: false, versions, authority: [seed.pendingId] }) };
  const th = { domain: 'conversation:1', machine: seed.machine, incarnation: runtime.incarnation,
    authorityIncarnation: runtime.authorityIncarnation, principal, scope, budget: 100, maxLeaseTerm: 1000,
    monotonic: runtime.monotonic, current: () => ({ decode: c, clock, stopped: false, generation: seed.register.generation }) };
  const context = { site: seed.site, preserved: seed.preserved, decode: c,
    schemas: [seed.noteSchema, ...transportSchemas(th), ...effectSchemas(host)],
    ownedBodies: [...take(registerTransportBodies(th, boundary)), ...take(registerEffectBodies(host))],
    keys: seed.keys, facts: [], grants: [], revocations: [], genesis: { ...seed.genesis, clock }, timeAnchors: [],
    get captures() { return custody.captures; }, folded: {} };
  const peer = createFactStore(context, createTransportFileStorage(join(directory, 'peer'), result));
  const copies = createEffectReplicaStorage(join(directory, 'origin'), { id: 'fixture-peer-directory', store: peer }, result);
  const store = createFactStore(context, copies.storage), author = { context, privateKey: seed.privateKey };
  const transport = createTransportAuthority(th, createTransportSpine(th, author, store), boundary);
  const spine = createEffectSpine(host, author, store);
  const adapter = runtime.adapter(result);
  // Optional nine assessment STAND-IN (present only for the admitted-dispatch settlement
  // path). It records a note and evidence keyed on the operation/state, exactly like the
  // in-process fixture stand-in; production composition supplies nine's real port. Absent
  // by default, so the existing recover-by-observe workers are unchanged (assessment: null).
  let acceptanceId = '';
  const assessmentView = (input, state, charge) => Object.freeze({
    outcome: take(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: state, evidence: [`assessment:${input.reservation.operation}:${state}`] }, c)),
    finalCharge: charge, delayedExecutionExcluded: false, required: Object.freeze([acceptanceId]) });
  const assessment = runtime.assessment ? {
    owner: 'part-nine',
    assess: input => result(() => {
      acceptanceId ||= take(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: seed.machine, principal,
        provenance: principal.provenance, at: clock, body: { identity: 'nine assessment STAND-IN', amount: '0' }, required: [] }, context, store, seed.privateKey)).fact.id;
      const state = runtime.assessment.state, evidenceId = `assessment:${input.reservation.operation}:${state}`;
      // The decode context's captures are raw byte strings; add the evidence bytes so the
      // Evidence decode (and settle's re-check) can verify the capture in this process.
      const evidenceBytes = `evidence:${evidenceId}`, evidenceRef = `capture:${evidenceId}`;
      c.captures[evidenceRef] = evidenceBytes;
      if (!c.evidence.some(e => e.id === evidenceId)) c.evidence.push(take(decode('Evidence', { type: 'Evidence', schemaVersion: 1, id: evidenceId,
        claim: { subject: input.reservation.operation, predicate: input.request.digest, value: state }, source: 'probe',
        observedAt: clock, freshFor: 100, strength: 'observation', capture: { reference: evidenceRef, hash: hashBytes(evidenceBytes) } }, c)));
      return { owner: 'part-nine', name: 'VerificationAssessment', id: acceptanceId }; }),
    read: (_acceptance, input) => result(() => assessmentView(input, runtime.assessment.state, runtime.assessment.charge)),
    consumeCurrent: (_a, input, consume) => result(() => consume(assessmentView(input, runtime.assessment.state, runtime.assessment.charge))),
  } : null;
  const api = createEffectDoorway({ host, spine, transport, durability: copies.durability, custody: custody.custody, adapter, assessment });
  const initialize = () => {
    const pending = take(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: seed.machine, principal,
      provenance: principal.provenance, at: clock, body: { identity: 'five-owned pending/source STAND-IN', amount: '0' }, required: [] }, context, store, seed.privateKey)).fact;
    if (pending.id !== seed.pendingId) throw new Error('pinned pending reference changed');
    take(installOperationDefinition(seed.definition, host, spine));
    const fence = take(transport.acquire('acquire', '', 500));
    const run = { owner: 'part-five', name: 'Run', id: 'run:1' };
    const policy = take(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'observation-policy', maxAttempts: 3,
      minDelay: 10, maxDuration: 1000, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, boundary));
    take(transport.schedule('schedule', fence, run, policy));
    const obligation = take(transport.inspect()).at(-1).fact.id;
    const message = take(decodeOutboundMessage(seed.message, host));
    const request = take(api.prepare({ definition: seed.definition.id, message, run, pending: pending.id,
      attempt: 'attempt:1', verificationOwner: 'reply-verifier', obligation, closure: [], fence }));
    return { request, fence };
  };
  // The admitted-dispatch seam: six reserves the operation EXTERNALLY (a caller's
  // admission), then eight adopts it — recording its own EffectRequest without a second
  // reservation. `dispatch`/`settle` then apply unchanged.
  const initializeAdmitted = () => {
    const pending = take(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: seed.machine, principal,
      provenance: principal.provenance, at: clock, body: { identity: 'five-owned pending/source STAND-IN', amount: '0' }, required: [] }, context, store, seed.privateKey)).fact;
    if (pending.id !== seed.pendingId) throw new Error('pinned pending reference changed');
    take(installOperationDefinition(seed.definition, host, spine));
    const fence = take(transport.acquire('acquire', '', 500));
    const run = { owner: 'part-five', name: 'Run', id: 'run:1' };
    const policy = take(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'observation-policy', maxAttempts: 3,
      minDelay: 10, maxDuration: 1000, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, boundary));
    take(transport.schedule('schedule', fence, run, policy));
    const obligation = take(transport.inspect()).at(-1).fact.id;
    const message = take(decodeOutboundMessage(seed.message, host));
    const requestId = `request:${take(canonical([message.account, message.conversation, message.semanticMessage])).hash}`;
    // The CALLER's external admission (six reserves at seven's request in production).
    take(transport.reserve({ command: 'external-admit', fence,
      request: { owner: 'part-eight', name: 'EffectRequest', id: requestId }, attempt: 'attempt:1',
      payloadDigest: take(canonical(message)).hash, charge: seed.definition.maxCharge, run,
      semanticMessage: message.semanticMessage, durability: seed.definition.durability, replicas: seed.definition.replicas }));
    const request = take(api.adopt({ definition: seed.definition.id, message, run, pending: pending.id,
      attempt: 'attempt:1', verificationOwner: 'reply-verifier', obligation, closure: [] }));
    return { request, fence };
  };
  return { api, transport, store, peer, host, result, initialize, initializeAdmitted };
}
