import { consumeResult, decode, decodeMeasurement, defineDecoder, deriveThrough } from '../dist/index.js';
import { createFactStore } from '../dist/facts/index.js';
import { createBoundedDueScanPort, createTransportAuthority, createTransportSpine, registerTransportBodies, transportSchemas } from '../dist/transport/index.js';
import { createTransportFileStorage } from './transport-file-storage.mjs';

const take = result => consumeResult(result, { Success: v => v, Refused: r => { throw new Error(`${r.site}: ${r.detail}`); } });

// Reference composition, not fleet activation. Boot input is pinned deployment
// configuration, never a message/candidate payload. The actual register reader,
// P5 engine and P8 doorway remain injected by the vertical-slice composition.
export function createTransportSlice(seed, directory, runtime) {
  const decodeContext = { register: seed.register, captures: seed.captures, preserved: seed.preserved,
    principals: [], grants: [], revocations: [], authorizations: [] };
  const provenance = take(decode('Provenance', seed.principal.provenance, decodeContext));
  const principal = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1,
    id: seed.principal.id, kind: seed.principal.kind }, { ...decodeContext, provenance }));
  decodeContext.principals.push(principal);
  const scope = take(decode('Scope', seed.scope, decodeContext));
  for (const raw of seed.grants) {
    const source = take(decode('Provenance', raw.source, decodeContext));
    decodeContext.grants.push(take(decode('StandingGrant', { ...raw, source, grantee: principal }, { ...decodeContext, provenance: source })));
  }
  const clock = take(decodeMeasurement('clock', seed.clock, decodeContext));
  const c = { site: seed.site, preserved: seed.preserved, register: seed.register };
  const result = run => {
    const d = take(defineDecoder({ name: 'ReferenceHostReceipt', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: () => { try { return { ok: true, value: run() }; } catch (e) { return { ok: false, detail: String(e) }; } },
    }, seed.preserved));
    return deriveThrough(d, { type: 'ReferenceHostReceipt', schemaVersion: 1 }, c);
  };
  const host = { domain: seed.domain, machine: seed.machine, incarnation: runtime.incarnation,
    authorityIncarnation: runtime.authorityIncarnation, principal, scope, budget: seed.budget,
    maxLeaseTerm: seed.maxLeaseTerm, monotonic: runtime.monotonic,
    current: () => runtime.current?.({ decode: decodeContext, clock, generation: seed.register.generation, stopped: false })
      ?? { decode: decodeContext, clock, generation: seed.register.generation, stopped: false } };
  const context = { site: c.site, preserved: c.preserved, decode: decodeContext, schemas: transportSchemas(host),
    ownedBodies: take(registerTransportBodies(host, c)), keys: seed.keys, facts: [], grants: [], revocations: [],
    genesis: { ...seed.genesis, clock }, timeAnchors: [], captures: {}, folded: {} };
  const storage = createTransportFileStorage(directory, result);
  const store = createFactStore(context, storage);
  const spine = createTransportSpine(host, { context, privateKey: seed.privateKey }, store);
  const api = createTransportAuthority(host, spine, c);
  const dueScan = createBoundedDueScanPort(host, spine, c);
  return Object.freeze({ api, dueScan, host, c, result, store });
}
