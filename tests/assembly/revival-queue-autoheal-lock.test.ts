/**
 * Single-writer custody for the revival queue.
 *
 * Carried from 1.x tests/unit/resume-queue-autoheal-lock.test.ts at
 * 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9 (GAP-D: the pid/hostname lockfile,
 * its FD1–FD5 rename-vs-conflict classifier and the auto-heal lever) for
 * carryover row 03. The lockfile is not carried: in 2.0 the queue persists in
 * the host-owned conversation record, whose single writer is the existing
 * conversation ownership fence (tests/preview/conversation-owner.ts —
 * exclusive per conversation, refused across machines, inhibited when the
 * authority is unusable, lost when the owner record changes; proven in
 * tests/preview/journal-conversation-owner.test.ts). What this file pins is the
 * fail-closed posture the 1.x lock cases protected, on the store port:
 *  - the queue never probes, reclaims or auto-heals anything itself;
 *  - an unusable store refuses the start loudly instead of starting empty;
 *  - a write the store cannot make durable propagates, never a silent hold.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  ResumeQueue,
  type ResumeCandidateInput,
  type RevivalQueueState,
  type RevivalQueueStore,
} from '../../src/assembly/revival-queue.js';

function candidate(over: Partial<ResumeCandidateInput> = {}): ResumeCandidateInput {
  return {
    sessionName: 'sess', tmuxSession: 'tmux-1', topicId: 42, cwd: '/tmp/project', reason: 'quota-shed',
    disposition: 'terminal', origin: 'autonomous', workEvidence: ['build-or-autonomous-active'], ...over,
  };
}

function makeQueue(store: RevivalQueueStore): { q: ResumeQueue; audits: Record<string, unknown>[]; aggregated: { kind: string; detail: string }[] } {
  const audits: Record<string, unknown>[] = [];
  const aggregated: { kind: string; detail: string }[] = [];
  const q = new ResumeQueue({ store, audit: (e) => audits.push(e), raiseAggregated: (kind, detail) => aggregated.push({ kind, detail }),
    now: () => 3_000_000_000_000 });
  return { q, audits, aggregated };
}

describe('single writer is the conversation ownership fence, never a queue-owned lock', () => {
  it('the queue has no host, pid or lock surface of its own (the 1.x FD1–FD5 classifier is gone)', () => {
    const source = readFileSync(new URL('../../src/assembly/revival-queue.ts', import.meta.url), 'utf8');
    for (const forbidden of ['os.hostname', 'pidAlive', 'lockPath', 'autoHealStaleHostLock', 'classifyDfSourceLocal', 'takeOverLockAtomic', 'acquireLock'])
      expect(source.includes(forbidden), forbidden).toBe(false);
    const q = makeQueue({ load: () => null, save: () => {} }).q;
    expect(Object.keys(q)).not.toContain('lockHeld');
  });

  it('the fence that serializes writers is the existing reviewed one, and it is tested', () => {
    const fence = readFileSync(new URL('../preview/conversation-owner.ts', import.meta.url), 'utf8');
    expect(fence).toContain('Rule 63');
    expect(fence).toContain("disposition: 'nonowner' | 'inhibited'");
    const proof = readFileSync(new URL('../preview/journal-conversation-owner.test.ts', import.meta.url), 'utf8');
    for (const title of ['a second root for the same conversation is refused without polling or sending while the owner serves',
      'the fence: exclusive per conversation, refused across machines, inhibited when the authority is unusable, lost when the owner record changes'])
      expect(proof).toContain(title);
  });
});

describe('fail-closed on an unusable store (what the lock cases protected)', () => {
  it('an unreadable store refuses the start loudly; no empty queue is started', () => {
    const { q } = makeQueue({ load: () => { throw new Error('EACCES: owner record'); }, save: () => {} });
    expect(() => q.start()).toThrow(/EACCES/);
    expect(q.considerEnqueue(candidate()).why).toBe('queue-off');
    expect(q.list()).toEqual([]);
  });

  it('a record from an unrecognized writer refuses the start and is preserved untouched', () => {
    const foreign = Object.freeze({ version: 7, entries: [], tombstones: [], paused: false }) as unknown as RevivalQueueState;
    let saved = 0;
    const { q } = makeQueue({ load: () => foreign, save: () => { saved++; } });
    expect(() => q.start()).toThrow(/unrecognized; preserved/);
    expect(saved).toBe(0);
  });

  it('a write the store cannot make durable propagates to the caller (never a silent hold)', () => {
    let fail = false;
    let record: RevivalQueueState | null = null;
    const { q } = makeQueue({ load: () => record, save: next => { if (fail) throw new Error('ENOSPC'); record = next; } });
    q.start();
    expect(q.considerEnqueue(candidate()).enqueued).toBe(true);
    fail = true;
    expect(() => q.considerEnqueue(candidate({ topicId: 2, tmuxSession: 't2' }))).toThrow(/ENOSPC/);
    expect(() => q.pause('emergency stop')).toThrow(/ENOSPC/);
    fail = false;
    expect(q.list().filter((e) => e.status === 'queued').map((e) => e.stableKey)).toEqual(['topic:42', 'topic:2']);
  });

  it('two queues over one record: the later loader sees the earlier writer\'s durable state, never a private copy', () => {
    let record: RevivalQueueState | null = null;
    const store: RevivalQueueStore = { load: () => record === null ? null : structuredClone(record), save: next => { record = Object.freeze(structuredClone(next)); } };
    const a = makeQueue(store).q; a.start();
    expect(a.considerEnqueue(candidate()).enqueued).toBe(true);
    const b = makeQueue(store).q; b.start();
    expect(b.list().map((e) => e.stableKey)).toEqual(['topic:42']);
    expect(b.considerEnqueue(candidate({ tmuxSession: 'renamed' })).why).toBe('duplicate-open-entry');
  });
});
