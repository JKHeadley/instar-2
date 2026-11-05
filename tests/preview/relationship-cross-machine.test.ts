/**
 * Cross-machine: a person recorded in the private conversation on machine A is READABLE in the group
 * conversation on machine B (the 2.0 shape of the 1.x WS2-SEND-2 proof).
 *
 * 1.x proved it with two in-process instances wired as server.ts wires them (journal emitter → serve →
 * apply → union read). 2.0 has one encrypted journal per conversation and replicates its sealed bytes to
 * the other machine (journal-replication.ts), so the proof is: A's private people enter the group journal
 * through the granted carry as `relationship-record` projections; the group journal's bytes are shipped
 * to B's replica store, verified and adopted; B opens the adopted journal and reads A's person as a
 * foreign-origin record. Identity across roots is the confirmed name set, never a local id.
 */
import { afterEach, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { appendGroupCarry, buildCarriedMemory, carriedPerson, carryOrigin, groupCarryPacket } from './group-carry.js';
import { openPreviewJournal } from './journal-test-worker.js';
import { adoptReceivedCopy, createJournalShipper, localReplicaClient, openReplicaStore } from './journal-replication.js';
import { resolveGroupDisclosure, verifyGroupAudience } from './group-disclosure.js';
import { now, key, sealKey, scope, records, authority, membership } from './group-carry-fixture.js';
import { peopleWorld, place } from './relationship-carry-fixture.js';
import { journalRelationships } from './relationship-journal.js';
import { buildRelationshipRecordData, mergeUnionToRelationships, originRecordFromData, renderForeignRelationshipContext, unionOfOriginRecords,
  type OriginRecord } from './relationship-store.js';

const SECRET = 'replication-test-secret-0123456789', CONVERSATION = `telegram/bot-${scope.bot}/chat-${scope.chat}`;
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const world = async (options?: Parameters<typeof peopleWorld>[1]) => { const dir = place('relationship-machine-'); dirs.push(dir);
  mkdirSync(join(dir, 'studio'), { recursive: true }); return { dir, ...await peopleWorld(join(dir, 'studio'), options) }; };
const permission = () => { const p = resolveGroupDisclosure(scope, authority(), now, records, sealKey); if (p.kind !== 'resolved') throw Error(p.reason); return p; };
const verify = (path: string) => { openPreviewJournal(path, key, undefined, undefined, true).close(); };

it('a person named on A becomes readable on B as a foreign-origin record after the carried journal is replicated and adopted', async () => {
  const w = await world();
  const audience = await verifyGroupAudience(scope, membership());
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), audience, now, () => false)).toBe('carried');
  // Machine B holds a replica of the group journal and nothing else.
  const laptop = join(w.dir, 'laptop'); mkdirSync(laptop, { recursive: true });
  const store = openReplicaStore({ directory: join(laptop, 'replica'), conversation: CONVERSATION, machine: 'laptop', secret: SECRET });
  const shipper = createJournalShipper({ path: w.target, size: () => w.destination.size, peer: localReplicaClient(store),
    conversation: CONVERSATION, machine: 'studio', secret: SECRET, epoch: () => 1, monotonic: () => 0 });
  await shipper.pump();
  expect(store.copy()).toMatchObject({ machine: 'studio', size: w.destination.size });
  const journalPath = join(laptop, 'journal.encrypted');
  expect(adoptReceivedCopy({ root: laptop, journalPath, store, epoch: 2, seed: false, verify })).toEqual({ ok: true, how: 'adopted' });
  // B's union read: A's person, foreign origin, channel-set identity, no local id.
  const adopted = openPreviewJournal(journalPath, key);
  const carried = adopted.view.groupCarry!.entries.filter(entry => entry.kind === 'person').map(entry => carriedPerson(entry, adopted.view.groupCarry!.scope)!);
  const union = unionOfOriginRecords(carried);
  const views = mergeUnionToRelationships(union);
  expect(views.map(view => view.data.name).sort()).toEqual(['Ana Lima', 'Sam Ruiz']);
  const sam = views.find(view => view.data.name === 'Sam Ruiz')!;
  expect(sam.origin).toBe(carryOrigin(scope));
  expect(sam.conflicted).toBe(false);
  expect(sam.data).not.toHaveProperty('id');
  expect(sam.recordKey).toBe(carried.find(record => record.data.name === 'Sam Ruiz')!.envelope.recordKey);
  expect(renderForeignRelationshipContext(sam)).toContain(`<replicated-untrusted-data origin="${carryOrigin(scope)}">`);
  // And the adopted root serves it to its own model packet exactly as the studio did.
  const packet = groupCarryPacket(adopted.view.groupCarry!, 'Who is Sam?', now, 409600, adopted.view);
  expect(packet.entries.some(entry => entry.kind === 'person' && entry.text.includes('Name: Sam Ruiz'))).toBe(true);
  adopted.close(); store.close(); w.destination.close(); w.source.close();
});

it('a forgotten mention on A is withheld before the carry, so B can never hold it: the forget row is the positive signal', async () => {
  const w = await world();
  w.source.view.memory.push({ mode: 'forget', source: w.ids.ana, trigger: w.ids.ana, quote: 'Ana Lima' });
  const memory = buildCarriedMemory(w.source.view, scope, permission(), now);
  const names = memory.entries.filter(entry => entry.kind === 'person').map(entry => carriedPerson(entry, scope)!.data.name);
  expect(names).toEqual(['Sam Ruiz']);
  expect(JSON.stringify(memory)).not.toContain('Ana');
  w.destination.close(); w.source.close();
});

it('the SAME person named in two private conversations collapses to ONE recordKey across origins and is flagged, never silently merged', async () => {
  const a = await world(), b = await world({ extraSamMention: true });
  const other = { ...scope, sourceRoot: '/test/other-private' };
  const asOrigin = (view: typeof a.source.view, origin: string): OriginRecord[] => journalRelationships(view, now).flatMap(person => {
    const data = buildRelationshipRecordData({ record: person.record, origin,
      hlc: { physical: Date.parse(person.record.lastInteraction), logical: person.record.interactionCount, node: origin } });
    // Read back through the store schema, as a receiver does: the envelope apart from the store fields.
    const record = data && originRecordFromData(data, { bumpSchemaReject() { throw Error('schema reject'); }, bumpDroppedField() {}, bumpJailReject() {} });
    return record ? [record] : [];
  });
  const recordsA = asOrigin(a.source.view, carryOrigin(scope)), recordsB = asOrigin(b.source.view, carryOrigin(other));
  const samA = recordsA.find(record => record.data.name === 'Sam Ruiz')!, samB = recordsB.find(record => record.data.name === 'Sam Ruiz')!;
  // ONE key for the same confirmed name set, from two roots that never shared a local id.
  expect(samA.envelope.recordKey).toBe(samB.envelope.recordKey);
  expect(samA.origin).not.toBe(samB.origin);
  expect(samB.data.interactionCount).toBe(3);
  const union = unionOfOriginRecords([...recordsA, ...recordsB]);
  expect(union.size).toBe(2); // Sam Ruiz (two origins) + Ana Lima
  // Ana's two accounts are byte-identical store fields: nothing to resolve, one value.
  expect(union.get(recordsA.find(record => record.data.name === 'Ana Lima')!.envelope.recordKey)!.conflict).toBeNull();
  const sam = union.get(samA.envelope.recordKey)!;
  // Neither root witnessed the other: HIGH-impact append-both-and-flag, never a silent clobber of either account.
  expect(sam.value).toBeNull();
  expect(sam.conflict!.versions.map(version => version.origin).sort()).toEqual([samA.origin, samB.origin].sort());
  expect(mergeUnionToRelationships(union).filter(view => view.conflicted)).toHaveLength(2);
  a.destination.close(); a.source.close(); b.destination.close(); b.source.close();
});
