import { expect, it } from 'vitest';
import { mkdtempSync, openSync, closeSync, writeSync, fsyncSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFactStore, authorAndAppend, decodeEnvelope, wrapUnresolved, verifyAndAdmit } from '../../src/facts/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { factsFixture, value, json, refused, privateKey } from '../facts/fixtures.js';
import { foldProjection } from '../../src/projections/index.js';
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
  const f = diskFixture(); try { expect(Object.keys(f.store).sort()).toEqual(['append', 'read']); expect(value(f.author()).durability).toEqual({ kind: 'local-durable' }); } finally { f.cleanup(); }
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
    [{ fact: a, taint: [], constitutional: [{ field: 'intent', value: left, subject: f.scope }] }, { fact: b, taint: [], constitutional: [{ field: 'intent', value: right, subject: f.scope }] }],
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
