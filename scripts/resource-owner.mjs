// The one physical resource owner of a host process (Rules 60, 61), in the fixed
// Ten physical host. It is the host's launch adapter, not the Six resource-set
// authority or the Ten process census: those seams (SEAM-LEDGER rows 36, 40, 63)
// are unlanded, and this adapter reports the bounds it can and cannot hold instead
// of claiming them.
//
// Every provider launch passes this owner's admission and runs through a limit
// shim. What is held hard, and on which subject:
//   - the count of concurrent owned launches, with a reserve for answer work
//     (this owner's own admission);
//   - per process: CPU time and open handles (RLIMIT_CPU, RLIMIT_NOFILE, soft and
//     hard), inherited by every descendant, including one that leaves the group;
//   - per user ID: RLIMIT_NPROC, lowered to the user's process count at launch plus
//     the launch's process ceiling. Its subject is the user ID, not the launched
//     tree: an unrelated process of the same user exiting frees a slot this tree
//     can take, so it is reported as `uidProcesses` with that subject and never as
//     a tree bound.
// What is NOT held hard on this host: the launched tree's process count and memory,
// and the aggregate memory/process ceilings are enforced only on observation
// (`sampled`); the tree's total handles are not observed (`unsupported`). There is
// no unprivileged confinement of a process tree here (a descendant can leave the
// group and session), so tree membership is `unconfined` and a completion can
// verify only the incarnations it recorded (`cleanup: 'unconfined'`), never that no
// descendant escaped. A confined tree needs the fixed native worker adapter with its
// own user ID and the Six allocation, which are not installed or landed here.
//
// The provider does not start until its launch evidence (pid, start evidence,
// owner) is durably recorded: the shim waits on a go signal the owner sends only
// after the ledger write, and exits unexecuted if the owner dies first.
//
// Observation is confined to owned launches: queries name the owned process group,
// owned parent pids, or pids this owner recorded with their start evidence. A pid
// is attributed or signalled only while its start evidence matches the recorded
// incarnation. A failed or denied query is `unknown`, never a rejection.
//
// Completion signals the remaining owned processes and then verifies that every
// recorded incarnation and the group are gone. A denied signal, a failed query, a
// member the ledger could not record, or a survivor keeps the durable row
// (`cleanup: 'unresolved'`): a signal attempt is not observed quiescence.
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
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { arch, cpus, hostname, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GiB = 1024 ** 3;
/** Ceilings use the NativeLaunchLimits field names of the effect doorway. */
export const RESOURCE_CEILINGS = Object.freeze({
  launch: Object.freeze({ memoryBytes: 2 * GiB, processCount: 32, handleCount: 1024, cpuMilliseconds: 600_000 }),
  aggregate: Object.freeze({ memoryBytes: 4 * GiB, processCount: 64, launches: 3 }),
  reserveLaunches: 1,
  sampleMs: 1000,
  /** Bounded census per tick: more owned processes than this is a partial sample. */
  censusLimit: 256,
});
const WORK = Object.freeze({ answer: 'critical', review: 'critical', maintenance: 'medium' });
const OUTCOME_LIMIT = 32;
const QUERY_TIMEOUT_MS = 2000;
const GATE_TIMEOUT_MS = 5000;
const UNKNOWN = Symbol('unknown');

// Wait for the owner's go signal (fd 3) when gated, then lower (never raise) the
// inherited soft and hard limits, then replace the shell with the provider,
// keeping its pid, process group and descendants under the ceiling. The hard
// limit matters: runtimes such as Node raise their own soft file limit to the hard
// limit at startup. The process limit is lowered last, because the shell's own
// command substitutions fork. The shell's own variables (PWD, SHLVL, OLDPWD) are
// removed by env(1), which execs in place, unless the caller supplied them.
const SHELL_VARIABLES = Object.freeze(['PWD', 'SHLVL', 'OLDPWD']);
const LIMIT_SCRIPT = [
  'if [ "$5" = gate ]; then read -r go <&3 || exit 125; [ "$go" = go ] || exit 125; exec 3<&-; fi',
  'lim() {',
  '  s=$(ulimit -S "$1") || exit 125',
  '  if [ "$s" = unlimited ] || [ "$s" -gt "$2" ]; then ulimit -S "$1" "$2" || exit 125; fi',
  '  h=$(ulimit -H "$1") || exit 125',
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
const pids = text => text === null ? null : text.split(/\s+/u).filter(Boolean).map(Number).filter(Number.isSafeInteger);
/** ps `time`: [[dd-]hh:]mm:ss[.cc] on both macOS and Linux. */
export function cpuMilliseconds(text) {
  const [days, clock] = text.includes('-') ? text.split('-') : ['0', text];
  const parts = clock.split(':').map(Number);
  if (parts.some(n => !Number.isFinite(n)) || !Number.isFinite(Number(days))) return null;
  const seconds = parts.reverse().reduce((total, part, index) => total + part * 60 ** index, 0);
  return Math.round((Number(days) * 86400 + seconds) * 1000);
}

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
export const HOST_BOUNDS = Object.freeze({ aggregateLaunches: 'hard', aggregateMemory: 'sampled', aggregateProcesses: 'sampled',
  treeMembership: 'unconfined', treeProcesses: 'sampled', treeHandles: 'unsupported', uidProcesses: 'hard',
  reason: 'no unprivileged per-tree confinement on this host: RLIMIT_NPROC bounds the user ID, not the launched tree' });
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
    monotonic: () => performance.now(), signal: (target, name) => process.kill(target, name) };
  let attached = null, inherited = { state: 'unobserved' }, usage = { level: 'normal', observation: 'idle',
    memoryBytes: 0, processes: 0, sampledAt: null };
  let lastSample = null, observer = { ticks: 0, queries: 0, elapsedMs: 0, lastTickMs: null };
  let orphans = [], lastLaunch = null;
  let sampling = false, sampler = null, pump = null, lastPersist = 0;
  const query = (file, args) => { observer.queries++; return ports.query(file, args).catch(() => null); };

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
      waiting: waiters.map(w => w.work), counters, peak, observer, sample: lastSample, lastLaunch, orphans, outcomes };
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
    update(rows);
    durableWrite(attached.ledgerPath, { version: 1, launches: rows });
  }
  function wake() {
    waiters.sort((a, b) => Number(priorityOf(b.work) === 'critical') - Number(priorityOf(a.work) === 'critical') || a.order - b.order);
    for (const waiter of [...waiters]) {
      if (waiter.stopped?.() || ports.now() >= waiter.deadline) { settleWaiter(waiter, null); continue; }
      if (eligible(waiter.work)) settleWaiter(waiter, reserve(waiter.work, waiter.requestedAt));
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
  function reserve(work, requestedAt = ports.monotonic()) {
    const lease = { id: randomUUID(), work, startedAt: ports.now(), pid: null, memoryBytes: 0, processes: 0,
      cpuMilliseconds: 0, members: [], known: new Map(), limit: null, enforcement: null, uidProcesses: null,
      peakMemoryBytes: 0, peakProcesses: 0, census: 'none', previous: new Map(), recording: 'complete' };
    launches.set(lease.id, lease); counters.admitted++;
    // This launch's own admission evidence: how many owned launches ran with it, and how long it waited.
    lease.admission = { work, concurrent: launches.size, waitedMs: Math.max(0, Math.round(ports.monotonic() - requestedAt)) };
    peak.launches = Math.max(peak.launches, launches.size);
    if (!sampler) sampler = setInterval(() => { void sample(); }, ceilings.sampleMs);
    return lease;
  }
  function admit(work, timeout, stopped) {
    if (eligible(work)) return Promise.resolve(reserve(work));
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
  const splitRow = line => {
    const parts = line.trim().split(/\s+/u);
    const [pid, ppid, pgid, rss, time] = parts, start = parts.slice(5).join(' ');
    const cpu = time === undefined ? null : cpuMilliseconds(time);
    if (!pid || cpu === null || !start || ![pid, ppid, pgid, rss].every(n => Number.isSafeInteger(Number(n)))) return null;
    return { pid: Number(pid), ppid: Number(ppid), pgid: Number(pgid), rssBytes: Number(rss) * 1024, cpu, start };
  };
  /** Owned trees only: owned groups, descendants of owned pids, and recorded members. The census
   * is `complete`, `partial` (traversal or census bound reached: examined/omitted counted) or
   * `failed` (a query was refused): a partial or failed census never reads as empty. */
  async function ownedTree(roots) {
    const members = new Set(roots.map(l => l.pid));
    for (const lease of roots) for (const pid of lease.known.keys()) members.add(pid);
    const group = pids(await query('/usr/bin/pgrep', ['-g', roots.map(l => l.pid).join(',')]));
    if (group === null) return { state: 'failed', rows: null };
    group.forEach(pid => members.add(pid));
    let frontier = [...members], truncated = false;
    for (let depth = 0; frontier.length; depth++) {
      if (depth >= 16 || members.size > censusLimit) { truncated = true; break; }
      const children = pids(await query('/usr/bin/pgrep', ['-P', frontier.join(',')]));
      if (children === null) return { state: 'failed', rows: null };
      frontier = children.filter(pid => !members.has(pid));
      frontier.forEach(pid => members.add(pid));
    }
    const examined = [...members].slice(0, censusLimit), omitted = members.size - examined.length;
    const table = await query('/bin/ps', ['-o', 'pid=,ppid=,pgid=,rss=,time=,lstart=', '-p', examined.join(',')]);
    if (table === null) return { state: 'failed', rows: null };
    const rows = new Map();
    for (const line of table.split('\n')) { const row = splitRow(line); if (row) rows.set(row.pid, row); }
    return { state: truncated || omitted > 0 ? 'partial' : 'complete', rows, examined: examined.length, omitted };
  }
  function ownerOf(pid, rows, roots) {
    const row = rows.get(pid);
    // A recorded member is ours only while it is the same incarnation.
    for (const lease of roots) if (lease.known.has(pid)) return lease.known.get(pid) === row?.start ? lease : null;
    for (let current = pid, hops = 0; current && hops < 64; hops++) {
      const root = roots.find(l => l.pid === current || rows.get(current)?.pgid === l.pid);
      if (root) return root;
      current = rows.get(current)?.ppid;
    }
    return null;
  }
  async function sample() {
    const roots = [...launches.values()].filter(l => l.pid && l.running);
    if (sampling || !roots.length) return;
    sampling = true;
    const started = ports.monotonic(), queriesBefore = observer.queries;
    try {
      const census = await ownedTree(roots);
      const at = ports.now(), monotonicAt = ports.monotonic();
      if (census.state === 'failed') {
        counters.observationFailures++; usage = { ...usage, observation: 'failed', sampledAt: at };
        lastSample = { sourceSample: randomUUID(), ...HOST_IDENTITY, at, census: { state: 'failed', examined: 0, omitted: null }, points: [] };
        return;
      }
      if (census.state === 'partial') counters.partialSamples++;
      const sourceSample = randomUUID(), points = [], joined = [];
      for (const lease of roots) Object.assign(lease, { memoryBytes: 0, processes: 0, cpuMilliseconds: 0, members: [] });
      for (const [pid, row] of census.rows) {
        const lease = ownerOf(pid, census.rows, roots);
        if (!lease) continue;
        lease.memoryBytes += row.rssBytes; lease.processes++; lease.cpuMilliseconds += row.cpu; lease.members.push(pid);
        if (!lease.known.has(pid)) { lease.known.set(pid, row.start); joined.push(lease); }
        // docs/20 §6: CPU consumed across a recorded monotonic interval, per process incarnation.
        const incarnation = `${pid}:${row.start}`, prior = lease.previous.get(incarnation);
        points.push({ id: `${sourceSample}:${pid}`, machine: HOST_IDENTITY.machine, processIncarnation: incarnation,
          sourceSample, at, hardwareProfile: HOST_IDENTITY.hardwareProfile, classifierGeneration: HOST_IDENTITY.classifierGeneration,
          cadenceMs: ceilings.sampleMs, state: 'observed', launch: lease.id, pid, startEvidence: row.start,
          cpuTimeMs: prior ? Math.max(0, row.cpu - prior.cpu) : null,
          monotonicIntervalMs: prior && monotonicAt > prior.monotonicAt ? monotonicAt - prior.monotonicAt : null,
          cumulativeCpuMs: row.cpu, rssBytes: row.rssBytes, heapBytes: null, heapState: 'unsupported' });
        lease.previous.set(incarnation, { cpu: row.cpu, monotonicAt });
      }
      for (const point of points) if (point.cpuTimeMs === null || point.monotonicIntervalMs === null) {
        point.cpuTimeMs = null; point.monotonicIntervalMs = null;
      }
      // Recorded members that were not seen are missing samples, never zero.
      for (const lease of roots) for (const [pid, start] of lease.known)
        if (!census.rows.has(pid) || census.rows.get(pid).start !== start)
          points.push({ id: `${sourceSample}:${pid}`, machine: HOST_IDENTITY.machine, processIncarnation: `${pid}:${start}`, sourceSample, at,
            hardwareProfile: HOST_IDENTITY.hardwareProfile, classifierGeneration: HOST_IDENTITY.classifierGeneration,
            cadenceMs: ceilings.sampleMs, state: 'missing', launch: lease.id, pid, startEvidence: start, cpuTimeMs: null,
            monotonicIntervalMs: null, cumulativeCpuMs: null, rssBytes: null, heapBytes: null, heapState: 'missing' });
      // New members join the durable ledger with their start evidence, so recovery and completion
      // can find a member that later leaves the group, and never mistake a reused pid for it.
      for (const lease of new Set(joined)) try {
        ledger(rows => { if (rows[lease.id]) rows[lease.id].members = Object.fromEntries(lease.known); });
      } catch {
        // A member the durable ledger does not hold: this launch's ownership is incomplete, so its
        // row is never closed by completion (it stays for recovery to observe).
        lease.recording = 'incomplete'; counters.recordingFailures++;
      }
      usage = { observation: census.state === 'complete' ? 'observed' : 'partial', sampledAt: at,
        memoryBytes: roots.reduce((sum, l) => sum + l.memoryBytes, 0), processes: roots.reduce((sum, l) => sum + l.processes, 0) };
      lastSample = { sourceSample, ...HOST_IDENTITY, at, census: { state: census.state, examined: census.examined, omitted: census.omitted },
        points };
      peak.memoryBytes = Math.max(peak.memoryBytes, usage.memoryBytes); peak.processes = Math.max(peak.processes, usage.processes);
      for (const lease of roots) {
        lease.peakMemoryBytes = Math.max(lease.peakMemoryBytes, lease.memoryBytes);
        lease.peakProcesses = Math.max(lease.peakProcesses, lease.processes);
        if (lease.census !== 'partial') lease.census = census.state;
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
      observer = { ticks: observer.ticks + 1, queries: observer.queries, elapsedMs: observer.elapsedMs + tick, lastTickMs: tick,
        lastTickQueries: observer.queries - queriesBefore };
      sampling = false; persist(); wake();
    }
  }
  /** A process's start evidence; `null` when it does not exist, `UNKNOWN` when the query failed. */
  async function startEvidence(pid) {
    const text = await query('/bin/ps', ['-o', 'lstart=', '-p', String(pid)]);
    return text === null ? UNKNOWN : text.trim() || null;
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
  /** Live incarnations of the named pids (a zombie is not live); `null` when the query failed. */
  async function incarnations(list) {
    if (!list.length) return new Map();
    const text = await query('/bin/ps', ['-o', 'pid=,stat=,lstart=', '-p', list.join(',')]);
    if (text === null) return null;
    const rows = new Map();
    for (const line of text.split('\n')) {
      const [pid, stat, ...start] = line.trim().split(/\s+/u);
      if (Number.isSafeInteger(Number(pid)) && stat && start.length) rows.set(Number(pid), { start: start.join(' '), zombie: stat.startsWith('Z') });
    }
    return rows;
  }
  /** Observed quiescence: the group is empty and no recorded incarnation is alive, within a bounded wait. */
  async function quiescent(lease) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const group = pids(await query('/usr/bin/pgrep', ['-g', String(lease.pid)]));
      const rows = await incarnations([...lease.known.keys()]);
      if (group === null || rows === null) return false;
      const living = [...lease.known].some(([pid, start]) => rows.get(pid)?.start === start && !rows.get(pid).zombie);
      if (!group.length && !living) return true;
      await new Promise(done => setTimeout(done, 100));
    }
    return false;
  }
  /** After the provider exits: remaining group members and every recorded member still the same
   * incarnation (one that left the group included) are reclaimed by the live owner of this launch.
   * Returns how many were left behind and whether any remain unverified. */
  async function cleanupTree(lease) {
    let leaked = 0, unresolved = lease.recording !== 'complete';
    const group = pids(await query('/usr/bin/pgrep', ['-g', String(lease.pid)]));
    if (group === null) unresolved = true;
    else if (group.length) {
      // Members keep the group id alive, so it cannot have been reused: every member is owned.
      if (kill(-lease.pid) === 'denied') unresolved = true;
      leaked += group.length;
    }
    const recorded = [...lease.known].filter(([pid]) => pid !== lease.pid && !group?.includes(pid));
    if (recorded.length) {
      const rows = await incarnations(recorded.map(([pid]) => pid));
      if (rows === null) unresolved = true;
      else for (const [pid, start] of recorded) if (rows.get(pid)?.start === start && !rows.get(pid).zombie) {
        if (kill(pid) === 'denied') unresolved = true;
        leaked++;
      }
    }
    // A signal attempt is not quiescence: every recorded incarnation and the group must be observed gone.
    if (!unresolved && !await quiescent(lease)) unresolved = true;
    if (unresolved) counters.cleanupUnresolved++;
    if (leaked) {
      counters.leakedDescendants += leaked;
      record({ kind: 'leaked-descendants', work: lease.work, processes: leaked });
    }
    return { leaked, unresolved };
  }
  function run(input, lease, uidProcesses) {
    const handles = Math.max(16, ceilings.launch.handleCount);
    const cpuSeconds = Math.max(1, Math.ceil(ceilings.launch.cpuMilliseconds / 1000));
    lease.enforcement = enforcement(); lease.uidProcesses = uidProcesses;
    const limitValue = uidProcesses.limit;
    return new Promise(resolve => {
      let child;
      try {
        child = spawn('/bin/sh', limitedArgv({ executable: input.executable, args: input.args, handles, cpuSeconds,
          processLimit: limitValue, env: input.env, gated: true }), {
          cwd: input.cwd, env: { ...input.env, __CF_USER_TEXT_ENCODING: undefined, NODE_V8_COVERAGE: undefined },
          shell: false, detached: true, stdio: ['pipe', 'pipe', 'ignore', 'pipe'] });
      } catch { resolve({ code: null, limited: true, localLimit: null, stdout: '', stdoutBytes: new Uint8Array() }); return; }
      lease.pid = child.pid ?? null;
      let chunks = [], size = 0, limited = false, localLimit = null;
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
            members: Object.fromEntries(lease.known), enforcement: lease.enforcement, uidProcesses: lease.uidProcesses }; });
        } catch {
          // The launch could not be recorded: it never runs (the owner refuses it rather than lose it).
          counters.refusedCapacity++;
          record({ kind: 'capacity-refused', work: lease.work, level: 'launch-evidence-unrecorded' });
          fail('capacity'); return;
        }
        if (limited) return;
        lease.running = true;
        try { gate.end('go\n'); } catch { fail(null); }
      };
      const gateTimer = setTimeout(() => { if (!lease.running) fail('capacity'); }, GATE_TIMEOUT_MS);
      void openGate().catch(() => fail('capacity'));
      const timer = setTimeout(() => fail('timeout'), input.timeout);
      const stopTimer = input.stopped ? setInterval(() => { if (input.stopped()) fail(null); }, 25) : undefined;
      child.on('error', () => { clearTimeout(timer); clearTimeout(gateTimer); clearInterval(stopTimer); resolve({ code: null, limited: true, localLimit: null, stdout: '', stdoutBytes: new Uint8Array() }); });
      child.stdin.on('error', () => fail(null));
      child.stdout.on('data', chunk => {
        size += chunk.length;
        if (size > input.maxBytes) fail('size'); else if (!limited) chunks.push(chunk);
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer); clearTimeout(gateTimer); clearInterval(stopTimer);
        lease.running = false;
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
          if (!unresolved) try { ledger(rows => { delete rows[lease.id]; }); } catch { /* observed at the next attach */ }
          // `unconfined`: every recorded incarnation was observed gone, but tree membership is not
          // confined on this host, so a descendant that escaped before it was recorded cannot be excluded.
          const resources = { enforcement: lease.enforcement, uidProcesses: lease.uidProcesses, admission: lease.admission,
            peakMemoryBytes: lease.peakMemoryBytes, peakProcesses: lease.peakProcesses,
            treeCpuMilliseconds: lease.cpuMilliseconds, census: lease.census, leakedDescendants: leaked,
            cleanup: unresolved ? 'unresolved' : 'unconfined' };
          lastLaunch = { work: lease.work, at: ports.now(), ...resources };
          resolve({ code, limited, localLimit, stdout: stdoutBytes.toString('utf8'), stdoutBytes: new Uint8Array(stdoutBytes), resources });
        };
        if (lease.pid) cleanupTree(lease).then(done, () => done({ leaked: 0, unresolved: true }));
        else done({ leaked: 0, unresolved: false });
      });
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
    const closed = [];
    for (const [id, row] of Object.entries(rows)) {
      const members = Object.entries(row?.members ?? {}).map(([pid, start]) => [Number(pid), start]);
      if (Number.isSafeInteger(row?.pid) && !members.some(([pid]) => pid === row.pid)) members.push([row.pid, row.start ?? null]);
      // A live owner (the same incarnation still running, or unknown) owns its launch: never ours to judge.
      const owner = row?.owner;
      const ownerNow = owner && Number.isSafeInteger(owner.pid) ? await startEvidence(owner.pid) : null;
      if (ownerNow === UNKNOWN || owner && typeof owner.start === 'string' && ownerNow === owner.start) {
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
      if (surviving || unknown) {
        counters.orphansObserved++;
        orphans.push({ launch: id, state: surviving ? 'surviving' : 'unknown', surviving, unknown, members: members.length });
        record({ kind: 'orphan-observed', launch: id, surviving, unknown });
      } else closed.push(id);
    }
    if (closed.length) try { ledger(all => { for (const id of closed) delete all[id]; }); } catch { /* observed again next attach */ }
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
    /** One owner per process: a second attach is refused. */
    async attach(options = {}) {
      if (attached) throw Error('resource owner already attached');
      ports = { compare: options.compare ?? plainCompare, priorityGate: options.priorityGate ?? null,
        reconcile: options.reconcile ?? null, now: options.now ?? (() => Date.now()), query: options.query ?? hostQuery,
        monotonic: options.monotonic ?? (() => performance.now()),
        signal: options.signal ?? ((target, name) => process.kill(target, name)) };
      // A desk-controlled low-ceiling case: the aggregate memory ceiling may be lowered, never raised.
      if (options.aggregateMemoryBytes !== undefined) {
        const bytes = options.aggregateMemoryBytes;
        if (!Number.isSafeInteger(bytes) || bytes < MIN_AGGREGATE_MEMORY_BYTES || bytes > ceilings.aggregate.memoryBytes)
          throw Error('resource owner: aggregate memory ceiling may only be lowered');
        ceilings = Object.freeze({ ...ceilings, aggregate: Object.freeze({ ...ceilings.aggregate, memoryBytes: bytes }) });
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
    observeInherited,
    snapshot,
  });
}

/** The single owner of this host process. */
export const hostResources = createResourceOwner();
