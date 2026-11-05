/**
 * RevivalQueue (reap-notify spec R2.2/R2.3/R2.9/R2.10) — enqueue rules,
 * stable-key dedupe + resurrection ledger (across job re-trigger chains with
 * fresh tmux names AND across a topic rename), ordering, TTL incident-age
 * semantics + pause-freeze, bounds, durable-store refusal of corrupt state,
 * requeue clamps.
 *
 * Carried from 1.x tests/unit/resume-queue.test.ts at
 * 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9 for carryover row 03. The queue now
 * persists through the host-owned durable store port instead of its own
 * state file, so the fixture is an in-memory store that freezes every saved
 * record (as the conversation store does) and hands back clones. The 1.x
 * lockfile cases are replaced: single-writer is the existing conversation
 * ownership fence (tests/preview/journal-conversation-owner.test.ts).
 */
import { describe, it, expect } from 'vitest';

import {
  ResumeQueue,
  classifyEligibility,
  type ResumeCandidateInput,
  type RevivalQueueState,
  type RevivalQueueStore,
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

/** A host-owned store: atomic, durable before return, frozen once saved, cloned on load. */
export function memoryStore(initial: RevivalQueueState | null = null): RevivalQueueStore & { saves: number; record(): RevivalQueueState | null } {
  let record: RevivalQueueState | null = initial;
  return {
    saves: 0,
    load: () => record === null ? null : structuredClone(record),
    save(next) { record = Object.freeze(structuredClone(next)); this.saves++; },
    record: () => record,
  };
}

function makeQueue(over?: {
  cfg?: Partial<import('../../src/assembly/revival-queue.js').ResumeQueueConfig>;
  now?: () => number;
  store?: RevivalQueueStore;
}) {
  const audits: Array<Record<string, unknown>> = [];
  const aggregated: Array<{ kind: string; detail: string }> = [];
  let nowMs = 3_000_000_000_000;
  const store = over?.store ?? memoryStore();
  const q = new ResumeQueue(
    {
      store,
      audit: (e) => audits.push(e),
      raiseAggregated: (kind, detail) => aggregated.push({ kind, detail }),
      now: over?.now ?? (() => nowMs),
    },
    over?.cfg,
  );
  return { q, store, audits, aggregated, advance: (ms: number) => { nowMs += ms; }, nowAt: () => nowMs };
}

// ── Eligibility classifier (R2.2), both sides ─────────────────────────

describe('classifyEligibility (R2.2)', () => {
  const cfg = { includeOperatorKills: false };

  it('accepts terminal autonomous topic-bound with one strong signal', () => {
    expect(classifyEligibility(candidate(), cfg).eligible).toBe(true);
  });

  it('rejects recovery-bounce, operator kills (default), watchdog kills, topic-moved closeouts', () => {
    expect(classifyEligibility(candidate({ disposition: 'recovery-bounce' }), cfg).why).toBe('not-terminal');
    expect(classifyEligibility(candidate({ origin: 'operator' }), cfg).why).toBe('operator-kill');
    expect(classifyEligibility(candidate({ reason: 'watchdog-stuck' }), cfg).why).toBe('watchdog-kill');
    expect(classifyEligibility(candidate({ reason: 'topic moved to mini — closing leftover' }), cfg).why).toBe('topic-moved');
  });

  it('includeOperatorKills:true admits operator kills (the config lever)', () => {
    expect(classifyEligibility(candidate({ origin: 'operator' }), { includeOperatorKills: true }).eligible).toBe(true);
  });

  it('rejects no-topic-no-job (no resume path) and non-opted-in jobs; admits opted-in jobs', () => {
    expect(classifyEligibility(candidate({ topicId: null, jobSlug: undefined }), cfg).why).toBe('no-resume-path');
    expect(classifyEligibility(candidate({ topicId: null, jobSlug: 'nightly' }), cfg).why).toBe('job-not-opted-in');
    expect(
      classifyEligibility(candidate({ topicId: null, jobSlug: 'nightly', jobResumeOptIn: true }), cfg).eligible,
    ).toBe(true);
  });

  it('weak-alone never queues; topic-bound + 2 distinct weak does; unbound + 2 weak does not', () => {
    expect(classifyEligibility(candidate({ workEvidence: ['active-process'] }), cfg).why).toBe('insufficient-evidence');
    expect(
      classifyEligibility(candidate({ workEvidence: ['active-process', 'recent-user-message'] }), cfg).eligible,
    ).toBe(true);
    expect(
      classifyEligibility(
        candidate({ topicId: null, jobSlug: 'j', jobResumeOptIn: true, workEvidence: ['active-process', 'recent-user-message'] }),
        cfg,
      ).why,
    ).toBe('insufficient-evidence');
  });
});

// ── Queue mechanics ───────────────────────────────────────────────────

describe('ResumeQueue — enqueue, dedupe, ordering, bounds', () => {
  it('enqueues an eligible candidate durably (survives a reload through the host store)', () => {
    const { q, store } = makeQueue();
    expect(q.start()).toBe(true);
    const d = q.considerEnqueue(candidate());
    expect(d.enqueued).toBe(true);
    expect(store.saves).toBe(1);
    q.stop();

    const second = makeQueue({ store });
    expect(second.q.start()).toBe(true);
    expect(second.q.list()).toHaveLength(1);
    expect(second.q.list()[0]!.stableKey).toBe('topic:42');
    second.q.stop();
  });

  it('a stopped (not started) queue refuses enqueues', () => {
    const { q } = makeQueue();
    expect(q.considerEnqueue(candidate()).why).toBe('queue-off');
  });

  it('dedupes on stable identity — a second reap of the same topic while queued is one entry', () => {
    const { q } = makeQueue();
    q.start();
    expect(q.considerEnqueue(candidate()).enqueued).toBe(true);
    // Topic renamed → different tmux name, SAME topic id.
    expect(q.considerEnqueue(candidate({ tmuxSession: 'tmux-renamed', sessionName: 'renamed' })).why).toBe(
      'duplicate-open-entry',
    );
    q.stop();
  });

  it('orders interactive before job before other, FIFO inside each (R2.5)', () => {
    const { q, advance } = makeQueue({ cfg: { } });
    q.start();
    q.considerEnqueue(candidate({ topicId: null, jobSlug: 'job-a', jobResumeOptIn: true, tmuxSession: 'j-a', workEvidence: ['open-commitment'] }));
    advance(1000);
    q.considerEnqueue(candidate({ topicId: 1, tmuxSession: 't-1' }));
    advance(1000);
    q.considerEnqueue(candidate({ topicId: 2, tmuxSession: 't-2' }));
    const order = q.nextCandidates().map((e) => e.stableKey);
    expect(order).toEqual(['topic:1', 'topic:2', 'job:job-a']);
    q.stop();
  });

  it('overflow drops the oldest low-priority entry into the aggregated surface (never silent)', () => {
    const { q, aggregated, advance } = makeQueue({ cfg: { maxQueueSize: 2 } });
    q.start();
    q.considerEnqueue(candidate({ topicId: null, jobSlug: 'old-job', jobResumeOptIn: true, tmuxSession: 'j1', workEvidence: ['open-commitment'] }));
    advance(10);
    q.considerEnqueue(candidate({ topicId: 1, tmuxSession: 't1' }));
    advance(10);
    q.considerEnqueue(candidate({ topicId: 2, tmuxSession: 't2' }));
    const byStatus = new Map(q.list().map((e) => [e.stableKey, e.status]));
    expect(byStatus.get('job:old-job')).toBe('gave-up:overflow');
    expect(aggregated.some((a) => a.kind === 'overflow')).toBe(true);
    q.stop();
  });

  it('caps the reason field and clamps evidence at enqueue', () => {
    const { q } = makeQueue();
    q.start();
    const d = q.considerEnqueue(
      candidate({ reason: 'x'.repeat(2000), workEvidence: ['open-commitment', 'fake-evidence'] }),
    );
    expect(d.entry!.reason.length).toBeLessThanOrEqual(500);
    expect(d.entry!.workEvidence).toEqual(['open-commitment']);
    q.stop();
  });

  it('string topic identities (2.0 conversation ids) key the ledger and cancellation exactly', () => {
    const { q } = makeQueue();
    q.start();
    expect(q.considerEnqueue(candidate({ topicId: 'operator:main', tmuxSession: 'p1' })).entry!.stableKey).toBe('topic:operator:main');
    expect(q.considerEnqueue(candidate({ topicId: 'operator:7', tmuxSession: 'p2' })).enqueued).toBe(true);
    expect(q.cancelByTopic('operator:main')).toBe(1);
    expect(q.resurrectionCountForTopic('operator:main')).toBe(0);
    q.stop();
  });
});

describe('ResumeQueue — resurrection ledger (R2.9)', () => {
  it('caps kill-resume-kill loops on stable identity across fresh tmux names; cap event is loud', () => {
    const { q, aggregated } = makeQueue({ cfg: { maxResurrections: 2 } });
    q.start();
    // Cycle 1: enqueue → resume succeeds → re-reap.
    for (let cycle = 1; cycle <= 2; cycle++) {
      const d = q.considerEnqueue(candidate({ tmuxSession: `tmux-gen-${cycle}` }));
      expect(d.enqueued).toBe(true);
      q.transition(d.entry!.id, 'respawned');
      q.recordResumeSuccess('topic:42');
    }
    // Third re-reap after two successful resumes in the window → cap.
    const third = q.considerEnqueue(candidate({ tmuxSession: 'tmux-gen-3' }));
    expect(third.why).toBe('resurrection-cap');
    expect(aggregated.some((a) => a.kind === 'resurrection-cap')).toBe(true);
    q.stop();
  });

  it('the 24h window resets the ledger', () => {
    const { q, advance } = makeQueue({ cfg: { maxResurrections: 1 } });
    q.start();
    const d1 = q.considerEnqueue(candidate());
    q.transition(d1.entry!.id, 'respawned');
    q.recordResumeSuccess('topic:42');
    advance(25 * 3600_000); // past the window
    expect(q.considerEnqueue(candidate({ tmuxSession: 't2' })).enqueued).toBe(true);
    q.stop();
  });

  it('the ledger survives a host restart through the store (the loop brake is durable)', () => {
    const { q, store } = makeQueue({ cfg: { maxResurrections: 1 } });
    q.start();
    const d1 = q.considerEnqueue(candidate());
    q.transition(d1.entry!.id, 'respawned');
    q.recordResumeSuccess('topic:42');
    const second = makeQueue({ store, cfg: { maxResurrections: 1 } });
    second.q.start();
    expect(second.q.considerEnqueue(candidate({ tmuxSession: 't2' })).why).toBe('resurrection-cap');
  });

  // 2026-09-30, topic 52075: idle reaps at 10:57 and 12:51 were both revived;
  // the revived coordinator then worked for five hours, went quiet, and was
  // age-killed at 18:14 with uncommitted work — and the cap refused it.
  const reviveTwice = (q: ResumeQueue, advance: (ms: number) => void) => {
    for (const [i, gapMs] of [[1, 0], [2, 114 * 60_000]] as const) {
      advance(gapMs);
      const d = q.considerEnqueue(candidate({ tmuxSession: `echo-coord-${i}`, reason: 'reaped-idle', workEvidence: ['uncommitted-worktree-work'] }));
      expect(d.enqueued).toBe(true);
      q.transition(d.entry!.id, 'respawned');
      q.recordResumeSuccess('topic:42');
    }
    advance(323 * 60_000);
  };

  it('REPRO 52075: an age-limit kill of a session seen working past its age limit is queued, and the ledger restarts', () => {
    const { q, audits, advance } = makeQueue({ cfg: { maxResurrections: 2 } });
    q.start();
    reviveTwice(q, advance);
    const d = q.considerEnqueue(candidate({
      tmuxSession: 'echo-coord-3', reason: 'age-limit',
      workEvidence: ['uncommitted-worktree-work'], seenWorkingPastAgeLimit: true,
    }));
    expect(d.enqueued).toBe(true);
    expect(audits.some((a) => a.event === 'resurrection-ledger-reset')).toBe(true);
    expect(q.resurrectionCountForTopic(42)).toBe(0);
    q.stop();
  });

  it('an age-limit kill NOT seen working past its age limit still counts toward the cap', () => {
    const { q, advance } = makeQueue({ cfg: { maxResurrections: 2 } });
    q.start();
    reviveTwice(q, advance);
    const d = q.considerEnqueue(candidate({ tmuxSession: 'echo-coord-3', reason: 'age-limit', workEvidence: ['uncommitted-worktree-work'] }));
    expect(d.why).toBe('resurrection-cap');
    q.stop();
  });

  it('after a ledger restart, quick re-reaps are capped again (the loop brake stays)', () => {
    const { q, advance } = makeQueue({ cfg: { maxResurrections: 2 } });
    q.start();
    reviveTwice(q, advance);
    const aged = q.considerEnqueue(candidate({ tmuxSession: 'g3', reason: 'age-limit', workEvidence: ['uncommitted-worktree-work'], seenWorkingPastAgeLimit: true }));
    expect(aged.enqueued).toBe(true);
    for (const t of ['g4', 'g5']) {
      q.transition(q.snapshot().entries.find((e) => e.status === 'queued')!.id, 'respawned');
      q.recordResumeSuccess('topic:42');
      advance(10 * 60_000);
      const d = q.considerEnqueue(candidate({ tmuxSession: t, reason: 'reaped-idle', workEvidence: ['uncommitted-worktree-work'] }));
      if (t === 'g4') expect(d.enqueued).toBe(true);
      else expect(d.why).toBe('resurrection-cap');
    }
    q.stop();
  });

  it('a stale age-limit kill with no work evidence is not queued, whatever the flag', () => {
    const { q } = makeQueue();
    q.start();
    const d = q.considerEnqueue(candidate({ reason: 'age-limit', workEvidence: [], seenWorkingPastAgeLimit: true }));
    expect(d).toEqual({ enqueued: false, why: 'insufficient-evidence' });
    q.stop();
  });

  it('requeue of a gave-up:resurrection-cap entry grants exactly ONE audited override', () => {
    const { q } = makeQueue({ cfg: { maxResurrections: 0 } });
    q.start();
    const d1 = q.considerEnqueue(candidate());
    q.transition(d1.entry!.id, 'respawned');
    q.recordResumeSuccess('topic:42');
    // Re-reap hits the cap immediately (maxResurrections 0).
    const capped = q.considerEnqueue(candidate({ tmuxSession: 't2' }));
    expect(capped.why).toBe('resurrection-cap');
    // Mark the original entry gave-up and requeue it → override granted.
    q.transition(d1.entry!.id, 'gave-up:resurrection-cap');
    expect(q.requeue(d1.entry!.id).ok).toBe(true);
    // The override admits ONE more enqueue... (entry already queued via requeue —
    // so the override path here proves the grant flag flips; the next re-reap re-caps.)
    q.transition(d1.entry!.id, 'respawned');
    q.recordResumeSuccess('topic:42');
    expect(q.considerEnqueue(candidate({ tmuxSession: 't3' })).why).toBe('resurrection-cap');
    q.stop();
  });
});

describe('ResumeQueue — TTL incident-age + pause freeze (R2.7/R2.9)', () => {
  it('expires a queued entry past the TTL; pressure-starved marker when not calm', () => {
    const { q, advance } = makeQueue({ cfg: { entryTtlHours: 1 } });
    q.start();
    q.considerEnqueue(candidate());
    advance(2 * 3600_000);
    const expired = q.expireTtl(false);
    expect(expired).toHaveLength(1);
    expect(expired[0]!.status).toBe('gave-up:ttl');
    expect(expired[0]!.pressureStarved).toBe(true);
    q.stop();
  });

  it('operator pause FREEZES the TTL clock; unpause resumes it', () => {
    const { q, advance } = makeQueue({ cfg: { entryTtlHours: 1 } });
    q.start();
    q.considerEnqueue(candidate());
    advance(30 * 60_000);
    q.pause('emergency stop');
    advance(5 * 3600_000); // 5h paused — must NOT expire
    expect(q.expireTtl(true)).toHaveLength(0); // no sweep while paused
    q.unpause();
    expect(q.expireTtl(true)).toHaveLength(0); // frozenMs excluded the pause
    advance(45 * 60_000); // 30m + 45m unpaused > 1h TTL
    const expired = q.expireTtl(true);
    expect(expired).toHaveLength(1);
    expect(expired[0]!.pressureStarved).toBe(false);
    q.stop();
  });

  it('requeue re-anchors the TTL clock but preserves queuedAt (R2.10)', () => {
    const { q, advance } = makeQueue({ cfg: { entryTtlHours: 1, maxAttempts: 3 } });
    q.start();
    const d = q.considerEnqueue(candidate());
    const originalQueuedAt = d.entry!.queuedAt;
    advance(2 * 3600_000);
    q.expireTtl(true);
    expect(q.get(d.entry!.id)!.status).toBe('gave-up:ttl');
    const r = q.requeue(d.entry!.id);
    expect(r.ok).toBe(true);
    const entry = q.get(d.entry!.id)!;
    expect(entry.queuedAt).toBe(originalQueuedAt); // preserved for R2.6 checks
    expect(entry.requeuedAt).toBeDefined();
    // Without the re-anchor this would re-expire instantly (the dead-lever bug).
    expect(q.expireTtl(true)).toHaveLength(0);
    q.stop();
  });
});

describe('ResumeQueue — requeue clamps + pause refusals (R2.7/R2.10)', () => {
  it('requeue is refused for cancelled entries (operator stops are not undoable via Bearer)', () => {
    const { q } = makeQueue();
    q.start();
    const d = q.considerEnqueue(candidate());
    q.cancel(d.entry!.id);
    expect(q.requeue(d.entry!.id).why).toBe('not-gave-up');
    q.stop();
  });

  it('requeue is refused while the queue is paused', () => {
    const { q, advance } = makeQueue({ cfg: { entryTtlHours: 0 } });
    q.start();
    const d = q.considerEnqueue(candidate());
    advance(1000);
    q.expireTtl(true);
    q.pause('emergency stop');
    expect(q.requeue(d.entry!.id).why).toBe('queue-paused');
    q.stop();
  });

  it('a pause is first-writer-wins and only an explicit unpause clears it (Rules 4/93)', () => {
    const { q, audits, advance } = makeQueue();
    q.start();
    q.pause('message-sentinel emergency stop');
    const pausedAt = q.pauseInfo().pausedAt;
    advance(120 * 60_000);
    q.pause('autonomous stop-all');
    expect(q.pauseInfo()).toEqual({ paused: true, pausedAt, reason: 'message-sentinel emergency stop' });
    expect(audits.filter((a) => a.event === 'paused')).toHaveLength(1);
    q.unpause();
    expect(q.isPaused()).toBe(false);
    q.stop();
  });

  it('cancelByTopic cancels only that topic and only open entries', () => {
    const { q } = makeQueue();
    q.start();
    q.considerEnqueue(candidate({ topicId: 1, tmuxSession: 't1' }));
    q.considerEnqueue(candidate({ topicId: 2, tmuxSession: 't2' }));
    expect(q.cancelByTopic(1)).toBe(1);
    const byKey = new Map(q.list().map((e) => [e.stableKey, e.status]));
    expect(byKey.get('topic:1')).toBe('cancelled');
    expect(byKey.get('topic:2')).toBe('queued');
    q.stop();
  });
});

describe('ResumeQueue — durability + boot reconciliation (R2.3/R2.4)', () => {
  it("'starting' found at load counts as a failed attempt", () => {
    const { q, store } = makeQueue();
    q.start();
    const d = q.considerEnqueue(candidate());
    q.transition(d.entry!.id, 'starting');
    q.stop();

    const second = makeQueue({ store });
    second.q.start();
    const entry = second.q.get(d.entry!.id)!;
    expect(entry.status).toBe('queued');
    expect(entry.attempts).toBe(1);
    second.q.stop();
  });

  it("'starting' at load that exhausts maxAttempts goes gave-up:max-attempts", () => {
    const { q, store } = makeQueue({ cfg: { maxAttempts: 1 } });
    q.start();
    const d = q.considerEnqueue(candidate());
    q.transition(d.entry!.id, 'starting');
    q.stop();

    const second = makeQueue({ store, cfg: { maxAttempts: 1 } });
    second.q.start();
    expect(second.q.get(d.entry!.id)!.status).toBe('gave-up:max-attempts');
    second.q.stop();
  });

  it('reconcileFromReapLog re-enqueues a lost mid-work reap; known keys and tombstones are skipped', () => {
    const { q } = makeQueue();
    q.start();
    q.considerEnqueue(candidate({ topicId: 1, tmuxSession: 't1' }));
    q.recordResumeSuccess('topic:3'); // tombstone for topic 3
    const n = q.reconcileFromReapLog([
      candidate({ topicId: 1, tmuxSession: 't1-respawn' }), // open entry → skip
      candidate({ topicId: 2, tmuxSession: 't2' }), // new → enqueue
      candidate({ topicId: 3, tmuxSession: 't3' }), // tombstone → skip
    ]);
    expect(n).toBe(1);
    expect(q.list().filter((e) => e.status === 'queued').map((e) => e.stableKey).sort()).toEqual([
      'topic:1',
      'topic:2',
    ]);
    q.stop();
  });

  it('a corrupt durable record refuses to start instead of silently resetting the ledger (Rules 26/40/42)', () => {
    // 1.x sidecar-preserved the corrupt file and started empty, losing the resurrection
    // ledger. The host store contract is: corrupt state throws, never looks empty.
    const corrupt = memoryStore({ version: 2 as unknown as 1, paused: false, entries: 'nope' as unknown as [], tombstones: [] });
    const { q } = makeQueue({ store: corrupt });
    expect(() => q.start()).toThrow(/unrecognized; preserved/);
    expect(q.considerEnqueue(candidate()).why).toBe('queue-off');
    const unreadable: RevivalQueueStore = { load: () => { throw new Error('store unreadable'); }, save: () => {} };
    expect(() => makeQueue({ store: unreadable }).q.start()).toThrow(/store unreadable/);
  });

  it('every mutation persists synchronously through the store and a frozen record never blocks the next one', () => {
    const { q, store } = makeQueue();
    q.start();
    const d = q.considerEnqueue(candidate());
    const saves = store.saves;
    q.transition(d.entry!.id, 'starting');
    q.transition(d.entry!.id, 'queued');
    q.pause('emergency stop');
    q.unpause();
    expect(store.saves).toBe(saves + 4);
    expect(Object.isFrozen(store.record())).toBe(true);
    expect(store.record()!.entries[0]!.status).toBe('queued');
  });
});

describe('ResumeQueue — ownership feed (R1.2)', () => {
  it('hasLiveQueuedEntryFor is FALSE before start even with a stored entry', () => {
    const { q, store } = makeQueue();
    q.start();
    q.considerEnqueue(candidate());
    const second = makeQueue({ store });
    expect(second.q.hasLiveQueuedEntryFor('tmux-1')).toBe(false);
    second.q.start();
    expect(second.q.hasLiveQueuedEntryFor('tmux-1')).toBe(true);
  });

  it('hasLiveQueuedEntryFor is TRUE for a live queued entry', () => {
    const { q } = makeQueue();
    q.start();
    q.considerEnqueue(candidate());
    expect(q.hasLiveQueuedEntryFor('tmux-1')).toBe(true);
    expect(q.hasLiveQueuedEntryFor('other-tmux')).toBe(false);
    q.stop();
  });
});
