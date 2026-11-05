import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, projectionDigest } from './journal.js';
import { AttentionQueue, AttentionConditionStore } from './attention-queue.js';
import { createAttentionSurface } from './attention-surface.js';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const key = new Uint8Array(32).fill(47), authority = `dashboard:${'a'.repeat(64)}`;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'attention-test', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const identity = { producer: 'stale-owner-release', conditionType: 'ambiguity', subject: 'peer-a', scope: 'owner' };
const item = { id: 'work-1', title: 'Review the result', summary: 'A result is ready', category: 'work', priority: 'NORMAL' as const };
function world() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'attention-queue-'))); dirs.push(root);
  const path = join(root, 'journal.encrypted'), clock = { now: 1000 }, host = { admitted: true, replicated: true };
  let journal = openPreviewJournal(path, key, genesis);
  const port = { state: () => journal.view.attention, append: (row: Parameters<typeof journal.append>[0]) => journal.append(row) };
  const queue = new AttentionQueue(port, () => clock.now);
  const surface = () => createAttentionSurface(journal, { now: () => clock.now, machine: 'studio',
    admitted: () => host.admitted, replicated: async () => host.replicated });
  return { path, clock, host, queue, port, surface, get journal() { return journal; },
    reopen: () => { journal.close(); journal = openPreviewJournal(path, key); }, close: () => journal.close() };
}
describe('AttentionConditionStore — adapted 1.x cases on the real journal', () => {
  it('reuses one active episode across process reconstruction', () => {
    const h = world(); try {
      const first = h.queue.conditions.observe(identity); expect(first.shouldRaise).toBe(true);
      h.clock.now += 60000; h.reopen();
      expect(h.queue.conditions.observe(identity)).toEqual({ itemId: first.itemId, episode: 1, shouldRaise: false });
    } finally { h.close(); }
  });
  it('mints a new episode only after an explicit clear', () => {
    const h = world(); try {
      const first = h.queue.conditions.observe(identity); expect(h.queue.conditions.clear(identity)).toBe(true);
      h.clock.now += 60000; h.reopen(); const recurrence = h.queue.conditions.observe(identity);
      expect(recurrence.shouldRaise).toBe(true); expect(recurrence.episode).toBe(2); expect(recurrence.itemId).not.toBe(first.itemId);
    } finally { h.close(); }
  });
  it('clears one producer/subject without touching siblings', () => {
    const h = world(); try {
      h.queue.conditions.observe(identity); h.queue.conditions.observe({ ...identity, conditionType: 'giveup', scope: '700' });
      const sibling = h.queue.conditions.observe({ ...identity, subject: 'peer-b' });
      expect(h.queue.conditions.clearSubject(identity.producer, identity.subject)).toBe(2);
      expect(h.queue.conditions.observe(identity).episode).toBe(2);
      expect(h.queue.conditions.observe({ ...identity, subject: 'peer-b' })).toEqual({ ...sibling, shouldRaise: false });
    } finally { h.close(); }
  });
  it('never evicts an active condition at capacity', () => {
    const h = world(); try {
      const store = new AttentionConditionStore(h.port, () => h.clock.now, 1), first = store.observe(identity);
      expect(store.observe({ ...identity, subject: 'peer-b' }).itemId).toContain(':capacity');
      expect(store.observe(identity)).toEqual({ ...first, shouldRaise: false });
      expect(h.journal.view.attention?.conditions).toHaveLength(1);
      expect(h.journal.view.attention?.conditionCapacity?.observations).toBe(1);
    } finally { h.close(); }
  });
});
it('dedupes exact ids, retains state after compaction/restart, and never exposes mutable aliases', () => {
  const h = world(); try {
    const first = h.queue.createAttentionItem(item); first.title = 'mutated';
    h.queue.createAttentionItem({ ...item, title: 'duplicate' });
    expect(h.queue.getAttentionItems()).toHaveLength(1); expect(h.queue.getAttentionItem(item.id)?.title).toBe(item.title);
    h.journal.compact(); const digest = projectionDigest(h.journal.view); h.reopen();
    expect(projectionDigest(h.journal.view)).toBe(digest); expect(h.queue.getAttentionItem(item.id)?.status).toBe('OPEN');
    expect(readFileSync(h.path).includes(Buffer.from(item.title))).toBe(false);
  } finally { h.close(); }
});
it('durably queues before confirmation, survives restart, then applies exactly once', async () => {
  const h = world(); try {
    h.queue.createAttentionItem(item); h.host.replicated = false;
    expect(await h.surface().acknowledge(item.id, 'done', 1, authority)).toEqual({ outcome: 'pending' });
    expect(h.queue.getAttentionItem(item.id)?.status).toBe('OPEN'); h.reopen();
    expect(h.queue.remoteAcks.list()).toHaveLength(1); h.host.replicated = true;
    await h.surface().drain(); expect(h.queue.getAttentionItem(item.id)?.status).toBe('DONE');
    const size = h.journal.size; await h.surface().drain(); expect(h.journal.size).toBe(size);
    h.reopen(); expect(h.queue.getAttentionItem(item.id)).toMatchObject({ status: 'DONE', revision: 2 });
    expect(h.journal.view.attention?.acknowledgements[0]?.lastOutcome).toBe('delivered');
  } finally { h.close(); }
});
it('a delayed acknowledgement cannot resolve a refreshed escalation', async () => {
  const h = world(); try {
    h.queue.createAttentionItem(item); h.host.replicated = false;
    await h.surface().acknowledge(item.id, 'DONE', 1, authority); h.queue.upsertAttentionItem({ ...item, priority: 'URGENT' });
    h.host.replicated = true; await h.surface().drain();
    expect(h.queue.getAttentionItem(item.id)).toMatchObject({ status: 'OPEN', priority: 'URGENT', revision: 2 });
    expect(h.journal.view.attention?.acknowledgements[0]?.lastOutcome).toBe('stale-superseded');
  } finally { h.close(); }
});
it('refuses unauthorized actors, invalid status, stop and lost ownership without altering the file', async () => {
  const h = world(); try {
    h.queue.createAttentionItem(item); const size = h.journal.size;
    expect(() => h.queue.remoteAcks.enqueue({ itemId: item.id, targetMachineId: 'studio', status: 'DONE',
      operatorUid: 'intruder', authority, revision: 1 })).toThrow(/operator/);
    await expect(h.surface().acknowledge(item.id, 'invented', 1, authority)).rejects.toThrow();
    await expect(h.surface().acknowledge(item.id, 'done', 1, 'unverified')).rejects.toThrow();
    h.host.admitted = false; await expect(h.surface().acknowledge(item.id, 'done', 1, authority)).rejects.toThrow();
    expect(h.journal.size).toBe(size); h.host.admitted = true;
    h.journal.append({ kind: 'stop', reason: 'operator', at: h.clock.now });
    await expect(h.surface().acknowledge(item.id, 'done', 1, authority)).rejects.toThrow();
  } finally { h.close(); }
});
it('retains exhausted acknowledgements visibly with a finite retry cap and backoff', () => {
  const h = world(); try {
    h.queue.remoteAcks.enqueue({ itemId: 'remote', targetMachineId: 'peer', status: 'DONE', operatorUid: genesis.operator, authority, revision: 1 });
    h.queue.drain(() => true); expect(h.queue.remoteAcks.list()[0]?.attempts).toBe(1);
    h.queue.drain(() => true); expect(h.queue.remoteAcks.list()[0]?.attempts).toBe(1);
    for (let i = 1; i < 50; i++) { h.clock.now += 300001; h.queue.drain(() => true); }
    expect(h.queue.remoteAcks.size).toBe(0);
    expect(h.journal.view.attention?.acknowledgements[0]).toMatchObject({ attempts: 50, lastOutcome: 'exhausted' });
    h.reopen(); expect(h.journal.view.attention?.acknowledgements[0]?.lastOutcome).toBe('exhausted');
  } finally { h.close(); }
});
it('a failed durable append cannot return a successful creation', () => {
  const queue = new AttentionQueue({ state: () => undefined, append: () => { throw Error('disk failed'); } }, () => 1000);
  expect(() => queue.createAttentionItem(item)).toThrow('disk failed'); expect(queue.getAttentionItems()).toEqual([]);
});
