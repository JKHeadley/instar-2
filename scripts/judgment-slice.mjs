import { canonical, consumeResult, decode, decodeMeasurement, defineDecoder, deriveThrough } from '../dist/index.js';
import { authorAndAppend, createFactStore } from '../dist/facts/index.js';
import { createTransportAuthority, createTransportSpine, registerTransportBodies, transportSchemas } from '../dist/transport/index.js';
import { createJudgmentDoorway, createJudgmentSpine, createModelAdapter, registerJudgmentBodies, judgmentSchemas } from '../dist/judgment/index.js';
import { consumeEffectSettlement, createEffectDoorway, createEffectSpine, decodeOutboundMessage, effectSchemas, installOperationDefinition, registerEffectBodies } from '../dist/effects/index.js';
import { createTransportFileStorage } from './transport-file-storage.mjs';
import { createJudgmentCaptures } from './judgment-captures.mjs';

const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
// Reference initialization with a deterministic fake provider. The seed is trusted
// test/deployment configuration, NOT authenticated intake or a P3 activation proof.
export function createJudgmentSlice(seed, directory, runtime) {
  if (seed.description.provider !== 'fake-deterministic') throw new Error('live-provider mode is not implemented by this slice');
  const dc = { register: seed.register, captures: seed.captures, preserved: seed.preserved,
    principals: [], grants: [], revocations: [], evidence: [], authorizations: [] };
  const provenance = take(decode('Provenance', seed.principal.provenance, dc));
  const principal = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1,
    id: seed.principal.id, kind: seed.principal.kind }, { ...dc, provenance })); dc.principals.push(principal);
  const scope = take(decode('Scope', seed.scope, dc));
  for (const raw of seed.grants) {
    const source = take(decode('Provenance', raw.source, dc));
    // A grant may name a DIFFERENT grantee than the executor principal (e.g. the
    // separate approver of an enforced eight operation definition).
    const grantee = raw.grantee && raw.grantee.id !== seed.principal.id
      ? (() => { const p = take(decode('Provenance', raw.grantee.provenance, dc));
        const g = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id: raw.grantee.id, kind: raw.grantee.kind }, { ...dc, provenance: p }));
        if (!dc.principals.some(k => k.id === g.id)) dc.principals.push(g); return g; })()
      : principal;
    dc.grants.push(take(decode('StandingGrant', { ...raw, source, grantee }, { ...dc, provenance: source })));
  }
  for (const raw of seed.evidence) dc.evidence.push(take(decode('Evidence', raw, dc)));
  const clock = take(decodeMeasurement('clock', seed.clock, dc));
  const c = { site: seed.site, preserved: seed.preserved, register: seed.register };
  const result = run => {
    const d = take(defineDecoder({ name: 'JudgmentReferenceHost', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: () => { try { return { ok: true, value: run() }; } catch (e) { return { ok: false, detail: String(e) }; } },
    }, seed.preserved)); return deriveThrough(d, { type: 'JudgmentReferenceHost', schemaVersion: 1 }, c);
  };
  const transport = { domain: seed.domain, machine: seed.machine, incarnation: runtime.incarnation,
    authorityIncarnation: runtime.authorityIncarnation, principal, scope, budget: seed.budget, maxLeaseTerm: seed.maxLeaseTerm,
    monotonic: runtime.monotonic, current: () => ({ decode: dc, clock, generation: seed.register.generation, stopped: runtime.stopped?.() ?? false }) };
  const host = { transport, point: seed.point, floor: take(decode('ActionFloor', seed.floor, dc)), description: seed.description,
    refreshFacts: () => result(() => {
      for (const entry of take(store.readForProjection()).entries) {
        if (entry.taint.length || entry.conflicts.length) throw new Error('cannot refresh from tainted facts');
        for (const historical of entry.historical) if (historical.view.type === 'Evidence' && !dc.evidence.some(old => old.id === historical.view.id))
          dc.evidence.push(take(decode('Evidence', historical.view, dc)));
      }
    }) };
  const metadata = {};
  for (const e of dc.evidence) metadata[e.capture.reference] = { hash: e.capture.hash, bytes: seed.captures[e.capture.reference],
    byteLength: Buffer.byteLength(seed.captures[e.capture.reference]), status: 'available' };
  const captures = createJudgmentCaptures(directory, metadata, result, seed.captureCapacity, dc.captures);
  // Optional through-eight composition (docs/11 step 6): the REAL eight doorway
  // over the SAME spine, seven's EffectDispatchPort bound to it.
  let versions = [], effectAuthority = [];
  const effectHost = seed.effects ? { machine: transport.machine, incarnation: runtime.incarnation, principal, scope, boundary: c,
    current: () => ({ decode: dc, clock, stopped: runtime.stopped?.() ?? false, versions, authority: effectAuthority }),
    capture: bytes => captures.put(bytes, seed.captureCapacity) } : undefined;
  const noteSchema = { kind: 'note', version: 1, fields: { identity: { kind: 'text', maxLength: 80 }, amount: { kind: 'exact', unit: 'minor' } },
    machineScope: 'shared', standing: 'requester', action: 'work', scope, causallyBound: false, requiredReferences: [], authority: 'none' };
  const context = { site: c.site, preserved: c.preserved, decode: dc, schemas: [...transportSchemas(transport), ...judgmentSchemas(host),
    { kind: 'judgment-context-evidence', version: 1, fields: { evidence: { kind: 'constitutional', type: 'Evidence' } },
      machineScope: 'shared', standing: 'requester', action: 'work', scope, causallyBound: false, requiredReferences: [], authority: 'none' },
    ...(effectHost ? [noteSchema, ...effectSchemas(effectHost)] : [])],
    ownedBodies: [...take(registerTransportBodies(transport, c, ...(effectHost ? [consumeEffectSettlement] : []))),
      ...take(registerJudgmentBodies(host, c)), ...(effectHost ? take(registerEffectBodies(effectHost)) : [])],
    keys: seed.keys, facts: [], grants: [], revocations: [], genesis: { ...seed.genesis, clock }, timeAnchors: [], captures: metadata, folded: {} };
  const base = createTransportFileStorage(directory, result), storage = runtime.storage?.(base) ?? base;
  const store = createFactStore(context, storage);
  if (!take(store.read()).length) for (const evidence of dc.evidence) take(authorAndAppend({ kind: 'judgment-context-evidence', schemaVersion: 1,
    machine: transport.machine, principal, provenance, at: clock, body: { evidence }, required: [] }, context, store, seed.privateKey));
  const six = createTransportAuthority(transport, createTransportSpine(transport, { context, privateKey: seed.privateKey }, store), c,
    ...(effectHost ? [consumeEffectSettlement] : []));
  const client = runtime.client ?? { automaticRetries: 0, execute: async send => { await send(); } };
  const model = take(createModelAdapter(host.description, client, runtime.invoke, six, transport, c));
  const spine = createJudgmentSpine(host, { context, privateKey: seed.privateKey }, store);
  let effects, effectDoorway;
  if (effectHost) {
    const note = identity => take(store.read()).find(f => f.kind === 'note' && f.body.identity === identity)
      ?? take(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: transport.machine, principal, provenance, at: clock,
        body: { identity, amount: '0' }, required: [] }, context, store, seed.privateKey)).fact;
    const anchor = note('eight-authority-anchor');
    effectAuthority = [anchor.id];
    const approvedYes = take(decode('Provenance', seed.effects.approval.explicitYes, dc));
    const approvedIn = take(decode('Authorization', { ...seed.effects.approval, explicitYes: approvedYes }, { ...dc, provenance: approvedYes }));
    versions = [{ ...seed.effects.version, content: seed.effects.definition,
      contentHash: take(canonical(seed.effects.definition)).hash, approvedIn, base: approvedIn.base, since: anchor.id }];
    const effectSpine = createEffectSpine(effectHost, { context, privateKey: seed.privateKey }, store);
    const durability = { owner: 'part-ten', ensure: facts => result(() => facts.map(fact => {
      const found = take(store.read()).find(x => x.id === fact.id && x.contentHash === fact.contentHash);
      if (!found) throw new Error('fact is not durable on the shared store');
      return { fact: found, durability: { kind: 'local-durable' }, taint: [] };
    })) };
    const custody = { owner: 'part-ten', verify: refs => result(() => {
      for (const r of refs) { const held = metadata[r.reference]; if (held?.status !== 'available' || held.hash !== r.hash) throw new Error('custody missing'); } }) };
    transport.accountingDurability = durability;
    const adapter = { owner: 'part-ten', id: seed.effects.definition.adapter,
      describe: () => ({ contract: 'judgment-model-contract:1', account: seed.effects.definition.account,
        conversation: seed.effects.definition.conversation, maxCharge: seed.effects.definition.maxCharge,
        timeout: seed.effects.definition.timeout, hiddenRetries: 0 }),
      // The registered adapter enforces the digest-bound question deadline at the
      // provider boundary itself (R1's second layer): late invocation refused
      // BEFORE any provider call or invocation journal entry.
      invoke: input => result(() => {
        const payload = JSON.parse(input.message.text);
        if (typeof payload.deadline === 'number' && runtime.monotonic() >= payload.deadline) throw new Error('judgment deadline exhausted at provider invocation');
        runtime.effectsInvoke?.(input); return JSON.stringify(seed.observation);
      }),
      observe: () => result(() => JSON.stringify({ status: 'unknown', reason: 'model fixture has no decisive negative lookup' })) };
    const assessment = runtime.assessment ?? { state: 'happened', charge: 3, excluded: true };
    let acceptanceId = '', assessmentEvidence = '';
    const view = (ref, input) => {
      if (ref.id !== acceptanceId || !input.observations.length) throw new Error('assessment binding');
      return Object.freeze({ outcome: take(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: assessment.state, evidence: [assessmentEvidence] }, dc)),
        finalCharge: assessment.charge, delayedExecutionExcluded: assessment.excluded !== false, required: Object.freeze([acceptanceId]) });
    };
    // EXPLICIT nine stand-in: a note fact + a deterministic local verdict. No
    // production nine authority is claimed by this reference slice.
    const assessor = { owner: 'part-nine',
      assess: input => result(() => { acceptanceId ||= note('nine-assessment-standin').id;
        const evidenceId = `assessment:${input.reservation.operation}:${assessment.state}`;
        if (!dc.evidence.some(e => e.id === evidenceId)) dc.evidence.push(take(decode('Evidence', { type: 'Evidence', schemaVersion: 1,
          id: evidenceId, claim: { subject: input.reservation.operation, predicate: input.request.digest, value: assessment.state },
          source: 'probe', observedAt: clock, freshFor: 100000, capture: seed.effects.evidenceCapture, strength: 'observation' }, dc)));
        assessmentEvidence = evidenceId;
        return { owner: 'part-nine', name: 'VerificationAssessment', id: acceptanceId }; }),
      read: (ref, input) => result(() => view(ref, input)),
      consumeCurrent: (ref, input, consume) => result(() => consume(view(ref, input))) };
    effectDoorway = createEffectDoorway({ host: effectHost, spine: effectSpine, transport: six, durability, adapter, custody, assessment: assessor });
    if (!take(store.read()).some(f => f.kind === 'effect-OperationDefinition')) take(installOperationDefinition(seed.effects.definition, effectHost, effectSpine));
    const doorwayRef = () => effectDoorway;
    const port = { owner: 'part-eight',
      describe: () => ({ definition: seed.effects.definition.id, account: seed.effects.definition.account,
        conversation: seed.effects.definition.conversation, maxCharge: seed.effects.definition.maxCharge,
        durability: seed.effects.definition.durability, replicas: seed.effects.definition.replicas }),
      adopted: id => result(() => { const row = take(doorwayRef().inspect()).find(v => v.record.type === 'EffectRequest' && v.record.id === id);
        if (!row) throw new Error('no adopted effect request'); return { request: row.record.id, digest: row.record.digest }; }),
      adopt: input => result(() => { const message = take(decodeOutboundMessage(input.message, effectHost));
        const q = take(doorwayRef().adopt({ ...input, message })); return { request: q.id, digest: q.digest }; }),
      dispatch: (adopted, fence) => result(() => { const row = take(doorwayRef().inspect()).find(v => v.record.type === 'EffectRequest' && v.record.id === adopted.request);
        if (!row) throw new Error('adopted effect request missing'); return { operation: take(doorwayRef().dispatch(row.record, fence)).operation }; }) };
    effects = runtime.wrapEffects?.(port) ?? port;
  }
  const doorway = createJudgmentDoorway({ host, authority: six, spine, captures, model, boundary: c, ...(effects ? { effects } : {}) });
  return Object.freeze({ doorway, six, store, captures, host, c, result, effects, effectDoorway });
}
