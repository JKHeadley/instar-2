// Git-backed signal sources for the clean-worktree reaper (carryover row 86). Ported from Instar 1.x
// JKHeadley/instar f3f94826 src/monitoring/agentWorktreeGit.ts and the non-forced `worktree remove`
// arm of src/core/SafeGitExecutor.ts, reshaped to the Part Ten adapter pattern of
// scripts/worktree-inventory.mjs: the caller supplies bounded process execution (`query` for reads,
// `mutate` for the one destructive operation), path existence, the owner's activity/ownership
// observations and the current process census. Missing or failed readings stay unknown, never
// clean, unlocked or unused. The classifier lives in src/assembly/worktree-reaper.ts.
import { parseWorktreeList } from './worktree-inventory.mjs';

/** Canonical default-branch candidates, preferring the upstream remote (1.x resolveBaseRef order). */
export const DEFAULT_BASE_REFS = Object.freeze(['JKHeadley/main', 'upstream/main', 'origin/main', 'main']);
export const SESSION_LOCK = '.session.lock';
export const BUILD_ACTIVE_MARKER = '.instar-build-active';

/** A read that returns null on any failure, whether the port returns null or throws. The optional
 * third argument is a working directory for a tool without git's `-C` (the forge CLI). */
const reader = query => async (file, args, cwd) => { try { return await query(file, args, cwd); } catch { return null; } };
const git = (read, repo, ...args) => read('git', ['--no-optional-locks', '-C', repo, ...args]);

/**
 * Resolve the canonical default branch ref that exists locally, preferring the upstream
 * remote. Returns null when none resolve (→ callers treat merged as unknown and KEEP).
 */
export async function resolveBaseRef(query, repo, refs = DEFAULT_BASE_REFS) {
  const read = reader(query);
  for (const ref of refs) {
    for (const full of [`refs/remotes/${ref}`, `refs/heads/${ref}`]) {
      const out = await git(read, repo, 'rev-parse', '--verify', '--quiet', full);
      if (out !== null && out.trim()) return ref;
    }
  }
  return null;
}

/**
 * True when EVERY commit unique to `headSha` already has an equivalent patch in `baseRef`
 * — i.e. the branch's content is in the default branch. Uses `git cherry` (patch-id
 * equivalence), which catches fast-forward, merge-commit, rebased, and single-commit-squash
 * merges. A multi-commit squash-merge is NOT detected (its commits' individual patch-ids
 * differ from the squashed commit) → reported NOT merged → KEPT. Null when cherry cannot be
 * computed (unknown → KEEP). Conservative by design: it never false-positives "merged".
 */
export async function isBranchMerged(query, repo, baseRef, headSha) {
  const out = await git(reader(query), repo, 'cherry', baseRef, headSha);
  if (out === null) return null;
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return true; // no commits ahead of base ⇒ merged
  return lines.every((l) => l.startsWith('-'));
}

/**
 * `headRefName → headRefOid` for MERGED pull requests, from the forge CLI's JSON. Detects
 * MULTI-COMMIT squash-merges that `git cherry` cannot: a merged PR into the selected
 * repository and default branch is the "content is in main" signal; the caller pairs it with an EXACT head-OID match so a
 * branch with commits ADDED AFTER the merge is still kept. Any malformed input ⇒ EMPTY map
 * (no signal ⇒ KEEP). The latest merged PR for a reused branch name wins (newest first).
 */
export function parseMergedPullRequestHeads(text, baseBranch) {
  const map = new Map();
  if (typeof text !== 'string' || !text) return map;
  let arr;
  try { arr = JSON.parse(text); } catch { return map; }
  if (!Array.isArray(arr)) return map;
  for (const row of arr) {
    if (!row || typeof row !== 'object' || !baseBranch || row.baseRefName !== baseBranch) continue;
    const { headRefName: name, headRefOid: oid } = row;
    if (typeof name === 'string' && typeof oid === 'string' && name && oid && !map.has(name)) map.set(name, oid);
  }
  return map;
}
/** ONE bounded forge query per sweep; fail-safe to an EMPTY map so the reaper degrades to cherry-only (KEEP). */
export async function mergedPullRequestHeads(query, repo, destination, limit = 500) {
  const out = await reader(query)('gh', ['pr', 'list', '--repo', destination.repository, '--base', destination.branch, '--state', 'merged', '--json', 'headRefName,headRefOid,baseRefName', '--limit', String(limit)], repo);
  return parseMergedPullRequestHeads(out, destination.branch);
}

/**
 * Only the non-forced form of `git worktree remove` may run: without `--force` git refuses to
 * delete ordinary untracked/modified work or a lock. Ignored user files are NOT protected by
 * git itself; the complete cleanliness observation must protect them before removal.
 * Deny ANY force-ish token shape (`--force`, `--force=1`, `-f`, `-fxyz`) rather than relying on
 * git's own parser to reject lookalikes. `worktree remove` has no other `-f`-prefixed flag.
 */
export function isNonForcedWorktreeRemove(args) {
  const at = args.indexOf('worktree');
  if (at < 0) return false;
  const verbArgs = args.slice(at + 1);
  if (verbArgs.find((arg) => !arg.startsWith('-')) !== 'remove') return false;
  return !verbArgs.some((arg) => /^--force(=|$)/.test(arg) || /^-f/.test(arg));
}
export const worktreeRemoveArgs = (repository, path) => ['-C', repository, 'worktree', 'remove', path];

export function createWorktreeReaperAdapter(ports) {
  const read = reader(ports.query);
  const { repository, worktreesDir } = ports;
  const githubMergeCheck = ports.githubMergeCheck ?? true;
  const within = p => p === worktreesDir || p.startsWith(`${worktreesDir}/`);
  const exists = async p => { try { const r = await ports.exists(p); return typeof r === 'boolean' ? r : null; } catch { return null; } };
  const base = () => ({ machine: ports.machine, freshForMs: ports.freshForMs, sourceTime: ports.now() });
  const failed = error => ({ ...base(), status: 'failed', error, worktrees: [] });

  async function readCheckout(row) {
    const status = await git(read, row.path, 'status', '--porcelain', '--ignored', '--untracked-files=all');
    // A session lock or an index lock means in-flight work. A linked worktree's index lock lives in
    // its own git directory, which git names; the main checkout's is `.git/index.lock`.
    const session = await exists(`${row.path}/${SESSION_LOCK}`);
    const indexLockPath = await git(read, row.path, 'rev-parse', '--git-path', 'index.lock');
    const index = indexLockPath === null ? null
      : await exists(indexLockPath.trim().startsWith('/') ? indexLockPath.trim() : `${row.path}/${indexLockPath.trim()}`);
    const locked = session === null || index === null ? null : session || index;
    const buildMarker = await exists(`${row.path}/${BUILD_ACTIVE_MARKER}`);
    let observation = null;
    try { observation = await ports.observe(row.path); } catch { observation = null; }
    return { path: row.path, branch: row.branch, head: row.head,
      changes: status === null ? null : status.split('\n').filter(Boolean),
      locked, buildMarker, owner: observation?.owner ?? 'unknown', activity: observation?.activity ?? null };
  }
  /** The three-state census of the checkouts under `worktreesDir` (the main checkout is excluded). */
  async function census(only = null) {
    try {
      const text = await git(read, repository, 'worktree', 'list', '--porcelain', '-z');
      const rows = parseWorktreeList(text);
      if (!rows) return failed(`worktree enumeration failed for repository "${repository}"`);
      if (!Number.isSafeInteger(ports.limit) || ports.limit < 1) return failed('worktree census limit is not a positive integer');
      const candidates = rows.filter(row => within(row.path) && (only === null || row.path === only));
      const worktrees = [];
      let error = candidates.length > ports.limit ? `worktree census truncated at ${ports.limit}` : null;
      for (const row of candidates.slice(0, ports.limit)) worktrees.push(await readCheckout(row));
      // Re-enumeration refuses a path/head/branch change during the per-checkout reads.
      const after = await git(read, repository, 'worktree', 'list', '--porcelain', '-z');
      if (after !== text) error ??= 'worktree enumeration changed during the census';
      return { ...base(), status: error === null ? 'complete' : 'partial', error, worktrees };
    } catch (err) { return failed(err instanceof Error ? err.message : String(err)); }
  }
  async function observe(only = null) {
    const worktrees = await census(only);
    let processes;
    try { processes = await ports.census(); } catch {
      // A failed census carries no population: every checkout is then kept as census-incomplete.
      processes = { type: 'ProcessInventory', schemaVersion: 1, id: 'census-failed', machine: ports.machine, hardwareProfile: 'unknown',
        adapter: 'worktree-reaper-git', adapterDigest: 'none', sourceTime: ports.now(), monotonicAt: 0, freshForMs: ports.freshForMs,
        cpuBasis: 'process-cpu-time', status: 'failed', examined: 0, omitted: null, processes: [] };
    }
    return { worktrees, processes, ownership: ports.ownership };
  }
  // Merged-PR map cached for a short TTL so a single reap pass makes ONE forge query, not one per
  // worktree. It is consulted lazily (only when cherry says unmerged) so a fully cherry-detectable
  // repository never calls the forge.
  let prMapCache = null; let prMapCacheAt = 0; let prMapDestination = null;
  const mergedHeads = async baseRef => {
    // Bind the forge repository to the remote that supplied the selected base, not gh's
    // ambient repository choice (which may be a fork). A local base uses origin.
    const remoteRef = await git(read, repository, 'rev-parse', '--verify', '--quiet', `refs/remotes/${baseRef}`);
    const slash = baseRef.indexOf('/');
    const remote = remoteRef && slash > 0 ? baseRef.slice(0, slash) : 'origin';
    const branch = remoteRef && slash > 0 ? baseRef.slice(slash + 1) : baseRef;
    const url = await git(read, repository, 'remote', 'get-url', remote);
    const match = url?.trim().match(/^(?:https?:\/\/|ssh:\/\/git@|git@)([^/:]+)[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (!match) return new Map();
    const destination = { repository: `${match[1]}/${match[2]}/${match[3]}`, branch };
    const key = `${destination.repository}:${branch}`;
    const t = ports.now();
    if (!prMapCache || key !== prMapDestination || t - prMapCacheAt > 60_000) {
      prMapCache = await mergedPullRequestHeads(ports.query, repository, destination, ports.pullRequestLimit);
      prMapCacheAt = t; prMapDestination = key;
    }
    return prMapCache;
  };
  return Object.freeze({
    census,
    observe: () => observe(null),
    recheck: path => observe(path),
    async merged(info) {
      const baseRef = await resolveBaseRef(ports.query, repository, ports.baseRefs);
      if (!baseRef || !info.head) return null;
      // 1) Patch-id equivalence (fast, offline): fast-forward / merge / rebase / single-commit-squash.
      const cherry = await isBranchMerged(ports.query, repository, baseRef, info.head);
      if (cherry === true) return true;
      // 2) Multi-commit squash-merge: `git cherry` cannot see it (SHAs differ). Consult merged-PR
      //    state — but require an EXACT head-OID match so a branch with commits ADDED AFTER the
      //    merge is still KEPT. Fail-safe: an empty/missing map ⇒ the cherry answer stands.
      if (githubMergeCheck && info.branch) {
        const oid = (await mergedHeads(baseRef)).get(info.branch);
        if (oid && oid === info.head) return true;
      }
      return cherry;
    },
    async remove(path) {
      if (!within(path)) return { removed: false, reason: 'checkout outside the admitted worktree directory' };
      const args = worktreeRemoveArgs(repository, path);
      if (!isNonForcedWorktreeRemove(args)) return { removed: false, reason: 'refusing a forced worktree removal' };
      try {
        const result = await ports.mutate('git', args);
        return result && result.ok === true ? { removed: true }
          : { removed: false, reason: typeof result?.detail === 'string' && result.detail ? result.detail : 'worktree removal refused' };
      } catch (err) { return { removed: false, reason: err instanceof Error ? err.message : String(err) }; }
    },
  });
}

/**
 * Fixed-cardinality durable history for worktree-guard enumeration failures (1.x
 * WorktreeEnumerationFailureStore). Only the historical count/time survive restart; the
 * current pass outcome stays process-local so a stale failure is never presented as a live
 * verdict. `read()` returns the ledger text or null when absent; `write(text)` replaces it
 * atomically (the caller's own bounded, fsynced write). A malformed or oversized ledger throws
 * rather than being silently reset.
 */
export const MAX_FAILURE_LEDGER_BYTES = 16_384;
const GUARD_KEYS = new Set(['worktree-reaper', 'orphaned-work-sentinel']);
const EMPTY_HISTORY = Object.freeze({ enumerationFailures: 0, lastEnumerationFailureAt: null });
export function validFailureHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Number.isSafeInteger(value.enumerationFailures) && value.enumerationFailures >= 0
    && (value.lastEnumerationFailureAt === null
      || (typeof value.lastEnumerationFailureAt === 'number' && Number.isFinite(value.lastEnumerationFailureAt) && value.lastEnumerationFailureAt >= 0));
}
export function createEnumerationFailureStore(ports) {
  let ledger = null;
  const load = () => {
    if (ledger) return ledger;
    const text = ports.read();
    if (text === null || text === undefined) { ledger = { version: 1, guards: {} }; return ledger; }
    if (typeof text !== 'string' || text.length > MAX_FAILURE_LEDGER_BYTES) throw new Error('worktree-enumeration-failure-ledger-too-large');
    const parsed = JSON.parse(text);
    if (parsed?.version !== 1 || !parsed.guards || typeof parsed.guards !== 'object' || Array.isArray(parsed.guards))
      throw new Error('invalid-worktree-enumeration-failure-ledger');
    for (const [key, value] of Object.entries(parsed.guards))
      if (!GUARD_KEYS.has(key) || !validFailureHistory(value)) throw new Error('invalid-worktree-enumeration-failure-ledger-record');
    ledger = parsed; return ledger;
  };
  return Object.freeze({
    forGuard(key) {
      if (!GUARD_KEYS.has(key)) throw new Error('unknown-worktree-enumeration-guard');
      return Object.freeze({
        load: () => ({ ...(load().guards[key] ?? EMPTY_HISTORY) }),
        recordFailure(at) {
          if (!Number.isFinite(at) || at < 0) throw new Error('invalid-worktree-enumeration-failure-time');
          const current = load();
          const previous = current.guards[key] ?? EMPTY_HISTORY;
          const next = { enumerationFailures: Math.min(Number.MAX_SAFE_INTEGER, previous.enumerationFailures + 1), lastEnumerationFailureAt: at };
          current.guards[key] = next;
          try { ports.write(`${JSON.stringify(current, null, 2)}\n`); }
          catch (err) {
            if (previous === EMPTY_HISTORY) delete current.guards[key]; else current.guards[key] = previous;
            throw err;
          }
          return { ...next };
        },
      });
    },
  });
}
