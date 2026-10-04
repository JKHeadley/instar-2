// The one physical resource owner of a host process (Rules 60, 61), in the fixed
// Ten physical host: the host's launch adapter. It holds no resource authority of its
// own: admission is Six's (a ResourceAllocationSet per launch, SEAM-LEDGER row 36) and
// the process census is Ten's (the read-only process inventory, rows 40/63).
//
// Every provider launch passes local admission (count, answer reserve, priority brake),
// then its Six allocation set is committed across its domains and attached to the
// launch's ordinary AdmissionReservation before anything is spawned; a Six capacity
// refusal waits like a local one. The debit is returned once, citing the evidence that
// proves the outcome (verified cleanup, or a gate that never opened); an unresolved
// cleanup keeps it reserved. What is held, and on which subject:
//   - Six: launch slots, memory and processes of the installation domain, and launch
//     slots per work family (maintenance never takes the answer reserve);
//   - per process: CPU time and open handles (RLIMIT_CPU, RLIMIT_NOFILE, soft and
//     hard), inherited by every descendant, including one that leaves the group;
//   - per user ID: RLIMIT_NPROC, lowered to the user's process count at launch plus
//     the launch's process ceiling (subject: the user ID, reported as `uidProcesses`).
// Enforced on observation (`sampled`): the tree's memory and process count against its
// ceiling, and the aggregate; the tree's total handles are not observed (`unsupported`).
//
// Membership (`working-area-joined`): each census is Ten's complete current-user
// inventory joined to the owned launches by recorded incarnation, group, ancestry and
// the launch's private working area. The last join covers a descendant that detaches
// and whose parent exits before any sample. A launch without a private working area is
// `unconfined`. Residue: a descendant that also leaves the working area before any
// census; only the held separate worker identity closes that — or, for a launch that
// runs under its own per-launch sandbox profile (`membership: 'sandbox'`), the sandbox
// join (`sandbox-joined`): the kernel's sandbox identity of each candidate, read from
// outside the launch, which no descendant sheds by a new session, a new parent or
// another working directory. Such a descendant is counted, held to the ceilings and
// ended like any other member; nothing inside the launch is consulted.
//
// The provider does not start until its launch evidence (pid, start evidence,
// owner) is durably recorded: the shim waits on a go signal the owner sends only
// after the ledger write, and exits unexecuted if the owner dies first.
//
// Observation is read-only (row 40 grants no control authority); signals go only to
// this owner's own launch members, and a pid is attributed or signalled only while
// its start identity matches. A failed or denied query is `unknown`, never a rejection.
//
// Completion records every live member durably, signals it, and then verifies in a
// complete census that no member is left. A denied signal, a failed query, a
// member the ledger could not record, or a survivor keeps the durable row
// (`cleanup: 'unresolved'`): a signal attempt is not observed quiescence.
//
// The owner settles each launch on the launch process's exit, and never waits on it
// past EXIT_SETTLE_MS: a descendant that detached holding the launch's stdout open
// (an escaped or suspended helper) cannot keep the owner from settling and then
// cleaning up. The owner, outside any launch's sandbox, is never dependent on a helper
// inside the launch to finish.
//
// Recovery after a crash is observation only. Disposing of a process left by a dead
// launcher is a recovery effect that needs the typed Part Eight process effect and
// the Ten driver seams, which are not landed; until then surviving orphans are
// reported with their evidence and their rows stay in the durable ledger.
//
// Waste and repair facts for each launch travel with its result (`resources`), and
// the journal's call-outcome row keeps them durably; `outcomes` here is a bounded view.
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { arch, cpus, hostname, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProcessInventory, loadTenOwner } from './process-inventory.mjs';

const GiB = 1024 ** 3;
/** Ceilings use the NativeLaunchLimits field names of the effect doorway. */
export const RESOURCE_CEILINGS = Object.freeze({
  launch: Object.freeze({ memoryBytes: 2 * GiB, processCount: 32, handleCount: 1024, cpuMilliseconds: 600_000 }),
  // The aggregate is exactly the launch slots times the per-launch allocation: the Six installation
  // domain's capacity, so every admitted launch has its whole allocation reserved.
  aggregate: Object.freeze({ memoryBytes: 6 * GiB, processCount: 96, launches: 3 }),
  reserveLaunches: 1,
  sampleMs: 1000,
  /** Bounded census per tick (every current-user process): more than this is a partial sample. */
  censusLimit: 4096,
  /** Working directories read per tick for escape candidates; more is a partial sample. */
  candidateLimit: 64,
});
const WORK = Object.freeze({ answer: 'critical', review: 'critical', maintenance: 'medium' });
const OUTCOME_LIMIT = 32;
const QUERY_TIMEOUT_MS = 2000;
const GATE_TIMEOUT_MS = 5000;
// After the launch process has exited, how long the owner waits for its output stream to end before it
// settles anyway. The stream ends at once when nothing outside the launch holds the launch's stdout; a
// descendant that detached with the stdout open (an escaped or suspended helper) would otherwise keep it
// open forever, so the owner never depends on that descendant to settle (it is independently protected).
const EXIT_SETTLE_MS = 2000;
const UNKNOWN = Symbol('unknown');

// Wait for the owner's go signal (fd 3) when gated, then lower (never raise) the
// inherited soft and hard limits, then replace the shell with the provider,
// keeping its pid, process group and descendants under the ceiling. The hard
// limit matters: runtimes such as Node raise their own soft file limit to the hard
// limit at startup. The process limit is lowered last, because the shell's own
// command substitutions fork; within one limit both values are read before either is
// lowered, so no substitution forks under a lowered process limit (a count that rose
// since it was read made that fork fail: a sent message read UNKNOWN). The shell's own variables (PWD, SHLVL, OLDPWD) are
// removed by env(1), which execs in place, unless the caller supplied them.
const SHELL_VARIABLES = Object.freeze(['PWD', 'SHLVL', 'OLDPWD']);
const LIMIT_SCRIPT = [
  'if [ "$5" = gate ]; then read -r go <&3 || exit 125; [ "$go" = go ] || exit 125; exec 3<&-; fi',
  'lim() {',
  '  s=$(ulimit -S "$1") || exit 125',
  '  h=$(ulimit -H "$1") || exit 125',
  '  if [ "$s" = unlimited ] || [ "$s" -gt "$2" ]; then ulimit -S "$1" "$2" || exit 125; fi',
  '  if [ "$h" = unlimited ] || [ "$h" -gt "$2" ]; then ulimit -H "$1" "$2" || exit 125; fi',
  '}',
  'lim -n "$1"; lim -t "$2"; if [ -n "$3" ]; then lim -u "$3"; fi',
  'u=; for v in $4; do u="$u -u $v"; done; shift 5',
  'exec /usr/bin/env $u "$@"'].join('\n');

/** The same shim as a file, for a caller whose first argument is a fixed label (the Telegram bridge keeps
 * its request at argv[1]): the file drops the label, then runs LIMIT_SCRIPT unchanged. */
export const LIMIT_FILE = fileURLToPath(new URL('./limit-exec.sh', import.meta.url));
export const LIMIT_FILE_TEXT = `shift\n${LIMIT_SCRIPT}\n`;
export function limitedFileArgv({ label, executable, args, handles, cpuSeconds, processLimit, env }) {
  return [LIMIT_FILE, label, String(handles), String(cpuSeconds), processLimit === null ? '' : String(processLimit),
    SHELL_VARIABLES.filter(name => env?.[name] === undefined).join(' '), '', executable, ...args];
}
/** The shim argv for one limited process: the one definition every launch uses. */
export function limitedArgv({ executable, args, handles, cpuSeconds, processLimit, env, gated }) {
  return ['-c', LIMIT_SCRIPT, 'instar-launch', String(handles), String(cpuSeconds), processLimit === null ? '' : String(processLimit),
    SHELL_VARIABLES.filter(name => env?.[name] === undefined).join(' '), gated ? 'gate' : '', executable, ...args];
}

const plainCompare = (left, right) => {
  if (left.subject.kind !== right.subject.kind || left.subject.instance !== right.subject.instance
    || left.unit !== right.unit) throw Error('resource comparison: subject, instance, or unit mismatch');
  return left.value - right.value;
};
const measured = (kind, instance, unit, value, at) => ({ subject: { kind, instance }, unit, value, at });

/** Every observation resolves: a denied or failed query is `null` (unknown), never a rejection.
 * execFile throws synchronously when the host refuses to spawn (EPERM), so that is caught too. */
export function hostQuery(file, args) {
  return new Promise(resolve => {
    try {
      execFile(file, args, { timeout: QUERY_TIMEOUT_MS, maxBuffer: 1024 * 1024, env: { PATH: '/usr/bin:/bin' } }, (error, stdout) => {
        // pgrep exits 1 when nothing matches; ps may exit 1 when a listed pid ended.
        if (error && (typeof error.code !== 'number' || error.code > 1)) resolve(null);
        else resolve(String(stdout));
      });
    } catch { resolve(null); }
  });
}
/** One canonical start identity: ps pads a single-digit day ("Oct  1"), the census row collapses it,
 * so every reading and every recorded start compares in the collapsed form. */
export const startIdentity = start => typeof start === 'string' ? start.trim().split(/\s+/u).join(' ') : start;
const pids = text => text === null ? null : text.split(/\s+/u).filter(Boolean).map(Number).filter(Number.isSafeInteger);
export { cpuMilliseconds } from './process-inventory.mjs';

function durableWrite(path, document) {
  const temporary = join(dirname(path), `.resource-${randomUUID()}.pending`);
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(document), 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path);
  const directory = openSync(dirname(path), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

export function readResourceOutcomes(statePath) {
  try { const state = JSON.parse(readFileSync(statePath, 'utf8')); return state.version === 1 ? state.outcomes : []; }
  catch { return []; }
}

/** The machine and hardware identity every resource sample carries (docs/20 §6). */
export const HOST_IDENTITY = Object.freeze({ machine: `machine:${hostname()}`,
  hardwareProfile: `hardware:${platform()}-${arch()}-${cpus().length}cpu`, cores: Math.max(1, cpus().length),
  producer: 'preview-host-launch-observer', classifierGeneration: 'classifier:owned-launch-v1' });

/** The host posture: which ceilings are held hard, and on which subject (Rule 60). */
export const HOST_BOUNDS = Object.freeze({ aggregateLaunches: 'hard', sixAllocation: 'hard', aggregateMemory: 'sampled',
  aggregateProcesses: 'sampled', treeMembership: 'working-area-joined', treeProcesses: 'sampled', treeHandles: 'unsupported',
  uidProcesses: 'hard', confinement: 'blocked-install-held',
  reason: 'no unprivileged per-tree kernel confinement on this host: memory and tree process counts are enforced on a complete '
    + 'current-user census joined by recorded incarnation, group, ancestry and private working area; RLIMIT_NPROC bounds the user ID; '
    + 'the working-area join is observation, not confinement, and a Six memory debit is an accounting reservation, not a kernel one',
  residual: 'a descendant that leaves its group, its parent and the private working area before any census is not joined, '
    + 'unless its launch runs under its own sandbox profile (`membership: sandbox`: the sandbox join reaches it); '
    + 'otherwise the separate restricted worker identity (the held Ten confined-launch monitor) closes it' });
/** The launch's private working area: the working directory when it is owned by this user ID and closed
 * to everyone else, otherwise none (then the escape join is unavailable and membership is `unconfined`). */
export function privateArea(cwd) {
  try {
    // The kernel reports a working directory by its real path (/tmp is /private/tmp on macOS).
    const real = realpathSync(cwd), stat = statSync(real);
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    return stat.isDirectory() && uid !== null && stat.uid === uid && (stat.mode & 0o077) === 0 && real !== '/' ? real : null;
  } catch { return null; }
}
/** A desk-controlled case may LOWER the aggregate memory ceiling, never raise it. */
export const MIN_AGGREGATE_MEMORY_BYTES = 64 * 1024 * 1024;

export function createResourceOwner(initialCeilings = RESOURCE_CEILINGS) {
  let ceilings = initialCeilings;
  const censusLimit = ceilings.censusLimit ?? RESOURCE_CEILINGS.censusLimit;
  const launches = new Map(), waiters = [];
  let counters = { admitted: 0, waited: 0, refusedCapacity: 0, completed: 0, killed: {}, leakedDescendants: 0,
    orphansObserved: 0, observationFailures: 0, partialSamples: 0, recordingFailures: 0, cleanupUnresolved: 0 };
  let outcomes = [];
  /** Highest owned usage seen: live evidence that the ceilings held. */
  let peak = { launches: 0, memoryBytes: 0, processes: 0 };
  let ports = { compare: plainCompare, priorityGate: null, reconcile: null, now: () => Date.now(), query: hostQuery,
    monotonic: () => performance.now(), signal: (target, name) => process.kill(target, name), allocation: null };
  let attached = null, inherited = { state: 'unobserved' }, usage = { level: 'normal', observation: 'idle',
    memoryBytes: 0, processes: 0, sampledAt: null };
  /** docs/20 §6: the observer's own cost under its own subject. Query children's CPU is not readable
   * from here (no child rusage in this runtime), so it is `unavailable`, never counted as zero. */
  let lastSample = null, observer = { subject: 'resource-owner-observer', ticks: 0, queries: 0, processesCreated: 0, bytesRead: 0,
    failures: 0, elapsedMs: 0, cpuMs: 0, lastTickMs: null, lastLagMs: null, maxLagMs: 0, childCpu: 'unavailable',
    // The census runs inside the launcher process: its memory is not separable from the launcher's.
    memory: 'shared-with-launcher', concurrency: 1 };
  let lastTickAt = null;
  let orphans = [], lastLaunch = null, lastAllocationRefusal = null;
  /** Ownership evidence a failed ledger write could not land, by launch id. Every later successful
   * ledger write carries it first, so storage that becomes writable again persists it. */
  const pendingEvidence = new Map();
  let sampling = false, sampler = null, pump = null, lastPersist = 0;
  const query = (file, args) => {
    observer.queries++; observer.processesCreated++;
    return ports.query(file, args).catch(() => null).then(text => {
      if (text === null) observer.failures++; else observer.bytesRead += Buffer.byteLength(text);
      return text;
    });
  };

  const priorityOf = work => WORK[work] ?? 'medium';
  const level = () => {
    if (!launches.size) return 'normal';
    if (usage.observation !== 'observed') return usage.observation === 'idle' ? 'normal' : 'unknown';
    const fraction = Math.max(usage.memoryBytes / ceilings.aggregate.memoryBytes,
      usage.processes / ceilings.aggregate.processCount);
    return fraction >= 1 ? 'shutdown' : fraction >= 0.85 ? 'critical' : fraction >= 0.6 ? 'elevated' : 'normal';
  };
  const eligible = work => {
    if (launches.size >= ceilings.aggregate.launches) return false;
    // The minimal reserve: maintenance never takes the last launch an answer needs.
    if (priorityOf(work) !== 'critical' && launches.size >= ceilings.aggregate.launches - ceilings.reserveLaunches) return false;
    const current = level();
    if (ports.priorityGate) return ports.priorityGate(priorityOf(work), current);
    return current !== 'shutdown' && (priorityOf(work) === 'critical' || current === 'normal');
  };
  const record = outcome => {
    outcomes.push({ at: ports.now(), ...outcome });
    if (outcomes.length > OUTCOME_LIMIT) outcomes.shift();
    persist(true);
  };
  /** Which bounds of one launch are held hard, and which only by observation. The tree's process
   * growth is sampled: the kernel's process limit holds the user ID (reported as `uidProcesses`
   * with its subject), not this tree. */
  const enforcement = () => ({ cpuPerProcess: 'hard', handlesPerProcess: 'hard', processGrowth: 'sampled',
    treeHandles: 'unsupported', memory: 'sampled', treeCpu: 'sampled' });
  /** One SIGKILL: `sent`, `gone` (no such process) or `denied` (anything else: never read as success). */
  const kill = target => {
    try { ports.signal(target, 'SIGKILL'); return 'sent'; }
    catch (error) { return error?.code === 'ESRCH' ? 'gone' : 'denied'; }
  };
  function snapshot() {
    return { version: 1, at: ports.now(), identity: HOST_IDENTITY, ceilings, bounds: HOST_BOUNDS, inherited, usage: { ...usage, level: level() },
      active: [...launches.values()].map(l => ({ id: l.id, work: l.work, pid: l.pid ?? null, startedAt: l.startedAt,
        memoryBytes: l.memoryBytes, processes: l.processes, cpuMilliseconds: l.cpuMilliseconds, enforcement: l.enforcement })),
      waiting: waiters.map(w => w.work), pendingEvidence: pendingEvidence.size, allocation: ports.allocation ? { state: 'six', lastRefusal: lastAllocationRefusal } : { state: 'absent' }, counters, peak, observer, sample: lastSample, lastLaunch, orphans, outcomes };
  }
  function persist(force = false) {
    if (!attached?.statePath) return;
    const now = ports.now();
    if (!force && now - lastPersist < 5000) return;
    lastPersist = now;
    try { durableWrite(attached.statePath, snapshot()); } catch { /* status is a view; enforcement never depends on it */ }
  }
  function readLedger() {
    if (!attached?.ledgerPath || !existsSync(attached.ledgerPath)) return {};
    const saved = JSON.parse(readFileSync(attached.ledgerPath, 'utf8'));
    if (saved?.version !== 1 || !saved.launches || typeof saved.launches !== 'object') throw Error('resource ledger malformed');
    return saved.launches;
  }
  /** Throws when the durable write fails: callers decide what an unrecorded launch means. */
  function ledger(update) {
    if (!attached?.ledgerPath) return;
    const rows = readLedger();
    for (const carry of pendingEvidence.values()) carry(rows);
    update(rows);
    durableWrite(attached.ledgerPath, { version: 1, launches: rows });
    const landed = [...pendingEvidence.entries()];
    pendingEvidence.clear();
    for (const [, carry] of landed) carry.landed?.();
  }
  /** Durable membership of a launch: every recorded incarnation, plus how many member writes failed.
   * A failed write stays pending and lands with the next successful write; until then the launch's
   * recording is `incomplete` and its row is never closed. */
  function recordMembers(lease, extra = {}) {
    const carry = rows => {
      if (!rows[lease.id]) {
        if (!extra.cleanup) return;
        rows[lease.id] = { pid: lease.pid, start: lease.known.get(lease.pid) ?? null, owner: attached?.owner ?? null,
          enforcement: lease.enforcement, uidProcesses: lease.uidProcesses, workingArea: lease.workingArea ?? null,
          sandboxArea: lease.sandboxArea ?? null };
      }
      Object.assign(rows[lease.id], { members: Object.fromEntries(lease.known), ...extra },
        lease.recordingFailures ? { recording: 'repaired', recordingFailures: lease.recordingFailures } : {});
    };
    carry.landed = () => { if (lease.recording === 'incomplete') lease.recording = 'repaired'; };
    try { ledger(carry); carry.landed(); }
    catch {
      lease.recording = 'incomplete'; lease.recordingFailures++; counters.recordingFailures++;
      pendingEvidence.set(lease.id, carry);
    }
  }
  function wake() {
    waiters.sort((a, b) => Number(priorityOf(b.work) === 'critical') - Number(priorityOf(a.work) === 'critical') || a.order - b.order);
    for (const waiter of [...waiters]) {
      if (waiter.stopped?.() || ports.now() >= waiter.deadline) { settleWaiter(waiter, null); continue; }
      const lease = tryReserve(waiter.work, waiter.requestedAt);
      if (lease) settleWaiter(waiter, lease);
    }
    if (!waiters.length && pump) { clearInterval(pump); pump = null; }
  }
  function settleWaiter(waiter, lease) {
    waiters.splice(waiters.indexOf(waiter), 1);
    if (!lease && !waiter.stopped?.()) {
      counters.refusedCapacity++;
      record({ kind: 'capacity-refused', work: waiter.work, level: level() });
    }
    waiter.resolve(lease);
  }
  function reserve(work, requestedAt = ports.monotonic(), id = randomUUID()) {
    const lease = { id, work, startedAt: ports.now(), pid: null, memoryBytes: 0, processes: 0,
      cpuMilliseconds: 0, members: [], known: new Map(), limit: null, enforcement: null, uidProcesses: null,
      peakMemoryBytes: 0, peakProcesses: 0, census: 'none', previous: new Map(), recording: 'complete', recordingFailures: 0 };
    launches.set(lease.id, lease); counters.admitted++;
    // This launch's own admission evidence: how many owned launches ran with it, and how long it waited.
    lease.admission = { work, concurrent: launches.size, waitedMs: Math.max(0, Math.round(ports.monotonic() - requestedAt)) };
    peak.launches = Math.max(peak.launches, launches.size);
    if (!sampler) sampler = setInterval(() => { void sample(); }, ceilings.sampleMs);
    return lease;
  }
  /** Local admission (count, answer reserve, priority brake), then the Six allocation: the launch's
   * resource set is committed across its domains and attached to its ordinary reservation. A Six
   * capacity refusal waits like a local one; nothing is reserved locally without the Six debit. */
  function tryReserve(work, requestedAt = ports.monotonic()) {
    if (!eligible(work)) return null;
    if (!ports.allocation) return reserve(work, requestedAt);
    const id = randomUUID();
    let reserved;
    try { reserved = ports.allocation.reserve({ launch: id, work, memoryBytes: ceilings.launch.memoryBytes,
      processCount: ceilings.launch.processCount }); }
    catch (error) { reserved = { ok: false, reason: String(error?.message ?? error) }; }
    if (!reserved?.ok) {
      counters.allocationRefusals = (counters.allocationRefusals ?? 0) + 1;
      lastAllocationRefusal = reserved?.reason ?? 'refused';
      return null;
    }
    const lease = reserve(work, requestedAt, id);
    lease.allocation = reserved.handle;
    return lease;
  }
  function admit(work, timeout, stopped) {
    const now = tryReserve(work);
    if (now) return Promise.resolve(now);
    counters.waited++;
    return new Promise(resolve => {
      waiters.push({ work, stopped, resolve, order: counters.waited, deadline: ports.now() + Math.max(0, timeout),
        requestedAt: ports.monotonic() });
      pump ??= setInterval(wake, 100);
      persist(true);
    });
  }
  function release(lease) {
    launches.delete(lease.id);
    if (!launches.size && sampler) { clearInterval(sampler); sampler = null; usage = { ...usage, observation: 'idle',
      memoryBytes: 0, processes: 0 }; }
    wake(); persist(true);
  }
  /** Signal only pids attributed in this sample or re-verified against their recorded start evidence. */
  function terminate(lease, reason, members = lease.members) {
    if (lease.limit) return;
    lease.limit = reason;
    counters.killed[reason] = (counters.killed[reason] ?? 0) + 1;
    if (lease.pid) kill(-lease.pid);
    // Completion re-verifies every member: a denied signal here surfaces there as unresolved.
    for (const pid of members) kill(pid);
    record({ kind: 'limit-kill', work: lease.work, reason, memoryBytes: lease.memoryBytes, processes: lease.processes });
  }
  // The harness's own user (harness-user.mjs), when the runner launches the harness as it: its processes are in the
  // census (so the tree's memory and processes are still sampled and bounded), but this account cannot signal them or
  // read their working directories; its launcher ends that tree, and cleanup waits for it (boundedly) instead.
  let harnessUid = null;
  const ownUid = typeof process.getuid === 'function' ? process.getuid() : null;
  const inventory = createProcessInventory({ query: (file, args) => query(file, args), now: () => ports.now(),
    monotonic: () => ports.monotonic(), identity: HOST_IDENTITY, limit: censusLimit, freshForMs: 2 * ceilings.sampleMs,
    uid: ownUid, uids: () => harnessUid === null ? [ownUid] : [ownUid, harnessUid] });
  const harnessRow = (snapshot, pid) => harnessUid !== null && snapshot.processes.find(p => p.pid === pid)?.uid === harnessUid;
  const rootOf = lease => ({ id: lease.id, pid: lease.pid, known: lease.known, workingArea: lease.workingArea ?? null,
    sandboxArea: lease.sandboxArea ?? null, start: lease.known.get(lease.pid) ?? null });
  /** One Ten census of every current-user process, joined to the owned launches by recorded
   * incarnation, group, ancestry and private working area. `complete`, `partial` (census or
   * candidate bound reached: examined/omitted counted) or `failed` (a refused read): a partial
   * or failed census never reads as empty. */
  async function census(leases) { return joinRoots(leases.filter(l => l.pid).map(rootOf)); }
  /** The one membership join, shared by live cleanup and restart recovery: a recovered root carries the
   * same working-area and sandbox declarations its launch row recorded, so recovery joins exactly as live does. */
  async function joinRoots(roots) {
    let snapshot, ten;
    // An owner module that cannot load is a failed census (unknown), never an empty one.
    try { ten = await loadTenOwner(); snapshot = await inventory.census(); }
    catch { return { state: 'failed', snapshot: { id: `inventory:${randomUUID()}`, adapter: 'unavailable', adapterDigest: 'unavailable' },
      members: null, rows: null }; }
    const { launchMembership, joinWorkingArea, joinSandbox } = ten;
    if (snapshot.status === 'failed') return { state: 'failed', snapshot, members: null, rows: null };
    const { members, candidates } = launchMembership(snapshot, roots, process.pid);
    const joined = new Map(members);
    const read = candidates.slice(0, ceilings.candidateLimit ?? RESOURCE_CEILINGS.candidateLimit);
    const cwds = read.length ? await inventory.workingDirectories(read) : new Map();
    if (read.length) for (const [pid, member] of joinWorkingArea(snapshot, roots, read, cwds)) joined.set(pid, member);
    // The sandbox join: a candidate the working-area join missed (it changed directory out of the area) is still a
    // member of a sandboxed launch if the kernel says it is in that launch's sandbox instance. An unreadable reading is
    // unknown, so a census holding one is never complete.
    const areas = [...new Set(roots.map(l => l.sandboxArea).filter(Boolean))];
    const unjoined = read.filter(pid => !joined.has(pid));
    let unboxed = 0;
    if (areas.length && unjoined.length) {
      const readings = typeof joinSandbox === 'function' ? await inventory.sandboxes(unjoined, areas) : new Map();
      if (typeof joinSandbox === 'function') for (const [pid, member] of joinSandbox(snapshot, roots, unjoined, readings)) joined.set(pid, member);
      unboxed = await unreadCandidates(snapshot, unjoined.filter(pid => readings.get(pid)?.state !== 'observed'), new Map());
    }
    const leftover = read.filter(pid => !joined.has(pid));
    const unread = await unreadCandidates(snapshot, leftover.filter(pid => !harnessRow(snapshot, pid)), cwds) + unboxed;
    // A harness-user process no join reached (its working directory is unreadable to this account): unknown now, and
    // its launcher ends it, so cleanup waits for it to go rather than reading the census as complete or as failed.
    const harnessUnread = await unreadCandidates(snapshot, leftover.filter(pid => harnessRow(snapshot, pid)), cwds);
    const settled = snapshot.status !== 'partial' && read.length >= candidates.length && !unread;
    const state = settled && !harnessUnread ? 'complete' : 'partial';
    return { state, waiting: settled && harnessUnread > 0, snapshot, members: joined, rows: new Map(snapshot.processes.map(p => [p.pid, p])),
      examined: snapshot.examined, omitted: (snapshot.omitted ?? 0) + candidates.length - read.length };
  }
  /** Candidates whose working directory could not be read and that are still the same live
   * incarnation: their membership is unknown, so a census holding one is never complete. */
  async function unreadCandidates(snapshot, read, cwds) {
    let unread = 0;
    for (const pid of read) {
      if (cwds.get(pid)?.state === 'observed') continue;
      const now = await startEvidence(pid), row = snapshot.processes.find(p => p.pid === pid);
      if (now === UNKNOWN || (now !== null && now === row?.start)) unread++;
    }
    return unread;
  }
  async function sample() {
    const roots = [...launches.values()].filter(l => l.pid && l.running);
    if (sampling || !roots.length) return;
    sampling = true;
    const started = ports.monotonic(), queriesBefore = observer.queries, cpuBefore = process.cpuUsage();
    // Lag: how late this tick ran against its cadence (a starved loop shows here).
    const lag = lastTickAt === null ? null : Math.max(0, started - lastTickAt - ceilings.sampleMs);
    lastTickAt = started;
    try {
      const seen = await census([...launches.values()]);
      const at = ports.now(), monotonicAt = ports.monotonic();
      if (seen.state === 'failed') {
        counters.observationFailures++; usage = { ...usage, observation: 'failed', sampledAt: at };
        lastSample = { sourceSample: seen.snapshot.id, ...HOST_IDENTITY, at, census: { state: 'failed', examined: 0, omitted: null,
          adapter: seen.snapshot.adapter, adapterDigest: seen.snapshot.adapterDigest }, points: [] };
        return;
      }
      if (seen.state === 'partial') counters.partialSamples++;
      const sourceSample = seen.snapshot.id, points = [], joined = [];
      for (const lease of roots) Object.assign(lease, { memoryBytes: 0, processes: 0, cpuMilliseconds: 0, members: [] });
      for (const [pid, member] of seen.members) {
        const lease = roots.find(l => l.id === member.launch), row = seen.rows.get(pid);
        if (!lease || !row || row.zombie) continue;
        const reading = row.resource;
        lease.processes++; lease.members.push(pid);
        if (reading.state === 'reported') { lease.memoryBytes += reading.rssBytes; lease.cpuMilliseconds += reading.cumulativeCpuMs; }
        if (!lease.known.has(pid)) { lease.known.set(pid, row.start); joined.push(lease); }
        // docs/20 §6: CPU consumed across a recorded monotonic interval, per process incarnation.
        const incarnation = `${pid}:${row.start}`, prior = lease.previous.get(incarnation);
        const cpu = reading.cumulativeCpuMs;
        points.push({ id: `${sourceSample}:${pid}`, machine: HOST_IDENTITY.machine, processIncarnation: incarnation,
          sourceSample, at, hardwareProfile: HOST_IDENTITY.hardwareProfile, classifierGeneration: HOST_IDENTITY.classifierGeneration,
          cadenceMs: ceilings.sampleMs, state: reading.state === 'reported' ? 'observed' : reading.state, membership: member.reason,
          launch: lease.id, pid, startEvidence: row.start,
          cpuTimeMs: prior && cpu !== null ? Math.max(0, cpu - prior.cpu) : null,
          monotonicIntervalMs: prior && monotonicAt > prior.monotonicAt ? monotonicAt - prior.monotonicAt : null,
          cumulativeCpuMs: cpu, rssBytes: reading.rssBytes, heapBytes: null, heapState: 'unsupported' });
        if (cpu !== null) lease.previous.set(incarnation, { cpu, monotonicAt });
      }
      for (const point of points) if (point.cpuTimeMs === null || point.monotonicIntervalMs === null) {
        point.cpuTimeMs = null; point.monotonicIntervalMs = null;
      }
      // Recorded members that were not seen are missing samples, never zero.
      for (const lease of roots) for (const [pid, start] of lease.known)
        if (!seen.rows.has(pid) || seen.rows.get(pid).start !== start)
          points.push({ id: `${sourceSample}:${pid}`, machine: HOST_IDENTITY.machine, processIncarnation: `${pid}:${start}`, sourceSample, at,
            hardwareProfile: HOST_IDENTITY.hardwareProfile, classifierGeneration: HOST_IDENTITY.classifierGeneration,
            cadenceMs: ceilings.sampleMs, state: 'missing', launch: lease.id, pid, startEvidence: start, cpuTimeMs: null,
            monotonicIntervalMs: null, cumulativeCpuMs: null, rssBytes: null, heapBytes: null, heapState: 'missing' });
      // New members join the durable ledger with their start evidence, so recovery and completion
      // can find a member that later leaves the group, and never mistake a reused pid for it.
      // A launch whose earlier member write failed retries here too, so its pending members land.
      for (const lease of new Set([...joined, ...roots.filter(l => l.recording === 'incomplete')])) recordMembers(lease);
      usage = { observation: seen.state === 'complete' ? 'observed' : 'partial', sampledAt: at,
        memoryBytes: roots.reduce((sum, l) => sum + l.memoryBytes, 0), processes: roots.reduce((sum, l) => sum + l.processes, 0) };
      lastSample = { sourceSample, ...HOST_IDENTITY, at, census: { state: seen.state, examined: seen.examined, omitted: seen.omitted,
        adapter: seen.snapshot.adapter, adapterDigest: seen.snapshot.adapterDigest }, points };
      peak.memoryBytes = Math.max(peak.memoryBytes, usage.memoryBytes); peak.processes = Math.max(peak.processes, usage.processes);
      for (const lease of roots) {
        lease.peakMemoryBytes = Math.max(lease.peakMemoryBytes, lease.memoryBytes);
        lease.peakProcesses = Math.max(lease.peakProcesses, lease.processes);
        if (lease.census !== 'partial') lease.census = seen.state;
        const over = (kind, unit, value, ceiling) => ports.compare(measured(kind, `launch:${lease.id}`, unit, value, at),
          measured(kind, `launch:${lease.id}`, unit, ceiling, at)) > 0;
        if (over('owned-process-memory', 'bytes', lease.memoryBytes, ceilings.launch.memoryBytes)) terminate(lease, 'memory');
        else if (over('owned-process-count', 'processes', lease.processes, ceilings.launch.processCount)) terminate(lease, 'processes');
        // The tree's summed CPU against its budget: each process is also held by RLIMIT_CPU.
        else if (over('owned-process-cpu', 'ms', lease.cpuMilliseconds, ceilings.launch.cpuMilliseconds)) terminate(lease, 'cpu');
      }
      const aggregate = (kind, unit, value, ceiling) => ports.compare(measured(kind, 'host-owned-launches', unit, value, at),
        measured(kind, 'host-owned-launches', unit, ceiling, at)) > 0;
      if (aggregate('owned-process-memory', 'bytes', usage.memoryBytes, ceilings.aggregate.memoryBytes)
        || aggregate('owned-process-count', 'processes', usage.processes, ceilings.aggregate.processCount)) {
        // Reclaim the newest maintenance launch first: answer work is preserved.
        const live = roots.filter(l => !l.limit);
        const victim = live.filter(l => priorityOf(l.work) !== 'critical').at(-1) ?? live.at(-1);
        if (victim) terminate(victim, 'aggregate');
      }
    } catch { counters.observationFailures++; usage = { ...usage, observation: 'failed' }; }
    finally {
      // docs/20 §6: the observer's own cost is recorded under its own subject.
      const tick = Math.max(0, ports.monotonic() - started);
      const cpu = process.cpuUsage(cpuBefore);
      observer = { ...observer, ticks: observer.ticks + 1, elapsedMs: observer.elapsedMs + tick, lastTickMs: tick,
        cpuMs: observer.cpuMs + Math.round((cpu.user + cpu.system) / 1000), lastLagMs: lag,
        maxLagMs: Math.max(observer.maxLagMs, lag ?? 0), lastTickQueries: observer.queries - queriesBefore };
      sampling = false; persist(); wake();
    }
  }
  /** A process's start evidence; `null` when it does not exist, `UNKNOWN` when the query failed. */
  async function startEvidence(pid) {
    const text = await query('/bin/ps', ['-o', 'lstart=', '-p', String(pid)]);
    return text === null ? UNKNOWN : startIdentity(text) || null;
  }
  /** The kernel process limit of the user ID: its current process count plus the launch ceiling.
   * Its subject is the user ID (every process of that user counts), never the launched tree. */
  async function processLimit() {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    if (uid === null || uid === 0) return { state: 'unavailable', subject: null, limit: null };
    const listed = pids(await query('/bin/ps', ['-U', String(uid), '-o', 'pid=']));
    return listed === null || listed.length === 0 ? { state: 'unavailable', subject: null, limit: null }
      : { state: 'hard', subject: `uid:${uid}`, limit: listed.length + ceilings.launch.processCount };
  }
  /** This launch's live members in one census (recorded incarnations, group, ancestry and working
   * area); `null` when the census failed or was partial: absence is then unproven. */
  async function liveMembers(lease) {
    const seen = await census([...launches.values()]);
    if (seen.state !== 'complete' && !seen.waiting) return null;
    const mine = [...seen.members].filter(([pid, member]) => member.launch === lease.id && !seen.rows.get(pid).zombie)
      .map(([pid]) => [pid, seen.rows.get(pid).start, seen.rows.get(pid).uid]);
    // A recorded incarnation still alive is ours even if no join reached it this time.
    for (const [pid, start] of lease.known) {
      const row = seen.rows.get(pid);
      if (row && row.start === start && !row.zombie && !mine.some(([p]) => p === pid)) mine.push([pid, start, row.uid]);
    }
    return Object.assign(mine, { waiting: seen.waiting === true });
  }
  /** After the provider exits: every live member of this launch (one that left the group, and one
   * that detached before any sample but stayed in the private working area, included) is recorded
   * durably and then reclaimed by the live owner of this launch. Every census in the bounded wait
   * reclaims what it finds: a member can first appear after an earlier census (a shell that forked
   * its command just before it was signalled), and waiting on it would leave it running. Quiescence
   * is a complete census that finds none. Returns how many were left behind and whether any remain
   * unverified. */
  async function cleanupTree(lease) {
    let unresolved = lease.recording === 'incomplete', quiet = false;
    const reclaimed = new Set();
    for (let attempt = 0; attempt < 20 && !quiet; attempt++) {
      const living = await liveMembers(lease);
      if (living === null) { unresolved = true; break; }
      if (!living.length && !living.waiting) { quiet = true; break; }
      let discovered = false;
      for (const [pid, start] of living) if (!lease.known.has(pid)) { lease.known.set(pid, start); discovered = true; }
      // Ownership evidence is durable before any signal, so a failed signal leaves it recoverable.
      if (discovered) recordMembers(lease);
      if (lease.pid) kill(-lease.pid);
      // A harness-user member refuses this account's signal by design: its launcher is ending it, so the next census
      // (bounded by this loop) sees it gone; one still alive when the loop ends is `unresolved` below.
      for (const [pid, , uid] of living) {
        if (kill(pid) === 'denied' && !(harnessUid !== null && uid === harnessUid)) unresolved = true;
        reclaimed.add(pid);
      }
      if (unresolved) break;
      await new Promise(done => setTimeout(done, 100));
    }
    // A signal attempt is not quiescence: every member must be observed gone in a complete census.
    if (!quiet) unresolved = true;
    if (unresolved) counters.cleanupUnresolved++;
    const leaked = reclaimed.size;
    if (leaked) {
      counters.leakedDescendants += leaked;
      record({ kind: 'leaked-descendants', work: lease.work, processes: leaked });
    }
    return { leaked, unresolved };
  }
  /** Returns a launch's Six debit once, citing the evidence that proves the outcome; false when it could not. */
  function closeAllocationOf(lease, settlement) {
    if (!lease.allocation || lease.allocation.closed) return true;
    try { const closed = ports.allocation.close(lease.allocation.set, settlement); if (closed?.ok) { lease.allocation.closed = settlement; return true; } }
    catch { /* the durable launch row keeps the allocation for recovery */ }
    counters.allocationCloseFailures = (counters.allocationCloseFailures ?? 0) + 1;
    return false;
  }
  function run(input, lease, uidProcesses) {
    const handles = Math.max(16, ceilings.launch.handleCount);
    const cpuSeconds = Math.max(1, Math.ceil(ceilings.launch.cpuMilliseconds / 1000));
    lease.enforcement = enforcement(); lease.uidProcesses = uidProcesses;
    // The join covers the whole private area the launch may write to, not just its working directory:
    // `input.area` (a caller's private scratch volume holding both the working directory and the launch's
    // own temporary directory) when given, so a descendant that changes to a sibling directory inside that
    // volume is still a member. Absent, the working directory is the area, as before.
    lease.workingArea = privateArea(input.area ?? input.cwd);
    // A launch under its own sandbox profile (one that reads this private area and not its parent) is also joined by
    // the kernel's sandbox identity; without a private area there is nothing to name the instance by.
    lease.sandboxArea = input.membership === 'sandbox' ? lease.workingArea : null;
    const limitValue = uidProcesses.limit;
    const closeAllocation = settlement => closeAllocationOf(lease, settlement);
    return new Promise(resolve => {
      let child;
      try {
        child = spawn('/bin/sh', limitedArgv({ executable: input.executable, args: input.args, handles, cpuSeconds,
          processLimit: limitValue, env: input.env, gated: true }), {
          cwd: input.cwd, env: { ...input.env, __CF_USER_TEXT_ENCODING: undefined, NODE_V8_COVERAGE: undefined },
          shell: false, detached: true, stdio: ['pipe', 'pipe', 'ignore', 'pipe'] });
      } catch {
        closeAllocation(`never-launched:${lease.id}`);
        resolve({ code: null, limited: true, localLimit: null, stdout: '', stdoutBytes: new Uint8Array() }); return;
      }
      lease.pid = child.pid ?? null;
      let chunks = [], size = 0, limited = false, localLimit = null, gateOpened = false;
      const fail = reason => { if (limited) return; limited = true; localLimit = reason; chunks = [];
        if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch { /* A group may be gone or unavailable. */ }
        try { child.kill('SIGKILL'); } catch { /* Timer and stop callbacks must never throw. */ }
      };
      const gate = child.stdio[3];
      gate?.on('error', () => { /* a gate closed by an exited shell is harmless */ });
      // Durable launch evidence before the provider runs: the shim waits for this go signal.
      const openGate = async () => {
        if (!lease.pid) return;
        const evidence = await startEvidence(lease.pid), start = typeof evidence === 'string' ? evidence : null;
        if (start) lease.known.set(lease.pid, start);
        try {
          ledger(rows => { rows[lease.id] = { pid: lease.pid, start, owner: attached?.owner ?? null,
            members: Object.fromEntries(lease.known), enforcement: lease.enforcement, uidProcesses: lease.uidProcesses,
            workingArea: lease.workingArea, sandboxArea: lease.sandboxArea, allocation: lease.allocation?.set ?? null }; });
        } catch {
          // The gate never opened, so the provider never ran: the Six debit returns now.
          closeAllocation(`never-launched:${lease.id}`);
          // The launch could not be recorded: it never runs (the owner refuses it rather than lose it).
          counters.refusedCapacity++;
          record({ kind: 'capacity-refused', work: lease.work, level: 'launch-evidence-unrecorded' });
          fail('capacity'); return;
        }
        if (limited) return;
        lease.running = true;
        try { gate.end('go\n'); gateOpened = true; } catch { fail(null); }
      };
      const gateTimer = setTimeout(() => { if (!lease.running) fail('capacity'); }, GATE_TIMEOUT_MS);
      void openGate().catch(() => fail('capacity'));
      const timer = setTimeout(() => fail('timeout'), input.timeout);
      const stopTimer = input.stopped ? setInterval(() => { if (input.stopped()) fail(null); }, 25) : undefined;
      let settleTimer, settled = false;
      child.on('error', () => { clearTimeout(timer); clearTimeout(gateTimer); clearInterval(stopTimer); clearTimeout(settleTimer); resolve({ code: null, limited: true, localLimit: null, stdout: '', stdoutBytes: new Uint8Array() }); });
      child.stdin.on('error', () => fail(null));
      child.stdout.on('data', chunk => {
        size += chunk.length;
        if (size > input.maxBytes) fail('size'); else if (!limited) chunks.push(chunk);
      });
      const finalize = (code, signal, stdoutHeld) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); clearTimeout(gateTimer); clearInterval(stopTimer); clearTimeout(settleTimer);
        lease.running = false;
        // The stdout stream never ended; drop it so the owner holds no half-open read of a leaked descendant.
        if (stdoutHeld) try { child.stdout.destroy(); } catch { /* already gone */ }
        if (lease.limit) { limited = true; localLimit = lease.limit; chunks = []; }
        else if (signal === 'SIGXCPU' && !limited) {
          limited = true; localLimit = 'cpu'; chunks = [];
          counters.killed.cpu = (counters.killed.cpu ?? 0) + 1;
          record({ kind: 'limit-kill', work: lease.work, reason: 'cpu' });
        }
        const stdoutBytes = Buffer.concat(chunks);
        const done = ({ leaked, unresolved }) => {
          // A row is removed only once every recorded member is verified gone; otherwise it stays
          // for recovery to observe (the launch evidence is never discarded while unresolved).
          // A verified cleanup returns the Six debit citing that evidence, then drops the row; if the
          // return cannot land the row keeps the allocation, and recovery returns it once later.
          if (!unresolved) closeAllocation(gateOpened ? `cleanup-verified:${lease.id}` : `never-launched:${lease.id}`);
          if (!unresolved && (!lease.allocation || lease.allocation.closed))
            try { ledger(rows => { delete rows[lease.id]; }); } catch { /* observed at the next attach */ }
          // An unresolved launch keeps every discovered incarnation durably (a member whose earlier
          // write failed included), so recovery observes it after a restart; a failed write stays pending.
          else recordMembers(lease, { cleanup: 'unresolved' });
          // `verified`: a complete census found no live member by recorded incarnation, group, ancestry
          // or private working area. With no private working area the escape join is unavailable
          // and the label stays `unconfined` (only recorded members could be verified).
          const resources = { enforcement: lease.enforcement, uidProcesses: lease.uidProcesses, admission: lease.admission,
            peakMemoryBytes: lease.peakMemoryBytes, peakProcesses: lease.peakProcesses,
            treeCpuMilliseconds: lease.cpuMilliseconds, census: lease.census, leakedDescendants: leaked,
            membership: lease.sandboxArea ? 'sandbox-joined' : lease.workingArea ? 'working-area-joined' : 'unconfined',
            cleanup: unresolved ? 'unresolved' : lease.workingArea ? 'verified' : 'unconfined',
            allocation: lease.allocation ? { set: lease.allocation.set, operation: lease.allocation.operation,
              state: lease.allocation.closed ? 'returned' : 'reserved', settlement: lease.allocation.closed ?? null } : null };
          lastLaunch = { work: lease.work, at: ports.now(), ...resources };
          resolve({ code, limited, localLimit, stdout: stdoutBytes.toString('utf8'), stdoutBytes: new Uint8Array(stdoutBytes), resources });
        };
        if (lease.pid) cleanupTree(lease).then(done, () => done({ leaked: 0, unresolved: true }));
        else done({ leaked: 0, unresolved: false });
      };
      // The ordinary settlement: the output stream ended because nothing outside the launch holds it.
      child.on('close', (code, signal) => finalize(code, signal, false));
      // The launch process exited but its output stream has not ended yet. The owner settles when it does
      // ('close'), but never waits past EXIT_SETTLE_MS: a descendant that detached holding the stdout open
      // (an escaped or suspended helper) would otherwise keep 'close' from ever firing, so the owner
      // force-settles itself and its cleanup then ends every member it can reach. A helper inside the
      // launch is never the owner's only way to finish.
      child.on('exit', (code, signal) => { if (!settled) settleTimer = setTimeout(() => finalize(code, signal, true), EXIT_SETTLE_MS); });
      child.stdin.end(input.stdin, 'utf8');
    });
  }
  /** Observation-only recovery (docs/18 §§8, 14): a row is examined against its owner and every
   * recorded member's incarnation. A live owner, an unknown reading or a surviving member keeps the
   * row; nothing is signalled, because disposal needs the unlanded typed recovery effect. Only a row
   * whose owner is gone and whose every recorded member is verified gone (missing, or the pid now
   * names another incarnation) is closed. */
  async function recover() {
    orphans = [];
    let rows;
    try { rows = readLedger(); } catch { orphans = [{ launch: null, state: 'unknown', reason: 'ledger unreadable' }]; return; }
    const closed = [], judged = [];
    for (const [id, row] of Object.entries(rows)) {
      const members = Object.entries(row?.members ?? {}).map(([pid, start]) => [Number(pid), startIdentity(start)]);
      if (Number.isSafeInteger(row?.pid) && !members.some(([pid]) => pid === row.pid)) members.push([row.pid, startIdentity(row.start) ?? null]);
      // A live owner (the same incarnation still running, or unknown) owns its launch: never ours to judge.
      const owner = row?.owner;
      const ownerNow = owner && Number.isSafeInteger(owner.pid) ? await startEvidence(owner.pid) : null;
      if (ownerNow === UNKNOWN || owner && typeof owner.start === 'string' && ownerNow === startIdentity(owner.start)) {
        orphans.push({ launch: id, state: ownerNow === UNKNOWN ? 'unknown' : 'live-owner', owner: owner.pid }); continue;
      }
      let surviving = 0, unknown = 0;
      for (const [pid, start] of members) {
        if (!Number.isSafeInteger(pid) || pid <= 1 || typeof start !== 'string') { unknown++; continue; }
        const current = await startEvidence(pid);
        if (current === UNKNOWN) { unknown++; continue; }
        const verdict = ports.reconcile ? ports.reconcile({ pid, start }, current)
          : current === null ? 'missing' : current === start ? 'same' : 'new-incarnation';
        if (verdict === 'same') surviving++;
        else if (verdict !== 'missing' && verdict !== 'new-incarnation') unknown++;
      }
      judged.push({ id, row, members, surviving, unknown });
    }
    // An unrecorded escapee of a dead launch (it detached before any census and its owner died)
    // is found by the same working-area and sandbox joins live cleanup uses; observation only, so it keeps the row.
    const area = value => typeof value === 'string' ? value : null;
    const roots = judged.filter(j => Number.isSafeInteger(j.row?.pid)).map(j => ({ id: j.id, pid: j.row.pid,
      known: new Map(j.members.filter(([, start]) => typeof start === 'string')), workingArea: area(j.row.workingArea),
      sandboxArea: area(j.row.sandboxArea), start: typeof j.row.start === 'string' ? startIdentity(j.row.start) : null }));
    let escaped = null;
    if (roots.length) {
      let joined = null;
      try { joined = await joinRoots(roots); } catch { joined = null; }
      // Anything short of a complete census (a partial read, an unread working directory or an unreadable
      // sandbox reading) leaves membership unknown, so every row stays.
      if (joined?.state === 'complete') {
        escaped = new Map();
        for (const [pid, m] of joined.members) if (!joined.rows.get(pid)?.zombie && !roots.find(r => r.id === m.launch)?.known.has(pid))
          escaped.set(m.launch, (escaped.get(m.launch) ?? 0) + 1);
      }
    }
    for (const { id, members, surviving, unknown } of judged) {
      const found = escaped === null ? null : escaped.get(id) ?? 0;
      const unjoined = found === null ? 1 : 0;
      if (surviving || unknown || found || unjoined) {
        counters.orphansObserved++;
        orphans.push({ launch: id, state: surviving || found ? 'surviving' : 'unknown', surviving: surviving + (found ?? 0),
          unknown: unknown + unjoined, members: members.length, ...(found ? { unrecorded: found } : {}) });
        record({ kind: 'orphan-observed', launch: id, surviving: surviving + (found ?? 0), unknown: unknown + unjoined });
      } else closed.push(id);
    }
    // A return already durably closing (or closed) under its original settlement resumes under that
    // same cause; only a set not yet closing takes this recovery's cause.
    const settle = (set, cause) => {
      try { if (ports.allocation.close(set, cause)?.ok === true) return true; } catch { /* resumed below */ }
      try { return ports.allocation.resume?.(set)?.ok === true; } catch { return false; }
    };
    // A verified-gone launch returns its Six debit once; a row whose return cannot land stays.
    const returned = closed.filter(id => {
      const set = rows[id]?.allocation;
      if (!set || !ports.allocation) return true;
      return settle(set, `recovery-observed-gone:${id}`);
    });
    if (returned.length) try { ledger(all => { for (const id of returned) delete all[id]; }); } catch { /* observed again next attach */ }
    // A set whose launch has no durable row never opened its gate (the row precedes the gate), so the
    // provider never ran: its debit returns as never-launched.
    if (ports.allocation) {
      let open = [];
      try { open = ports.allocation.open(); } catch { open = []; }
      for (const { set, launch } of open) if (!rows[launch]) settle(set, `never-launched:${launch}`);
    }
  }
  async function observeInherited() {
    const text = await query('/bin/sh', ['-c', 'ulimit -S -n; ulimit -H -n; ulimit -S -t; ulimit -H -t; ulimit -S -u; ulimit -H -u']);
    const values = text?.trim().split('\n').map(v => v.trim() === 'unlimited' ? 'unlimited' : Number(v));
    if (!values || values.length !== 6 || values.some(v => v !== 'unlimited' && !Number.isSafeInteger(v))) {
      inherited = { state: 'unknown' }; return inherited;
    }
    const pair = (soft, hard) => ({ soft, hard });
    const effective = (hard, ceiling) => hard === 'unlimited' ? ceiling : Math.min(hard, ceiling);
    inherited = { state: 'observed', at: ports.now(), handles: pair(values[0], values[1]), cpuSeconds: pair(values[2], values[3]),
      userProcesses: pair(values[4], values[5]),
      effectivePerLaunch: { handleCount: effective(values[1], ceilings.launch.handleCount),
        cpuSeconds: effective(values[3], Math.ceil(ceilings.launch.cpuMilliseconds / 1000)) } };
    return inherited;
  }
  return Object.freeze({
    get ceilings() { return ceilings; },
    /** The harness's own user, when it did not exist at attach (harness-user.mjs harnessGate): from now on the census
     * includes its processes. Only once, never a different uid, never this account. */
    adoptHarnessUid(uid) {
      if (harnessUid === uid) return;
      if (harnessUid !== null) throw Error('resource owner: a different harness user is already in the census');
      if (!Number.isSafeInteger(uid) || uid <= 0 || uid === ownUid) throw Error('resource owner: the harness user must be a separate identity');
      harnessUid = uid;
    },
    /** One owner per process: a second attach is refused. */
    async attach(options = {}) {
      if (attached) throw Error('resource owner already attached');
      ports = { compare: options.compare ?? plainCompare, priorityGate: options.priorityGate ?? null,
        reconcile: options.reconcile ?? null, now: options.now ?? (() => Date.now()), query: options.query ?? hostQuery,
        monotonic: options.monotonic ?? (() => performance.now()),
        signal: options.signal ?? ((target, name) => process.kill(target, name)), allocation: options.allocation ?? null };
      // A durable owner launches only through its Six allocation (SEAM-LEDGER row 36).
      if (options.ledgerPath && !options.allocation) throw Error('resource owner: a durable owner needs its Six resource allocation');
      // A desk-controlled low-ceiling case: the aggregate memory ceiling may be lowered, never raised.
      if (options.aggregateMemoryBytes !== undefined) {
        const bytes = options.aggregateMemoryBytes;
        if (!Number.isSafeInteger(bytes) || bytes < MIN_AGGREGATE_MEMORY_BYTES || bytes > ceilings.aggregate.memoryBytes)
          throw Error('resource owner: aggregate memory ceiling may only be lowered');
        ceilings = Object.freeze({ ...ceilings, aggregate: Object.freeze({ ...ceilings.aggregate, memoryBytes: bytes }) });
      }
      if (options.harnessUid !== undefined && options.harnessUid !== null) {
        if (!Number.isSafeInteger(options.harnessUid) || options.harnessUid <= 0 || options.harnessUid === ownUid)
          throw Error('resource owner: the harness user must be a separate identity');
        harnessUid = options.harnessUid;
      }
      attached = { ledgerPath: options.ledgerPath ?? null, statePath: options.statePath ?? null, owner: { pid: process.pid, start: null } };
      const own = await startEvidence(process.pid);
      attached.owner.start = typeof own === 'string' ? own : null;
      // The bounded view continues across restarts instead of being overwritten empty.
      if (attached.statePath) try {
        const prior = JSON.parse(readFileSync(attached.statePath, 'utf8'));
        if (prior?.version === 1) {
          if (Array.isArray(prior.outcomes)) outcomes = prior.outcomes.slice(-OUTCOME_LIMIT);
          if (prior.counters && typeof prior.counters === 'object') counters = { ...counters, ...prior.counters, killed: { ...prior.counters.killed } };
          if (prior.peak && typeof prior.peak === 'object') peak = { ...peak, ...prior.peak };
        }
      } catch { /* no prior view */ }
      await observeInherited();
      await recover();
      persist(true);
      return snapshot();
    },
    async execute(input, work = 'answer') {
      if (input.stopped?.()) return { code: null, limited: true, localLimit: null, stdout: '', stdoutBytes: new Uint8Array() };
      const lease = await admit(work, input.timeout, input.stopped);
      if (!lease) return { code: null, limited: true, localLimit: input.stopped?.() ? null : 'capacity', stdout: '', stdoutBytes: new Uint8Array() };
      try { return await run(input, lease, await processLimit()); }
      finally { counters.completed++; release(lease); }
    },
    /**
     * Rules 60, 114: a delegated session's process tree, held like a launch this owner did not spawn
     * itself (tmux forks it). Admission (count, answer reserve, priority brake, Six allocation)
     * happens here, before the session exists; `attach` joins the session's root process and its
     * private working area, so the same sampled memory, process and CPU ceilings reclaim it; and
     * `release` runs the same verified cleanup. The per-process kernel limits (RLIMIT_CPU and
     * RLIMIT_NOFILE through the shim) do not reach a tmux-forked tree, so those bounds are `sampled`
     * here, never claimed `hard`. Returns null on a capacity refusal or a stop.
     */
    async hold(work, { timeout, stopped }) {
      if (stopped?.()) return null;
      const lease = await admit(work, timeout, stopped);
      if (!lease) return null;
      let outcome = null;
      return Object.freeze({
        async attach({ pid, cwd }) {
          if (!Number.isSafeInteger(pid) || pid <= 1) throw Error('resource owner: exact session root process required');
          lease.enforcement = { ...enforcement(), cpuPerProcess: 'sampled', handlesPerProcess: 'unsupported' };
          lease.uidProcesses = { state: 'unavailable', subject: null, limit: null };
          lease.workingArea = privateArea(cwd); lease.pid = pid;
          const evidence = await startEvidence(pid), start = typeof evidence === 'string' ? evidence : null;
          if (start) lease.known.set(pid, start);
          // Durable ownership evidence before the tree is counted as held (a failed write throws).
          ledger(rows => { rows[lease.id] = { pid, start, owner: attached?.owner ?? null, members: Object.fromEntries(lease.known),
            enforcement: lease.enforcement, uidProcesses: lease.uidProcesses, workingArea: lease.workingArea,
            allocation: lease.allocation?.set ?? null }; });
          lease.running = true;
          if (!sampler) sampler = setInterval(() => { void sample(); }, ceilings.sampleMs);
        },
        async release() {
          if (outcome) return outcome;
          lease.running = false;
          const { unresolved } = lease.pid ? await cleanupTree(lease) : { unresolved: false };
          if (!unresolved) closeAllocationOf(lease, lease.pid ? `cleanup-verified:${lease.id}` : `never-launched:${lease.id}`);
          if (!unresolved && (!lease.allocation || lease.allocation.closed))
            try { ledger(rows => { delete rows[lease.id]; }); } catch { /* observed at the next attach */ }
          else recordMembers(lease, { cleanup: 'unresolved' });
          counters.completed++; release(lease);
          outcome = { verified: !unresolved, limit: lease.limit ?? null };
          return outcome;
        },
      });
    },
    observeInherited,
    snapshot,
  });
}

/** The single owner of this host process. */
export const hostResources = createResourceOwner();
