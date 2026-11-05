/**
 * Integration (1.x COHERENCE-JOURNAL-SPEC §3.4 round-trip, carried from tests/integration/journal-sync-roundtrip.test.ts):
 * relationship replication from the private predecessor to the group root, end to end, on one machine and across two.
 *
 * 1.x proved A → B over the real signed MeshRpc transport with two in-process machines. 2.0 has no mesh: a conversation's
 * encrypted journal is replicated whole to the other machine (journal-replication.ts), and the group root reads the
 * predecessor's emits from the predecessor journal it can verify (its own copy on this machine, or the replica copy the
 * owner shipped). The flow proves the whole chain with NO fakes on the trust path:
 *  1. The private root (the writer, machine A) emits per-record relationship envelopes into its own journal as its
 *     people change: a new attribute is a put, a forget is a tombstone.
 *  2. The group root applies them under the carry's grant and audience (refreshGroupCarry): first-hop binding to the
 *     predecessor it read, seq-gated, schema-validated, one durable refresh frame.
 *  3. The group root's actual worker serves the CURRENT account to its model inside the untrusted-data envelope, and the
 *     forgotten person is gone; the account survives close/reopen.
 *  4. Machine B holds only replica copies: the private journal's bytes shipped to B's replica store, verified; the group
 *     journal shipped, verified and adopted. B's group root refreshes from the predecessor's REPLICA COPY and serves the
 *     same current account. The predecessor is never written by either refresh.
 *  5. A second private root (another predecessor) and a re-seeded predecessor are refused by the fixed group root even
 *     with a valid grant of their own; a tampered copy never opens.
 */
import { afterEach, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendGroupCarry, carriedRelationshipViews, carryOrigin, groupCarryPacket } from './group-carry.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { adoptReceivedCopy, createJournalShipper, localReplicaClient, openReplicaStore } from './journal-replication.js';
import { resolveGroupDisclosure, verifyGroupAudience } from './group-disclosure.js';
import { now, key, sealKey, scope, records, authority, membership, permissionFor } from './group-carry-fixture.js';
import { peopleWorld, place, update } from './relationship-carry-fixture.js';
import { createRelationshipEmitter, emitRelationshipChanges } from './relationship-emitter.js';
import { refreshGroupCarry } from './relationship-applier.js';

const SECRET = 'replication-test-secret-0123456789';
const GROUP = `telegram/bot-${scope.bot}/chat-${scope.chat}`, PRIVATE = `telegram/bot-${scope.bot}/chat-${scope.operator}`;
const ORIGIN = carryOrigin(scope);
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const world = async (options?: Parameters<typeof peopleWorld>[1]) => { const dir = place('relationship-roundtrip-'); dirs.push(dir);
  mkdirSync(join(dir, 'studio'), { recursive: true }); return { dir, ...await peopleWorld(join(dir, 'studio'), options) }; };
const permission = () => { const p = resolveGroupDisclosure(scope, authority(), now, records, sealKey); if (p.kind !== 'resolved') throw Error(p.reason); return p; };
const verify = (path: string) => { openPreviewJournal(path, key, undefined, undefined, true).close(); };
const served = (view: ReturnType<typeof openPreviewJournal>['view'], question = 'Who is Sam?') =>
  groupCarryPacket(view.groupCarry!, question, now, 409600, view).entries.filter(entry => entry.kind === 'person').map(entry => entry.text);

/** The private root has been emitting since its grant existed: two puts (Sam, Ana) before the carry. */
function emittingPredecessor(w: Awaited<ReturnType<typeof world>>) {
  const emitter = createRelationshipEmitter(w.source, { now: () => now - 500, origin: ORIGIN, permission });
  expect(emitRelationshipChanges(w.source, emitter, now - 500, ORIGIN).puts).toHaveLength(2);
  return emitter;
}
/** The private root's people change after the carry: Sam gets a city (a put), Ana is forgotten (a tombstone). Returns every emitted seq.
 *  The default emitter reads a wall clock after the carry; a test may hand in the lagging one to prove the positional serving rule. */
function changeAfterCarry(w: Awaited<ReturnType<typeof world>>, emitter = createRelationshipEmitter(w.source, { now: () => now + 1000, origin: ORIGIN, permission })) {
  w.source.view.personAttributes.push({ name: 'Sam Ruiz', attribute: 'city', value: 'Porto', status: 'current', source: w.ids.sam2, quote: 'Porto' });
  w.source.view.memory.push({ mode: 'forget', source: w.ids.ana, trigger: w.ids.ana, quote: 'Ana Lima' });
  const changes = emitRelationshipChanges(w.source, emitter, now + 1000, ORIGIN);
  expect(changes.puts).toHaveLength(1); expect(changes.deletes).toHaveLength(1);
  return w.source.view.relationshipEmits.map(emit => emit.seq);
}

it('A emits after the carry; the group root applies under the carry\'s grant; its worker serves the current account; it survives reopen', async () => {
  const w = await world();
  const emitter = emittingPredecessor(w);
  const audience = await verifyGroupAudience(scope, membership());
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), audience, now, () => false)).toBe('carried');
  // The snapshot supersedes the two emits before it: a refresh starts after them.
  expect(w.destination.view.groupCarry!.emitsThrough).toBe(2);
  const before = served(w.destination.view);
  expect(before.some(text => text.includes('Name: Ana Lima'))).toBe(true);
  expect(before.find(text => text.includes('Name: Sam Ruiz'))).toContain('Notes: job: engineer');
  // 1. The predecessor's own stream: two emits after the carry (a put and a tombstone) behind the two before it.
  expect(changeAfterCarry(w)).toEqual([1, 2, 3, 4]);
  expect(w.source.view.relationshipEmits.at(-1)!.hlc.physical).toBeGreaterThan(now);
  const privateBytes = w.source.size;
  // 2. The group root applies only the two after the carry: one durable refresh frame, bound to this predecessor.
  const outcome = refreshGroupCarry(w.destination, w.source, scope, permission(), audience, now + 2000, () => false);
  expect(outcome).toMatchObject({ from: 2, through: 4, remaining: 0 });
  expect(outcome.result).toMatchObject({ applied: 2, forgedEntries: 0, invalidEntries: 0, duplicates: 0 });
  expect(w.destination.view.groupCarryRefreshes).toHaveLength(1);
  expect(w.source.size).toBe(privateBytes); // the predecessor is read, never written
  // 3. Serving: Sam's current account inside the untrusted-data envelope; Ana is gone.
  const after = served(w.destination.view);
  expect(after).toHaveLength(1);
  expect(after[0]!).toContain(`<replicated-untrusted-data origin="${ORIGIN}">`);
  expect(after[0]!).toContain('Name: Sam Ruiz');
  expect(after[0]!).toContain('Notes: job: engineer; city: Porto');
  expect(JSON.stringify(after)).not.toContain('Ana');
  // The actual worker offers the refreshed account to its model.
  let context = '';
  const worker = createJournalWorker(w.destination, { now: () => now + 3000, stopped: () => false, groupDisclosure: async () => true,
    model: async input => { context = input.context; return 'Sam Ruiz is the engineer, now in Porto.'; }, send: async () => 1, checkOutbound: () => {} });
  worker.intake([update(5, 'Where is Sam now?', true)]); await worker.drain();
  expect(context).toContain('city: Porto');
  // The relationship record is gone; the private conversation's quoted messages carried at the time stay as recall text
  // (the snapshot's own semantics: refresh keeps relationship records current, not the carried message text).
  expect(context).not.toContain('Name: Ana Lima');
  // Survives close/reopen: the refresh frame replays, re-validated, and the same account is served.
  w.destination.close();
  const replay = openPreviewJournal(w.target, key);
  expect(replay.view.groupCarryRefreshes[0]!.through).toBe(4);
  expect(served(replay.view)).toEqual(after);
  replay.close(); w.source.close();
});

it('machine B refreshes its adopted group root from the predecessor\'s verified REPLICA COPY and serves the same account; a forged copy never opens', async () => {
  const w = await world();
  emittingPredecessor(w);
  const audience = await verifyGroupAudience(scope, membership());
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), audience, now, () => false)).toBe('carried');
  changeAfterCarry(w);
  // Machine B holds replica copies of both conversations and nothing else.
  const laptop = join(w.dir, 'laptop'), privateRoot = join(laptop, 'private'), groupRoot = join(laptop, 'group');
  mkdirSync(privateRoot, { recursive: true }); mkdirSync(groupRoot, { recursive: true });
  const privateStore = openReplicaStore({ directory: join(privateRoot, 'replica'), conversation: PRIVATE, machine: 'laptop', secret: SECRET });
  const groupStore = openReplicaStore({ directory: join(groupRoot, 'replica'), conversation: GROUP, machine: 'laptop', secret: SECRET });
  await createJournalShipper({ path: w.path, size: () => w.source.size, peer: localReplicaClient(privateStore), conversation: PRIVATE,
    machine: 'studio', secret: SECRET, epoch: () => 1, monotonic: () => 0 }).pump();
  await createJournalShipper({ path: w.target, size: () => w.destination.size, peer: localReplicaClient(groupStore), conversation: GROUP,
    machine: 'studio', secret: SECRET, epoch: () => 1, monotonic: () => 0 }).pump();
  expect(privateStore.copy()).toMatchObject({ machine: 'studio', size: w.source.size });
  // B becomes the group root's owner from the newest copy it holds; the predecessor stays a read-only copy.
  const groupPath = join(groupRoot, 'journal.encrypted');
  expect(adoptReceivedCopy({ root: groupRoot, journalPath: groupPath, store: groupStore, epoch: 2, seed: false, verify })).toEqual({ ok: true, how: 'adopted' });
  const adopted = openPreviewJournal(groupPath, key);
  expect(adopted.view.groupCarryRefreshes).toEqual([]);
  const copy = openPreviewJournal(privateStore.copyPath, key, undefined, undefined, true);
  expect(copy.view.relationshipEmits).toHaveLength(4);
  const outcome = refreshGroupCarry(adopted, copy, scope, permission(), audience, now + 2000, () => false);
  expect(outcome).toMatchObject({ from: 2, through: 4 });
  expect(outcome.result.applied).toBe(2);
  const onB = served(adopted.view);
  expect(onB).toHaveLength(1);
  expect(onB[0]!).toContain('Notes: job: engineer; city: Porto');
  expect(onB[0]!).toContain(`origin="${ORIGIN}"`);
  expect(JSON.stringify(onB)).not.toContain('Ana');
  // The union read on B agrees: one record, this predecessor's origin, not conflicted.
  const views = carriedRelationshipViews(adopted.view.groupCarry!, adopted.view.groupCarryRefreshes);
  expect(views.map(view => [view.data.name, view.origin, view.conflicted])).toEqual([['Sam Ruiz', ORIGIN, false]]);
  // The predecessor copy was only read.
  expect(privateStore.copy()!.size).toBe(w.source.size);
  // A forged copy (bytes altered in place) does not open as a journal, so nothing of it can be served or applied.
  const forgedPath = join(laptop, 'forged.encrypted'), bytes = readFileSync(privateStore.copyPath);
  bytes.writeUInt8(bytes.readUInt8(bytes.length - 40) ^ 0x5a, bytes.length - 40); writeFileSync(forgedPath, bytes);
  expect(() => openPreviewJournal(forgedPath, key, undefined, undefined, true)).toThrow();
  copy.close(); adopted.close(); privateStore.close(); groupStore.close(); w.destination.close(); w.source.close();
});

it('refuses a second predecessor with its own valid grant, and a predecessor re-seeded under the same path, once the group root is fixed', async () => {
  const w = await world();
  const lagging = emittingPredecessor(w);
  const audience = await verifyGroupAudience(scope, membership());
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), audience, now, () => false)).toBe('carried');
  // The predecessor's wall clock lags the machine that carried (its emits after the carry carry an earlier HLC than the
  // snapshot): the refresh still supersedes the snapshot, because a refresh record is positional (seq > emitsThrough).
  changeAfterCarry(w, lagging);
  expect(w.source.view.relationshipEmits.at(-1)!.hlc.physical).toBeLessThan(now);
  expect(refreshGroupCarry(w.destination, w.source, scope, permission(), audience, now + 2000, () => false).result.applied).toBe(2);
  expect(served(w.destination.view)).toHaveLength(1);
  // Another private conversation of the same operator, with a valid grant for this group: not this group's predecessor.
  const b = await world({ extraSamMention: true });
  const other = { ...scope, sourceRoot: '/test/other-private' };
  const otherPermission = permissionFor(other); if (otherPermission.kind !== 'resolved') throw Error(otherPermission.reason);
  expect(() => refreshGroupCarry(w.destination, b.source, other, otherPermission, audience, now + 3000, () => false)).toThrow(/predecessor already fixed/u);
  // The same root re-seeded (a different genesis) is a changed predecessor: refused, the held history untouched.
  const reseeded = { view: { ...b.source.view, genesis: { ...w.source.view.genesis, grant: 'TEST-reseeded' } }, readOnly: true };
  expect(() => refreshGroupCarry(w.destination, reseeded, scope, permission(), audience, now + 4000, () => false)).toThrow(/predecessor lineage changed/u);
  expect(w.destination.view.groupCarryRefreshes).toHaveLength(1);
  expect(served(w.destination.view)[0]!).toContain('city: Porto');
  b.source.close(); b.destination.close(); w.destination.close(); w.source.close();
});

it('carry before the first ordinary emit establishes tombstones for a subsequently forgotten person, including after reopen', async () => {
  const w = await world();
  expect(w.source.view.relationshipEmits).toHaveLength(0);
  appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false);
  expect(w.destination.view.groupCarry!.emitsThrough).toBe(2);
  expect(changeAfterCarry(w)).toEqual([1, 2, 3, 4]);
  expect(refreshGroupCarry(w.destination, w.source, scope, permission(), true, now + 2000, () => false).result.applied).toBe(2);
  expect(served(w.destination.view)).toHaveLength(1);
  expect(served(w.destination.view)[0]).not.toContain('Ana Lima');
  w.destination.close();
  const reopened = openPreviewJournal(w.target, key);
  expect(served(reopened.view)).toHaveLength(1);
  expect(served(reopened.view)[0]).toContain('city: Porto');
  reopened.close(); w.source.close();
});

it('a newly carried person since the previous emit is also baselined, and retry after a destination failure stays consistent', async () => {
  const w = await world();
  const ana = w.source.view.people.filter(p => p.name === 'Ana Lima');
  w.source.view.people = w.source.view.people.filter(p => p.name !== 'Ana Lima');
  const emitter = createRelationshipEmitter(w.source, { now: () => now, origin: ORIGIN, permission });
  expect(emitRelationshipChanges(w.source, emitter, now, ORIGIN).puts).toHaveLength(1);
  w.source.view.people.push(...ana);
  const failed = { ...w.destination, append: () => { throw Error('injected destination append failure'); } };
  expect(() => appendGroupCarry(failed, w.source, scope, permission(), true, now, () => false)).toThrow(/injected/u);
  expect(w.source.view.relationshipEmits).toHaveLength(2);
  expect(w.destination.view.groupCarry).toBeUndefined();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false);
  expect(w.source.view.relationshipEmits).toHaveLength(2);
  expect(w.destination.view.groupCarry!.emitsThrough).toBe(2);
  changeAfterCarry(w);
  refreshGroupCarry(w.destination, w.source, scope, permission(), true, now + 2000, () => false);
  expect(served(w.destination.view)).toHaveLength(1);
  w.destination.close(); w.source.close();
});

it('refuses a replacement predecessor before the first refresh and preserves the initial people', async () => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false);
  const original = served(w.destination.view);
  const replacement = { view: { ...w.source.view, genesis: { ...w.source.view.genesis, grant: 'TEST-replacement' } }, readOnly: true };
  expect(() => refreshGroupCarry(w.destination, replacement, scope, permission(), true, now + 1, () => false)).toThrow(/predecessor lineage changed/u);
  expect(w.destination.view.groupCarryRefreshes).toEqual([]);
  expect(served(w.destination.view)).toEqual(original);
  expect(refreshGroupCarry(w.destination, w.source, scope, permission(), true, now + 1, () => false).result.applied).toBe(0);
  w.destination.close(); w.source.close();
});

it('a partially refused emit baseline never publishes a carry and retries without duplicate puts', async () => {
  const w = await world();
  const append = w.source.append.bind(w.source);
  let writes = 0;
  const interrupted = { ...w.source, append: (...args: Parameters<typeof w.source.append>) => {
    if (++writes === 2) throw Error('injected source append failure');
    return append(...args);
  } };
  expect(() => appendGroupCarry(w.destination, interrupted, scope, permission(), true, now, () => false)).toThrow(/baseline not durable/u);
  expect(w.source.view.relationshipEmits).toHaveLength(1);
  expect(w.destination.view.groupCarry).toBeUndefined();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false);
  expect(w.source.view.relationshipEmits).toHaveLength(2);
  expect(w.destination.view.groupCarry!.emitsThrough).toBe(2);
  expect(served(w.destination.view)).toHaveLength(2);
  w.destination.close(); w.source.close();
});
