/**
 * RevivalDrainer (reap-notify spec R2.4–R2.11) — calm-ticks, one-per-tick,
 * re-entrancy, EACH drain-time validation both sides, pause semantics, the
 * failure ladder + breaker, capacity holds, Tier1 observe-only paths, and
 * the oscillating-load calm-ticks reset.
 *
 * Carried from 1.x tests/unit/resume-queue-drainer.test.ts at
 * 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9 for carryover row 03. The drainer
 * now runs on the host's injected clock and bounded wait with its brakes
 * durable through the host store; the 1.x dry-run posture and the Layer-2
 * stale-emergency-pause auto-resume are not carried (Rules 73/76 and 4/93),
 * and the capacity hold learned by admitting replaces the 1.x pre-gate.
 */
import { describe, it, expect, vi } from 'vitest';

import { ResumeQueue, type ResumeCandidateInput, type RevivalQueueState } from '../../src/assembly/revival-queue.js';
import {
  ResumeQueueDrainer,
  buildResumeSanityPrompt,
  buildResumeSanityEvaluationOptions,
  DP_RESUME_SANITY_CHECK,
  RESUME_SANITY_CHECK_PROMPT_ID,
  type ResumeQueueDrainerDeps,
  type RevivalDrainerBrakes,
} from '../../src/assembly/revival-drainer.js';
import {
  AGE_LIMIT_ACTIVE_RUN_REASON,
  COMMITMENT_ACTIVE_RUN_REASON,
} from '../../src/assembly/work-evidence.js';

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

interface Harness {
  queue: ResumeQueue;
  drainer: ResumeQueueDrainer;
  deps: ResumeQueueDrainerDeps;
  audits: Array<Record<string, unknown>>;
  aggregated: Array<{ kind: string; detail: string }>;
  respawns: string[];
  notices: string[];
  setTier: (t: 'normal' | 'moderate' | 'critical') => void;
  advance: (ms: number) => void;
  /** A second host over the same durable records (restart). */
  reopen: () => Harness;
}

/** One durable host record: queue state and drainer brakes, frozen once saved. */
function records() {
  let queue: RevivalQueueState | null = null, brakes: RevivalDrainerBrakes | null = null;
  return {
    queue: { load: () => queue === null ? null : structuredClone(queue), save: (next: RevivalQueueState) => { queue = Object.freeze(structuredClone(next)); } },
    brakes: { load: () => brakes === null ? null : structuredClone(brakes), save: (next: RevivalDrainerBrakes) => { brakes = Object.freeze(structuredClone(next)); } },
  };
}

/** An explicit `undefined` override removes a dep or restores a config default (the drainer skips undefined). */
type Overrides<T> = { [K in keyof T]?: T[K] | undefined };
function harness(over?: {
  queueCfg?: Partial<import('../../src/assembly/revival-queue.js').ResumeQueueConfig>;
  drainerCfg?: Overrides<import('../../src/assembly/revival-drainer.js').ResumeQueueDrainerConfig>;
  deps?: Overrides<ResumeQueueDrainerDeps>;
  stores?: ReturnType<typeof records>;
  clock?: { now: number };
}): Harness {
  const audits: Array<Record<string, unknown>> = [];
  const aggregated: Array<{ kind: string; detail: string }> = [];
  const respawns: string[] = [];
  const notices: string[] = [];
  const clock = over?.clock ?? { now: 4_000_000_000_000 };
  const stores = over?.stores ?? records();
  let tier: 'normal' | 'moderate' | 'critical' = 'normal';
  const queue = new ResumeQueue(
    {
      store: stores.queue,
      audit: (e) => audits.push(e),
      raiseAggregated: (kind, detail) => aggregated.push({ kind, detail }),
      now: () => clock.now,
    },
    over?.queueCfg,
  );
  queue.start();
  const deps: ResumeQueueDrainerDeps = {
    queue,
    pressureTier: () => tier,
    canSpawnSession: () => true,
    sessionCountOk: () => true,
    migrationInFlight: () => false,
    liveSessionForTopic: () => false,
    currentResumeUuid: () => '11111111-1111-4111-8111-111111111111',
    topicOwnerElsewhere: () => false,
    topicBindingMatches: () => true,
    operatorStopSince: () => false,
    jobCheck: () => ({ ok: true }),
    pathExists: () => true,
    respawnTopic: async (entry) => {
      respawns.push(entry.id);
      return `respawned-${entry.tmuxSession}`;
    },
    triggerJob: async () => 'triggered',
    spawnAliveAfterGrace: async () => true,
    notifyResumed: (entry) => notices.push(entry.id),
    raiseAggregated: (kind, detail) => aggregated.push({ kind, detail }),
    audit: (e) => audits.push(e),
    wait: async (ms) => { clock.now += ms; },
    brakes: stores.brakes,
    now: () => clock.now,
    ...over?.deps,
  } as ResumeQueueDrainerDeps;
  const drainer = new ResumeQueueDrainer(deps, {
    requiredCalmTicks: 3,
    attemptBackoffMs: 1000,
    ...over?.drainerCfg,
  } as Partial<import('../../src/assembly/revival-drainer.js').ResumeQueueDrainerConfig>);
  return {
    queue,
    drainer,
    deps,
    audits,
    aggregated,
    respawns,
    notices,
    setTier: (t) => { tier = t; },
    advance: (ms) => { clock.now += ms; },
    reopen: () => harness({ ...over, stores, clock }),
  };
}

/** Drive enough calm ticks to satisfy the gate. */
async function warmCalm(h: Harness, ticks = 3): Promise<void> {
  for (let i = 0; i < ticks; i++) await h.drainer.tick();
}

describe('ResumeQueueDrainer — Tier-1 provenance', () => {
  it('enrolls queue evidence without storing the reason or evidence text', () => {
    const entry = candidate({
      reason: 'cobalt-lantern private completion contradiction',
      workEvidence: ['cobalt-lantern-private-signal'],
    }) as unknown as import('../../src/assembly/revival-queue.js').ResumeQueueEntry;
    const prompt = buildResumeSanityPrompt({ ...entry, queuedAt: 4_000_000_000_000, attempts: 0 });
    const options = buildResumeSanityEvaluationOptions({ promptText: prompt, entry: { ...entry, queuedAt: 4_000_000_000_000, attempts: 0 } });

    expect(prompt).toContain('cobalt-lantern');
    expect(options.provenance).toMatchObject({
      decisionPoint: DP_RESUME_SANITY_CHECK,
      optionsPresented: ['sensible', 'not-sensible'],
      promptId: RESUME_SANITY_CHECK_PROMPT_ID,
    });
    expect(JSON.stringify(options.provenance?.context)).not.toContain('cobalt-lantern');
    expect(options.provenance.context.promptIdentitySha256).toMatch(/^sha256:([0-9a-f]{16}:){3}[0-9a-f]{16}$/);
  });
});

describe('ResumeQueueDrainer — calm gates (R2.4)', () => {
  it('does not resume until requiredCalmTicks consecutive normal ticks', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate());
    expect((await h.drainer.tick()).blocked).toBe('calm-ticks'); // calm=1
    expect((await h.drainer.tick()).blocked).toBe('calm-ticks'); // calm=2
    const third = await h.drainer.tick(); // calm=3 → gates pass → resume
    expect(third.resumed).toBe(true);
    expect(h.respawns).toHaveLength(1);
  });

  it('oscillating load RESETS the calm streak (the stress case)', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate());
    await h.drainer.tick(); // calm=1
    await h.drainer.tick(); // calm=2
    h.setTier('moderate');
    await h.drainer.tick(); // reset to 0
    h.setTier('normal');
    expect((await h.drainer.tick()).blocked).toBe('calm-ticks'); // calm=1 again
    expect((await h.drainer.tick()).blocked).toBe('calm-ticks'); // calm=2
    expect((await h.drainer.tick()).resumed).toBe(true); // calm=3
  });

  it('the calm streak is a durable reading of the gauge: a host restart keeps it', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate());
    await h.drainer.tick(); await h.drainer.tick(); // calm=2
    const next = h.reopen();
    expect(next.drainer.status().calmTicks).toBe(2);
    expect((await next.drainer.tick()).resumed).toBe(true);
  });

  it('quota / session-cap / migration gates each block (never bypassable)', async () => {
    for (const [dep, expected] of [
      [{ canSpawnSession: () => false }, 'quota'],
      [{ sessionCountOk: () => false }, 'session-cap'],
      [{ migrationInFlight: () => true }, 'migration-in-flight'],
    ] as const) {
      const h = harness({ deps: dep as Overrides<ResumeQueueDrainerDeps> });
      h.queue.considerEnqueue(candidate());
      await warmCalm(h);
      expect((await h.drainer.tick()).blocked).toBe(expected);
      expect(h.respawns).toHaveLength(0);
      h.queue.stop();
    }
  });

  it('manual drain skips ONLY the calm-ticks gate', async () => {
    const h = harness({ deps: { canSpawnSession: () => false } });
    h.queue.considerEnqueue(candidate());
    // skipCalmTicks does NOT bypass quota.
    expect((await h.drainer.tick({ skipCalmTicks: true })).blocked).toBe('quota');
    h.queue.stop();

    const h2 = harness();
    h2.queue.considerEnqueue(candidate());
    expect((await h2.drainer.tick({ skipCalmTicks: true })).resumed).toBe(true);
  });

  it('an unreadable pressure gauge counts as NOT calm (fail-safe)', async () => {
    const h = harness({ deps: { pressureTier: () => { throw new Error('gauge'); } } });
    h.queue.considerEnqueue(candidate());
    for (let i = 0; i < 5; i++) {
      expect((await h.drainer.tick()).blocked).toBe('calm-ticks');
    }
  });
});

describe('ResumeQueueDrainer — a resource hold learned by admitting is not a failed spawn', () => {
  it('respawnTopic returning null keeps the entry queued with zero attempts, audited as the quota gate', async () => {
    let capacity = false;
    const h = harness({ deps: { respawnTopic: async (entry) => capacity ? `respawned-${entry.tmuxSession}` : null } });
    const d = h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    for (let n = 0; n < 4; n++) {
      expect((await h.drainer.tick()).blocked).toBe('quota');
      expect(h.queue.get(d.entry!.id)).toMatchObject({ status: 'queued', attempts: 0 });
    }
    expect(h.audits.filter((a) => a.event === 'gates-blocked' && a.gate === 'quota')).toHaveLength(1);
    expect(h.drainer.status().consecutiveFailures).toBe(0);
    capacity = true;
    expect((await h.drainer.tick()).resumed).toBe(true);
    expect(h.audits.some((a) => a.event === 'gates-cleared')).toBe(true);
  });
});

describe('ResumeQueueDrainer — one per tick, ordering, re-entrancy (R2.4/R2.5)', () => {
  it('resumes AT MOST ONE entry per tick, interactive first', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate({ topicId: null, jobSlug: 'job-x', jobResumeOptIn: true, tmuxSession: 'j1', workEvidence: ['open-commitment'] }));
    h.queue.considerEnqueue(candidate({ topicId: 1, tmuxSession: 't1' }));
    h.queue.considerEnqueue(candidate({ topicId: 2, tmuxSession: 't2' }));
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true); // topic 1
    expect(h.respawns).toHaveLength(1);
    expect((await h.drainer.tick()).resumed).toBe(true); // topic 2
    expect(h.respawns).toHaveLength(2);
    expect((await h.drainer.tick()).resumed).toBe(true); // then the job
    const statuses = new Map(h.queue.list().map((e) => [e.stableKey, e.status]));
    expect(statuses.get('topic:1')).toBe('respawned');
    expect(statuses.get('topic:2')).toBe('respawned');
    expect(statuses.get('job:job-x')).toBe('respawned');
  });

  it('re-entrant tick is refused', async () => {
    const h = harness({
      deps: {
        respawnTopic: async (entry) => {
          // While the first tick is mid-spawn, a second tick must bounce.
          const inner = await h.drainer.tick();
          expect(inner.blocked).toBe('re-entrant');
          return `respawned-${entry.tmuxSession}`;
        },
      },
    });
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true);
  });

  it('paused queue never spawns', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    h.queue.pause('emergency stop');
    expect((await h.drainer.tick()).blocked).toBe('paused');
    expect(h.respawns).toHaveLength(0);
  });

  it('a job entry without job deps invalidates instead of spawning (2.0 scheduled work has its own owner)', async () => {
    const h = harness({ deps: { jobCheck: undefined, triggerJob: undefined } });
    h.queue.considerEnqueue(candidate({ topicId: null, jobSlug: 'nightly', jobResumeOptIn: true, workEvidence: ['open-commitment'] }));
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).invalidated).toBe(1);
    expect(h.queue.list()[0]!.status).toBe('invalidated:job-recovery-unwired');
  });
});

describe('ResumeQueueDrainer — drain-time reality validations (R2.6, both sides)', () => {
  const cases: Array<[string, Partial<ResumeQueueDrainerDeps>, string]> = [
    ['live session exists', { liveSessionForTopic: () => true }, 'live-session-exists'],
    ['resume uuid stale', { currentResumeUuid: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff' }, 'resume-uuid-stale'],
    ['topic owned elsewhere', { topicOwnerElsewhere: () => true }, 'topic-owner-elsewhere'],
    ['binding mismatch', { topicBindingMatches: () => false }, 'binding-mismatch'],
    ['operator stop since queuedAt', { operatorStopSince: () => true }, 'operator-stop'],
    ['cwd missing', { pathExists: () => false }, 'cwd-missing'],
  ];
  for (const [name, deps, why] of cases) {
    it(`invalidates (never spawns) on: ${name}`, async () => {
      const h = harness({ deps });
      h.queue.considerEnqueue(candidate());
      await warmCalm(h, 2);
      const r = await h.drainer.tick();
      expect(r.invalidated).toBe(1);
      expect(h.respawns).toHaveLength(0);
      const entry = h.queue.list()[0]!;
      expect(entry.status).toBe(`invalidated:${why}`);
    });
  }

  it('job entries: a failed jobCheck invalidates with its reason', async () => {
    const h = harness({
      deps: { jobCheck: () => ({ ok: false, why: 'job-ran-since' }) },
    });
    h.queue.considerEnqueue(candidate({ topicId: null, jobSlug: 'nightly', jobResumeOptIn: true, workEvidence: ['open-commitment'] }));
    await warmCalm(h, 2);
    const r = await h.drainer.tick();
    expect(r.invalidated).toBe(1);
    expect(h.queue.list()[0]!.status).toBe('invalidated:job-ran-since');
  });

  it('all validations passing → the spawn happens (the other side)', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true);
  });

  it('a corrupt entry (bad resumeUuid) is invalidated by the hard invariants', async () => {
    const h = harness();
    const d = h.queue.considerEnqueue(candidate());
    // Corrupt the durable entry out-of-band (simulates on-disk corruption).
    h.queue.transition(d.entry!.id, 'queued', { resumeUuid: 'not-a-uuid-at-all' } as never);
    await warmCalm(h, 2);
    const r = await h.drainer.tick();
    expect(r.invalidated).toBe(1);
    expect(h.queue.list()[0]!.status).toBe('invalidated:corrupt-entry');
    expect(h.respawns).toHaveLength(0);
  });
});

describe('ResumeQueueDrainer — failure ladder + breaker (R2.9)', () => {
  it('a failed spawn retries with backoff; maxAttempts → gave-up + aggregated item', async () => {
    const h = harness({
      deps: { spawnAliveAfterGrace: async () => false },
      drainerCfg: { maxAttempts: 2, breakerThreshold: 99 },
    });
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).blocked).toBe('attempt-failed'); // attempt 1
    expect(h.queue.list()[0]!.status).toBe('queued');
    expect(h.queue.list()[0]!.attempts).toBe(1);
    expect((await h.drainer.tick()).blocked).toBe('empty'); // backing off: no candidate due
    h.advance(2000); // past backoff
    expect((await h.drainer.tick()).blocked).toBe('attempt-failed'); // attempt 2 = max
    expect(h.queue.list()[0]!.status).toBe('gave-up:max-attempts');
    expect(h.aggregated.some((a) => a.kind === 'gave-up')).toBe(true);
  });

  it('the source backoff doubles from two minutes per attempt', async () => {
    const h = harness({ deps: { spawnAliveAfterGrace: async () => false }, drainerCfg: { attemptBackoffMs: undefined, maxAttempts: 3, breakerThreshold: 99 } });
    const d = h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    const first = h.deps.now();
    await h.drainer.tick();
    expect(h.queue.get(d.entry!.id)!.nextAttemptAt).toBe(first + 2 * 60_000);
    h.advance(2 * 60_000);
    const second = h.deps.now();
    await h.drainer.tick();
    expect(h.queue.get(d.entry!.id)!.nextAttemptAt).toBe(second + 4 * 60_000);
  });

  it('breakerThreshold consecutive failures opens the breaker for the cooldown, ONE aggregated notice', async () => {
    const h = harness({
      deps: { spawnAliveAfterGrace: async () => false },
      drainerCfg: { maxAttempts: 99, breakerThreshold: 2, breakerCooldownMin: 30 },
    });
    h.queue.considerEnqueue(candidate({ topicId: 1, tmuxSession: 't1' }));
    h.queue.considerEnqueue(candidate({ topicId: 2, tmuxSession: 't2' }));
    await warmCalm(h, 2);
    await h.drainer.tick(); // failure 1
    h.advance(2000);
    await h.drainer.tick(); // failure 2 → breaker opens
    expect(h.aggregated.filter((a) => a.kind === 'breaker')).toHaveLength(1);
    expect(h.drainer.status().breakerOpen).toBe(true);
    expect((await h.drainer.tick()).blocked).toBe('breaker-open');
    // The breaker is durable: a restarted host stays braked.
    expect((await h.reopen().drainer.tick()).blocked).toBe('breaker-open');
    // Cooldown elapses → the breaker closes and draining resumes.
    h.advance(31 * 60_000);
    h.advance(2000);
    const after = await h.drainer.tick();
    expect(after.blocked).not.toBe('breaker-open');
  });

  it('a successful resume resets the consecutive-failure streak', async () => {
    let fail = true;
    const h = harness({
      deps: { spawnAliveAfterGrace: async () => !fail },
      drainerCfg: { maxAttempts: 99, breakerThreshold: 3 },
    });
    h.queue.considerEnqueue(candidate({ topicId: 1, tmuxSession: 't1' }));
    h.queue.considerEnqueue(candidate({ topicId: 2, tmuxSession: 't2' }));
    await warmCalm(h, 2);
    await h.drainer.tick(); // t1 fails (streak 1)
    fail = false;
    h.advance(2000);
    await h.drainer.tick(); // t2 succeeds → streak resets
    expect(h.drainer.status().consecutiveFailures).toBe(0);
  });

  it('a replacement that died with effects the host cannot prove absent is invalidated, never retried', async () => {
    const h = harness({ deps: { spawnAliveAfterGrace: async () => 'uncertain' }, drainerCfg: { maxAttempts: 3 } });
    const d = h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).invalidated).toBe(1);
    expect(h.queue.get(d.entry!.id)).toMatchObject({ status: 'invalidated:uncertain-after-spawn', attempts: 0 });
    expect(h.drainer.status().consecutiveFailures).toBe(0);
    expect(h.aggregated.some((a) => a.kind === 'invalidated' && a.detail.includes('uncertain-after-spawn'))).toBe(true);
    expect((await h.drainer.tick()).blocked).toBe('empty');
  });

  it('a launch the host settled itself (unknown launch) propagates and enters no ladder', async () => {
    const h = harness({ deps: { respawnTopic: async (entry) => { h.queue.transition(entry.id, 'invalidated:uncertain-launch'); throw new Error('host lost during launch'); } } });
    const d = h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    await expect(h.drainer.tick()).rejects.toThrow(/host lost during launch/);
    expect(h.queue.get(d.entry!.id)).toMatchObject({ status: 'invalidated:uncertain-launch', attempts: 0 });
    expect(h.drainer.status().consecutiveFailures).toBe(0);
    expect((await h.drainer.tick()).blocked).toBe('empty'); // the tick lock was released
  });
});

describe('ResumeQueueDrainer — Tier1 paths (P7)', () => {
  it('Tier1 observe-only: a NEGATIVE verdict is audited and the resume still happens', async () => {
    const h = harness({
      deps: { tier1Check: async () => ({ sensible: false, reasoning: 'reason contradicts evidence' }) },
    });
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true); // never defers
    const verdicts = h.audits.filter((a) => a.event === 'tier1-verdict');
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]!.sensible).toBe(false);
  });

  it('Tier1 deadline: a hung check sheds through the host wait and the gates proceed', async () => {
    const h = harness({
      deps: { tier1Check: () => new Promise(() => { /* never resolves */ }) },
      drainerCfg: { tier1DeadlineMs: 10 },
    });
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true);
    const verdicts = h.audits.filter((a) => a.event === 'tier1-verdict');
    expect(verdicts[0]!.supervision).toBe('shed');
  });

  it('Tier1 default deadline is five seconds of the host clock', async () => {
    const before = 4_000_000_000_000;
    const h = harness({ deps: { tier1Check: () => new Promise(() => { /* never resolves */ }) } });
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true);
    expect(h.deps.now()).toBe(before + 5_000);
  });

  it('a throwing check sheds and never blocks the resume', async () => {
    const h = harness({ deps: { tier1Check: async () => { throw new Error('doorway down'); } } });
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true);
    expect(h.audits.find((a) => a.event === 'tier1-verdict')?.supervision).toBe('shed');
  });

  it('tier1Check:false lever switches the check off entirely', async () => {
    const probe = vi.fn(async () => ({ sensible: true }));
    const h = harness({
      deps: { tier1Check: probe },
      drainerCfg: { tier1Check: false },
    });
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true);
    expect(probe).not.toHaveBeenCalled();
  });

  it('R2.11: the resume notice fires on success; the continuation prompt treats reason as data', async () => {
    const h = harness();
    const d = h.queue.considerEnqueue(candidate({ reason: 'quota-shed `evil` injection' }));
    await warmCalm(h, 2);
    await h.drainer.tick();
    expect(h.notices).toEqual([d.entry!.id]);
    const prompt = h.drainer.continuationPrompt(h.queue.get(d.entry!.id)!);
    expect(prompt).toContain('restarted to pick the work back up');
    expect(prompt).not.toContain('`evil`'); // backticks neutralized (literal data)
    expect(prompt).toContain('build-or-autonomous-active');
  });

  it('ACT-839 R2.1: uncommitted-worktree-work prepends the verbatim commit-first directive as the first line', () => {
    const h = harness();
    const d = h.queue.considerEnqueue(candidate({ workEvidence: ['uncommitted-worktree-work'] }));
    const prompt = h.drainer.continuationPrompt(h.queue.get(d.entry!.id)!);
    expect(prompt.startsWith('You were revived because your worktree had uncommitted changes')).toBe(true);
    expect(prompt).toContain('commit them with a real, descriptive commit, or deliberately preserve/discard');
    expect(prompt).toContain('restarted to pick the work back up'); // base text still present
  });

  it('ACT-839 R2.1: with BOTH uncommitted-worktree-work + build-or-autonomous-active, the build second-sentence is included', () => {
    const h = harness();
    const d = h.queue.considerEnqueue(candidate({ workEvidence: ['uncommitted-worktree-work', 'build-or-autonomous-active'] }));
    const prompt = h.drainer.continuationPrompt(h.queue.get(d.entry!.id)!);
    expect(prompt).toContain('A build/autonomous run was also active');
  });

  it('ACT-839 R2.1: NO directive when uncommitted-worktree-work is absent (unchanged prompt)', () => {
    const h = harness();
    const d = h.queue.considerEnqueue(candidate({ workEvidence: ['open-commitment'] }));
    const prompt = h.drainer.continuationPrompt(h.queue.get(d.entry!.id)!);
    expect(prompt.startsWith('You were revived because your worktree')).toBe(false);
    expect(prompt.startsWith('Your previous session was shut down')).toBe(true);
  });
});

describe('ResumeQueueDrainer — ACT-839 R2.2 worktree-revival obligation hook', () => {
  it('fires onWorktreeRevival after a successful resume of an uncommitted-worktree entry', async () => {
    const fired: string[] = [];
    const h = harness({ deps: { onWorktreeRevival: (e) => fired.push(e.id) } });
    const d = h.queue.considerEnqueue(candidate({ workEvidence: ['uncommitted-worktree-work'] }));
    await warmCalm(h, 2);
    await h.drainer.tick();
    expect(fired).toEqual([d.entry!.id]);
  });
  it('does NOT fire for an entry without uncommitted-worktree-work', async () => {
    const fired: string[] = [];
    const h = harness({ deps: { onWorktreeRevival: (e) => fired.push(e.id) } });
    h.queue.considerEnqueue(candidate({ workEvidence: ['open-commitment'] }));
    await warmCalm(h, 2);
    await h.drainer.tick();
    expect(fired).toEqual([]);
  });
  it('a throw in onWorktreeRevival never fails the resume', async () => {
    const h = harness({ deps: { onWorktreeRevival: () => { throw new Error('commitment boom'); } } });
    const d = h.queue.considerEnqueue(candidate({ workEvidence: ['uncommitted-worktree-work'] }));
    await warmCalm(h, 2);
    const r = await h.drainer.tick();
    expect(r.resumed).toBe(true);
    expect(h.queue.get(d.entry!.id)?.status).toBe('respawned');
  });
});

describe('ResumeQueueDrainer — paused queue: Layer 1 notice carried, Layer 2 auto-resume not carried (Rules 4/93)', () => {
  const EMERGENCY = 'message-sentinel emergency stop';
  const STOP_ALL = 'autonomous stop-all';

  /** Enqueue an active-autonomous-run entry (the only reason 1.x Layer 2 would auto-resume). */
  function activeRunCandidate(over: Partial<ResumeCandidateInput> = {}): ResumeCandidateInput {
    return candidate({ reason: AGE_LIMIT_ACTIVE_RUN_REASON, ...over });
  }

  it('Layer 1: paused + waiting → raises paused-waiting ONCE per pause episode; never spawns; still blocked:paused', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate()); // plain mid-work entry (not active-run)
    await warmCalm(h, 2);
    h.queue.pause(EMERGENCY);
    expect((await h.drainer.tick()).blocked).toBe('paused');
    expect((await h.drainer.tick()).blocked).toBe('paused');
    expect((await h.drainer.tick()).blocked).toBe('paused');
    // Fired exactly once across the steady episode.
    expect(h.aggregated.filter((a) => a.kind === 'paused-waiting')).toHaveLength(1);
    expect(h.respawns).toHaveLength(0);
  });

  it('Layer 1: the notice marker is durable — a restart mid-pause does not re-alert', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate());
    h.queue.pause(EMERGENCY);
    await h.drainer.tick();
    const next = h.reopen();
    await next.drainer.tick();
    expect(next.aggregated.filter((a) => a.kind === 'paused-waiting')).toHaveLength(0);
  });

  it('Layer 1: a NEW pause episode (unpause + re-pause) re-raises paused-waiting', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate());
    h.queue.pause(EMERGENCY);
    await h.drainer.tick();
    h.queue.unpause();
    h.advance(1000);
    h.queue.pause(EMERGENCY); // new pausedAt
    await h.drainer.tick();
    expect(h.aggregated.filter((a) => a.kind === 'paused-waiting')).toHaveLength(2);
  });

  it('Layer 1: a GROWING backlog under the SAME pause re-raises; a steady count does not (codex r3 #3)', async () => {
    const h = harness();
    h.queue.considerEnqueue(candidate({ topicId: 1, tmuxSession: 't1' }));
    h.queue.pause(EMERGENCY);
    await h.drainer.tick(); // count=1 → alert
    await h.drainer.tick(); // count=1 → no re-alert
    h.queue.considerEnqueue(candidate({ topicId: 2, tmuxSession: 't2' })); // count grows to 2
    await h.drainer.tick(); // count=2 → re-alert
    await h.drainer.tick(); // count=2 → no re-alert
    expect(h.aggregated.filter((a) => a.kind === 'paused-waiting')).toHaveLength(2);
  });

  it('a stale emergency pause is NEVER auto-resumed: an active-run entry queued well past the 1.x threshold stays paused', async () => {
    const h = harness();
    await warmCalm(h, 3); // calm satisfied, so only the pause holds the revival
    h.queue.pause(EMERGENCY); // pausedAt = T0
    h.advance(61 * 60_000); // past the 1.x 60-minute Layer-2 threshold
    h.queue.considerEnqueue(activeRunCandidate()); // queuedAt = T0 + 61m
    for (let i = 0; i < 3; i++) expect((await h.drainer.tick()).blocked).toBe('paused');
    expect(h.queue.isPaused()).toBe(true);
    expect(h.audits.some((a) => a.event === 'auto-resumed-stale-pause')).toBe(false);
    expect(h.aggregated.some((a) => a.kind === 'auto-resumed-stale-pause')).toBe(false);
    expect(h.respawns).toHaveLength(0);
    // Layer 1 still tells the operator the work is waiting.
    expect(h.aggregated.filter((a) => a.kind === 'paused-waiting')).toHaveLength(1);
  });

  it('a deliberate stop-all pause + active-run entry stays paused as well', async () => {
    const h = harness();
    h.queue.pause(STOP_ALL);
    h.advance(120 * 60_000);
    h.queue.considerEnqueue(activeRunCandidate());
    expect((await h.drainer.tick()).blocked).toBe('paused');
    expect(h.queue.isPaused()).toBe(true);
  });

  it('only an explicit unpause clears the pause, and the per-topic stop guard still invalidates after it (gemini r2 #1)', async () => {
    const h = harness({ deps: { operatorStopSince: () => true } });
    await warmCalm(h, 3);
    h.queue.pause(EMERGENCY);
    h.advance(61 * 60_000);
    h.queue.considerEnqueue(activeRunCandidate());
    expect((await h.drainer.tick()).blocked).toBe('paused');
    h.queue.unpause();
    const r = await h.drainer.tick();
    // The queue resumed, but the per-topic stop guard still blocks the spawn.
    expect(h.queue.isPaused()).toBe(false);
    expect(r.invalidated).toBe(1);
    expect(h.respawns).toHaveLength(0);
    expect(h.queue.list()[0]!.status).toBe('invalidated:operator-stop');
  });
});

describe('ResumeQueueDrainer — GAP-B D9 commitment drain-time re-check (both sides)', () => {
  const committedCandidate = (over?: Partial<ResumeCandidateInput>) =>
    candidate({ reason: COMMITMENT_ACTIVE_RUN_REASON, workEvidence: ['build-or-autonomous-active'], ...over });

  it('commitment still active at drain ⇒ spawn proceeds', async () => {
    const h = harness({ deps: { commitmentStillActiveForTopic: () => true } });
    h.queue.considerEnqueue(committedCandidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true);
    expect(h.respawns).toHaveLength(1);
  });

  it('commitment closed/lapsed between enqueue and drain ⇒ invalidated (never spawns)', async () => {
    const h = harness({ deps: { commitmentStillActiveForTopic: () => false } });
    h.queue.considerEnqueue(committedCandidate());
    await warmCalm(h, 2);
    const r = await h.drainer.tick();
    expect(r.invalidated).toBe(1);
    expect(h.respawns).toHaveLength(0);
    expect(h.queue.list()[0]!.status).toBe('invalidated:commitment-no-longer-active');
  });

  it('the re-check is gated on the COMMITMENT reason only (a quota-shed entry never consults it)', async () => {
    let consulted = false;
    const h = harness({
      deps: { commitmentStillActiveForTopic: () => { consulted = true; return false; } },
    });
    // reason 'quota-shed' (the candidate default), NOT the commitment reason.
    h.queue.considerEnqueue(candidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true);
    expect(consulted).toBe(false);
  });

  it('a throwing dep resolves SAFE (still-active ⇒ spawn proceeds, never wrongly dropped)', async () => {
    const h = harness({
      deps: { commitmentStillActiveForTopic: () => { throw new Error('boom'); } },
    });
    h.queue.considerEnqueue(committedCandidate());
    await warmCalm(h, 2);
    expect((await h.drainer.tick()).resumed).toBe(true);
  });
});

describe('ResumeQueueDrainer — TTL sweep at the tick (R2.9)', () => {
  it('expiries fold into ONE ttl-expired notice naming the pressure-starved count', async () => {
    const h = harness({ queueCfg: { entryTtlHours: 1 } });
    h.queue.considerEnqueue(candidate({ topicId: 1, tmuxSession: 't1' }));
    h.queue.considerEnqueue(candidate({ topicId: 2, tmuxSession: 't2' }));
    h.setTier('critical');
    h.advance(2 * 3600_000);
    await h.drainer.tick();
    const notices = h.aggregated.filter((a) => a.kind === 'ttl-expired');
    expect(notices).toHaveLength(1);
    expect(notices[0]!.detail).toContain('2 queued resume(s) expired after 24h');
    expect(notices[0]!.detail).toContain('2 pressure-starved');
    expect(h.queue.list().every((e) => e.status === 'gave-up:ttl' && e.pressureStarved)).toBe(true);
  });
});

describe('ResumeQueueDrainer — G2: no silent pressure-held revival (agent-always-reachable)', () => {
  const NOTICE_MS = 10_000;

  /** Pressure-held: tier stays moderate (calm-ticks never satisfied) + entry waited past the window. */
  function heldHarness(over?: Parameters<typeof harness>[0]): Harness {
    const h = harness({ drainerCfg: { pressureHeldNoticeMs: NOTICE_MS }, ...over });
    h.setTier('moderate'); // calmTicks resets to 0 every tick ⇒ permanent calm-ticks block
    return h;
  }

  it('emits ONE pressure-held notice when a revival is held past the window — never silent', async () => {
    const h = heldHarness();
    h.queue.considerEnqueue(candidate()); // queuedAt = now
    h.advance(NOTICE_MS); // the entry has now waited the full window under pressure

    const r = await h.drainer.tick();
    expect(r.blocked).toBe('calm-ticks'); // still held — the notice does NOT bypass the gate
    expect(r.resumed).toBeFalsy();

    const held = h.aggregated.filter((a) => a.kind === 'pressure-held');
    expect(held).toHaveLength(1);
    expect(held[0]!.detail).toContain('under memory/CPU pressure');
    expect(held[0]!.detail).toContain('freeing resources');
  });

  it('the source window is twenty minutes', async () => {
    const h = harness({ drainerCfg: { pressureHeldNoticeMs: undefined } });
    h.setTier('moderate');
    h.queue.considerEnqueue(candidate());
    h.advance(20 * 60_000 - 1);
    await h.drainer.tick();
    expect(h.aggregated.filter((a) => a.kind === 'pressure-held')).toHaveLength(0);
    h.advance(1);
    await h.drainer.tick();
    expect(h.aggregated.filter((a) => a.kind === 'pressure-held')).toHaveLength(1);
  });

  it('does NOT emit while the entry has waited LESS than the window (no premature notice)', async () => {
    const h = heldHarness();
    h.queue.considerEnqueue(candidate());
    h.advance(NOTICE_MS - 1); // one ms short of the window

    await h.drainer.tick();
    expect(h.aggregated.filter((a) => a.kind === 'pressure-held')).toHaveLength(0);
  });

  it('suppresses repeats — the notice fires ONCE per pressure episode, not every tick, including across a restart', async () => {
    const h = heldHarness();
    h.queue.considerEnqueue(candidate());
    h.advance(NOTICE_MS);

    await h.drainer.tick();
    await h.drainer.tick();
    await h.drainer.tick();
    expect(h.aggregated.filter((a) => a.kind === 'pressure-held')).toHaveLength(1);
    const next = h.reopen(); next.setTier('moderate');
    await next.drainer.tick();
    expect(next.aggregated.filter((a) => a.kind === 'pressure-held')).toHaveLength(0);
  });

  it('does NOT fire for a NON-pressure hold (quota), and re-arms for a later pressure episode', async () => {
    // Quota-blocked (not calm-ticks): no pressure-held notice even though time has passed.
    const h = harness({
      drainerCfg: { pressureHeldNoticeMs: NOTICE_MS },
      deps: { canSpawnSession: () => false },
    });
    h.queue.considerEnqueue(candidate());
    // Clear the calm-ticks gate FIRST (entry still fresh) so the blocking gate is
    // purely 'quota' — only THEN age the entry. The notice keys on a calm-ticks
    // hold, not a quota hold, so a quota-blocked aged entry must stay silent.
    await warmCalm(h, 3);
    h.advance(NOTICE_MS);
    expect((await h.drainer.tick()).blocked).toBe('quota');
    expect(h.aggregated.filter((a) => a.kind === 'pressure-held')).toHaveLength(0);
  });

  it('re-arms after the gate clears — a second pressure episode notifies again', async () => {
    const h = heldHarness();
    h.queue.considerEnqueue(candidate());
    h.advance(NOTICE_MS);
    await h.drainer.tick(); // first notice
    expect(h.aggregated.filter((a) => a.kind === 'pressure-held')).toHaveLength(1);

    // Pressure eases: warm calm so the gate fully clears and the entry resumes (re-arms the flag).
    h.setTier('normal');
    await warmCalm(h, 3); // calm satisfied → resume → pressureHeldNotified reset
    expect(h.respawns).toHaveLength(1);

    // A NEW held entry under a fresh pressure episode notifies again.
    h.setTier('moderate');
    h.queue.considerEnqueue(candidate({ tmuxSession: 'tmux-2', resumeUuid: '22222222-2222-4222-8222-222222222222' }));
    h.advance(NOTICE_MS);
    await h.drainer.tick();
    expect(h.aggregated.filter((a) => a.kind === 'pressure-held')).toHaveLength(2);
  });
});
