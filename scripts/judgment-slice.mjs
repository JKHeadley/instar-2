import { consumeResult, decode, decodeMeasurement, defineDecoder, deriveThrough } from '../dist/index.js';
import { authorAndAppend, createFactStore } from '../dist/facts/index.js';
import { createTransportAuthority, createTransportSpine, registerTransportBodies, transportSchemas } from '../dist/transport/index.js';
import { createJudgmentDoorway, createJudgmentSpine, createModelAdapter, registerJudgmentBodies, judgmentSchemas } from '../dist/judgment/index.js';
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
    dc.grants.push(take(decode('StandingGrant', { ...raw, source, grantee: principal }, { ...dc, provenance: source })));
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
  const context = { site: c.site, preserved: c.preserved, decode: dc, schemas: [...transportSchemas(transport), ...judgmentSchemas(host),
    { kind: 'judgment-context-evidence', version: 1, fields: { evidence: { kind: 'constitutional', type: 'Evidence' } },
      machineScope: 'shared', standing: 'requester', action: 'work', scope, causallyBound: false, requiredReferences: [], authority: 'none' }],
    ownedBodies: [...take(registerTransportBodies(transport, c)), ...take(registerJudgmentBodies(host, c))],
    keys: seed.keys, facts: [], grants: [], revocations: [], genesis: { ...seed.genesis, clock }, timeAnchors: [], captures: metadata, folded: {} };
  const base = createTransportFileStorage(directory, result), storage = runtime.storage?.(base) ?? base;
  const store = createFactStore(context, storage);
  if (!take(store.read()).length) for (const evidence of dc.evidence) take(authorAndAppend({ kind: 'judgment-context-evidence', schemaVersion: 1,
    machine: transport.machine, principal, provenance, at: clock, body: { evidence }, required: [] }, context, store, seed.privateKey));
  const six = createTransportAuthority(transport, createTransportSpine(transport, { context, privateKey: seed.privateKey }, store), c);
  const client = runtime.client ?? { automaticRetries: 0, execute: async send => { await send(); } };
  const model = take(createModelAdapter(host.description, client, runtime.invoke, six, transport, c));
  const spine = createJudgmentSpine(host, { context, privateKey: seed.privateKey }, store);
  const doorway = createJudgmentDoorway({ host, authority: six, spine, captures, model, boundary: c });
  return Object.freeze({ doorway, six, store, captures, host, c, result });
}
