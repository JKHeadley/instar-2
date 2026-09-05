import { expect, it } from 'vitest';
import { mkdtempSync, openSync, closeSync, writeSync, fsyncSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFactStore, authorAndAppend, decodeEnvelope, wrapUnresolved, verifyAndAdmit, prepareSnapshot } from '../../src/facts/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { factsFixture, value, json, refused, privateKey, point } from '../facts/fixtures.js';
import { foldProjection, readProjection } from '../../src/projections/index.js';
import { decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';

function diskFixture() {
  const f = factsFixture(), directory = mkdtempSync(join(tmpdir(), 'instar-p2-test-')), path = join(directory, 'segment.jsonl');
  const read = () => { try { return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as unknown); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; } };
  const storage: SegmentStoragePort = { owner: 'part-ten', read,
    append(bytes, expected) {
      const head = read().at(-1) as { contentHash: string } | undefined;
      if ((head?.contentHash ?? null) !== expected) throw new Error('compare-head failed');
      const fd = openSync(path, 'a'); try { writeSync(fd, bytes + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
      const dir = openSync(directory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      return f.success({ kind: 'local-durable' });
    },
  };
  const ctx = { ...f.ctx, schemas: [...f.ctx.schemas, { ...f.schema, kind: 'retraction', fields: { target: { kind: 'reference' as const }, reason: { kind: 'text' as const, maxLength: 100 } } }] };
  const store = createFactStore(ctx, storage);
  const author = (body: Record<string, Json> = { identity: 'one', amount: '10' }, kind = 'note') => authorAndAppend({ kind, schemaVersion: 1, machine: 'machine-a', principal: json(f.alice), provenance: json(f.alice.provenance), at: json(f.now), body, required: [] }, ctx, store, privateKey);
  return { ...f, ctx, storage, store, path, author, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}
it('P2-NF-15 public fact store exposes exactly one mutating method', () => {
  const f = diskFixture(); try { expect(Object.keys(f.store).sort()).toEqual(['append', 'read', 'readForProjection']); expect(value(f.author()).durability).toEqual({ kind: 'local-durable' }); } finally { f.cleanup(); }
});
it('P2-NF-16 out-of-band disk mutation fails read verification', () => {
  const f = diskFixture(); try {
    value(f.author()); const bytes = readFileSync(f.path, 'utf8'); writeFileSync(f.path, bytes.replace('"amount":"10"', '"amount":"11"'));
    refused(f.store.read(), 'hash mismatch');
  } finally { f.cleanup(); }
});
it('P2-NF-29 unresolved input becomes an attributed system observation, never lost or promoted', () => {
  const f = factsFixture(), observer = f.principal('observer', 'system');
  const raw = { type: 'UnresolvedInput', schemaVersion: 1, raw: f.capture('unknown sender message'), channel: 'host', at: f.now, reason: 'identity unavailable' };
  const observation = value(wrapUnresolved(raw, observer, f.ctx));
  expect(observation.principal.kind).toBe('system'); expect(observation.body.input.raw).toBe(raw.raw);
  refused(wrapUnresolved(raw, f.alice, f.ctx), 'system principal');
});
it('P2-NF-34 retraction does not remove prior facts from the durable read port', () => {
  const f = diskFixture(); try {
    const first = value(f.author()); value(f.author({ target: first.fact.id, reason: 'incorrect reading' }, 'retraction'));
    const reloaded = createFactStore(f.ctx, f.storage); expect(value(reloaded.read()).map(v => v.contentHash)).toContain(first.fact.contentHash);
    expect(value(decodeEnvelope(value(reloaded.read())[0], f.ctx)).id).toBe(first.fact.id);
  } finally { f.cleanup(); }
});
it('P2-NF-52 part-one immutable-field disagreement becomes a recorded projection conflict', () => {
  const f = factsFixture(), left = value(decode('Intent', f.intentInput(), f.ctx.decode));
  const right = value(decode('Intent', f.intentInput({ raw: f.capture('different') }), f.ctx.decode));
  const a = f.fact({ body: { identity: 'one', amount: '1', intent: left } }), b = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, body: { identity: 'one', amount: '1', intent: right } });
  const result = value(foldProjection({ id: 'intents', class: 'informational', retention: 'all-identities', stalenessBound: 100,
    decisions: { note: { kind: 'folds', merge: 'additive', identity: 'identity', value: 'amount' } } },
    value(prepareSnapshot([a, b], { ...f.ctx, schemas: [{ ...f.schema, fields: { ...f.schema.fields, intent: { kind: 'constitutional', type: 'Intent' } } }] })),
    { reference: f.ctx.decode.register.generation, kinds: ['note'], lineages: { 'machine-a': { head: a.segment, observedAt: 100, closed: false }, 'machine-b': { head: b.segment, observedAt: 100, closed: false } } }, f.c));
  expect(result.conflicts[0]?.constitutional?.type).toBe('Conflict'); expect(result.values).toEqual({});
});
it('P2-NF-60 no operation sequence can compact facts out of the exposed store', () => {
  const f = diskFixture(); try {
    const hashes = [value(f.author()).fact.contentHash, value(f.author({ identity: 'two', amount: '20' })).fact.contentHash];
    for (let i = 0; i < 4; i++) expect(value(f.store.read()).map(v => v.contentHash)).toEqual(hashes);
    expect('compact' in f.store || 'delete' in f.store || 'truncate' in f.store).toBe(false);
  } finally { f.cleanup(); }
});
it('P2-NF-62 replication duplicate is idempotent and altered duplicate refuses without changing receiver', () => {
  const f = factsFixture(), a = f.fact(), ctx = { ...f.ctx, facts: [a] }, before = JSON.stringify(ctx.facts);
  expect(value(verifyAndAdmit(a, 'machine-a', ctx)).id).toBe(a.id);
  refused(verifyAndAdmit({ ...a, body: { tampered: true } }, 'machine-a', ctx), 'changed bytes'); expect(JSON.stringify(ctx.facts)).toBe(before);
});
it('P2-NF-23 P2-NF-33 P2-NF-36 same-kind corrections pass the real append/replication path only with causal and original standing', () => {
  const f = diskFixture(); try {
    const schema = { ...f.schema, fields: { ...f.schema.fields, corrects: { kind: 'reference' as const } }, optional: ['corrects'] };
    const ctx = { ...f.ctx, schemas: [schema] }, store = createFactStore(ctx, f.storage);
    const original = f.fact(); value(store.append(original));
    const correction = f.next(original, { body: { identity: 'one', amount: '40', corrects: original.id } });
    const remote = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, body: correction.body });
    refused(store.append(remote, { peer: 'machine-b' }), 'causally');
    value(store.append(correction, { peer: 'machine-a' }));
    const facts = value(store.read());
    const view = value(foldProjection({ id: 'corrected', class: 'informational', stalenessBound: 100, retention: 'all-identities', decisions: { note: { kind: 'folds', merge: 'additive', identity: 'identity', value: 'amount' } } }, value(store.readForProjection()), { reference: ctx.decode.register.generation, kinds: ['note'], lineages: { 'machine-a': { head: correction.segment, observedAt: 100, closed: false } } }, f.c));
    expect(view.values['note:one']).toBe('40');
    const old = { ...schema, standing: 'operator' as const, authority: 'conferring' as const, causallyBound: true };
    const lower = { ...schema, version: 2 };
    const low = f.next(original, { schemaVersion: 2, body: correction.body }, { ...ctx, schemas: [old, lower] });
    const lowContext = { ...ctx, schemas: [old, lower], facts: [original], migrations: [{ kind: 'note', from: 1, to: 2, migrate: (body: Json) => body }] };
    refused(verifyAndAdmit(low, 'machine-a', lowContext), 'less standing');
  } finally { f.cleanup(); }
});
it.skip('P2-NF-63 SKIPPED: part eight owns irreversible-effect durability admission; only typed storage receipts exist in part two', () => {});
it('P2-NF-62 replication durably appends through the sole write port, preserving receiver bytes across duplicate and rejected deliveries', () => {
  const f = diskFixture(); try {
    const receiver = createFactStore({ ...f.ctx, decode: { ...f.ctx.decode, principals: [], grants: [], authorizations: [] } }, f.storage);
    const first = f.fact();
    expect(value(receiver.append(first, { peer: 'machine-a' })).durability.kind).toBe('local-durable');
    const before = readFileSync(f.path, 'utf8');
    expect(value(receiver.append(first, { peer: 'machine-a' })).fact.id).toBe(first.id);
    refused(receiver.append({ ...first, body: { changed: true } }, { peer: 'machine-a' }), 'hash mismatch');
    refused(receiver.append(f.next(first), { peer: 'machine-b' }), 'does not own');
    expect(readFileSync(f.path, 'utf8')).toBe(before);
    value(receiver.append(f.next(first), { peer: 'machine-a' }));
    expect(value(receiver.read())).toHaveLength(2);
    expect(readFileSync(f.path, 'utf8').startsWith(before)).toBe(true);
  } finally { f.cleanup(); }
});
it.skip('P2-NF-73 SKIPPED: part eight owns blocking irreversible effects on provisional authority; part two emits and tests taint but does not dispatch effects', () => {});
it('P2-NF-76 append -> capture expiry -> status-bearing read refuses old and rebuilt authority without annotations', () => {
  const f = diskFixture(); try {
    const captures = { 'capture:evidence': { hash: f.e.capture.hash, bytes: 'observed bytes' as string | null, status: 'available' as 'available' | 'expired', byteLength: 14 } };
    const ctx = { ...f.ctx, captures, schemas: [{ ...f.schema, fields: { ...f.schema.fields, evidence: { kind: 'constitutional' as const, type: 'Evidence' as const } } }] };
    const store = createFactStore(ctx, f.storage), fact = f.fact({ body: { identity: 'one', amount: '10', evidence: f.e } }); value(store.append(fact));
    const def = { id: 'evidence', class: 'authority-answering' as const, retention: 'all-identities' as const, stalenessBound: 100, decisions: { note: { kind: 'folds' as const, merge: 'additive' as const, identity: 'identity', value: 'amount' } } };
    const generation = { reference: ctx.decode.register.generation, kinds: ['note'], lineages: { 'machine-a': { head: fact.segment, observedAt: 100, closed: false } } };
    const view = value(foldProjection(def, value(store.readForProjection()), generation, f.c)); value(readProjection(view, def, f.now, f.c));
    captures['capture:evidence'].status = 'expired'; captures['capture:evidence'].bytes = null;
    refused(readProjection(view, def, f.now, f.c), 'source changed');
    const rebuilt = value(foldProjection(def, value(store.readForProjection()), generation, f.c));
    expect(rebuilt.taint).toContain('evidence-unavailable'); refused(readProjection(rebuilt, def, f.now, f.c), 'tainted');
  } finally { f.cleanup(); }
});
it('P2-NF-72 P2-NF-75 P2-NF-76 historical-only store derives late revocation status from actual bodies', () => {
  const f = diskFixture(); try {
    const grantSchema = { ...f.schema, kind: 'grant-record', fields: { grant: { kind: 'constitutional' as const, type: 'StandingGrant' as const } } };
    const revSchema = { ...f.schema, kind: 'revocation-record', fields: { revocation: { kind: 'constitutional' as const, type: 'Revocation' as const } } };
    const schema = { ...f.schema, standing: 'operator' as const, causallyBound: true };
    const ctx = { ...f.ctx, schemas: [grantSchema, revSchema, schema], decode: { ...f.ctx.decode, principals: [], grants: [], authorizations: [] }, grants: [], revocations: [] };
    const store = createFactStore(ctx, f.storage);
    const grant = value(decodeEnvelope(f.wire({ kind: 'grant-record', provenance: f.g.source, body: { grant: f.g } }), ctx, 'replication'));
    value(store.append(grant, { peer: 'machine-a' }));
    const candidate = f.next(grant, { predecessors: { inSegment: grant.id, frontier: {}, required: [grant.id] } });
    value(store.append(candidate, { peer: 'machine-a' }));
    const def = { id: 'standing', class: 'authority-answering' as const, retention: 'all-identities' as const, stalenessBound: 100, decisions: {
      note: { kind: 'folds' as const, merge: 'additive' as const, identity: 'identity', value: 'amount' }, 'grant-record': { kind: 'ignores' as const, reason: 'standing' }, 'revocation-record': { kind: 'ignores' as const, reason: 'standing' } } };
    const generation = { reference: ctx.decode.register.generation, kinds: Object.keys(def.decisions), lineages: { 'machine-a': { head: candidate.segment, observedAt: 100, closed: false } } };
    const view = value(foldProjection(def, value(store.readForProjection()), generation, f.c)); value(readProjection(view, def, f.now, f.c));
    const payload = { id: 'late', grantId: f.g.id, by: f.alice, at: f.now, reason: 'withdrawn' }, proof = f.proof(payload);
    const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, provenance: proof.p }));
    const rev = value(decodeEnvelope(f.wire({ kind: 'revocation-record', machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, provenance: proof.p, predecessors: { inSegment: null, required: [grant.id], frontier: { 'machine-a': point(grant) } }, body: { revocation } }), ctx, 'replication'));
    value(store.append(rev, { peer: 'machine-b' }));
    refused(readProjection(view, def, f.now, f.c), 'source changed');
    const snapshot = value(store.readForProjection());
    expect(snapshot.entries.find(e => e.fact.id === candidate.id)?.conflicts[0]?.kind).toBe('revocation-conflict');
    const current = value(foldProjection(def, snapshot, { ...generation, lineages: { ...generation.lineages, 'machine-b': { head: rev.segment, observedAt: 100, closed: false } } }, f.c));
    refused(readProjection(current, def, f.now, f.c), 'tainted');
  } finally { f.cleanup(); }
});
