/**
 * Clean-worktree reclamation (carryover row 86) — the safety-critical classifier for reclaiming
 * stale checkouts. THE hard requirement under test: NEVER delete unmerged, dirty, in-use or fresh
 * work. A worktree is reap-eligible ONLY when unused AND quiet AND on a branch AND clean AND merged;
 * any single failing or unreadable gate ⇒ KEEP. Also covers dry-run (classify, never delete), the
 * blast-radius cap, the per-path breaker, the action-time recheck, fail-visible enumeration, the
 * one-time initial pass, the merged-detection helpers, and the installed path against real git.
 * Ported from Instar 1.x f3f94826 tests/unit/agent-worktree-reaper.test.ts.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createWorktreeReaper, classifyPorcelain, summarizeEnumerationError, MAX_ENUMERATION_ERROR_CHARS,
  REAPER_RESIDUE_DENYLIST, processCensusGap, type ReaperObservation, type ReaperWorktree, type ReaperInventory,
  type WorktreeReaperPorts, type WorktreeReaperConfig } from '../../src/assembly/worktree-reaper.js';
import { decodeProcessInventory, type InventoryProcess } from '../../src/assembly/process-inventory.js';
// @ts-expect-error Physical adapter is JavaScript.
import { createEnumerationFailureStore, createWorktreeReaperAdapter, isBranchMerged, isNonForcedWorktreeRemove, parseMergedPullRequestHeads, resolveBaseRef, worktreeRemoveArgs } from '../../scripts/worktree-reaper-git.mjs';
// @ts-expect-error Physical adapter is JavaScript.
import { parseWorktreeList } from '../../scripts/worktree-inventory.mjs';

const NOW = 10_000;
const activity = { coveredFrom: 0, coveredThrough: NOW, lastActivity: 1000 };
const captured = readFileSync(new URL('./fixtures/worktree-list-2026-10-15.bin', import.meta.url), 'utf8');

function wt(over: Partial<ReaperWorktree> = {}): ReaperWorktree {
  return { path: '/wt/a', branch: 'echo/feature', head: 'abc', changes: [], locked: false, buildMarker: false, owner: 'absent', activity, ...over };
}
const inventory = (worktrees: readonly ReaperWorktree[], over: Partial<ReaperInventory> = {}): ReaperInventory =>
  ({ machine: 'm', sourceTime: NOW, freshForMs: 100, status: 'complete', error: null, worktrees, ...over });
const proc = (over: Partial<InventoryProcess> = {}): InventoryProcess => ({ pid: 100, ppid: 1, pgid: 100, uid: 501,
  start: 'Thu Oct 15 17:00:00 2026', command: 'worker', zombie: false, cwd: { state: 'observed', path: '/work/neighbor' },
  resource: { state: 'reported', sourceSample: 'inventory:1', cumulativeCpuMs: 0, rssBytes: 1, heap: 'unsupported' }, ...over });
const processes = (rows: InventoryProcess[] = [proc()], over: Record<string, unknown> = {}) => decodeProcessInventory({
  type: 'ProcessInventory', schemaVersion: 1, id: 'inventory:1', machine: 'm', hardwareProfile: 'h', adapter: 'a', adapterDigest: 'd',
  sourceTime: NOW, monotonicAt: 10, freshForMs: 100, cpuBasis: 'process-cpu-time', status: 'complete', examined: rows.length, omitted: 0,
  processes: rows, ...over });
const observation = (worktrees: readonly ReaperWorktree[] = [wt()], over: Partial<ReaperObservation> = {}): ReaperObservation =>
  ({ worktrees: inventory(worktrees), processes: processes(), ownership: () => new Map([[100, 'non-owner']]), ...over });

/** Ports where every gate is "reapable" by default; tests flip one at a time. */
function ports(over: Partial<WorktreeReaperPorts> = {}, obs: () => ReaperObservation = () => observation()): WorktreeReaperPorts {
  return { observe: async () => obs(), merged: async () => true, recheck: async () => obs(), remove: vi.fn(async () => ({ removed: true as const })),
    now: () => NOW, stopped: () => false, ...over };
}
const config = (over: Partial<WorktreeReaperConfig> = {}): Partial<WorktreeReaperConfig> => ({ enabled: true, dryRun: true, quietMs: 5000, ...over });

describe('evaluate — never reap unsafe worktrees', () => {
  const reap = (p: Partial<WorktreeReaperPorts>, info = wt(), obs = observation([info])) =>
    createWorktreeReaper(ports(p, () => obs), config()).evaluate(info, obs);

  it('reap-eligible only when unused AND quiet AND on a branch AND clean AND merged', async () => {
    expect(await reap({})).toEqual({ path: '/wt/a', branch: 'echo/feature', verdict: 'reap-eligible', reason: 'merged-clean-idle' });
  });
  it.each([
    ['live owner', wt({ owner: 'live' }), 'in-use'],
    ['unknown owner', wt({ owner: 'unknown' }), 'owner-unknown'],
    ['session or index lock', wt({ locked: true }), 'in-use'],
    ['unreadable lock', wt({ locked: null }), 'lock-unreadable'],
    ['build marker', wt({ buildMarker: true }), 'build-active-marker'],
    ['unreadable marker', wt({ buildMarker: null }), 'marker-unreadable'],
    ['detached HEAD', wt({ branch: null }), 'detached-or-unknown-branch'],
    ['unknown head', wt({ head: '' }), 'unknown-head'],
    ['tracked modification', wt({ changes: [' M src/core/x.ts'] }), 'uncommitted-changes'],
    ['hand-authored untracked source', wt({ changes: ['?? src/newThing.ts'] }), 'uncommitted-changes'],
    ['unreadable status', wt({ changes: null }), 'status-unreadable'],
    ['recent activity (fresh)', wt({ activity: { ...activity, lastActivity: 9000 } }), 'fresh'],
    ['missing activity', wt({ activity: null }), 'activity-unknown'],
    ['activity coverage starting inside the quiet window', wt({ activity: { ...activity, coveredFrom: 6000 } }), 'activity-unknown'],
    ['activity coverage ending before the census', wt({ activity: { ...activity, coveredThrough: 9999 } }), 'activity-unknown'],
    ['noncanonical path', wt({ path: '/wt/../wt/a' }), 'noncanonical-path'],
  ])('KEEPs %s', async (_name, info, reason) => {
    expect(await reap({}, info)).toMatchObject({ verdict: 'keep', reason });
  });
  it('tells residue-only droppings (the Spotlight marker was the dominant blocker) apart from work, and still keeps them', async () => {
    // Non-forced `git worktree remove` refuses any untracked file, so this path cannot reclaim them; the
    // distinct reason keeps the count honest instead of reporting them reclaimable and then refusing.
    expect(await reap({}, wt({ changes: ['?? .metadata_never_index'] }))).toMatchObject({ verdict: 'keep', reason: 'residue-only' });
    expect(await reap({}, wt({ changes: ['?? dist/', '?? node_modules/', '?? .instar/instar-dev-traces/run.json'] }))).toMatchObject({ verdict: 'keep', reason: 'residue-only' });
  });
  it('KEEPs an unmerged worktree and an undeterminable merge', async () => {
    expect(await reap({ merged: async () => false })).toMatchObject({ verdict: 'keep', reason: 'unmerged' });
    expect(await reap({ merged: async () => null })).toMatchObject({ verdict: 'keep', reason: 'merge-unknown' });
  });
  it('KEEPs a checkout a live process works in, or whose candidate ownership is not resolved', async () => {
    for (const path of ['/wt/a', '/wt/a/sub'])
      expect(await reap({}, wt(), observation([wt()], { processes: processes([proc({ cwd: { state: 'observed', path } })]) })))
        .toMatchObject({ reason: 'in-use' });
    for (const ownership of [() => new Map([[100, 'owner' as const]]), () => new Map([[100, 'unknown' as const]]), () => new Map()])
      expect(await reap({}, wt(), observation([wt()], { ownership }))).toMatchObject({ reason: 'owner-unknown' });
    const neighbor = observation([wt(), wt({ path: '/work/neighbor', owner: 'live' })],
      { ownership: checkout => new Map([[100, checkout === '/work/neighbor' ? 'owner' : 'non-owner']]) });
    expect((await reap({}, wt(), neighbor)).verdict).toBe('reap-eligible');
  });
  it.each([
    ['incomplete', processes([proc()], { status: 'partial', omitted: 1 }), 'process-census-incomplete'],
    ['failed', processes([], { status: 'failed', omitted: null, examined: 0 }), 'process-census-incomplete'],
    ['foreign', processes([proc()], { machine: 'other' }), 'process-census-foreign'],
    ['stale', processes([proc()], { sourceTime: NOW - 101 }), 'process-census-stale'],
    ['unknown-cwd', processes([proc({ cwd: { state: 'unavailable' } })]), 'process-cwd-unknown'],
  ])('KEEPs every checkout on a %s process census', async (_name, census, reason) => {
    expect(await reap({}, wt(), observation([wt()], { processes: census }))).toMatchObject({ verdict: 'keep', reason });
    expect(processCensusGap(census, 'm', NOW)).toBe(reason);
  });
  it('does NOT call merged (a git op) for a dirty or in-use worktree (cheap gates first)', async () => {
    const merged = vi.fn(async () => true);
    await reap({ merged }, wt({ changes: [' M x'] }));
    await reap({ merged }, wt({ owner: 'live' }));
    expect(merged).not.toHaveBeenCalled();
  });
});

describe('reap — dry-run + blast radius', () => {
  it('dry-run classifies reap-eligible but NEVER deletes', async () => {
    const p = ports();
    const res = await createWorktreeReaper(p, config()).reap();
    expect(res.dryRun).toBe(true);
    expect(res.evaluations[0]!.verdict).toBe('reap-eligible');
    expect(res.reaped).toEqual([]);
    expect(p.remove).not.toHaveBeenCalled();
  });
  it('disabled never deletes either', async () => {
    const p = ports();
    const res = await createWorktreeReaper(p, config({ enabled: false, dryRun: false })).reap();
    expect(res.dryRun).toBe(true); expect(res.reaped).toEqual([]); expect(p.remove).not.toHaveBeenCalled();
  });
  it('live mode reaps eligible worktrees up to maxReapsPerPass', async () => {
    const many = Array.from({ length: 5 }, (_, i) => wt({ path: `/wt/${i}`, head: `s${i}` }));
    const p = ports({}, () => observation(many));
    const res = await createWorktreeReaper(p, config({ dryRun: false, maxReapsPerPass: 2 })).reap();
    expect(res.dryRun).toBe(false);
    expect(res.reaped).toHaveLength(2); // capped
    expect(p.remove).toHaveBeenCalledTimes(2);
  });
  it('a stop before observation or between candidates ends the pass without a removal', async () => {
    let stopped = true, observed = 0;
    const p = ports({ stopped: () => stopped, observe: async () => { observed++; return observation([wt(), wt({ path: '/wt/b' })]); } });
    expect((await createWorktreeReaper(p, config({ dryRun: false })).reap()).evaluations).toEqual([]);
    expect(observed).toBe(0);
    stopped = false;
    p.recheck = async () => { stopped = true; return observation([wt(), wt({ path: '/wt/b' })]); };
    const res = await createWorktreeReaper(p, config({ dryRun: false })).reap();
    expect(res.reaped).toEqual([]); expect(p.remove).not.toHaveBeenCalled(); expect(res.evaluations).toHaveLength(1);
  });
  it('an undefined option keeps its default instead of erasing it', () => {
    const r = createWorktreeReaper(ports(), { enabled: true, reapIntervalMs: undefined, maxReapsPerPass: undefined } as unknown as Partial<WorktreeReaperConfig>);
    expect(r.config.reapIntervalMs).toBe(24 * 3600 * 1000); expect(r.config.maxReapsPerPass).toBe(20);
  });
});

describe('reap — exec-time re-validation closes the enumerate→reclaim race', () => {
  const live = (p: Partial<WorktreeReaperPorts>) => createWorktreeReaper(ports(p), config({ dryRun: false }));
  it.each([
    ['branch changed since eval (builder checked out a new unmerged branch)', wt({ branch: 'echo/dashboard-f5f8' }), 'raced-changed-since-eval'],
    ['head changed since eval', wt({ head: 'def' }), 'raced-changed-since-eval'],
    ['went dirty', wt({ changes: [' M src/x.ts'] }), 'raced-now-dirty'],
    ['gained residue', wt({ changes: ['?? .metadata_never_index'] }), 'raced-now-dirty'],
    ['became in-use (lock)', wt({ locked: true }), 'raced-now-in-use'],
    ['became in-use (owner)', wt({ owner: 'live' }), 'raced-now-in-use'],
    ['an .instar-build-active marker appeared', wt({ buildMarker: true }), 'raced-build-active-marker'],
    ['became fresh', wt({ activity: { ...activity, lastActivity: 9999 } }), 'raced-now-fresh'],
    ['is now detached', wt({ branch: null }), 'raced-changed-since-eval'],
  ])('%s → KEEP, not reaped', async (_name, fresh, reason) => {
    const p = { recheck: async () => observation([fresh]) };
    const res = await live(p).reap();
    expect(ports().remove).not.toHaveBeenCalled();
    expect(res.reaped).toEqual([]);
    expect(res.evaluations[0]).toMatchObject({ verdict: 'keep', reason });
    expect(res.raced).toEqual([{ path: '/wt/a', reason, evaluatedBranch: 'echo/feature' }]);
  });
  it.each([[9000, 1, false], [9900, 100, true], [9900, 99, false], [10001, 100, false]])(
    'recheck inventory at %i with lifetime %i permits removal: %s', async (sourceTime, freshForMs, allowed) => {
      const remove = vi.fn(async () => ({ removed: true as const }));
      const current = observation([wt({ activity: { ...activity, coveredThrough: sourceTime } })],
        { worktrees: inventory([wt({ activity: { ...activity, coveredThrough: sourceTime } })], { sourceTime, freshForMs }) });
      const result = await live({ remove, recheck: async () => current }).reap();
      expect(remove).toHaveBeenCalledTimes(allowed ? 1 : 0);
      expect(result.raced).toHaveLength(allowed ? 0 : 1);
      if (!allowed) expect(result.evaluations[0]!.reason).toBe('reclaim-recheck-error');
    });
  it.each([
    ['checkout expires during merge', 100, 1000, 10101, false],
    ['process census expires during merge', 1000, 100, 10101, false],
    ['both remain valid at inclusive expiry', 100, 100, 10100, true],
  ] as const)('%s', async (_name, checkoutLife, processLife, afterMerge, allowed) => {
    let now = NOW;
    let mergeCalls = 0;
    const remove = vi.fn(async () => ({ removed: true as const }));
    const current = observation([wt()], {
      worktrees: inventory([wt()], { freshForMs: checkoutLife }),
      processes: processes([proc()], { freshForMs: processLife }),
    });
    const result = await live({
      now: () => now,
      remove,
      recheck: async () => current,
      merged: async () => {
        if (++mergeCalls === 2) now = afterMerge;
        return true;
      },
    }).reap();
    expect(mergeCalls).toBe(2);
    expect(remove).toHaveBeenCalledTimes(allowed ? 1 : 0);
    expect(result.reaped).toEqual(allowed ? ['/wt/a'] : []);
    expect(result.raced).toEqual(allowed ? [] : [{
      path: '/wt/a', reason: 'reclaim-recheck-error', evaluatedBranch: 'echo/feature',
    }]);
    expect(result.evaluations[0]).toMatchObject(allowed
      ? { verdict: 'reap-eligible', reason: 'merged-clean-idle' }
      : { verdict: 'keep', reason: 'reclaim-recheck-error' });
  });
  it('main moved and un-merged it at recheck → KEEP', async () => {
    let calls = 0;
    const res = await live({ merged: async () => ++calls === 1 }).reap();
    expect(res.evaluations[0]!.reason).toBe('raced-now-unmerged');
  });
  it('fail-closed: an unreadable or vanished checkout at recheck → KEEP, never reap on uncertain state', async () => {
    const remove = vi.fn(async () => ({ removed: true as const }));
    for (const recheck of [async () => null, async () => observation([]), async () => { throw new Error('boom'); }])
      expect((await live({ remove, recheck }).reap()).evaluations[0]!.reason).toBe('reclaim-recheck-error');
    expect(remove).not.toHaveBeenCalled();
  });
  it('genuinely still merged-clean-idle-unchanged at recheck → REAPS (unchanged happy path)', async () => {
    const remove = vi.fn(async () => ({ removed: true as const }));
    const res = await live({ remove }).reap();
    expect(remove).toHaveBeenCalledWith('/wt/a');
    expect(res.reaped).toEqual(['/wt/a']);
    expect(res.evaluations[0]!.verdict).toBe('reap-eligible');
  });
  it('snapshot reports the reclaimable count without side effects', async () => {
    const p = ports();
    const snap = await createWorktreeReaper(p, config()).snapshot();
    expect(snap.reclaimable).toBe(1); expect(snap.dryRun).toBe(true);
    expect(p.remove).not.toHaveBeenCalled();
  });
});

describe('due — one-time initial pass (reaper-never-fires fix)', () => {
  // Root cause under test: the first pass used to be a full 24h after boot, and real servers
  // restart more often than daily — so an enabled+armed reaper never ran a single pass
  // (2026-07-02 incident: 86 worktrees / 25GB accumulated with the feature ON).
  const DELAY = 15 * 60 * 1000, DAY = 24 * 3600 * 1000;
  it('is due ONCE after initialPassDelayMs, before the 24h interval, then on the cadence', async () => {
    // The caller's cycle reads the same clock port the pass reads; a pass settles whichever kind was due.
    let now = 0;
    const r = createWorktreeReaper(ports({ now: () => now }, () => ({ ...observation(), worktrees: inventory([wt()], { sourceTime: 0, freshForMs: 3 * DAY }) })),
      config({ initialPassDelayMs: DELAY }));
    expect(r.due(DELAY)).toBeNull(); // not activated
    r.activate(0);
    expect(r.due(DELAY - 1)).toBeNull();
    now = DELAY;
    expect(r.due(now)).toBe('initial');
    expect((await r.snapshot()).initialPassPending).toBe(true);
    expect((await r.reap()).enumerationOk).toBe(true);
    expect((await r.snapshot()).initialPassPending).toBe(false);
    expect(r.due(now)).toBeNull(); // exactly one initial pass
    expect(r.due(DAY - 1)).toBeNull();
    now = DAY;
    expect(r.due(now)).toBe('interval');
    await r.reap();
    expect(r.due(now)).toBeNull();
    expect(r.due(2 * DAY)).toBe('interval');
  });
  it('is never due when the reaper is disabled', () => {
    const r = createWorktreeReaper(ports(), config({ enabled: false }));
    r.activate(0);
    expect(r.due(25 * 3600 * 1000)).toBeNull();
  });
  it('initialPassDelayMs <= 0 disables the initial pass (interval-only rollback lever)', () => {
    const r = createWorktreeReaper(ports(), config({ reapIntervalMs: 1000, initialPassDelayMs: 0 }));
    r.activate(0);
    expect(r.due(999)).toBeNull();
    expect(r.due(1000)).toBe('interval');
  });
  it('deactivate cancels the pending initial pass', () => {
    const r = createWorktreeReaper(ports(), config({ initialPassDelayMs: DELAY }));
    r.activate(0); r.deactivate();
    expect(r.due(DELAY * 2)).toBeNull();
  });
});

describe('per-path reclaim-failure breaker (Rule 55)', () => {
  it('stops attempting a path after the failure cap, surfaces keep(reclaim-failed), trips once', async () => {
    const remove = vi.fn(async () => ({ removed: false as const, reason: 'cannot remove (permission)' }));
    const r = createWorktreeReaper(ports({ remove }), config({ dryRun: false, maxReclaimFailuresPerPath: 2 }));
    const p1 = await r.reap(); const p2 = await r.reap(); const p3 = await r.reap();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(p1.evaluations[0]!.verdict).toBe('reap-eligible');
    expect(p1.refused).toEqual([{ path: '/wt/a', reason: 'cannot remove (permission)' }]);
    expect(p2.breakerTripped).toEqual([{ path: '/wt/a', failures: 2 }]);
    expect(p3.evaluations[0]).toMatchObject({ verdict: 'keep', reason: 'reclaim-failed' });
    expect(p3.breakerTripped).toEqual([]);
  });
  it('a successful removal clears the breaker count; a thrown removal is a refusal, not a crash', async () => {
    let calls = 0;
    const remove = vi.fn(async () => { if (++calls === 1) throw new Error('transient'); return { removed: true as const }; });
    const r = createWorktreeReaper(ports({ remove }), config({ dryRun: false, maxReclaimFailuresPerPath: 2 }));
    expect((await r.reap()).refused[0]!.reason).toBe('transient');
    expect((await r.reap()).reaped).toEqual(['/wt/a']);
    expect((await r.reap()).reaped).toEqual(['/wt/a']);
  });
});

describe('enumeration failure is visible, not a clean zero', () => {
  const failing = (over: Partial<ReaperInventory>) => ports({}, () => ({ ...observation(), worktrees: inventory([], over) }));
  it('snapshot reports reclaimable:null and enumerationOk:false on a failed enumeration', async () => {
    const snap = await createWorktreeReaper(failing({ status: 'failed', error: "fatal: cannot change to '/nope'" }), config()).snapshot();
    expect(snap.reclaimable).toBeNull(); // NOT zero. Zero is a measurement; this is an absence.
    expect(snap.enumerationOk).toBe(false);
    expect(snap.enumerationError).toContain('cannot change to');
    expect(snap.worktrees).toEqual([]);
  });
  it('a healthy enumeration still reports a real number and enumerationOk:true', async () => {
    const snap = await createWorktreeReaper(ports(), config()).snapshot();
    expect(snap.enumerationOk).toBe(true); expect(snap.enumerationError).toBeNull(); expect(snap.reclaimable).toBe(1);
  });
  it.each([
    ['partial', { status: 'partial' as const, error: 'worktree census truncated at 1' }],
    ['stale', { sourceTime: NOW - 101 }],
    ['repeated path', { worktrees: [wt(), wt()] }],
  ])('a %s enumeration reaps nothing and is reported as not ok', async (_name, over) => {
    const p = failing(over);
    const res = await createWorktreeReaper(p, config({ dryRun: false })).reap();
    expect(res.enumerationOk).toBe(false); expect(res.reaped).toEqual([]); expect(p.remove).not.toHaveBeenCalled();
  });
  it('a thrown observation does not crash and leaves a passive trace naming UNKNOWN rather than zero', async () => {
    const lines: string[] = [];
    const r = createWorktreeReaper(ports({ observe: async () => { throw new Error('fatal: cannot change to /nope'); }, trace: l => lines.push(l) }), config());
    const res = await r.reap();
    expect(res.enumerationOk).toBe(false); expect(res.evaluations).toEqual([]);
    expect(lines).toHaveLength(1); expect(lines[0]).toMatch(/enumeration FAILED/); expect(lines[0]).toMatch(/UNKNOWN, not zero/);
    expect((await r.snapshot()).reclaimable).toBeNull();
  });
  it('does NOT trace on a healthy pass', async () => {
    const lines: string[] = [];
    await createWorktreeReaper(ports({ trace: l => lines.push(l) }), config()).reap();
    expect(lines).toEqual([]);
  });
  it('counts failed reap passes, not snapshot reads, and publishes a live unknown verdict until recovery', async () => {
    let fail = true, now = NOW;
    const r = createWorktreeReaper(ports({ now: () => now, observe: async () => fail
      ? { ...observation(), worktrees: inventory([], { status: 'failed', error: 'fatal: cannot enumerate' }) } : observation([]) }), config({ dryRun: false }));
    await r.snapshot(); await r.snapshot();
    expect((await r.snapshot()).enumerationFailures).toBe(0);
    expect(r.guardStatus()).toEqual({ enabled: true, dryRun: false, lastTickAt: 0 });
    await r.reap(); await r.reap();
    const snap = await r.snapshot();
    expect(snap.enumerationFailures).toBe(2); expect(snap.lastEnumerationFailureAt).toBe(NOW);
    expect(r.guardStatus()).toMatchObject({ lastTickAt: NOW, verdictUnknown: true, verdictUnknownReason: 'fatal: cannot enumerate' });
    fail = false; now++;
    await r.reap();
    expect(r.guardStatus()).toEqual({ enabled: true, dryRun: false, lastTickAt: NOW + 1 });
    expect((await r.snapshot()).enumerationFailures).toBe(2);
  });
  it('reloads historical failure count/time without restoring a stale live blind verdict, and persists new failures', async () => {
    const history = { enumerationFailures: 7, lastEnumerationFailureAt: NOW - 5 };
    const recordFailure = vi.fn((at: number) => ({ enumerationFailures: 8, lastEnumerationFailureAt: at }));
    const r = createWorktreeReaper(failing({ status: 'failed', error: 'x' }), config({ dryRun: false }));
    const withHistory = createWorktreeReaper({ ...failing({ status: 'failed', error: 'x' }), failureHistory: { load: () => history, recordFailure } }, config({ dryRun: false }));
    expect(await withHistory.snapshot()).toMatchObject(history);
    expect(withHistory.guardStatus()).toEqual({ enabled: true, dryRun: false, lastTickAt: 0 });
    await withHistory.reap();
    expect(recordFailure).toHaveBeenCalledWith(NOW);
    expect((await withHistory.snapshot()).enumerationFailures).toBe(8);
    expect((await r.snapshot()).enumerationFailures).toBe(0);
  });
});

describe('enumeration failure store — only count/time survive restart', () => {
  const store = (text: string | null, write: (t: string) => void = () => {}) => createEnumerationFailureStore({ read: () => text, write });
  it('starts empty, records failures through the write port, and reloads exactly what was written', () => {
    let written: string | null = null;
    const guard = store(null, t => { written = t; }).forGuard('worktree-reaper');
    expect(guard.load()).toEqual({ enumerationFailures: 0, lastEnumerationFailureAt: null });
    expect(guard.recordFailure(NOW)).toEqual({ enumerationFailures: 1, lastEnumerationFailureAt: NOW });
    expect(guard.recordFailure(NOW + 1)).toEqual({ enumerationFailures: 2, lastEnumerationFailureAt: NOW + 1 });
    expect(store(written).forGuard('worktree-reaper').load()).toEqual({ enumerationFailures: 2, lastEnumerationFailureAt: NOW + 1 });
    expect(store(written).forGuard('orphaned-work-sentinel').load()).toEqual({ enumerationFailures: 0, lastEnumerationFailureAt: null });
    const reaper = createWorktreeReaper({ ...ports(), failureHistory: store(written).forGuard('worktree-reaper') }, config());
    expect(reaper.guardStatus()).toEqual({ enabled: true, dryRun: true, lastTickAt: 0 }); // history is not a live verdict
  });
  it('a failed write keeps the previous history; malformed, oversized or foreign ledgers throw instead of resetting', () => {
    const guard = store(null, () => { throw new Error('disk full'); }).forGuard('worktree-reaper');
    expect(() => guard.recordFailure(NOW)).toThrow('disk full');
    expect(guard.load()).toEqual({ enumerationFailures: 0, lastEnumerationFailureAt: null });
    expect(() => guard.recordFailure(-1)).toThrow('invalid-worktree-enumeration-failure-time');
    expect(() => store('{"version":2,"guards":{}}').forGuard('worktree-reaper').load()).toThrow('invalid-worktree-enumeration-failure-ledger');
    expect(() => store('{"version":1,"guards":{"other":{"enumerationFailures":1,"lastEnumerationFailureAt":1}}}').forGuard('worktree-reaper').load()).toThrow('record');
    expect(() => store('{"version":1,"guards":{"worktree-reaper":{"enumerationFailures":-1,"lastEnumerationFailureAt":null}}}').forGuard('worktree-reaper').load()).toThrow('record');
    expect(() => store(' '.repeat(16_385)).forGuard('worktree-reaper').load()).toThrow('too-large');
    expect(() => store(null).forGuard('session-reaper')).toThrow('unknown-worktree-enumeration-guard');
  });
});

describe('classifyPorcelain — residue-aware, narrow denylist', () => {
  const dirty = (porcelain: string) => classifyPorcelain(porcelain, REAPER_RESIDUE_DENYLIST);
  it('CLEAN on the instar Spotlight marker, narrow residue and an empty worktree', () => {
    expect(dirty('?? .metadata_never_index\n')).toBe(false);
    expect(dirty('?? dist/\n?? node_modules/\n?? .instar/instar-dev-traces/run.json\n?? a.tsbuildinfo\n')).toBe(false);
    expect(dirty('')).toBe(false);
  });
  it('DIRTY on a tracked modification, a hand-authored untracked file, a rename and a quoted path', () => {
    expect(dirty(' M src/core/x.ts\n')).toBe(true);
    expect(dirty('?? src/newThing.ts\n')).toBe(true);
    expect(dirty('R  dist/old.js -> src/new.ts\n')).toBe(true);
    expect(dirty('?? "src/with space.ts"\n')).toBe(true);
  });
  it('DIRTY (KEEP) on broad entries the reaper denylist DELIBERATELY excludes (build/, *.log, out/, coverage/)', () => {
    for (const line of ['?? build/deploy.md\n', '?? analysis.log\n', '?? out/report.txt\n', '?? coverage/index.html\n']) expect(dirty(line)).toBe(true);
  });
  it('REAPER_RESIDUE_DENYLIST is narrow — excludes the broad user-authorable entries', () => {
    expect(REAPER_RESIDUE_DENYLIST).toContain('.metadata_never_index');
    for (const broad of ['out/', 'build/', '*.log', 'coverage/']) expect(REAPER_RESIDUE_DENYLIST).not.toContain(broad);
  });
});

describe('summarizeEnumerationError — bounded, single-line, control-char-free', () => {
  const ESC = '\u001B';
  it('strips control characters, not just whitespace', () => {
    const out = summarizeEnumerationError(new Error(`fatal: bad ${ESC}[31mred${ESC}[0m path`));
    expect(out).not.toContain(ESC); expect(out).toContain('fatal: bad');
  });
  it('collapses newlines, clamps with an ellipsis, and handles a non-Error throw', () => {
    expect(summarizeEnumerationError(new Error('line one\nline two'))).toBe('line one line two');
    const out = summarizeEnumerationError(new Error('x'.repeat(1000)));
    expect(out.length).toBe(MAX_ENUMERATION_ERROR_CHARS); expect(out.endsWith('…')).toBe(true);
    expect(summarizeEnumerationError('plain string')).toBe('plain string');
  });
});

describe('adapter helpers — merged detection is conservative, never false-positive', () => {
  const fakeGit = (cherryOut: string | null) => async (_file: string, args: string[]) => {
    if (args.includes('cherry')) { if (cherryOut === null) throw new Error('no such ref'); return cherryOut; }
    throw new Error('unexpected git call');
  };
  it('isBranchMerged: empty cherry ⇒ merged; all "-" ⇒ merged; any "+" ⇒ not; unreadable ⇒ null (KEEP)', async () => {
    expect(await isBranchMerged(fakeGit(''), '/repo', 'main', 'sha')).toBe(true);
    expect(await isBranchMerged(fakeGit('- aaa\n- bbb'), '/repo', 'main', 'sha')).toBe(true);
    expect(await isBranchMerged(fakeGit('- aaa\n+ ccc'), '/repo', 'main', 'sha')).toBe(false);
    expect(await isBranchMerged(fakeGit(null), '/repo', 'main', 'sha')).toBeNull();
  });
  it('resolveBaseRef prefers the first ref that resolves and is null when none do', async () => {
    const q = async (_f: string, args: string[]) => args.at(-1) === 'refs/remotes/JKHeadley/main' ? 'abc\n' : null;
    expect(await resolveBaseRef(q, '/repo')).toBe('JKHeadley/main');
    expect(await resolveBaseRef(async () => null, '/repo')).toBeNull();
    expect(await resolveBaseRef(async () => { throw new Error('no'); }, '/repo')).toBeNull();
  });
  it('parseMergedPullRequestHeads: newest entry per reused branch wins; malformed or missing ⇒ empty (KEEP)', () => {
    const m = parseMergedPullRequestHeads(JSON.stringify([{ headRefName: 'echo/reused', headRefOid: 'newest' },
      { headRefName: 'echo/reused', headRefOid: 'older' }, { headRefName: 'ok', headRefOid: 'oidOk' },
      { headRefName: '', headRefOid: 'x' }, { headRefOid: 'noName' }, { headRefName: 'noOid' }, null].map(row => row && ({ ...row, baseRefName: 'main' }))), 'main');
    expect([...m]).toEqual([['echo/reused', 'newest'], ['ok', 'oidOk']]);
    expect(parseMergedPullRequestHeads(JSON.stringify([{ headRefName: 'x', headRefOid: 'oid' }]), 'main').size).toBe(0);
    expect(parseMergedPullRequestHeads(JSON.stringify([{ headRefName: 'x', headRefOid: 'oid', baseRefName: 'staging' }]), 'main').size).toBe(0);
    expect(parseMergedPullRequestHeads(null).size).toBe(0);
    expect(parseMergedPullRequestHeads('not json').size).toBe(0);
    expect(parseMergedPullRequestHeads('{"a":1}').size).toBe(0);
  });
  it('only the non-forced `git worktree remove` shape may run', () => {
    expect(isNonForcedWorktreeRemove(worktreeRemoveArgs('/repo', '/repo/.worktrees/a'))).toBe(true);
    for (const force of ['--force', '--force=1', '-f', '-fxyz'])
      expect(isNonForcedWorktreeRemove(['-C', '/repo', 'worktree', 'remove', force, '/x'])).toBe(false);
    expect(isNonForcedWorktreeRemove(['-C', '/repo', 'worktree', 'prune'])).toBe(false);
    expect(isNonForcedWorktreeRemove(['-C', '/repo', 'branch', '-D', 'x'])).toBe(false);
  });
  describe('merged — multi-commit squash via the merged-PR map', () => {
    // rev-parse resolves a base; cherry reports UNMERGED (a "+" commit): the multi-commit-squash blind spot.
    const cherryUnmergedGit = async (_file: string, args: string[]) => {
      if (args.includes('rev-parse')) return 'abc\n';
      if (args.includes('cherry')) return '+ aaa\n+ bbb';
      throw new Error('unexpected git call: ' + args.join(' '));
    };
    const adapter = (heads: Map<string, string>, githubMergeCheck = true, mergedHeads = vi.fn(async () => JSON.stringify([...heads].map(([headRefName, headRefOid]) => ({ headRefName, headRefOid, baseRefName: 'main' }))))) => ({
      mergedHeads, adapter: createWorktreeReaperAdapter({ repository: '/repo', worktreesDir: '/repo/.worktrees', machine: 'm', freshForMs: 100,
        now: () => NOW, limit: 10, query: async (file: string, args: string[]) => file === 'gh' ? mergedHeads() : args.includes('get-url') ? 'git@github.com:owner/repo.git' : cherryUnmergedGit(file, args), mutate: async () => ({ ok: false, detail: 'unused' }), exists: async () => false,
        observe: async () => null, census: async () => processes([]), ownership: () => new Map(), githubMergeCheck }) });
    const info = (branch: string, head: string) => wt({ branch, head });
    it('MERGED when cherry says unmerged but a merged PR head-OID matches exactly', async () => {
      expect(await adapter(new Map([['echo/feat', 'SQUASHED_OID']])).adapter.merged(info('echo/feat', 'SQUASHED_OID'))).toBe(true);
    });
    it('KEEP when the branch advanced past the merged PR, when no merged PR exists, or when detached', async () => {
      expect(await adapter(new Map([['echo/feat', 'MERGED_OID']])).adapter.merged(info('echo/feat', 'NEWER_OID_WITH_UNMERGED_WORK'))).toBe(false);
      expect(await adapter(new Map()).adapter.merged(info('echo/feat', 'anySha'))).toBe(false);
      expect(await adapter(new Map([['echo/feat', 'X']])).adapter.merged(wt({ branch: null, head: 'X' }))).toBe(false);
    });
    it('KEEP (cherry-only) when githubMergeCheck is disabled — never queries the forge; one query per sweep otherwise', async () => {
      const off = adapter(new Map([['echo/feat', 'SQUASHED_OID']]), false);
      expect(await off.adapter.merged(info('echo/feat', 'SQUASHED_OID'))).toBe(false);
      expect(off.mergedHeads).not.toHaveBeenCalled();
      const on = adapter(new Map([['echo/feat', 'SQUASHED_OID']]));
      await on.adapter.merged(info('echo/feat', 'SQUASHED_OID')); await on.adapter.merged(info('echo/other', 'y'));
      expect(on.mergedHeads).toHaveBeenCalledTimes(1);
    });
    it('binds the upstream repository and invalidates cached evidence when its destination changes', async () => {
      let url = 'https://github.com/owner/upstream.git';
      const forge = vi.fn(async () => JSON.stringify([{ headRefName: 'feature', headRefOid: 'oid', baseRefName: 'main' }]));
      const q = async (file: string, args: string[]) => {
        if (file === 'gh') { expect(args[args.indexOf('--repo') + 1]).toBe(url === 'https://github.com/owner/upstream.git' ? 'github.com/owner/upstream' : 'github.com/owner/other'); return forge(); }
        if (args.includes('get-url')) { expect(args.at(-1)).toBe('JKHeadley'); return url; }
        return cherryUnmergedGit(file, args);
      };
      const a = createWorktreeReaperAdapter({ repository: '/repo', query: q, now: () => NOW });
      expect(await a.merged(info('feature', 'oid'))).toBe(true);
      expect(await a.merged(info('feature', 'oid'))).toBe(true);
      expect(forge).toHaveBeenCalledTimes(1);
      url = 'git@github.com:owner/other.git';
      expect(await a.merged(info('feature', 'oid'))).toBe(true);
      expect(forge).toHaveBeenCalledTimes(2);
      url = '/local/repository';
      expect(await a.merged(info('feature', 'oid'))).toBe(false);
      expect(forge).toHaveBeenCalledTimes(2);
    });
    it('null (KEEP) when no base ref resolves or the head is unknown', async () => {
      const a = createWorktreeReaperAdapter({ repository: '/repo', worktreesDir: '/repo/.worktrees', machine: 'm', freshForMs: 100, now: () => NOW,
        limit: 10, query: async () => null, mutate: async () => ({ ok: false }), exists: async () => false, observe: async () => null,
        census: async () => processes([]), ownership: () => new Map() });
      expect(await a.merged(info('echo/feat', 'abc'))).toBeNull();
    });
  });
});

describe('physical census', () => {
  it('replays captured git worktree list bytes with branch names, and keeps the sibling census shape', async () => {
    const rows = parseWorktreeList(captured) as { path: string; head: string; branch: string | null }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => row.branch === null || (typeof row.branch === 'string' && !row.branch.startsWith('refs/')))).toBe(true);
    expect(rows.some(row => typeof row.branch === 'string')).toBe(true);
    expect(parseWorktreeList('worktree /x\0HEAD ' + 'a'.repeat(40) + '\0detached\0\0')).toEqual([{ path: '/x', head: 'a'.repeat(40), branch: null }]);
  });
});

/**
 * The installed path against real git (the row 86 can-fail test): a live pass over a real
 * repository removes exactly the merged, clean, unused, quiet checkouts and leaves every dirty,
 * unmerged, in-use, fresh, marked and detached checkout with its bytes. It fails if unfinished
 * work were deleted, and it fails if abandoned clean work accumulated (nothing reclaimed).
 */
describe('installed path — real git repository', () => {
  const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-C', cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
    '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10_000 }).trim();
  const query = async (file: string, args: string[], cwd?: string) => {
    try { return execFileSync(file, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10_000, cwd }); } catch { return null; }
  };
  const mutate = async (file: string, args: string[]) => {
    try { execFileSync(file, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10_000 }); return { ok: true }; }
    catch (err) { return { ok: false, detail: err instanceof Error ? err.message : String(err) }; }
  };
  const exists = async (p: string) => { try { return existsSync(p); } catch { return null; } };
  function repository() {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'worktree-reaper-')));
    const repo = join(root, 'repo'); mkdirSync(repo);
    git(repo, 'init', '-q', '-b', 'main');
    writeFileSync(join(repo, 'README.md'), '#\n'); git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'init');
    // As in 1.x, the checkouts live beside the repository (the agent home's `.worktrees/`), not inside it.
    const worktreesDir = join(root, '.worktrees'); mkdirSync(worktreesDir);
    const add = (name: string, ...extra: string[]) => { git(repo, 'worktree', 'add', '-q', join(worktreesDir, name), ...extra); return join(worktreesDir, name); };
    const merged = add('merged', '-b', 'feat-merged', 'HEAD');
    const residue = add('residue', '-b', 'feat-residue', 'HEAD');
    writeFileSync(join(residue, '.metadata_never_index'), '');
    const unmerged = add('unmerged', '-b', 'feat-unmerged', 'HEAD');
    writeFileSync(join(unmerged, 'new.txt'), 'x'); git(unmerged, 'add', '-A'); git(unmerged, 'commit', '-qm', 'ahead');
    const dirty = add('dirty', '-b', 'feat-dirty', 'HEAD');
    writeFileSync(join(dirty, 'wip.txt'), 'uncommitted');
    const locked = add('locked', '-b', 'feat-locked', 'HEAD');
    writeFileSync(join(locked, '.session.lock'), '');
    const marked = add('marked', '-b', 'feat-marked', 'HEAD');
    writeFileSync(join(marked, '.instar-build-active'), '');
    const fresh = add('fresh', '-b', 'feat-fresh', 'HEAD');
    const busy = add('busy', '-b', 'feat-busy', 'HEAD');
    const detached = add('detached', '--detach', 'HEAD');
    const head = git(repo, 'rev-parse', 'HEAD');
    return { root, repo, worktreesDir, head, merged, residue, unmerged, dirty, locked, marked, fresh, busy, detached };
  }
  /** The composition binds its clock and stop beside the adapter's git/process ports. */
  const bind = (adapter: Omit<WorktreeReaperPorts, 'now' | 'stopped'>, cfg: Partial<WorktreeReaperConfig>) =>
    createWorktreeReaper({ ...adapter, now: () => NOW, stopped: () => false }, cfg);
  const adapterFor = (r: ReturnType<typeof repository>, census: () => ReturnType<typeof processes>, over: Record<string, unknown> = {}) =>
    createWorktreeReaperAdapter({ repository: r.repo, worktreesDir: r.worktreesDir, machine: 'm', freshForMs: 100_000, now: () => NOW, limit: 20,
      query, mutate, exists, census, ownership: () => new Map(census().processes.map(p => [p.pid, 'non-owner'])), githubMergeCheck: false,
      observe: async (path: string) => ({ owner: 'absent', activity: { ...activity, lastActivity: path === r.fresh ? NOW - 1 : 0 } }), ...over });

  it('a live pass removes exactly the merged, clean, unused, quiet checkouts and keeps every other one with its bytes', async () => {
    const r = repository();
    // A real foreground process works inside the busy checkout; its exact PID is observed and later killed.
    const child = spawn('sleep', ['30'], { cwd: r.busy, stdio: 'ignore' });
    try {
      expect(child.pid).toBeGreaterThan(0);
      const census = () => processes([proc({ pid: child.pid!, pgid: child.pid!, cwd: { state: 'observed', path: r.busy } })]);
      const adapter = adapterFor(r, census);
      const before = await adapter.census();
      expect(before.status).toBe('complete');
      expect(before.worktrees.map((w: ReaperWorktree) => w.path).sort()).toEqual([r.busy, r.detached, r.dirty, r.fresh, r.locked, r.marked, r.merged, r.residue, r.unmerged].sort());
      const reaper = bind(adapter, { enabled: true, dryRun: false, quietMs: 5000 });
      const dry = await bind(adapter, { enabled: true, dryRun: true, quietMs: 5000 }).reap();
      expect(dry.reaped).toEqual([]);
      expect(Object.fromEntries(dry.evaluations.map(e => [e.path, e.reason]))).toEqual({
        [r.merged]: 'merged-clean-idle', [r.residue]: 'residue-only', [r.unmerged]: 'unmerged', [r.dirty]: 'uncommitted-changes',
        [r.locked]: 'in-use', [r.marked]: 'build-active-marker', [r.fresh]: 'fresh', [r.busy]: 'in-use', [r.detached]: 'detached-or-unknown-branch' });
      for (const path of Object.values(r).filter(v => typeof v === 'string' && v.startsWith(r.worktreesDir))) expect(existsSync(path)).toBe(true);

      const live = await reaper.reap();
      expect(live.enumerationOk).toBe(true); expect(live.refused).toEqual([]); expect(live.raced).toEqual([]);
      // Abandoned clean work does not accumulate: exactly this one was reclaimed.
      expect(live.reaped).toEqual([r.merged]);
      expect(existsSync(r.merged)).toBe(false);
      // Residue-only is kept under its own reason: git refuses the non-forced removal of any untracked file.
      expect(existsSync(join(r.residue, '.metadata_never_index'))).toBe(true);
      expect(await adapter.remove(r.residue)).toMatchObject({ removed: false, reason: expect.stringMatching(/untracked|--force/u) });
      expect(existsSync(r.residue)).toBe(true);
      // Unfinished work was not deleted.
      expect(readFileSync(join(r.unmerged, 'new.txt'), 'utf8')).toBe('x');
      expect(readFileSync(join(r.dirty, 'wip.txt'), 'utf8')).toBe('uncommitted');
      for (const path of [r.locked, r.marked, r.fresh, r.busy, r.detached, r.residue]) expect(existsSync(path)).toBe(true);
      // Only the checkout went: the merged branches and their commits remain, and main is untouched.
      expect(git(r.repo, 'rev-parse', '--verify', 'refs/heads/feat-merged')).toBe(r.head);
      expect(git(r.repo, 'rev-parse', '--verify', 'refs/heads/feat-residue')).toBe(r.head);
      expect(git(r.repo, 'rev-parse', 'HEAD')).toBe(r.head);
      expect(git(r.repo, 'status', '--porcelain')).toBe('');
      const after = await adapter.census();
      expect(after.worktrees.map((w: ReaperWorktree) => w.path)).not.toContain(r.merged);
      expect((await reaper.snapshot()).reclaimable).toBe(0);
    } finally {
      child.kill('SIGTERM');
      rmSync(r.root, { recursive: true, force: true });
    }
  });

  it('unregistered ignored user work is preserved beside a clean removal', async () => {
    const r = repository();
    try {
      writeFileSync(join(r.repo, '.gitignore'), 'private-notes/\n');
      git(r.repo, 'add', '.gitignore'); git(r.repo, 'commit', '-qm', 'ignore private notes');
      git(r.merged, 'merge', '--ff-only', 'main');
      mkdirSync(join(r.merged, 'private-notes'));
      const note = join(r.merged, 'private-notes/draft.txt');
      writeFileSync(note, 'unique user draft');
      const adapter = adapterFor(r, () => processes([]));
      const result = await bind(adapter, { enabled: true, dryRun: false, quietMs: 5000 }).reap();
      expect(result.evaluations.find(e => e.path === r.merged)?.reason).toBe('uncommitted-changes');
      expect(readFileSync(note, 'utf8')).toBe('unique user draft');
      expect(result.reaped).toEqual([r.busy]);
    } finally { rmSync(r.root, { recursive: true, force: true }); }
  });

  it.each(['staging', 'main'])('forge merge into %s is bound to the selected destination', async baseRefName => {
    const r = repository();
    try {
      git(r.repo, 'remote', 'add', 'origin', 'git@github.com:owner/intended.git');
      const head = git(r.unmerged, 'rev-parse', 'HEAD');
      expect(git(r.repo, 'cherry', 'main', head)).toMatch(/^\+/);
      const forge = vi.fn(async (_file: string, args: string[], cwd?: string) => {
        if (_file !== 'gh') return query(_file, args, cwd);
        expect(args).toContain('github.com/owner/intended');
        expect(args[args.indexOf('--base') + 1]).toBe('main');
        return JSON.stringify([{ headRefName: 'feat-unmerged', headRefOid: head, baseRefName }]);
      });
      const adapter = adapterFor(r, () => processes([]), { query: forge, githubMergeCheck: true });
      expect(await adapter.merged(wt({ path: r.unmerged, branch: 'feat-unmerged', head }))).toBe(baseRefName === 'main');
      expect(readFileSync(join(r.unmerged, 'new.txt'), 'utf8')).toBe('x');
    } finally { rmSync(r.root, { recursive: true, force: true }); }
  });

  it('a builder that switches the branch between the census and the removal keeps its checkout', async () => {
    const r = repository();
    try {
      const adapter = adapterFor(r, () => processes([]), { ownership: () => new Map() });
      const raced = { ...adapter, recheck: async (path: string) => {
        if (path === r.merged) { writeFileSync(join(r.merged, 'late.txt'), 'late'); git(r.merged, 'checkout', '-q', '-b', 'feat-late'); }
        return adapter.recheck(path);
      } };
      const live = await bind(raced, { enabled: true, dryRun: false, quietMs: 5000 }).reap();
      expect(live.raced).toEqual([{ path: r.merged, reason: 'raced-changed-since-eval', evaluatedBranch: 'feat-merged' }]);
      expect(live.evaluations.find(e => e.path === r.merged)).toMatchObject({ verdict: 'keep', reason: 'raced-changed-since-eval' });
      expect(live.reaped).not.toContain(r.merged);
      expect(live.reaped).toEqual([r.busy]); // the unchanged idle checkout still goes
      expect(readFileSync(join(r.merged, 'late.txt'), 'utf8')).toBe('late');
      expect(git(r.merged, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feat-late');
    } finally { rmSync(r.root, { recursive: true, force: true }); }
  });

  it('git itself refuses the non-forced removal of a checkout that went dirty after every recheck, and the refusal stays visible', async () => {
    const r = repository();
    try {
      const adapter = adapterFor(r, () => processes([]), { ownership: () => new Map() });
      const dirtyRemove = { ...adapter, remove: async (path: string) => { writeFileSync(join(path, 'last-second.txt'), 'x'); return adapter.remove(path); } };
      const live = await bind(dirtyRemove, { enabled: true, dryRun: false, quietMs: 5000, maxReapsPerPass: 1 }).reap();
      expect(live.reaped).toEqual([]);
      // Every eligible candidate was attempted once (merged and the now idle busy checkout); none was removed.
      expect(live.refused.map(row => row.path).sort()).toEqual([r.busy, r.merged].sort());
      for (const row of live.refused) {
        expect(row.reason).toMatch(/untracked|modified|--force/u);
        expect(readFileSync(join(row.path, 'last-second.txt'), 'utf8')).toBe('x');
      }
      expect(await adapter.remove(join(r.repo, 'elsewhere'))).toEqual({ removed: false, reason: 'checkout outside the admitted worktree directory' });
    } finally { rmSync(r.root, { recursive: true, force: true }); }
  });

  it('an incomplete process census or a missing repository keeps everything and is reported, never a clean zero', async () => {
    const r = repository();
    try {
      const partial = adapterFor(r, () => processes([proc()], { status: 'partial', omitted: 1 }));
      const res = await bind(partial, { enabled: true, dryRun: false, quietMs: 5000 }).reap();
      expect(res.reaped).toEqual([]);
      expect(res.evaluations.every(e => e.verdict === 'keep' && e.reason === 'process-census-incomplete')).toBe(true);
      expect(existsSync(r.merged)).toBe(true);
      const missing = createWorktreeReaperAdapter({ repository: join(r.root, 'nope'), worktreesDir: join(r.root, 'nope', '.worktrees'), machine: 'm',
        freshForMs: 100_000, now: () => NOW, limit: 20, query, mutate, exists, census: async () => processes([]), ownership: () => new Map(),
        observe: async () => null });
      const snap = await bind(missing, { enabled: true, dryRun: true }).snapshot();
      expect(snap.enumerationOk).toBe(false); expect(snap.reclaimable).toBeNull(); expect(snap.enumerationError).toMatch(/enumeration failed/);
      // A linked worktree's index lock lives in its own git directory; the adapter asks git where.
      const lockPath = join(r.repo, '.git', 'worktrees', 'merged', 'index.lock');
      writeFileSync(lockPath, '');
      const lockedRow = (await adapterFor(r, () => processes([])).census()).worktrees.find((w: ReaperWorktree) => w.path === r.merged)!;
      expect(lockedRow.locked).toBe(true);
      rmSync(lockPath);
    } finally { rmSync(r.root, { recursive: true, force: true }); }
  });
});
