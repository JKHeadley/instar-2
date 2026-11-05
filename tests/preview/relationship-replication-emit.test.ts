/**
 * WS2.3 emit-on-mutation funnel + tombstone/erasure tests for RelationshipManager.
 *
 * The manager routes EVERY persistence mutation through its single save() funnel
 * and EVERY deletion through delete()/mergeRelationships(); when a replication
 * emitter is injected it emits a `put` on save and a `delete` tombstone on delete.
 * These tests prove:
 *   - emit-on-every-mutation (findOrCreate, updateNotes, linkChannel, addTags emit a put)
 *   - DARK no-op (no emitter ⇒ zero emissions, byte-identical single-machine behavior)
 *   - delete emits a channel-keyed tombstone (erasure-reaches-offline-peer prerequisite)
 *   - mergeRelationships emits a coherent put(survivor)+delete(merged) pair with
 *     DISTINCT recordKeys (no dangling tombstone, no replication loop)
 *   - a replication-emitter THROW never breaks the local write (additive)
 */
import { describe, it, expect } from 'vitest';

import { RelationshipManager, memoryRelationshipStore, type RelationshipReplicationEmitter } from './relationship-manager.js';
import { deriveRelationshipRecordKey } from './relationship-store.js';
import type { RelationshipRecord, UserChannel } from './relationship-manager.js';

interface PutEvent { kind: 'put'; record: RelationshipRecord }
interface DeleteEvent { kind: 'delete'; channels: UserChannel[]; deletedAt: string }
type Event = PutEvent | DeleteEvent;

function recordingEmitter(events: Event[]): RelationshipReplicationEmitter {
  return {
    emitPut: (record) => { events.push({ kind: 'put', record: JSON.parse(JSON.stringify(record)) as RelationshipRecord }); },
    emitDelete: (channels, deletedAt) => { events.push({ kind: 'delete', channels: [...channels], deletedAt }); },
  };
}

const CLOCK = Date.UTC(2026, 9, 10, 12, 0, 0);

describe('WS2.3 RelationshipManager emit funnel', () => {
  function mgr(emitter?: RelationshipReplicationEmitter): RelationshipManager {
    let ids = 0;
    return new RelationshipManager({ maxRecentInteractions: 20 }, { now: () => CLOCK, id: () => `r${++ids}` }, memoryRelationshipStore(), emitter);
  }

  it('DARK no-op: no emitter ⇒ ZERO emissions on a full create+mutate+delete cycle', () => {
    const m = mgr(); // no emitter
    const r = m.findOrCreate('Alice', { type: 'telegram', identifier: '1' });
    m.updateNotes(r.id, 'hello');
    m.addTags(r.id, ['ai']);
    expect(m.delete(r.id)).toBe(true);
    // No throw, no emitter — the manager behaves exactly as a single-machine agent.
    expect(m.getAll()).toHaveLength(0);
  });

  it('emit-on-every-mutation: create/updateNotes/linkChannel/addTags each emit a put', () => {
    const events: Event[] = [];
    const m = mgr(recordingEmitter(events));
    const r = m.findOrCreate('Alice', { type: 'telegram', identifier: '1' });
    m.updateNotes(r.id, 'a note');
    m.linkChannel(r.id, { type: 'email', identifier: 'a@x.io' });
    m.addTags(r.id, ['ai']);
    const puts = events.filter((e): e is PutEvent => e.kind === 'put');
    expect(puts.length).toBeGreaterThanOrEqual(4); // findOrCreate + 3 mutations
    // The last put reflects the consolidated channel set + note + tag.
    const last = puts[puts.length - 1]!.record;
    expect(last.notes).toBe('a note');
    expect(last.tags).toContain('ai');
    expect(last.channels.map((c) => c.identifier)).toContain('a@x.io');
  });

  it('delete emits a channel-keyed tombstone (the erasure-reaches-offline-peer prerequisite)', () => {
    const events: Event[] = [];
    const m = mgr(recordingEmitter(events));
    const r = m.findOrCreate('Alice', { type: 'telegram', identifier: '1' });
    m.linkChannel(r.id, { type: 'email', identifier: 'a@x.io' });
    const channelsAtDelete = [...m.get(r.id)!.channels];
    events.length = 0; // clear the put events
    expect(m.delete(r.id)).toBe(true);
    const deletes = events.filter((e): e is DeleteEvent => e.kind === 'delete');
    expect(deletes).toHaveLength(1);
    // The tombstone keys on the channel SET (identity surface), not the local id.
    expect(deriveRelationshipRecordKey(deletes[0]!.channels)).toBe(deriveRelationshipRecordKey(channelsAtDelete));
    expect(deletes[0]!.deletedAt).toBe(new Date(CLOCK).toISOString());
  });

  it('mergeRelationships emits a coherent put(survivor)+delete(merged) pair with DISTINCT recordKeys', () => {
    const events: Event[] = [];
    const m = mgr(recordingEmitter(events));
    // Two distinct records for what turns out to be the same person.
    const keep = m.findOrCreate('Alice', { type: 'telegram', identifier: '1' });
    const merge = m.findOrCreate('Alicia', { type: 'email', identifier: 'a@x.io' });
    const mergedChannelsBefore = [...m.get(merge.id)!.channels];
    events.length = 0;

    m.mergeRelationships(keep.id, merge.id);

    const puts = events.filter((e): e is PutEvent => e.kind === 'put');
    const deletes = events.filter((e): e is DeleteEvent => e.kind === 'delete');
    expect(puts.length).toBeGreaterThanOrEqual(1); // survivor put
    expect(deletes).toHaveLength(1);               // merged tombstone

    const survivor = puts[puts.length - 1]!.record;
    const survivorKey = deriveRelationshipRecordKey(survivor.channels);
    const tombstoneKey = deriveRelationshipRecordKey(deletes[0]!.channels);

    // The tombstone keys on the merged's OLD standalone channel set...
    expect(tombstoneKey).toBe(deriveRelationshipRecordKey(mergedChannelsBefore));
    // ...which is DISTINCT from the survivor's now-consolidated recordKey — so the
    // tombstone can NEVER suppress the survivor (no dangling tombstone, no loop).
    expect(tombstoneKey).not.toBe(survivorKey);
    // The survivor now carries BOTH channels (the consolidated identity).
    expect(survivor.channels.map((c) => c.identifier).sort()).toEqual(['1', 'a@x.io']);
    // The merged record is gone (only the survivor remains).
    expect(m.getAll()).toHaveLength(1);
  });

  it('a throwing emitter NEVER breaks the local write (additive replication)', () => {
    const m = mgr({
      emitPut: () => { throw new Error('replication down'); },
      emitDelete: () => { throw new Error('replication down'); },
    });
    // The local create + delete must succeed despite the emitter throwing.
    const r = m.findOrCreate('Alice', { type: 'telegram', identifier: '1' });
    expect(m.get(r.id)).not.toBeNull();
    expect(m.delete(r.id)).toBe(true);
    expect(m.getAll()).toHaveLength(0);
  });

  it('a failing store write surfaces and emits nothing (replication follows the durable write, never precedes it)', () => {
    const events: Event[] = [];
    const store = memoryRelationshipStore();
    const failing = { ...store, save: () => { throw new Error('disk full'); } };
    const m = new RelationshipManager({ maxRecentInteractions: 20 }, { now: () => CLOCK, id: () => 'r1' }, failing, recordingEmitter(events));
    expect(() => m.findOrCreate('Alice', { type: 'telegram', identifier: '1' })).toThrow('disk full');
    expect(events).toHaveLength(0);
  });

  it('setReplicationEmitter late-binds + detaches', () => {
    const events: Event[] = [];
    const m = mgr(); // start dark
    const r1 = m.findOrCreate('Alice', { type: 'telegram', identifier: '1' });
    expect(events).toHaveLength(0); // dark — no emission
    m.setReplicationEmitter(recordingEmitter(events));
    m.updateNotes(r1.id, 'now replicated');
    expect(events.filter((e) => e.kind === 'put').length).toBeGreaterThanOrEqual(1);
    m.setReplicationEmitter(undefined); // detach
    events.length = 0;
    m.updateNotes(r1.id, 'dark again');
    expect(events).toHaveLength(0);
  });

  it('the peer-read seam is separate from local resolution: dark ⇒ [], bound ⇒ the foreign blocks, never a local record', () => {
    const m = mgr();
    const r = m.findOrCreate('Alice', { type: 'telegram', identifier: '1' });
    expect(m.peerContextForChannels(r.channels)).toEqual([]);
    m.setPeerReadSeam({ peerContextForChannels: () => ['<replicated-untrusted-data origin="m_peer">\nName: Alice\n</replicated-untrusted-data>'] });
    expect(m.peerContextForChannels(r.channels)).toHaveLength(1);
    expect(m.resolveByChannel({ type: 'email', identifier: 'peer-only@x.io' })).toBeNull();
    m.setPeerReadSeam(undefined);
    expect(m.peerContextForChannels(r.channels)).toEqual([]);
  });
});
