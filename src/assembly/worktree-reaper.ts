// Clean-worktree reclamation (carryover row 86; docs/18 §7 P14-NF-66). Ported from Instar 1.x
// JKHeadley/instar f3f94826ae7c0ae6203c2651698c02b95b89ccfa: src/monitoring/AgentWorktreeReaper.ts
// (classifier, pass, breaker, action-time recheck, fail-visible enumeration, initial pass),
// src/monitoring/worktreeEnumeration.ts (three-state enumeration and bounded diagnostics) and the
// pure residue classification of src/core/worktreeDirtyCheck.ts with the reaper's own narrow list
// from src/monitoring/agentWorktreeGit.ts. The physical git/process adapter is
// scripts/worktree-reaper-git.mjs; this module reads only through its ports (NF-52).
//
// THE hard requirement: NEVER delete unmerged or dirty work. A worktree is reap-eligible ONLY
// when ALL of these hold:
//   - not in use (no live or unknown owner, no session/index lock, no build marker, and no live
//     process whose working directory is inside it, from a complete same-machine census), and
//   - not fresh (complete activity coverage over the quiet window with no activity inside it), and
//   - on a known branch (detached ⇒ KEEP), and
//   - clean (no tracked or untracked change after the narrow residue list), and
//   - merged (its content is already in the default branch: patch equivalence, or a merged pull
//     request whose head object exactly equals the checkout head).
// When all hold, removing the checkout loses NOTHING: the branch and its commits remain (merged ⇒
// content is in main; clean ⇒ no uncommitted work), so only the working-dir checkout is reclaimed
// (re-creatable on demand). Any ambiguity, unreadable or incomplete evidence ⇒ KEEP. Ships OFF +
// dry-run by default (the only worktree path that deletes on a heuristic), with a bounded blast
// radius per pass and a per-path failure breaker. Staleness alone never makes a checkout
// reclaimable; it is one more gate, never a reason.
import type { ProcessInventorySnapshot } from './process-inventory.js';

export interface WorktreeReaperConfig {
  enabled: boolean;
  dryRun: boolean;
  reapIntervalMs: number;
  /**
   * Delay before the ONE-TIME initial pass after activation (default 15 min).
   * Without it the reaper's first pass is a full `reapIntervalMs` (24h) after
   * boot — and because agent servers restart far more often than daily, the
   * interval timer resets forever and an enabled+armed reaper NEVER runs a
   * single pass (the 2026-07-02 incident: 86 worktrees / 25GB accumulated with
   * the feature switched on). The delay keeps the pass off the busy post-boot
   * window; <= 0 disables the initial pass (interval-only — the rollback lever).
   */
  initialPassDelayMs: number;
  /** Bounded blast radius per pass. */
  maxReapsPerPass: number;
  /**
   * Per-path consecutive-removal-failure breaker (Rule 55, No Unbounded Loops).
   * After this many consecutive removal failures for the SAME path, the reaper
   * stops attempting it (keeps it as `reclaim-failed`) until restart, so a
   * permanently-unremovable worktree can't be retried forever. 0 disables the brake.
   */
  maxReclaimFailuresPerPath: number;
  /**
   * When true (default), merged-detection may use merged pull-request head objects
   * to catch MULTI-COMMIT squash-merges that patch equivalence cannot — the
   * disk-accumulation root cause where squash-merged worktrees are kept forever.
   * The adapter makes one bounded forge query per sweep and fails safe to
   * patch-equivalence only (KEEP). Set false to restore the offline-only behavior.
   */
  githubMergeCheck: boolean;
  /**
   * A checkout with any observed activity inside this window before the census, or
   * whose activity coverage does not span it, is fresh and kept. The owning observer
   * supplies activity coverage; an old file timestamp is never read as quiet.
   */
  quietMs: number;
}

export const DEFAULT_WORKTREE_REAPER_CONFIG: WorktreeReaperConfig = Object.freeze({
  enabled: false,
  dryRun: true,
  reapIntervalMs: 24 * 3600 * 1000,
  initialPassDelayMs: 15 * 60 * 1000,
  maxReapsPerPass: 20,
  maxReclaimFailuresPerPath: 3,
  githubMergeCheck: true,
  quietMs: 24 * 3600 * 1000,
});

/**
 * Reaper-specific residue denylist (1.x spec worktree-reaper-untracked-blindspot).
 * INTENTIONALLY NARROW: this list gates an irreversible `git worktree remove`, so it
 * contains ONLY paths that are unambiguously never user work. It deliberately
 * EXCLUDES broad `out/` / `build/` / `coverage/` / `*.log` entries — users legitimately
 * hand-author files under those (a `build/deploy.md`, an `analysis.log`), and an
 * untracked one of those on a merged worktree must NEVER be silently reaped.
 */
export const REAPER_RESIDUE_DENYLIST: readonly string[] = Object.freeze([
  'dist/', 'node_modules/', '.cache/', '.turbo/', '*.tsbuildinfo',
  '.metadata_never_index',          // instar-managed Spotlight-exclusion marker — never work
  '.instar/instar-dev-traces/',     // instar audit-trace droppings — never work
]);

/**
 * One porcelain line → its path (strip the 2-char status + space; handle the
 * `R old -> new` rename arrow and quoted paths). Returns '' if unparseable.
 */
export function porcelainPath(line: string): string {
  if (line.length < 4) return '';
  let p = line.slice(3); // drop "XY "
  const arrow = p.indexOf(' -> ');
  if (arrow >= 0) p = p.slice(arrow + 4); // rename: take the destination
  // porcelain quotes paths with special chars; strip surrounding quotes.
  if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
  return p;
}

/** Does a porcelain path match a residue-denylist entry (prefix dir or *.ext glob)? */
export function isResiduePath(p: string, denylist: readonly string[]): boolean {
  for (const rule of denylist) {
    if (rule.startsWith('*.')) {
      if (p.endsWith(rule.slice(1))) return true; // '*.log' → endsWith('.log')
    } else if (rule.endsWith('/')) {
      if (p === rule.slice(0, -1) || p.startsWith(rule)) return true; // 'dist/' prefix
      // also match a nested segment: any path component equal to the dir
      if (p.includes('/' + rule)) return true;
    } else if (p === rule) {
      return true;
    }
  }
  return false;
}

/**
 * Decide dirtiness from porcelain output + denylist. Exported pure for tests:
 * non-empty AND at least one non-residue entry.
 */
export function classifyPorcelain(porcelain: string, denylist: readonly string[]): boolean {
  const lines = porcelain.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.length > 0);
  if (lines.length === 0) return false;
  for (const line of lines) {
    const p = porcelainPath(line);
    if (!p) continue;
    if (!isResiduePath(p, denylist)) return true; // a real (non-residue) change
  }
  return false; // everything dirty was build residue
}

/**
 * Upper bound on the diagnostic string. It is served to the operator and written to a
 * log, so an unbounded upstream git error must not become an unbounded field.
 */
export const MAX_ENUMERATION_ERROR_CHARS = 300;

/**
 * Bounded, single-line, control-character-free diagnostic for an enumeration failure.
 * `Error.message` only — NEVER a stack. Control characters are stripped BEFORE the
 * whitespace collapse, because a `\s+` collapse leaves `ESC` intact and git/path output
 * can carry ANSI escape sequences that a terminal reading the log would interpret.
 */
export function summarizeEnumerationError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const printable = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
  const oneLine = printable.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_ENUMERATION_ERROR_CHARS
    ? `${oneLine.slice(0, MAX_ENUMERATION_ERROR_CHARS - 1)}…`
    : oneLine;
}

export interface WorktreeEnumerationFailureHistory {
  enumerationFailures: number;
  lastEnumerationFailureAt: number | null;
}
/** Restart-surviving failure count/time. Current blind state is never restored. */
export interface WorktreeEnumerationFailureHistoryPort {
  load(): WorktreeEnumerationFailureHistory;
  recordFailure(at: number): WorktreeEnumerationFailureHistory;
}

export type WorktreeActivity = Readonly<{ coveredFrom: number; coveredThrough: number; lastActivity: number }>;
/** One enumerated checkout with every pre-selection reading. Null readings are unknown, never clean. */
export interface ReaperWorktree {
  readonly path: string;
  /** Short branch name, or null when detached/unknown. */
  readonly branch: string | null;
  readonly head: string;
  /** `git status --porcelain` lines; null when the status read failed. */
  readonly changes: readonly string[] | null;
  /** Session or index lock present; null when unreadable. */
  readonly locked: boolean | null;
  /** `.instar-build-active` marker present; null when unreadable. */
  readonly buildMarker: boolean | null;
  readonly owner: 'live' | 'absent' | 'unknown';
  readonly activity: WorktreeActivity | null;
}
/**
 * The three-state enumeration (1.x WorktreeEnumeration): `complete` with the list (which may
 * legitimately be empty), or `partial`/`failed` with a bounded diagnostic. The states exist so
 * "I could not look" can never read as "I looked and found nothing" — that collapse reported a
 * clean bill of health over a broken guard twice in 1.x production.
 */
export interface ReaperInventory {
  readonly machine: string;
  readonly sourceTime: number;
  readonly freshForMs: number;
  readonly status: 'complete' | 'partial' | 'failed';
  readonly error: string | null;
  readonly worktrees: readonly ReaperWorktree[];
}
export type CheckoutOwnership = (checkout: string) => ReadonlyMap<number, 'non-owner' | 'owner' | 'unknown'>;
export interface ReaperObservation {
  readonly worktrees: ReaperInventory;
  readonly processes: ProcessInventorySnapshot;
  /** Resolve each live process against this candidate, independently of its cwd. */
  readonly ownership: CheckoutOwnership;
}

export type Verdict = 'keep' | 'reap-eligible';
export interface WorktreeEvaluation {
  path: string;
  branch: string | null;
  verdict: Verdict;
  /** The gate that forced KEEP, or 'merged-clean-idle' when reap-eligible. */
  reason: string;
}
/** Rule 42: a refused removal stays a refusal; it is never read as a removal. */
export type Removal = Readonly<{ removed: true } | { removed: false; reason: string }>;

/**
 * All signal sources injected so the classifier is unit-testable without git/fs.
 * Production wiring supplies the git-backed adapter in scripts/worktree-reaper-git.mjs.
 */
export interface WorktreeReaperPorts {
  /** One read-only census of the admitted checkouts joined to the current process census. */
  observe(): Promise<ReaperObservation>;
  /** True when the branch's content is already in the default branch; null when undeterminable. */
  merged(info: ReaperWorktree): Promise<boolean | null>;
  /**
   * The LIVE state of one checkout, read at RECLAIM time to close the enumerate→reclaim
   * race: a builder may `git checkout -b <new-unmerged>`, dirty the tree or start working in
   * it between the census and the removal. Null when the checkout is gone or unreadable.
   */
  recheck(path: string): Promise<ReaperObservation | null>;
  /** Non-forced `git worktree remove`. Only called when kills are enabled. */
  remove(path: string): Promise<Removal>;
  now(): number;
  stopped(): boolean;
  /** Passive trace for an enumeration failure. Retention follows the deployment log. */
  trace?(line: string): void;
  failureHistory?: WorktreeEnumerationFailureHistoryPort;
}

export interface ReapPass {
  readonly ts: number;
  readonly dryRun: boolean;
  readonly enumerationOk: boolean;
  readonly enumerationError: string | null;
  readonly evaluations: readonly WorktreeEvaluation[];
  readonly reaped: readonly string[];
  /** Removal refusals with their typed reasons (counted toward the breaker). */
  readonly refused: readonly Readonly<{ path: string; reason: string }>[];
  /** Breaker trips emitted once per path when its failure count reaches the cap. */
  readonly breakerTripped: readonly Readonly<{ path: string; failures: number }>[];
  /** Candidates whose fresh action-time reading no longer cleared every gate. */
  readonly raced: readonly Readonly<{ path: string; reason: string; evaluatedBranch: string | null }>[];
}

const instant = (n: number) => Number.isSafeInteger(n) && n >= 0;
const fresh = (at: number, life: number, now: number) => instant(at) && instant(life)
  && life > 0 && at <= now && now - at <= life;
const canonical = (path: string) => path.startsWith('/') && path !== '/' && !path.endsWith('/')
  && !path.split('/').slice(1).some(part => part === '.' || part === '..' || part === '');
const inside = (path: string, area: string) => path === area || path.startsWith(`${area}/`);

/** Why a complete, fresh, same-machine process census is not available, or null when it is. */
export function processCensusGap(processes: ProcessInventorySnapshot, machine: string, now: number): string | null {
  if (processes.status !== 'complete' || processes.omitted !== 0 || processes.examined !== processes.processes.length) return 'process-census-incomplete';
  if (!machine || processes.machine !== machine) return 'process-census-foreign';
  if (!fresh(processes.sourceTime, processes.freshForMs, now)) return 'process-census-stale';
  const live = processes.processes.filter(row => !row.zombie);
  if (live.some(row => row.cwd.state !== 'observed' || !canonical(row.cwd.path) && row.cwd.path !== '/')) return 'process-cwd-unknown';
  return null;
}

export function createWorktreeReaper(ports: WorktreeReaperPorts, config?: Partial<WorktreeReaperConfig>) {
  // An explicitly undefined option keeps its default (1.x #2038: an undefined timing erased a default).
  const cfg: WorktreeReaperConfig = { ...DEFAULT_WORKTREE_REAPER_CONFIG,
    ...Object.fromEntries(Object.entries(config ?? {}).filter(([, v]) => v !== undefined)) };
  const trace = ports.trace ?? (() => {});
  let running = false;
  let activatedAt: number | null = null;
  let initialPassPending = false;
  let lastIntervalAt = 0;
  let lastPassAt = 0;
  let reapedLastPass = 0;
  /**
   * Metric: how many background REAP PASSES have failed to enumerate in the retained
   * history, and when the most recent one was. Incremented ONLY by `reap()` — never by
   * `snapshot()`, which runs per read and would otherwise make this a measure of
   * polling frequency.
   */
  let enumerationFailures = 0;
  let lastEnumerationFailureAt: number | null = null;
  /** Current-process outcome of the last completed background pass. */
  let lastEnumerationOk: boolean | null = null;
  let lastEnumerationError: string | null = null;
  /** Per-path consecutive removal-failure counts (breaker). Cleared on a successful removal.
   *  Process-lifetime: the restart-surviving pressure docs/18 assigns to Part Six is not landed. */
  const reclaimFailures = new Map<string, number>();
  const reclaimTripped = new Set<string>();
  try {
    const history = ports.failureHistory?.load();
    if (history) {
      enumerationFailures = history.enumerationFailures;
      lastEnumerationFailureAt = history.lastEnumerationFailureAt;
    }
  } catch (err) {
    // Not silent: the guard remains live and the failed historical load is surfaced.
    trace(`[worktree-reaper] enumeration failure history load FAILED: ${summarizeEnumerationError(err)}`);
  }
  const killsEnabled = () => cfg.enabled && !cfg.dryRun;

  /**
   * Pure, stateless per-worktree classifier. Returns KEEP unless EVERY safety gate clears.
   * Order: cheap protect-gates first (short-circuit on the first KEEP) — never evaluate
   * `merged` (a git call) on a dirty/active worktree.
   */
  function classify(info: ReaperWorktree, observation: ReaperObservation): WorktreeEvaluation {
    const keep = (reason: string): WorktreeEvaluation => ({ path: info.path, branch: info.branch, verdict: 'keep', reason });
    const { worktrees, processes, ownership } = observation;
    if (!canonical(info.path)) return keep('noncanonical-path');
    const gap = processCensusGap(processes, worktrees.machine, ports.now());
    if (gap) return keep(gap);
    if (info.owner !== 'absent') return keep(info.owner === 'live' ? 'in-use' : 'owner-unknown');
    if (info.locked !== false) return keep(info.locked === null ? 'lock-unreadable' : 'in-use');
    if (info.buildMarker !== false) return keep(info.buildMarker === null ? 'marker-unreadable' : 'build-active-marker');
    const candidateOwnership = ownership(info.path);
    const live = processes.processes.filter(row => !row.zombie);
    if (live.some(row => row.cwd.state === 'observed' && inside(row.cwd.path, info.path))) return keep('in-use');
    if (live.some(row => candidateOwnership.get(row.pid) !== 'non-owner')) return keep('owner-unknown');
    const activity = info.activity;
    if (!activity || ![activity.coveredFrom, activity.coveredThrough, activity.lastActivity].every(instant)
      || activity.coveredFrom > worktrees.sourceTime - cfg.quietMs || activity.coveredThrough < worktrees.sourceTime
      || activity.coveredThrough > ports.now()) return keep('activity-unknown');
    if (activity.lastActivity > worktrees.sourceTime - cfg.quietMs) return keep('fresh');
    if (!info.branch) return keep('detached-or-unknown-branch');
    if (info.changes === null) return keep('status-unreadable');
    // Residue-aware: a checkout whose only entries are narrow residue holds no work. It is still
    // kept, under its own reason, because the only admitted removal is the non-forced form and
    // git refuses that for ANY untracked file (observed with git 2.x; the 1.x spec's claim that
    // the non-forced form ignores untracked files was wrong, so 1.x never reclaimed these either).
    // Reclaiming them needs a separately admitted residue-removal or forced path, not this one.
    if (info.changes.length > 0) return keep(classifyPorcelain(info.changes.join('\n'), REAPER_RESIDUE_DENYLIST) ? 'uncommitted-changes' : 'residue-only');
    return { path: info.path, branch: info.branch, verdict: 'reap-eligible', reason: 'merged-clean-idle' };
  }
  async function evaluate(info: ReaperWorktree, observation: ReaperObservation): Promise<WorktreeEvaluation> {
    const cheap = classify(info, observation);
    if (cheap.verdict === 'keep') return cheap;
    if (!info.head) return { ...cheap, verdict: 'keep', reason: 'unknown-head' };
    const merged = await ports.merged(info);
    if (merged !== true) return { path: info.path, branch: info.branch, verdict: 'keep', reason: merged === null ? 'merge-unknown' : 'unmerged' };
    return cheap;
  }
  /** True when this path's removal has failed >= the configured cap (breaker open). cap 0 never trips. */
  const breakerTripped = (path: string) => cfg.maxReclaimFailuresPerPath > 0
    && (reclaimFailures.get(path) ?? 0) >= cfg.maxReclaimFailuresPerPath;
  function recordReclaimFailure(path: string): Readonly<{ path: string; failures: number }> | null {
    const cap = cfg.maxReclaimFailuresPerPath;
    const n = (reclaimFailures.get(path) ?? 0) + 1;
    reclaimFailures.set(path, n);
    if (cap > 0 && n >= cap && !reclaimTripped.has(path)) { reclaimTripped.add(path); return { path, failures: n }; }
    return null;
  }
  function recordEnumerationFailure(at: number): void {
    enumerationFailures = Math.min(Number.MAX_SAFE_INTEGER, enumerationFailures + 1);
    lastEnumerationFailureAt = at;
    try {
      const persisted = ports.failureHistory?.recordFailure(at);
      if (persisted) { enumerationFailures = persisted.enumerationFailures; lastEnumerationFailureAt = persisted.lastEnumerationFailureAt; }
    } catch (err) {
      trace(`[worktree-reaper] enumeration failure history persist FAILED: ${summarizeEnumerationError(err)}`);
    }
  }
  /**
   * Re-check the LIVE state at RECLAIM time (after enumeration) to close the race. Returns a
   * KEEP reason if it raced (a builder changed the branch or head, dirtied it, took it in use,
   * or dropped a build marker since evaluation), else null (safe to reclaim). Fail-closed: any
   * unreadable or thrown signal → 'reclaim-recheck-error'.
   */
  async function reclaimRaceGuard(info: ReaperWorktree): Promise<string | null> {
    try {
      const current = await ports.recheck(info.path);
      const row = current?.worktrees.status === 'complete' ? current.worktrees.worktrees.find(w => w.path === info.path) : undefined;
      if (!current || !row) return 'reclaim-recheck-error';
      if (row.buildMarker !== false) return row.buildMarker === null ? 'reclaim-recheck-error' : 'raced-build-active-marker';
      // The load-bearing check: has the checked-out branch or head changed since enumeration?
      // If so, the merge evidence is stale and must NOT authorize a delete.
      if (row.branch !== info.branch || row.head !== info.head) return 'raced-changed-since-eval';
      const again = await evaluate(row, current);
      if (again.verdict === 'reap-eligible') return null;
      if (again.reason === 'in-use' || again.reason === 'owner-unknown') return 'raced-now-in-use';
      if (again.reason === 'uncommitted-changes' || again.reason === 'residue-only') return 'raced-now-dirty';
      if (again.reason === 'unmerged') return 'raced-now-unmerged';
      if (again.reason === 'fresh') return 'raced-now-fresh';
      return 'reclaim-recheck-error';
    } catch {
      return 'reclaim-recheck-error';
    }
  }

  /**
   * Which pass, if any, is due now: the one-time initial pass `initialPassDelayMs` after
   * activation, then the `reapIntervalMs` cadence from activation. Disabled: never.
   */
  function due(now: number): 'initial' | 'interval' | null {
    if (activatedAt === null || !cfg.enabled) return null;
    if (initialPassPending && now - activatedAt >= cfg.initialPassDelayMs) return 'initial';
    if (now - lastIntervalAt >= cfg.reapIntervalMs) return 'interval';
    return null;
  }

  return Object.freeze({
    config: Object.freeze({ ...cfg }),
    /** Marks activation; the caller's own bounded cycle asks `due` and runs `reap`. No timer is owned here. */
    activate(now: number): void {
      if (activatedAt !== null || !cfg.enabled) return;
      activatedAt = now; lastIntervalAt = now;
      initialPassPending = cfg.initialPassDelayMs > 0;
    },
    deactivate(): void { activatedAt = null; initialPassPending = false; },
    due,
    classify,
    evaluate,
    /** One reap pass. Returns the per-worktree evaluations + what was reaped. */
    async reap(): Promise<ReapPass> {
      const empty = (ts: number, enumerationError: string | null): ReapPass => ({ ts, dryRun: !killsEnabled(),
        enumerationOk: enumerationError === null, enumerationError, evaluations: [], reaped: [], refused: [], breakerTripped: [], raced: [] });
      if (running || ports.stopped()) return empty(ports.now(), null);
      running = true;
      const now = ports.now();
      const kind = due(now);
      if (kind === 'initial') initialPassPending = false;
      if (kind === 'interval') lastIntervalAt += cfg.reapIntervalMs * Math.max(1, Math.floor((now - lastIntervalAt) / cfg.reapIntervalMs));
      const reaped: string[] = []; const evaluations: WorktreeEvaluation[] = [];
      const refused: { path: string; reason: string }[] = []; const breaker: { path: string; failures: number }[] = [];
      const raced: { path: string; reason: string; evaluatedBranch: string | null }[] = [];
      try {
        let observation: ReaperObservation;
        try { observation = await ports.observe(); } catch (err) {
          observation = { worktrees: { machine: '', sourceTime: now, freshForMs: 0, status: 'failed', error: summarizeEnumerationError(err), worktrees: [] },
            processes: { type: 'ProcessInventory', schemaVersion: 1, id: '', machine: '', hardwareProfile: '', adapter: '', adapterDigest: '',
              sourceTime: now, monotonicAt: 0, freshForMs: 0, cpuBasis: 'process-cpu-time', status: 'failed', examined: 0, omitted: null, processes: [] },
            ownership: () => new Map() };
        }
        const inventory = observation.worktrees;
        const enumerationError = inventory.status !== 'complete' ? (inventory.error ?? `worktree enumeration ${inventory.status}`)
          : !fresh(inventory.sourceTime, inventory.freshForMs, ports.now()) ? 'worktree enumeration stale'
            : new Set(inventory.worktrees.map(row => row.path)).size !== inventory.worktrees.length ? 'worktree enumeration repeats a path' : null;
        if (enumerationError !== null) {
          const failedAt = ports.now();
          lastPassAt = failedAt; lastEnumerationOk = false; lastEnumerationError = enumerationError;
          recordEnumerationFailure(failedAt);
          trace(`[worktree-reaper] enumeration FAILED — reclaimable is UNKNOWN, not zero: ${enumerationError}`);
          return empty(failedAt, enumerationError);
        }
        for (const info of inventory.worktrees) {
          if (ports.stopped()) break;
          let evaln: WorktreeEvaluation;
          try { evaln = await evaluate(info, observation); }
          catch {
            // A signal threw — cannot reason about it, so KEEP. Never reap on a failed evaluation.
            evaluations.push({ path: info.path, branch: info.branch, verdict: 'keep', reason: 'eval-error' });
            continue;
          }
          // Per-path failure breaker: a reap-eligible worktree whose removal has failed too many
          // times is no longer attempted — surfaced honestly as keep('reclaim-failed').
          if (evaln.verdict === 'reap-eligible' && breakerTripped(info.path)) {
            evaluations.push({ path: info.path, branch: info.branch, verdict: 'keep', reason: 'reclaim-failed' });
            continue;
          }
          evaluations.push(evaln);
          if (evaln.verdict !== 'reap-eligible') continue;
          if (reaped.length >= cfg.maxReapsPerPass) continue; // blast-radius cap
          if (!killsEnabled()) continue; // dry-run: classify, do not delete
          // EXEC-TIME RE-VALIDATION: re-read the LIVE state right before the irreversible delete;
          // on any race, ABORT this reap (keep) — strictly FEWER reaps, never more.
          const raceReason = await reclaimRaceGuard(info);
          if (raceReason) {
            evaln.verdict = 'keep'; evaln.reason = raceReason;
            raced.push({ path: info.path, reason: raceReason, evaluatedBranch: info.branch });
            continue;
          }
          if (ports.stopped()) break;
          let removal: Removal;
          try { removal = await ports.remove(info.path); }
          catch (err) { removal = { removed: false, reason: summarizeEnumerationError(err) }; }
          if (removal.removed) {
            reaped.push(info.path);
            reclaimFailures.delete(info.path); // success → clear the breaker count
            reclaimTripped.delete(info.path);
          } else {
            // The worktree is simply kept and retried (bounded by the breaker), the safe direction.
            refused.push({ path: info.path, reason: removal.reason });
            const trip = recordReclaimFailure(info.path);
            if (trip) breaker.push(trip);
          }
        }
        lastPassAt = ports.now(); lastEnumerationOk = true; lastEnumerationError = null;
        reapedLastPass = reaped.length;
      } finally {
        running = false;
      }
      return { ts: ports.now(), dryRun: !killsEnabled(), enumerationOk: true, enumerationError: null,
        evaluations, reaped, refused, breakerTripped: breaker, raced };
    },
    /** Cheap, in-memory posture read. */
    guardStatus(): { enabled: boolean; dryRun: boolean; lastTickAt: number; verdictUnknown?: true; verdictUnknownReason?: string } {
      return { enabled: cfg.enabled, dryRun: cfg.dryRun, lastTickAt: lastPassAt,
        ...(lastEnumerationOk === false
          ? { verdictUnknown: true as const, verdictUnknownReason: lastEnumerationError ?? 'worktree enumeration failed' } : {}) };
    },
    /**
     * Observability snapshot (no side effects). FAIL-VISIBLE, not fail-silent: when
     * enumeration fails the numbers are UNKNOWN (`reclaimable: null`), never zero, because
     * "the check could not run" and "there is nothing to reclaim" are the same bytes to a
     * reader and opposite facts.
     */
    async snapshot(): Promise<{
      enabled: boolean; dryRun: boolean; lastPassAt: number; reapedLastPass: number; initialPassPending: boolean;
      worktrees: WorktreeEvaluation[]; reclaimable: number | null; enumerationOk: boolean; enumerationError: string | null;
      enumerationFailures: number; lastEnumerationFailureAt: number | null;
    }> {
      let worktrees: WorktreeEvaluation[] = []; let enumerationOk = true; let enumerationError: string | null = null;
      try {
        const observation = await ports.observe();
        if (observation.worktrees.status === 'complete') {
          for (const info of observation.worktrees.worktrees) {
            try { worktrees.push(await evaluate(info, observation)); }
            catch { worktrees.push({ path: info.path, branch: info.branch, verdict: 'keep', reason: 'eval-error' }); }
          }
        } else { enumerationOk = false; enumerationError = observation.worktrees.error ?? `worktree enumeration ${observation.worktrees.status}`; }
      } catch (err) {
        // Deliberately does NOT increment enumerationFailures: the counter measures background passes.
        enumerationOk = false; enumerationError = summarizeEnumerationError(err); worktrees = [];
      }
      return { enabled: cfg.enabled, dryRun: cfg.dryRun, lastPassAt, reapedLastPass, initialPassPending, worktrees,
        reclaimable: enumerationOk ? worktrees.filter((w) => w.verdict === 'reap-eligible').length : null,
        enumerationOk, enumerationError, enumerationFailures, lastEnumerationFailureAt };
    },
  });
}
