import { expect, it } from 'vitest';
import { mkdtempSync, openSync, closeSync, writeSync, fsyncSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createFactStore, authorAndAppend, decodeEnvelope, wrapUnresolved, verifyAndAdmit, prepareSnapshot, signVerifiedPrefix, restoreVerifiedPrefix, conflictFactSchema, signEnvelope, drainConflictFacts } from '../../src/facts/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { factsFixture, value, json, refused, privateKey, publicKey, point } from '../facts/fixtures.js';
import { foldProjection, readProjection } from '../../src/projections/index.js';
import { decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';

function diskFixture() {
  const f = factsFixture(), directory = mkdtempSync(join(tmpdir(), 'instar-p2-test-')), path = join(directory, 'segment.jsonl');
  const read = () => { try { return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as unknown); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; } };
  const storage: SegmentStoragePort = { owner: 'part-ten', read,
    recordConflicts(records) {
      const file = join(directory, 'conflict-outbox.jsonl');
      const existing = (() => { try { return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s) as { key: string }); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; } })();
      const fd = openSync(file, 'a'); try { for (const record of records) if (!existing.some(r => r.key === record.key)) writeSync(fd, JSON.stringify(record) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
      const dir = openSync(directory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      return f.success({ kind: 'local-durable' });
    },
    append(bytes, expected) {
      const head = read().at(-1) as { contentHash: string } | undefined;
      if ((head?.contentHash ?? null) !== expected) throw new Error('compare-head failed');
      const fd = openSync(path, 'a'); try { writeSync(fd, bytes + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
      const dir = openSync(directory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      return f.success({ kind: 'local-durable' });
    },
  };
  const observer = f.principal('conflict-observer', 'system');
  const conflictAppender = { owner: 'part-ten' as const, machine: 'machine-a', principal: observer, provenance: observer.provenance, clock: () => f.now, sign: (wire: Json) => f.success(signEnvelope(wire, privateKey)) };
  const ctx = { ...f.ctx, schemas: [...f.ctx.schemas, conflictFactSchema(f.scope), { ...f.schema, kind: 'retraction', fields: { target: { kind: 'reference' as const }, reason: { kind: 'text' as const, maxLength: 100 } } }] };
  const store = createFactStore(ctx, storage, { conflictAppender });
  const author = (body: Record<string, Json> = { identity: 'one', amount: '10' }, kind = 'note') => authorAndAppend({ kind, schemaVersion: 1, machine: 'machine-a', principal: json(f.alice), provenance: json(f.alice.provenance), at: json(f.now), body, required: [] }, ctx, store, privateKey);
  return { ...f, ctx, storage, store, path, conflictAppender, outbox: join(directory, 'conflict-outbox.jsonl'), author, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}
it('P2-NF-15 public fact store exposes exactly one mutating method', () => {
  const f = diskFixture(); try { expect(Object.keys(f.store).sort()).toEqual(['append', 'read', 'readForProjection', 'sweep', 'verifiedPrefix']); expect(value(f.author()).durability).toEqual({ kind: 'local-durable' }); } finally { f.cleanup(); }
});
it('P2-NF-16 out-of-band disk mutation fails read verification', () => {
  const f = diskFixture(); try {
    value(f.author()); const bytes = readFileSync(f.path, 'utf8'); writeFileSync(f.path, bytes.replace('"amount":"10"', '"amount":"11"'));
    refused(f.store.read(), 'prefix changed');
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
  const f = diskFixture(); try {
  const left = value(decode('Intent', f.intentInput(), f.ctx.decode));
  const right = value(decode('Intent', f.intentInput({ raw: f.capture('different') }), f.ctx.decode));
  const a = f.fact({ body: { identity: 'one', amount: '1', intent: left } }), b = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, body: { identity: 'one', amount: '1', intent: right } });
  const ctx = { ...f.ctx, schemas: [conflictFactSchema(f.scope), { ...f.schema, fields: { ...f.schema.fields, intent: { kind: 'constitutional' as const, type: 'Intent' as const } } }] }, store = createFactStore(ctx, f.storage, { conflictAppender: f.conflictAppender });
  value(store.append(a)); value(store.append(b, { peer: 'machine-b' }));
  const result = value(foldProjection({ id: 'intents', class: 'informational', retention: 'all-identities', stalenessBound: 100,
    decisions: { 'conflict-record': { kind: 'ignores', reason: 'status is mandatory' }, note: { kind: 'folds', merge: 'additive', identity: 'identity', value: 'amount' } } },
    value(store.readForProjection()),
    { reference: f.ctx.decode.register.generation, kinds: ['note', 'conflict-record'], lineages: { 'machine-a': { head: a.segment, observedAt: 100, closed: false }, 'machine-b': { head: b.segment, observedAt: 100, closed: false } } }, f.c));
  expect(result.conflicts[0]?.constitutional?.type).toBe('Conflict'); expect(result.values).toEqual({});
  expect(readFileSync(f.outbox, 'utf8')).toContain('immutable-disagreement');
  } finally { f.cleanup(); }
});
it('P2-NF-52 historical-only disagreement refuses instead of laundering absent comparison annotations', () => {
  const f = factsFixture(), left = value(decode('Intent', f.intentInput(), f.ctx.decode)), right = value(decode('Intent', f.intentInput({ raw: f.capture('different') }), f.ctx.decode));
  const a = f.fact({ body: { identity: 'one', amount: '1', intent: left } }), b = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, body: { identity: 'one', amount: '1', intent: right } });
  const ctx = { ...f.ctx, decode: { ...f.ctx.decode, principals: [] }, schemas: [{ ...f.schema, fields: { ...f.schema.fields, intent: { kind: 'constitutional' as const, type: 'Intent' as const } } }] };
  refused(prepareSnapshot([a, b], ctx), 'historical comparison consumer required');
});
it.skip('P2-NF-52 SKIPPED: producing a historical-only constitutional Conflict requires P1 public comparison over HistoricalRead wrappers; the current owner export only accepts live values', () => {});
it.each(['both', 'left', 'right', 'neither'] as const)('P2-NF-52 P2-NF-76 complete identity set across %s live origins has equal and unequal controls', live => {
  for (const equal of [true, false]) {
    const f = diskFixture(); try {
      const left = value(decode('Intent', f.intentInput(), f.ctx.decode));
      const right = value(decode('Intent', f.intentInput({ raw: equal ? left.raw : f.capture('different immutable raw') }), f.ctx.decode));
      const otherOrigin = f.proof({ receive: 'second signed origin' }).p;
      const a = f.wire({ body: { identity: 'one', amount: '1', intent: left } });
      const b = f.wire({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, provenance: otherOrigin, body: { identity: 'one', amount: '1', intent: right } });
      const ctx = { ...f.ctx, schemas: [conflictFactSchema(f.scope), { ...f.schema, fields: { ...f.schema.fields, intent: { kind: 'constitutional' as const, type: 'Intent' as const } } }],
        decode: { ...f.ctx.decode, principals: live === 'both' || live === 'left' ? [f.alice] : [], ...(live === 'both' || live === 'right' ? { provenance: otherOrigin } : {}) } };
      const store = createFactStore(ctx, f.storage, { conflictAppender: f.conflictAppender });
      value(store.append(a, { peer: 'machine-a' })); value(store.append(b, { peer: 'machine-b' }));
      if (!equal && live !== 'both') { refused(store.readForProjection(), 'historical comparison consumer required'); continue; }
      const snapshot = value(store.readForProjection());
      expect(snapshot.entries.slice(0, 2).map(e => e.historical.length)).toEqual([1, 1]);
      const def = { id: 'matrix', class: 'authority-answering' as const, retention: 'all-identities' as const, stalenessBound: 100,
        decisions: { note: { kind: 'folds' as const, merge: 'additive' as const, identity: 'identity', value: 'amount' }, 'conflict-record': { kind: 'ignores' as const, reason: 'status still propagates' } } };
      const view = value(foldProjection(def, snapshot, { reference: ctx.decode.register.generation, kinds: Object.keys(def.decisions),
        lineages: { 'machine-a': { head: point(snapshot.entries.filter(e => e.fact.machine === 'machine-a').at(-1)!.fact), observedAt: 100, closed: false }, 'machine-b': { head: { epoch: 0, position: 0 }, observedAt: 100, closed: false } } }, f.c));
      if (equal) { value(readProjection(view, def, f.now, f.c)); expect(view.values['note:one']).toBe('2'); expect(view.conflicts).toEqual([]); }
      else { refused(readProjection(view, def, f.now, f.c), 'tainted'); expect(view.conflicts).toHaveLength(1); expect(value(store.read()).filter(f => f.kind === 'conflict-record')).toHaveLength(1); }
    } finally { f.cleanup(); }
  }
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
it('P2-NF-16 production store restores certified prefix, verifies only suffix on load/append, and still sweeps genesis', () => {
  const f = diskFixture(); try {
    const first = value(f.author()).fact, second = value(f.author({ identity: 'two', amount: '20' })).fact;
    const certificate = signVerifiedPrefix(value(f.store.verifiedPrefix()), 'local-cache', privateKey);
    const keys = [{ id: 'local-cache', publicKey }];
    const prefix = value(restoreVerifiedPrefix(JSON.parse(JSON.stringify(certificate)), f.ctx, keys));
    let checked = 0;
    const reopened = createFactStore(f.ctx, f.storage, { prefix, verificationBudget: 1, onVerified: () => checked++ });
    expect(value(reopened.read())).toHaveLength(2); expect(checked).toBe(0);
    value(reopened.append(f.next(second))); expect(checked).toBe(1);
    value(reopened.read()); expect(checked).toBe(1);
    refused(createFactStore(f.ctx, f.storage, { verificationBudget: 1 }).read(), 'budget exhausted');
    refused(restoreVerifiedPrefix(certificate, f.ctx, []), 'independently trusted');
    const changed = JSON.parse(JSON.stringify(certificate)); changed.payload.value.facts[0].body.amount = '99';
    refused(restoreVerifiedPrefix(changed, f.ctx, keys), 'hash mismatch');
    const before = readFileSync(f.path, 'utf8'); writeFileSync(f.path, before.replace('"amount":"10"', '"amount":"99"'));
    refused(reopened.read(), 'prefix changed');
    refused(createFactStore(f.ctx, f.storage).sweep(), 'hash mismatch');
    expect(before).toContain(first.contentHash);
  } finally { f.cleanup(); }
});
it('P2-NF-15 P2-NF-52 P2-NF-62 P2-NF-75 conflict obligations drain after restart, survive lost append ACK, and replicate as signed system facts', () => {
  const f = diskFixture(), receiverDisk = diskFixture(); try {
    const ctx = { ...f.ctx, schemas: [conflictFactSchema(f.scope),
      { ...f.schema, kind: 'grant-record', fields: { grant: { kind: 'constitutional' as const, type: 'StandingGrant' as const } } },
      { ...f.schema, kind: 'revocation-record', fields: { revocation: { kind: 'constitutional' as const, type: 'Revocation' as const } } },
      { ...f.schema, standing: 'operator' as const, causallyBound: true }], decode: { ...f.ctx.decode, principals: [], grants: [], authorizations: [] } };
    const store = createFactStore(ctx, f.storage);
    const grant = value(store.append(f.wire({ kind: 'grant-record', provenance: f.g.source, body: { grant: f.g } }), { peer: 'machine-a' })).fact;
    const candidate = value(store.append(f.next(grant, { predecessors: { inSegment: grant.id, frontier: {}, required: [grant.id] } }), { peer: 'machine-a' })).fact;
    const payload = { id: 'r-drain', grantId: f.g.id, by: f.alice, at: f.now, reason: 'withdrawn' }, proof = f.proof(payload);
    const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, provenance: proof.p }));
    const rev = value(store.append(f.wire({ kind: 'revocation-record', machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, provenance: proof.p,
      predecessors: { inSegment: null, required: [grant.id], frontier: { 'machine-a': point(grant) } }, body: { revocation } }), { peer: 'machine-b' })).fact;
    // A durable sidecar ACK alone cannot complete the mandatory read.
    refused(store.readForProjection(), 'outbox receipt is insufficient'); expect(value(store.read())).toHaveLength(3);
    expect(readFileSync(f.outbox, 'utf8')).toContain(`revocation:${candidate.id}:${rev.id}`);
    // Process dies after fsync, before the append ACK is observed.
    let crash = true;
    const crashStorage: SegmentStoragePort = { ...f.storage, append(bytes, head) {
      const result = f.storage.append(bytes, head);
      if (JSON.parse(bytes).kind === 'conflict-record' && crash) { crash = false; throw new Error('crash after conflict fsync'); }
      return result;
    } };
    const crashing = createFactStore(ctx, crashStorage, { conflictAppender: f.conflictAppender });
    refused(crashing.readForProjection(), 'crash after conflict fsync');
    expect(f.storage.read()).toHaveLength(4);
    // Fresh public-package process: no retained WeakMaps or live fixture values.
    const restarted = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import {readFileSync} from 'node:fs';
      import {decode,decodeMeasurement,consumeResult,defineDecoder} from './dist/index.js';
      import {createFactStore,signEnvelope} from './dist/facts/index.js';
      const {context:raw,principal:identity,proof,path,key}=JSON.parse(readFileSync(0,'utf8'));
      const take=r=>consumeResult(r,{Success:v=>v,Refused:r=>{throw Error(r.detail)}});
      const decodeContext={...raw.decode,principals:[],grants:[],revocations:[],authorizations:[]};
      const now=take(decodeMeasurement('clock',raw.genesis.clock,decodeContext));
      const provenance=take(decode('Provenance',proof,decodeContext));
      const principal=take(decode('VerifiedPrincipal',{type:'VerifiedPrincipal',schemaVersion:1,id:identity.id,kind:identity.kind},{...decodeContext,provenance}));
      const context={...raw,decode:decodeContext,genesis:{...raw.genesis,clock:now},schemas:raw.schemas.map(s=>({...s,scope:take(decode('Scope',s.scope,decodeContext))}))};
      const boundary={site:context.site,preserved:context.preserved,register:decodeContext.register};
      const result=value=>take(defineDecoder({owner:'part-ten',name:'RestartProvider',currentVersion:1,versions:{1:{validate:v=>({ok:true,value:v})}},migrations:{},decodeCurrent:()=>({ok:true,value})},context.preserved)).decode({schemaVersion:1},boundary);
      let appends=0;
      const storage={owner:'part-ten',read:()=>readFileSync(path,'utf8').trim().split('\\n').map(JSON.parse),append:()=>{appends++;throw Error('duplicate append after restart')}};
      const appender={owner:'part-ten',machine:'machine-a',principal,provenance,clock:()=>now,sign:wire=>result(signEnvelope(wire,key))};
      const store=createFactStore(context,storage,{conflictAppender:appender});
      const snapshot=take(store.readForProjection());
      process.stdout.write(JSON.stringify({appends,facts:take(store.read()).length,keys:[...new Set(snapshot.entries.flatMap(e=>e.conflicts).map(c=>c.key))]}));
    `], { encoding: 'utf8', input: JSON.stringify({ context: ctx, principal: f.conflictAppender.principal,
      proof: f.proof({ id: f.conflictAppender.principal.id, kind: 'system' }, { id: f.conflictAppender.principal.id, kind: 'system' }, 'identity').input,
      path: f.path, key: privateKey }) });
    expect(restarted.status, restarted.stderr).toBe(0);
    expect(JSON.parse(restarted.stdout)).toEqual({ appends: 0, facts: 4, keys: [`revocation:${candidate.id}:${rev.id}`] });
    const recovered = createFactStore(ctx, f.storage, { conflictAppender: f.conflictAppender });
    const snapshot = value(recovered.readForProjection()), persisted = value(recovered.read());
    expect(persisted).toHaveLength(4); value(recovered.readForProjection()); expect(value(recovered.read())).toHaveLength(4);
    const recorded = persisted.at(-1)!;
    expect(recorded.kind).toBe('conflict-record'); expect(recorded.principal.kind).toBe('system'); expect(recorded.provenance.class).toBe('verified');
    expect(recorded.predecessors.required).toEqual([candidate.id, rev.id].sort());
    expect(snapshot.entries.find(e => e.fact.id === recorded.id)!.conflicts[0]!.facts).toEqual([candidate.id, rev.id]);
    const observerB = f.principal('observer-b', 'system');
    const appenderB = { ...f.conflictAppender, machine: 'machine-b', principal: observerB, provenance: observerB.provenance,
      sign: (input: Json) => f.success(f.wire(input as Record<string, unknown>)) };
    const receiver = createFactStore(ctx, receiverDisk.storage, { conflictAppender: appenderB });
    for (const fact of persisted) value(receiver.append(json(fact), { peer: fact.machine }));
    const received = value(receiver.readForProjection());
    const conflicts = value(receiver.read()).filter(f => f.kind === 'conflict-record');
    expect(conflicts).toHaveLength(2); expect(conflicts.map(f => f.machine).sort()).toEqual(['machine-a', 'machine-b']);
    expect(new Set(received.entries.flatMap(e => e.conflicts).map(c => c.key)).size).toBe(1);
    const before = readFileSync(receiverDisk.path, 'utf8');
    // Re-signed fabricated pair and non-system authors still fail normal admission.
    const badBody = { record: JSON.stringify({ key: 'invented', kind: 'revocation-conflict', facts: [candidate.id, rev.id], detail: 'fake' }) };
    const lastA = recorded;
    const fake = f.next(lastA, { kind: 'conflict-record', principal: f.conflictAppender.principal, provenance: f.conflictAppender.provenance, body: badBody,
      predecessors: { inSegment: lastA.id, frontier: { 'machine-b': point(rev) }, required: [candidate.id, rev.id] } }, { ...ctx, decode: f.ctx.decode });
    refused(receiver.append(fake, { peer: 'machine-a' }), 'independently derived');
    const person = f.next(lastA, { kind: 'conflict-record', body: recorded.body,
      predecessors: { inSegment: lastA.id, frontier: { 'machine-b': point(rev) }, required: [candidate.id, rev.id] } }, { ...ctx, decode: f.ctx.decode });
    refused(receiver.append(person, { peer: 'machine-a' }), 'system principal');
    expect(readFileSync(receiverDisk.path, 'utf8')).toBe(before);
  } finally { f.cleanup(); receiverDisk.cleanup(); }
});
it.each([false, true])('P2-NF-72 P2-NF-75 P2-NF-76 actual revocation lifecycle distinguishes self, concurrent and later events (later=%s)', later => {
  const f = diskFixture(); try {
    const grantSchema = { ...f.schema, kind: 'grant-record', fields: { grant: { kind: 'constitutional' as const, type: 'StandingGrant' as const } } };
    const revSchema = { ...f.schema, kind: 'revocation-record', fields: { revocation: { kind: 'constitutional' as const, type: 'Revocation' as const } } };
    const schema = { ...f.schema, standing: 'operator' as const, causallyBound: true };
    const ctx = { ...f.ctx, schemas: [conflictFactSchema(f.scope), grantSchema, revSchema, schema], decode: { ...f.ctx.decode, principals: [], grants: [], authorizations: [] }, grants: [], revocations: [] };
    const store = createFactStore(ctx, f.storage, { conflictAppender: f.conflictAppender });
    const grant = value(decodeEnvelope(f.wire({ kind: 'grant-record', provenance: f.g.source, body: { grant: f.g } }), ctx, 'replication'));
    value(store.append(grant, { peer: 'machine-a' }));
    const candidate = f.next(grant, { predecessors: { inSegment: grant.id, frontier: {}, required: [grant.id] } });
    value(store.append(candidate, { peer: 'machine-a' }));
    const def = { id: 'standing', class: 'authority-answering' as const, retention: 'all-identities' as const, stalenessBound: 100, decisions: {
      note: { kind: 'folds' as const, merge: 'additive' as const, identity: 'identity', value: 'amount' }, 'conflict-record': { kind: 'ignores' as const, reason: 'mandatory status' }, 'grant-record': { kind: 'ignores' as const, reason: 'standing' }, 'revocation-record': { kind: 'ignores' as const, reason: 'standing' } } };
    const generation = { reference: ctx.decode.register.generation, kinds: Object.keys(def.decisions), lineages: { 'machine-a': { head: candidate.segment, observedAt: 100, closed: false } } };
    const view = value(foldProjection(def, value(store.readForProjection()), generation, f.c)); value(readProjection(view, def, f.now, f.c));
    const payload = { id: 'late', grantId: f.g.id, by: f.alice, at: f.now, reason: 'withdrawn' }, proof = f.proof(payload);
    const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, provenance: proof.p }));
    const rev = value(decodeEnvelope(f.wire({ kind: 'revocation-record', machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, provenance: proof.p, predecessors: { inSegment: null, required: [grant.id], frontier: { 'machine-a': point(later ? candidate : grant) } }, body: { revocation } }), ctx, 'replication'));
    value(store.append(rev, { peer: 'machine-b' }));
    refused(readProjection(view, def, f.now, f.c), 'source changed');
    const snapshot = value(store.readForProjection());
    expect(snapshot.entries.find(e => e.fact.id === rev.id)?.conflicts).toEqual([]);
    if (!later) {
      const outbox = readFileSync(f.outbox, 'utf8'); expect(outbox).toContain('revocation-conflict');
      value(store.readForProjection()); expect(readFileSync(f.outbox, 'utf8')).toBe(outbox);
      expect(snapshot.entries.find(e => e.fact.id === candidate.id)?.conflicts[0]?.facts).toEqual([candidate.id, rev.id]);
      const records = value(store.read()).filter(f => f.kind === 'conflict-record');
      expect(records).toHaveLength(1); expect(records[0]!.principal.kind).toBe('system');
      expect(value(drainConflictFacts(ctx, store, f.conflictAppender))).toEqual([]);
    } else {
      expect(snapshot.entries.flatMap(e => e.conflicts)).toEqual([]);
      expect(value(store.read())).toHaveLength(3);
    }
    const current = value(foldProjection(def, snapshot, { ...generation, lineages: { ...generation.lineages, 'machine-b': { head: rev.segment, observedAt: 100, closed: false } } }, f.c));
    if (later) { value(readProjection(current, def, f.now, f.c)); expect(current.values['note:one']).toBe('10'); }
    else refused(readProjection(current, def, f.now, f.c), 'tainted');
  } finally { f.cleanup(); }
});
