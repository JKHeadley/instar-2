// Part Ten's read-only process inventory (SEAM-LEDGER rows 40 and 63; docs/18 §14,
// docs/20 §6), and the launch-membership join the host launch adapter enforces with.
//
// The physical census (scripts/process-inventory.mjs) enumerates every current-user
// process in one batched read. This module owns the decoder and the joins; it has
// no process-control, cleanup, placement or throttling authority. A partial or
// failed census never projects an empty population, and a missing reading is an
// explicit state, never a synthetic zero.
//
// Launch membership (the confinement join). A process belongs to an owned launch by
// evidence, never by self-report:
//   recorded     - an incarnation the owner already recorded (pid + start identity);
//   group        - a member of the launch's own process group;
//   ancestry     - its parent chain reaches the launch root or another member;
//   working-area - it escaped the group and was reparented to launchd, it started no
//                  earlier than the launch, every ancestor up to launchd did too, and
//                  its working directory is inside the launch's private working area.
// The last join is what covers a descendant that detaches and whose parent exits
// before any sample: on this host neither its group, its parent nor (for a platform
// binary) its environment survives, but its working directory does. Honest residue:
// a process that ALSO changes its working directory out of the area before it is
// observed is not joined; only a separate restricted worker identity (the held Ten
// confined-launch monitor) closes that. Start identities have one-second resolution.

export type InventoryStatus = 'complete' | 'partial' | 'failed';
/** Row 63: the observation state of one process's resource reading. */
export type ResourceObservationState = 'reported' | 'process-exited' | 'permission-denied' | 'unavailable' | 'unsupported';
export type WorkingDirectory = Readonly<{ state: 'observed'; path: string } | { state: 'unobserved' | 'unavailable' }>;
export interface InventoryResource {
  readonly state: ResourceObservationState;
  /** Stable per actual sample: every process read in one census shares it. */
  readonly sourceSample: string;
  /** Cumulative process CPU at the sample instant; an interval is derived from two samples. */
  readonly cumulativeCpuMs: number | null;
  /** RSS bytes at the one named sample instant. */
  readonly rssBytes: number | null;
  /** Runtime heap is a separate category and never substitutes for RSS. */
  readonly heap: 'unsupported';
}
export interface InventoryProcess {
  readonly pid: number; readonly ppid: number; readonly pgid: number; readonly uid: number;
  /** The platform's process start identity (with the pid, one incarnation). */
  readonly start: string;
  /** Executable and ordered argv exactly as the platform reports them, joined; in memory only. */
  readonly command: string;
  readonly zombie: boolean;
  readonly cwd: WorkingDirectory;
  readonly resource: InventoryResource;
}
export interface ProcessInventorySnapshot {
  readonly type: 'ProcessInventory'; readonly schemaVersion: 1;
  readonly id: string; readonly machine: string; readonly hardwareProfile: string;
  readonly adapter: string; readonly adapterDigest: string;
  /** Source wall time and the monotonic instant of the one census read. */
  readonly sourceTime: number; readonly monotonicAt: number; readonly freshForMs: number;
  /** CPU is per process on one core's clock; no percentage is claimed. */
  readonly cpuBasis: 'process-cpu-time';
  readonly status: InventoryStatus; readonly examined: number; readonly omitted: number | null;
  readonly processes: readonly InventoryProcess[];
}

const nonnegative = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const text = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.length <= max;
function must(condition: unknown, detail: string): asserts condition { if (!condition) throw new Error(detail); }
const states = new Set(['reported', 'process-exited', 'permission-denied', 'unavailable', 'unsupported']);

/** Owner decoder of one raw census from the physical adapter. Throws with the refusal detail. */
export function decodeProcessInventory(input: unknown): ProcessInventorySnapshot {
  must(input !== null && typeof input === 'object' && !Array.isArray(input), 'process inventory: object required');
  const raw = input as Record<string, unknown>;
  must(raw.type === 'ProcessInventory' && raw.schemaVersion === 1, 'process inventory: type');
  for (const key of ['id', 'machine', 'hardwareProfile', 'adapter', 'adapterDigest'])
    must(text(raw[key], 256) && (raw[key] as string).length > 0, `process inventory: ${key}`);
  must(nonnegative(raw.sourceTime) && typeof raw.monotonicAt === 'number' && Number.isFinite(raw.monotonicAt)
    && nonnegative(raw.freshForMs), 'process inventory: clocks');
  must(raw.cpuBasis === 'process-cpu-time', 'process inventory: cpu basis');
  must(raw.status === 'complete' || raw.status === 'partial' || raw.status === 'failed', 'process inventory: status');
  must(nonnegative(raw.examined) && (raw.omitted === null || nonnegative(raw.omitted)), 'process inventory: counts');
  must(Array.isArray(raw.processes), 'process inventory: processes');
  const processes = raw.processes as unknown[];
  // A failed census carries no population: it can never read as an empty one.
  if (raw.status === 'failed') must(processes.length === 0 && raw.omitted === null, 'process inventory: a failed census has no rows');
  if (raw.status === 'complete') must(raw.omitted === 0 && processes.length === raw.examined, 'process inventory: complete counts');
  if (raw.status === 'partial') must(raw.omitted === null || (raw.omitted as number) > 0, 'process inventory: partial counts');
  const seen = new Set<number>();
  for (const p of processes) {
    must(p !== null && typeof p === 'object', 'process inventory: row');
    const r = p as Record<string, unknown>;
    must(['pid', 'ppid', 'pgid', 'uid'].every(k => nonnegative(r[k])) && (r.pid as number) > 0, 'process inventory: row identity');
    must(!seen.has(r.pid as number), 'process inventory: duplicate pid');
    seen.add(r.pid as number);
    must(text(r.start, 64) && (r.start as string).length > 0 && text(r.command) && typeof r.zombie === 'boolean', 'process inventory: row start');
    const cwd = r.cwd as Record<string, unknown> | null;
    must(cwd && (cwd.state === 'observed' ? text(cwd.path) && (cwd.path as string).startsWith('/')
      : cwd.state === 'unobserved' || cwd.state === 'unavailable'), 'process inventory: working directory');
    const res = r.resource as Record<string, unknown> | null;
    must(res && states.has(res.state as string) && res.sourceSample === raw.id && res.heap === 'unsupported',
      'process inventory: resource observation');
    // A reading is numeric only when reported; a missing reading is never a synthetic zero.
    if (res.state === 'reported') must(nonnegative(res.cumulativeCpuMs) && nonnegative(res.rssBytes), 'process inventory: reported reading');
    else must(res.cumulativeCpuMs === null && res.rssBytes === null, 'process inventory: missing reading is not zero');
  }
  return Object.freeze({ ...raw, processes: Object.freeze(processes.map(p => Object.freeze({ ...(p as object) }))) }) as ProcessInventorySnapshot;
}

const months = new Map(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => [m, i + 1]));
/** Seconds on the host's civil clock from a ps `lstart` identity ("Mon Sep 28 09:30:01 2026"); null when unreadable. */
export function startSeconds(start: string): number | null {
  const parts = start.trim().split(/\s+/u);
  if (parts.length !== 5) return null;
  const month = months.get(parts[1]!), day = Number(parts[2]), year = Number(parts[4]);
  const clock = parts[3]!.split(':').map(Number);
  if (!month || !Number.isSafeInteger(day) || !Number.isSafeInteger(year) || clock.length !== 3 || clock.some(n => !Number.isSafeInteger(n))) return null;
  // days_from_civil (proleptic Gregorian), so no ambient date API is needed.
  const y = month <= 2 ? year - 1 : year, era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const days = era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
  return days * 86400 + clock[0]! * 3600 + clock[1]! * 60 + clock[2]!;
}

export interface LaunchRoot {
  readonly id: string; readonly pid: number;
  /** Recorded incarnations: pid → start identity (the root included once recorded). */
  readonly known: ReadonlyMap<number, string>;
  /** The launch's private working area, or null when it has none to join on. */
  readonly workingArea: string | null;
  /** The root's start identity; the working-area join needs it. */
  readonly start: string | null;
  /** The private area whose sandbox instance confines this launch (a launch run under a per-launch sandbox
   * profile that reads that area and not its parent), or absent/null when it has none to join on. */
  readonly sandboxArea?: string | null;
}
export type MembershipReason = 'recorded' | 'group' | 'ancestry' | 'working-area' | 'sandbox';
/** One process's sandbox reading: the private area whose sandbox instance holds it (`null`: in none of them). */
export type SandboxReading = { readonly state: 'observed'; readonly area: string | null } | { readonly state: 'unavailable' };
export interface Membership { readonly launch: string; readonly reason: MembershipReason }

const inside = (path: string, area: string) => {
  const base = area.endsWith('/') ? area.slice(0, -1) : area;
  return path === base || path.startsWith(`${base}/`);
};
/** A usable working area: absolute and not the filesystem root. */
const joinable = (area: string | null): area is string => !!area && area.startsWith('/') && area.replace(/\/+$/u, '').length > 0;

/**
 * Membership by recorded incarnation, group and ancestry (no working directory needed),
 * plus the processes whose working directory the working-area join must read: those that
 * reparented to launchd through ancestors that all started no earlier than a launch that has
 * a working area.
 */
export function launchMembership(snapshot: ProcessInventorySnapshot, launches: readonly LaunchRoot[], ownerPid: number): Readonly<{
  members: ReadonlyMap<number, Membership>; candidates: readonly number[] }> {
  const rows = new Map(snapshot.processes.map(p => [p.pid, p]));
  const members = new Map<number, Membership>();
  const memo = new Map<number, Membership | null>();
  const ownerOf = (pid: number, hops: number): Membership | null => {
    const cached = memo.get(pid);
    if (cached !== undefined) return cached;
    const p = rows.get(pid);
    if (!p || pid <= 1 || pid === ownerPid || hops > 64) return null;
    // A recorded pid is ours only while it is the same incarnation.
    const recorded = launches.find(l => l.known.get(pid) === p.start);
    // A group id is not reallocated while any member lives, so a group whose leader is gone is still
    // the launch's; a leader pid now naming another incarnation means the id was reused.
    const group = recorded ? undefined : launches.find(l => {
      if (l.pid !== p.pgid) return false;
      const leader = rows.get(l.pid), start = l.known.get(l.pid) ?? l.start;
      return !leader || (start !== null && leader.start === start);
    });
    let found: Membership | null = recorded ? { launch: recorded.id, reason: 'recorded' }
      : group ? { launch: group.id, reason: 'group' } : null;
    if (!found && !launches.some(l => l.known.has(pid))) {
      const parent = ownerOf(p.ppid, hops + 1);
      if (parent) found = { launch: parent.launch, reason: 'ancestry' };
    }
    memo.set(pid, found);
    return found;
  };
  for (const p of snapshot.processes) { const m = ownerOf(p.pid, 0); if (m) members.set(p.pid, m); }
  const earliest = Math.min(...launches.filter(l => joinable(l.workingArea) && l.start && startSeconds(l.start) !== null)
    .map(l => startSeconds(l.start!)!));
  const candidates: number[] = [];
  if (Number.isFinite(earliest)) for (const p of snapshot.processes) {
    if (members.has(p.pid) || p.pid === ownerPid || p.zombie) continue;
    // Every ancestor up to launchd started no earlier than the earliest such launch.
    let current: InventoryProcess | undefined = p, eligible = false;
    for (let hops = 0; current && hops < 64; hops++) {
      const s = startSeconds(current.start);
      if (s === null || s < earliest || current.pid === ownerPid || members.has(current.pid)) break;
      if (current.ppid === 1) { eligible = true; break; }
      current = rows.get(current.ppid);
    }
    if (eligible) candidates.push(p.pid);
  }
  return { members, candidates };
}

/** The working-area join over the candidates whose working directory was read. */
export function joinWorkingArea(snapshot: ProcessInventorySnapshot, launches: readonly LaunchRoot[], candidates: readonly number[],
  cwds: ReadonlyMap<number, WorkingDirectory>): ReadonlyMap<number, Membership> {
  const rows = new Map(snapshot.processes.map(p => [p.pid, p]));
  const joined = new Map<number, Membership>();
  for (const pid of candidates) {
    const cwd = cwds.get(pid), row = rows.get(pid), s = row && startSeconds(row.start);
    if (cwd?.state !== 'observed' || s === null || s === undefined) continue;
    // The newest launch that started no later than this process and whose private area holds it.
    const owner = launches.filter(l => joinable(l.workingArea) && l.start && startSeconds(l.start) !== null
      && startSeconds(l.start)! <= s && inside(cwd.path, l.workingArea!))
      .sort((a, b) => startSeconds(b.start!)! - startSeconds(a.start!)!)[0];
    if (owner) joined.set(pid, { launch: owner.id, reason: 'working-area' });
  }
  return joined;
}

/**
 * The sandbox join over the candidates whose sandbox was read: the kernel's own sandbox identity, which a process
 * cannot leave by a new session, a new parent or another working directory. A candidate joins the newest launch,
 * started no later than it, whose sandbox area its reading names.
 */
export function joinSandbox(snapshot: ProcessInventorySnapshot, launches: readonly LaunchRoot[], candidates: readonly number[],
  readings: ReadonlyMap<number, SandboxReading>): ReadonlyMap<number, Membership> {
  const rows = new Map(snapshot.processes.map(p => [p.pid, p]));
  const joined = new Map<number, Membership>();
  for (const pid of candidates) {
    const reading = readings.get(pid), row = rows.get(pid), s = row && startSeconds(row.start);
    if (reading?.state !== 'observed' || reading.area === null || s === null || s === undefined) continue;
    const owner = launches.filter(l => l.sandboxArea === reading.area && l.start && startSeconds(l.start) !== null
      && startSeconds(l.start)! <= s).sort((a, b) => startSeconds(b.start!)! - startSeconds(a.start!)!)[0];
    if (owner) joined.set(pid, { launch: owner.id, reason: 'sandbox' });
  }
  return joined;
}
