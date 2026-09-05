// Fresh-process proof using only public package APIs and retained signed bytes.
import { readFileSync } from 'node:fs';
import { compare, decode, decodeMeasurement, consumeResult, defineDecoder } from '../dist/index.js';
import { createFactStore, signEnvelope } from '../dist/facts/index.js';
const { context: raw, principal: identity, proof, path, key } = JSON.parse(readFileSync(0, 'utf8'));
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw Error(r.detail); } });
const { provenance: _origin, ...receivedContext } = raw.decode;
const decodeContext = { ...receivedContext, principals: [], grants: [], revocations: [], authorizations: [] };
const now = take(decodeMeasurement('clock', raw.genesis.clock, decodeContext));
const provenance = take(decode('Provenance', proof, decodeContext));
const principal = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id: identity.id, kind: identity.kind }, { ...decodeContext, provenance }));
const context = { ...raw, decode: decodeContext, genesis: { ...raw.genesis, clock: now },
  schemas: raw.schemas.map(s => ({ ...s, scope: take(decode('Scope', s.scope, decodeContext)) })) };
const boundary = { site: context.site, preserved: context.preserved, register: decodeContext.register };
const result = value => take(defineDecoder({ owner: 'part-ten', name: 'RestartProvider', currentVersion: 1,
  versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {}, decodeCurrent: () => ({ ok: true, value }) },
context.preserved)).decode({ schemaVersion: 1 }, boundary);
let appends = 0;
const storage = { owner: 'part-ten', read: () => readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse),
  append: () => { appends++; throw Error('duplicate append after restart'); } };
const appender = { owner: 'part-ten', machine: 'machine-a', principal, provenance, clock: () => now, sign: wire => result(signEnvelope(wire, key)) };
const store = createFactStore(context, storage, { conflictAppender: appender });
const snapshot = take(store.readForProjection());
const conflicts = [...new Map(snapshot.entries.flatMap(e => e.conflicts).map(c => [c.key, c])).values()];
const historical = conflicts.flatMap(c => c.historicalConstitutional ? [c.historicalConstitutional] : []);
const liveRefused = historical.every(c => consumeResult(compare(c.view.left.type, c.view.left, c.view.right, 'identity', c.view.subject, context.preserved),
  { Success: () => false, Refused: () => true }));
process.stdout.write(JSON.stringify({ appends, facts: take(store.read()).length, keys: conflicts.map(c => c.key),
  historical: historical.map(c => ({ owner: c.owner, kind: c.kind, sources: c.sources })), liveRefused }));
