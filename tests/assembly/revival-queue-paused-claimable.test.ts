/**
 * honest-session-state-surfaces Finding (c) — the split predicate.
 *
 * `hasLiveQueuedEntryFor` (OWNERSHIP, paused-BLIND) feeds the double-spawn
 * coordination guard and must stay TRUE while the queue is paused (the queue
 * still owns its frozen entry). `hasClaimableQueuedEntryFor` (CLAIMABILITY =
 * live AND !paused) feeds the user-facing "A restart is queued" copy and must
 * be FALSE while paused (a paused queue won't revive yet, so the claim would be
 * a promise it cannot currently keep).
 *
 * Carried from 1.x tests/unit/ResumeQueue-paused-claimable.test.ts at
 * 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9 for carryover row 03; the queue now
 * persists through the host store port and the 1.x dry-run posture is not carried.
 *
 * These tests pin BOTH sides of the boundary — including the I2-guard regression
 * assertion that ownership survives a pause.
 */
import { describe, it, expect } from 'vitest';

import {
  ResumeQueue,
  type ResumeCandidateInput,
  type RevivalQueueState,
} from '../../src/assembly/revival-queue.js';

function candidate(over: Partial<ResumeCandidateInput> = {}): ResumeCandidateInput {
  return {
    sessionName: 'sess',
    tmuxSession: 'tmux-1',
    topicId: 42,
    resumeUuid: '11111111-1111-4111-8111-111111111111',
    cwd: '/tmp/project',
    reason: 'quota-shed',
    disposition: 'terminal',
    origin: 'autonomous',
    workEvidence: ['build-or-autonomous-active'],
    ...over,
  };
}

function makeQueue(cfg?: Partial<import('../../src/assembly/revival-queue.js').ResumeQueueConfig>) {
  let nowMs = 3_000_000_000_000;
  let record: RevivalQueueState | null = null;
  const q = new ResumeQueue(
    {
      store: { load: () => record === null ? null : structuredClone(record), save: next => { record = Object.freeze(structuredClone(next)); } },
      audit: () => {},
      raiseAggregated: () => {},
      now: () => nowMs,
    },
    cfg,
  );
  return q;
}

describe('ResumeQueue split predicate (Finding c)', () => {
  it('live entry, NOT paused → BOTH ownership and claimability are true', () => {
    const q = makeQueue();
    q.start();
    expect(q.considerEnqueue(candidate()).enqueued).toBe(true);

    expect(q.hasLiveQueuedEntryFor('tmux-1')).toBe(true);
    expect(q.hasClaimableQueuedEntryFor('tmux-1')).toBe(true);
  });

  it('PAUSED → claimability FALSE (copy suppressed) while ownership stays TRUE (I2 guard preserved)', () => {
    const q = makeQueue();
    q.start();
    expect(q.considerEnqueue(candidate()).enqueued).toBe(true);

    q.pause('emergency-stop');

    // The user-facing "restart is queued" copy must NOT claim a revival.
    expect(q.hasClaimableQueuedEntryFor('tmux-1')).toBe(false);
    // …but the queue STILL owns the frozen topic — the double-spawn
    // coordination guard reads this and must keep deferring.
    expect(q.hasLiveQueuedEntryFor('tmux-1')).toBe(true);
  });

  it('after unpause → claimability returns to true (entry preserved across the pause)', () => {
    const q = makeQueue();
    q.start();
    expect(q.considerEnqueue(candidate()).enqueued).toBe(true);

    q.pause('emergency-stop');
    expect(q.hasClaimableQueuedEntryFor('tmux-1')).toBe(false);

    q.unpause();
    expect(q.hasClaimableQueuedEntryFor('tmux-1')).toBe(true);
    expect(q.hasLiveQueuedEntryFor('tmux-1')).toBe(true);
  });

  it('not started → BOTH predicates false (no claim before the durable record is loaded)', () => {
    const q = makeQueue();
    // No start() — the started guard fires before any entry can be read.
    expect(q.hasLiveQueuedEntryFor('tmux-1')).toBe(false);
    expect(q.hasClaimableQueuedEntryFor('tmux-1')).toBe(false);
  });

  it('stopped → BOTH predicates false', () => {
    const q = makeQueue();
    q.start();
    q.considerEnqueue(candidate());
    q.stop();
    expect(q.hasLiveQueuedEntryFor('tmux-1')).toBe(false);
    expect(q.hasClaimableQueuedEntryFor('tmux-1')).toBe(false);
  });

  it('unknown session → both false even when paused', () => {
    const q = makeQueue();
    q.start();
    q.considerEnqueue(candidate());
    q.pause('emergency-stop');

    expect(q.hasLiveQueuedEntryFor('not-a-session')).toBe(false);
    expect(q.hasClaimableQueuedEntryFor('not-a-session')).toBe(false);
  });
});
